import type { Request, Response } from 'express';
import type { Pool } from 'pg';
import {
  SessionResponseSchema,
  BootstrapResponseSchema,
  LogoutResponseSchema,
} from '@cloudlane/contracts/api';
import { OwnerSessionResolver } from '../common/authorization';
import { ApiException } from '../common/errors';
import { AuthStore, type SessionRecord } from './store';
import { Passwords } from './passwords';
import {
  AuthBoundary,
  CSRF_HEADER,
  SESSION_COOKIE,
  SETUP_COOKIE,
  clearCredential,
  readCredential,
  sameNonce,
  setCredential,
} from './policy';

const invalid = (): never => {
  throw new ApiException(401, 'AUTHENTICATION_FAILED');
};
export class OwnerAuthReview extends OwnerSessionResolver {
  readonly store: AuthStore;
  readonly boundary: AuthBoundary;
  readonly passwords = new Passwords();
  private readonly sessions = new WeakMap<Request, SessionRecord>();

  constructor(pool: Pool, panelOrigin: string) {
    super();
    this.store = new AuthStore(pool);
    this.boundary = new AuthBoundary(panelOrigin);
  }
  async prepare(): Promise<void> {
    await this.passwords.prepare();
  }
  private async run<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (error instanceof ApiException) throw error;
      throw new ApiException(503, 'API_UNAVAILABLE');
    }
  }
  private requestId(response: Response): string {
    return String(response.getHeader('X-Request-Id'));
  }
  private source(request: Request): string {
    return request.socket.remoteAddress ?? 'unknown';
  }
  private sessionRecord(request: Request): SessionRecord {
    const record = this.sessions.get(request);
    if (!record) throw new ApiException(401, 'SESSION_REQUIRED');
    return record;
  }
  private view(session: SessionRecord) {
    return SessionResponseSchema.parse({
      authenticated: true,
      user: {
        id: session.user_id,
        email: session.email,
        displayName: session.display_name,
        role: 'owner',
      },
      workspace: { id: session.workspace_id, name: session.workspace_name },
      csrfToken: session.csrf_token.toString('base64url'),
    });
  }
  async resolve(request: Request): Promise<unknown> {
    this.sessions.delete(request);
    this.boundary.assert(request);
    const credential = readCredential(request, SESSION_COOKIE);
    if (!credential) return null;
    const logout =
      request.method === 'POST' && request.path === '/api/v1/auth/logout';
    return this.run(async () => {
      const row = await this.store.lookup(credential, logout);
      if (!row) return null;
      if (
        !['GET', 'HEAD', 'OPTIONS'].includes(request.method) &&
        !sameNonce(row.csrf_token, request.headers[CSRF_HEADER])
      )
        throw new ApiException(403, 'FORBIDDEN');
      // Logout must still revoke its family if a rotation wins between lookup
      // and a last-seen update. It never needs to extend the idle lifetime.
      if (!logout && !(await this.store.touch(row))) return null;
      this.sessions.set(request, row);
      return {
        actorType: 'human',
        role: 'owner',
        userId: row.user_id,
        workspaceId: row.workspace_id,
        sessionId: row.id,
        expiresAt: row.authorization_expires_at.toISOString(),
        revoked: false,
      };
    });
  }
  session(request: Request) {
    return this.view(this.sessionRecord(request));
  }

  async claim(request: Request, response: Response, body: { code: string }) {
    return this.run(async () => {
      await this.store.budget('claim', this.source(request));
      const result = await this.store.exchangeClaim(
        body.code,
        this.requestId(response),
      );
      if (!result.ok) return invalid();
      setCredential(response, SETUP_COOKIE, result.value.credential, 600);
      return BootstrapResponseSchema.parse({
        state: 'owner_setup_required',
        csrfToken: result.value.csrf.toString('base64url'),
      });
    });
  }
  async owner(
    request: Request,
    response: Response,
    body: { email: string; displayName: string; password: string },
  ) {
    return this.run(async () => {
      await this.store.budget('owner', this.source(request));
      const credential = readCredential(request, SETUP_COOKIE);
      const setup = credential ? await this.store.setup(credential) : null;
      if (!setup) return invalid();
      if (!sameNonce(setup.csrf_token, request.headers[CSRF_HEADER]))
        throw new ApiException(403, 'FORBIDDEN');
      const passwordHash = await this.passwords.hash(body.password);
      if (
        !(await this.store.createOwner(
          setup.id,
          {
            email: body.email.toLowerCase(),
            displayName: body.displayName,
            passwordHash,
          },
          this.requestId(response),
        ))
      )
        return invalid();
      clearCredential(response, SETUP_COOKIE);
      return BootstrapResponseSchema.parse({ state: 'mfa_setup_required' });
    });
  }
  async login(
    request: Request,
    response: Response,
    body: { email: string; password: string },
  ) {
    return this.run(async () => {
      const email = body.email.toLowerCase();
      await this.store.budget('login', this.source(request), email);
      const user = await this.store.findUser(email);
      const verified = await this.passwords.verify(
        user?.password_hash ?? null,
        body.password,
      );
      const session = await this.store.login(
        user,
        verified,
        readCredential(request, SESSION_COOKIE),
        this.requestId(response),
      );
      if (!session) return invalid();
      setCredential(response, SESSION_COOKIE, session.credential, 43200);
      return this.view(session.row);
    });
  }
  async rotate(request: Request, response: Response) {
    return this.run(async () => {
      await this.store.budget('rotate', this.source(request));
      const session = await this.store.rotate(
        this.sessionRecord(request),
        this.requestId(response),
      );
      if (!session) throw new ApiException(401, 'SESSION_REQUIRED');
      const remaining = Math.max(
        1,
        Math.floor(
          (session.row.absolute_expires_at.getTime() - Date.now()) / 1000,
        ),
      );
      setCredential(response, SESSION_COOKIE, session.credential, remaining);
      return this.view(session.row);
    });
  }
  async logout(request: Request, response: Response) {
    return this.run(async () => {
      await this.store.logout(
        this.sessionRecord(request),
        this.requestId(response),
      );
      clearCredential(response, SESSION_COOKIE);
      return LogoutResponseSchema.parse({ signedOut: true });
    });
  }
}
