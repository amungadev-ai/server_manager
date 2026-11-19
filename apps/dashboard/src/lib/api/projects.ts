import type { z } from 'zod';
import { IdempotencyKeySchema, ResourceIdSchema } from '@cloudlane/contracts';
import {
  API_PREFIX,
  ApiErrorEnvelopeSchema,
  SessionResponseSchema,
  CreateProjectRequestSchema,
  CreateProjectResponseSchema,
  ProjectListResponseSchema,
  ProjectRecordSchema,
  PaginationQuerySchema,
  type CreateProjectRequest,
} from '@cloudlane/contracts/api';
import { InfrastructureError, readJson } from './http.ts';
export class ProjectMutationError extends InfrastructureError {
  readonly ambiguous: boolean;
  constructor(error: InfrastructureError, ambiguous: boolean) {
    super(error.message, error.code, error.status, error.requestId);
    this.ambiguous = ambiguous;
  }
}
/** Same-origin HTTPS only. Cookies remain HttpOnly; CSRF/retry keys stay in memory. */
export class HttpProjectApi {
  private readonly origin: string;
  private readonly controller = new AbortController();
  constructor(origin: string = globalThis.location?.origin ?? '') {
    const url = new URL(origin);
    if (
      url.protocol !== 'https:' ||
      url.origin !== origin ||
      (globalThis.location && globalThis.location.origin !== origin)
    )
      throw new Error('Projects require this site’s HTTPS address.');
    this.origin = origin;
  }
  dispose() {
    this.controller.abort();
  }
  private async request<T>(
    path: string,
    schema: z.ZodType<T>,
    body?: object,
    headers: Record<string, string> = {},
  ): Promise<T> {
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
          ...headers,
          ...(body === undefined
            ? {}
            : {
                'Content-Type': 'application/json',
                'X-Cloudlane-Request': 'owner-auth',
              }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch {
      throw new InfrastructureError(
        'The project API could not be reached.',
        'NETWORK_ERROR',
        0,
      );
    }
    const value = await readJson(response, signal);
    if (!response.ok) {
      const result = ApiErrorEnvelopeSchema.safeParse(value);
      if (!result.success)
        throw new InfrastructureError(
          'The project API returned an invalid response.',
          'INVALID_API_RESPONSE',
          response.status,
        );
      const { code, requestId } = result.data.error;
      const message =
        code === 'SESSION_REQUIRED'
          ? 'Sign in with your authenticator again to continue.'
          : code === 'CONFLICT'
            ? 'The project conflicts with an existing request, slug or workspace limit. Refresh your projects before starting a new request.'
            : code === 'FORBIDDEN'
              ? 'This request could not be verified. Reopen the secure Cloudlane address and sign in again.'
              : code === 'NOT_FOUND'
                ? 'This project is unavailable.'
                : code === 'VALIDATION_ERROR'
                  ? 'Check the project name or reload the project list.'
                  : code === 'RATE_LIMITED'
                    ? 'Too many attempts. Wait before trying again.'
                    : 'Project data is temporarily unavailable. Please try again.';
      throw new InfrastructureError(message, code, response.status, requestId);
    }
    const result = schema.safeParse(value);
    if (!result.success)
      throw new InfrastructureError(
        'The project response does not match the contract.',
        'INVALID_API_RESPONSE',
        response.status,
      );
    return result.data;
  }
  private async session() {
    const session = await this.request('/auth/session', SessionResponseSchema);
    if (
      !session.mfaVerified ||
      !session.authenticationMethod ||
      !session.csrfToken
    )
      throw new InfrastructureError(
        'A verified owner session is required.',
        'SESSION_REQUIRED',
        401,
      );
    return session;
  }
  async list(query: { limit?: number; cursor?: string } = {}) {
    const input = PaginationQuerySchema.parse(query),
      session = await this.session();
    const params = new URLSearchParams({ limit: String(input.limit) });
    if (input.cursor) params.set('cursor', input.cursor);
    const result = await this.request(
      '/projects?' + params.toString(),
      ProjectListResponseSchema,
    );
    if (
      result.items.some((p) => p.workspaceId !== session.workspace.id) ||
      new Set(result.items.map((p) => p.id)).size !== result.items.length
    )
      throw new InfrastructureError(
        'The project response has an invalid workspace scope.',
        'INVALID_API_RESPONSE',
        200,
      );
    return result;
  }
  async get(id: string) {
    ResourceIdSchema.parse(id);
    const session = await this.session();
    const project = await this.request('/projects/' + id, ProjectRecordSchema);
    if (project.workspaceId !== session.workspace.id || project.id !== id)
      throw new InfrastructureError(
        'The project response has an invalid scope.',
        'INVALID_API_RESPONSE',
        200,
      );
    return project;
  }
  async create(body: CreateProjectRequest, retryKey: string) {
    const input = CreateProjectRequestSchema.parse(body);
    IdempotencyKeySchema.parse(retryKey);
    const session = await this.session();
    try {
      const result = await this.request(
        '/projects',
        CreateProjectResponseSchema,
        input,
        { 'X-CSRF-Token': session.csrfToken!, 'Idempotency-Key': retryKey },
      );
      if (
        result.project.workspaceId !== session.workspace.id ||
        result.environment.projectId !== result.project.id
      )
        throw new InfrastructureError(
          'The create response has an invalid scope.',
          'INVALID_API_RESPONSE',
          201,
        );
      return result;
    } catch (error) {
      const cause =
        error instanceof InfrastructureError
          ? error
          : new InfrastructureError(
              'The create result could not be verified.',
              'NETWORK_ERROR',
              0,
            );
      throw new ProjectMutationError(
        cause,
        cause.status === 0 ||
          cause.status >= 500 ||
          cause.code === 'INVALID_API_RESPONSE',
      );
    }
  }
}
