import type { z } from 'zod';
import {
  API_PREFIX,
  ApiErrorEnvelopeSchema,
  InstallationStatusSchema,
  BootstrapResponseSchema,
  AuthChallengeResponseSchema,
  MfaEnrollmentResponseSchema,
  MfaProofResponseSchema,
  SessionResponseSchema,
  RecoveryCodesResponseSchema,
  LogoutResponseSchema,
} from '@cloudlane/contracts/api';
import { InfrastructureError, readJson } from './http.ts';

/** CSRF lives only in this flow object. Credential cookies remain HttpOnly. */
export class AuthClient {
  private csrf = '';
  private readonly controller = new AbortController();
  private readonly origin: string;
  constructor(origin: string = globalThis.location?.origin ?? '') {
    const parsed = new URL(origin);
    if (
      parsed.protocol !== 'https:' ||
      parsed.origin !== origin ||
      (globalThis.location && globalThis.location.origin !== origin)
    )
      throw new Error(
        'Owner authentication requires this site’s HTTPS origin.',
      );
    this.origin = origin;
  }
  clear() {
    this.csrf = '';
  }
  dispose() {
    this.clear();
    this.controller.abort();
  }
  private async request<T>(
    path: string,
    schema: z.ZodType<T>,
    body?: object,
  ): Promise<T> {
    if (!/^\/(?:auth|bootstrap|installation)\/[a-z/]+$/.test(path))
      throw new Error('Invalid authentication path.');
    const signal = AbortSignal.any([
      this.controller.signal,
      AbortSignal.timeout(12000),
    ]);
    let response: Response;
    try {
      response = await fetch(`${this.origin}${API_PREFIX}${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        credentials: 'include',
        redirect: 'error',
        cache: 'no-store',
        signal,
        headers: {
          Accept: 'application/json',
          ...(body === undefined
            ? {}
            : {
                'Content-Type': 'application/json',
                'X-Cloudlane-Request': 'owner-auth',
                ...(this.csrf ? { 'X-CSRF-Token': this.csrf } : {}),
              }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch {
      throw new InfrastructureError(
        'The authentication API could not be reached. Please try again.',
        'NETWORK_ERROR',
        0,
      );
    }
    const value = await readJson(response, signal);
    if (!response.ok) {
      const error = ApiErrorEnvelopeSchema.safeParse(value);
      if (!error.success)
        throw new InfrastructureError(
          'The authentication API returned an invalid response.',
          'INVALID_API_RESPONSE',
          response.status,
        );
      const { code, requestId } = error.data.error;
      const message =
        code === 'RATE_LIMITED'
          ? 'Too many attempts. Wait before trying again.'
          : code === 'AUTHENTICATION_FAILED'
            ? 'Verification failed or the challenge expired. Check your details, or start again.'
            : code === 'SESSION_REQUIRED'
              ? 'Sign in again to continue.'
              : code === 'FORBIDDEN'
                ? 'This request could not be verified. Start again on the secure Cloudlane address.'
                : code === 'NOT_IMPLEMENTED' || code === 'API_UNAVAILABLE'
                  ? 'Owner authentication is unavailable on this installation.'
                  : code === 'CONFLICT'
                    ? 'This setup step has already been used. Start again to continue.'
                    : 'The request could not be completed. Check your details and try again.';
      throw new InfrastructureError(message, code, response.status, requestId);
    }
    const result = schema.safeParse(value);
    if (!result.success)
      throw new InfrastructureError(
        'The authentication response does not match the contract.',
        'INVALID_API_RESPONSE',
        response.status,
      );
    if (
      typeof result.data === 'object' &&
      result.data &&
      'csrfToken' in result.data &&
      typeof result.data.csrfToken === 'string'
    )
      this.csrf = result.data.csrfToken;
    return result.data;
  }
  status() {
    return this.request('/installation/status', InstallationStatusSchema);
  }
  claim(code: string) {
    return this.request('/bootstrap/claim', BootstrapResponseSchema, { code });
  }
  createOwner(email: string, displayName: string, password: string) {
    return this.request('/bootstrap/owner', BootstrapResponseSchema, {
      email,
      displayName,
      password,
    });
  }
  login(email: string, password: string) {
    this.clear();
    return this.request('/auth/login', AuthChallengeResponseSchema, {
      email,
      password,
    });
  }
  enroll() {
    return this.request('/auth/mfa/enroll', MfaEnrollmentResponseSchema, {});
  }
  verify(code: string, enrollment: boolean) {
    return this.request(
      enrollment ? '/auth/mfa/confirm' : '/auth/mfa/verify',
      MfaProofResponseSchema,
      { code },
    );
  }
  recover(code: string) {
    return this.request('/auth/recovery/use', SessionResponseSchema, { code });
  }
  acknowledge() {
    return this.request('/auth/recovery/acknowledge', SessionResponseSchema, {
      acknowledged: true,
    });
  }
  regenerate(password: string, code: string) {
    return this.request(
      '/auth/recovery/regenerate',
      RecoveryCodesResponseSchema,
      { password, code },
    );
  }
  async session() {
    const session = await this.request('/auth/session', SessionResponseSchema);
    if (!session.mfaVerified)
      throw new InfrastructureError(
        'A verified owner session is required.',
        'SESSION_REQUIRED',
        401,
      );
    return session;
  }
  async logout() {
    try {
      return await this.request('/auth/logout', LogoutResponseSchema, {});
    } finally {
      this.clear();
    }
  }
}
