import {
  ApiErrorEnvelopeSchema,
  API_PREFIX,
  OverviewResponseSchema,
  SessionResponseSchema,
} from '@cloudlane/contracts/api';
import type { paths } from '@cloudlane/contracts/client-types';
import type {
  InfrastructureApi,
  InfrastructureSnapshot,
} from '@cloudlane/contracts/preview';

type SessionResponse =
  paths['/api/v1/auth/session']['get']['responses'][200]['content']['application/json'];
type OverviewResponse =
  paths['/api/v1/overview']['get']['responses'][200]['content']['application/json'];
type RuntimeSchema<T> = {
  safeParse(value: unknown): { success: true; data: T } | { success: false };
};
const RESPONSE_LIMIT = 1024 * 1024;

export class InfrastructureError extends Error {
  readonly code: string;
  readonly status: number;
  readonly requestId?: string;
  constructor(
    message: string,
    code: string,
    status: number,
    requestId?: string,
  ) {
    super(message);
    this.code = code;
    this.status = status;
    this.requestId = requestId;
  }
}
export async function readJson(
  response: Response,
  signal?: AbortSignal,
): Promise<unknown> {
  const invalid = () =>
    new InfrastructureError(
      'The API returned an invalid response.',
      'INVALID_API_RESPONSE',
      response.status,
    );
  if (
    !response.headers
      .get('content-type')
      ?.split(';')[0]
      ?.trim()
      .match(/^application\/(?:[a-z0-9.-]+\+)?json$/i)
  )
    throw invalid();
  if (Number(response.headers.get('content-length') ?? 0) > RESPONSE_LIMIT)
    throw invalid();
  const reader = response.body?.getReader();
  if (!reader) throw invalid();
  let length = 0;
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      signal?.throwIfAborted();
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > RESPONSE_LIMIT) {
        await reader.cancel();
        throw invalid();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw invalid();
  }
}
export class HttpInfrastructureApi implements InfrastructureApi {
  readonly mode = 'http' as const;
  async getSnapshot(signal?: AbortSignal): Promise<InfrastructureSnapshot> {
    // Generated OpenAPI types and the runtime schema must agree at compile time.
    const session: SessionResponse = await this.get(
      '/auth/session',
      SessionResponseSchema,
      signal,
    );
    if (!session.authenticated)
      throw new InfrastructureError(
        'Sign in required.',
        'SESSION_REQUIRED',
        401,
      );
    const snapshot: OverviewResponse = await this.get(
      '/overview',
      OverviewResponseSchema,
      signal,
    );
    return snapshot;
  }
  private async get<T>(
    path: '/auth/session' | '/overview',
    schema: RuntimeSchema<T>,
    signal?: AbortSignal,
  ): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${API_PREFIX}${path}`, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
        signal,
      });
    } catch (error) {
      if (signal?.aborted) throw error;
      throw new InfrastructureError(
        'The Cloudlane API could not be reached.',
        'NETWORK_ERROR',
        0,
      );
    }
    const body = await readJson(response, signal);
    if (!response.ok) {
      const result = ApiErrorEnvelopeSchema.safeParse(body);
      if (!result.success)
        throw new InfrastructureError(
          'The API returned an invalid error response.',
          'INVALID_API_RESPONSE',
          response.status,
        );
      const { code, message, requestId } = result.data.error;
      throw new InfrastructureError(message, code, response.status, requestId);
    }
    const result = schema.safeParse(body);
    if (!result.success)
      throw new InfrastructureError(
        'The API response does not match the contract.',
        'INVALID_API_RESPONSE',
        response.status,
      );
    return result.data;
  }
}
