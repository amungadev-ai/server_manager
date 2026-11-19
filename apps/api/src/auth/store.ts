import { randomUUID, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Pool, PoolClient, QueryResultRow } from 'pg';
import { ApiException } from '../common/errors';
import { opaque, verifier } from './policy';

type Action =
  | 'claim'
  | 'owner'
  | 'login'
  | 'rotate'
  | 'logout'
  | 'mfa_enroll'
  | 'mfa_verify'
  | 'recovery_use'
  | 'recovery_ack'
  | 'recovery_regenerate';
type Outcome<T> = { ok: true; value: T } | { ok: false };
const yes = <T>(value: T): Outcome<T> => ({ ok: true, value });
const no = (): Outcome<never> => ({ ok: false });
export interface SetupRecord extends QueryResultRow {
  id: string;
  installation_id: string;
  csrf_token: Buffer;
  generation: string;
}
export interface SessionRecord extends QueryResultRow {
  id: string;
  family_id: string;
  user_id: string;
  workspace_id: string;
  csrf_token: Buffer;
  email: string;
  display_name: string;
  workspace_name: string;
  authorization_expires_at: Date;
  absolute_expires_at: Date;
  rotated: boolean;
  mfa_epoch: string;
  mfa_verified_at: Date;
  authentication_method: 'totp' | 'recovery';
}
export interface LoginUser extends QueryResultRow {
  id: string;
  password_hash: string;
  disabled_at: Date | null;
}
export interface NewSession {
  credential: string;
  csrf: Buffer;
  row: SessionRecord;
}

export class AuthStore {
  constructor(readonly pool: Pool) {}

  async transaction<T>(
    operation: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect().catch(() => {
      throw new ApiException(503, 'API_UNAVAILABLE');
    });
    let destroy = false;
    try {
      await client.query('BEGIN');
      await client.query("SET LOCAL lock_timeout = '2s'");
      await client.query("SET LOCAL statement_timeout = '5s'");
      const result = await operation(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        destroy = true;
      }
      if (error instanceof ApiException) throw error;
      throw new ApiException(503, 'API_UNAVAILABLE');
    } finally {
      client.release(destroy);
    }
  }

  async audit(
    client: PoolClient,
    action: Action,
    requestId: string,
    allowed: boolean,
    userId: string | null = null,
  ): Promise<void> {
    await client.query(
      `INSERT INTO cloudlane.auth_audit (installation_id, user_id, request_id, action, outcome)
      SELECT id, $1, $2, $3, $4 FROM cloudlane.installations WHERE singleton`,
      [userId, requestId, action, allowed ? 'allowed' : 'denied'],
    );
  }

  async budget(
    purpose: 'claim' | 'owner' | 'login' | 'rotate' | 'mfa' | 'recovery',
    source: string,
    identity?: string,
  ): Promise<void> {
    const globalLimit = {
      claim: 20,
      owner: 10,
      login: 100,
      rotate: 60,
      mfa: 100,
      recovery: 60,
    }[purpose];
    const sourceLimit = {
      claim: 10,
      owner: 5,
      login: 30,
      rotate: 20,
      mfa: 50,
      recovery: 30,
    }[purpose];
    const buckets: [string, number, number][] = [
      ['global', globalLimit, 60],
      [`source:${source}`, sourceLimit, 600],
    ];
    if (identity !== undefined)
      buckets.push([`identity:${identity}`, purpose === 'mfa' ? 10 : 5, 900]);
    await this.pool.query(`DELETE FROM cloudlane.auth_rate_limits WHERE ctid IN
      (SELECT ctid FROM cloudlane.auth_rate_limits WHERE expires_at <= clock_timestamp() LIMIT 100)`);
    for (const [key, limit, seconds] of buckets) {
      const { rows } = await this.pool.query<{ attempts: number }>(
        `
        INSERT INTO cloudlane.auth_rate_limits (purpose, key_hash, attempts, expires_at)
        VALUES ($1, $2, 1, clock_timestamp() + $3 * interval '1 second')
        ON CONFLICT (purpose, key_hash) DO UPDATE SET
          attempts = CASE WHEN auth_rate_limits.expires_at <= clock_timestamp() THEN 1 ELSE LEAST(auth_rate_limits.attempts + 1, 1000000) END,
          expires_at = CASE WHEN auth_rate_limits.expires_at <= clock_timestamp() THEN clock_timestamp() + $3 * interval '1 second' ELSE auth_rate_limits.expires_at END
        RETURNING attempts`,
        [purpose, verifier('rate', key), seconds],
      );
      if (!rows[0] || rows[0].attempts > limit)
        throw new ApiException(429, 'RATE_LIMITED');
    }
  }

  async issueClaim(): Promise<string> {
    const secret = opaque();
    return this.transaction(async (client) => {
      const { rows } = await client.query<{
        id: string;
        state: string;
        owned: boolean;
      }>(`
        SELECT i.id, i.state, EXISTS (SELECT 1 FROM cloudlane.users u WHERE u.installation_id = i.id) AS owned
        FROM cloudlane.installations i WHERE singleton FOR UPDATE`);
      const installation = rows[0];
      if (
        !installation ||
        installation.owned ||
        !['unclaimed', 'setup_pending'].includes(installation.state)
      )
        throw new ApiException(409, 'CONFLICT');
      const code = `${installation.id}.${secret}`;
      await client.query(
        `INSERT INTO cloudlane.bootstrap_claims (installation_id, generation, verifier_hash, expires_at)
        VALUES ($1, 1, $2, clock_timestamp() + interval '20 minutes')
        ON CONFLICT (installation_id) DO UPDATE SET generation = bootstrap_claims.generation + 1,
          verifier_hash = EXCLUDED.verifier_hash, issued_at = clock_timestamp(), expires_at = EXCLUDED.expires_at,
          consumed_at = NULL, attempts = 0`,
        [installation.id, verifier('claim', code)],
      );
      await client.query(
        'UPDATE cloudlane.bootstrap_setups SET revoked_at = clock_timestamp() WHERE installation_id = $1 AND revoked_at IS NULL',
        [installation.id],
      );
      await client.query(
        "UPDATE cloudlane.installations SET state = 'unclaimed', updated_at = clock_timestamp() WHERE id = $1",
        [installation.id],
      );
      return code;
    });
  }

  async exchangeClaim(
    code: string,
    requestId: string,
  ): Promise<Outcome<{ credential: string; csrf: Buffer }>> {
    return this.transaction(async (client) => {
      const { rows: installations } = await client.query<{
        id: string;
        state: string;
      }>(
        'SELECT id, state FROM cloudlane.installations WHERE singleton FOR UPDATE',
      );
      const installation = installations[0];
      const { rows } = await client.query<{
        verifier_hash: Buffer;
        generation: string;
        valid: boolean;
      }>(
        `
        SELECT verifier_hash, generation, expires_at > clock_timestamp() AND consumed_at IS NULL AND attempts < 10 AS valid
        FROM cloudlane.bootstrap_claims WHERE installation_id = $1 FOR UPDATE`,
        [installation?.id],
      );
      const claim = rows[0],
        supplied = verifier('claim', code);
      if (
        !installation ||
        installation.state !== 'unclaimed' ||
        !claim?.valid ||
        !code.startsWith(installation.id + '.') ||
        !timingSafeEqual(claim.verifier_hash, supplied)
      ) {
        if (claim)
          await client.query(
            'UPDATE cloudlane.bootstrap_claims SET attempts = LEAST(attempts + 1, 10) WHERE installation_id = $1',
            [installation?.id],
          );
        await this.audit(client, 'claim', requestId, false);
        return no();
      }
      const credential = opaque(),
        csrf = randomBytes(32);
      await client.query(
        'UPDATE cloudlane.bootstrap_claims SET consumed_at = clock_timestamp() WHERE installation_id = $1',
        [installation.id],
      );
      await client.query(
        `INSERT INTO cloudlane.bootstrap_setups (installation_id, generation, verifier_hash, csrf_token, expires_at)
        VALUES ($1, $2, $3, $4, clock_timestamp() + interval '10 minutes')`,
        [
          installation.id,
          claim.generation,
          verifier('setup', credential),
          csrf,
        ],
      );
      await client.query(
        "UPDATE cloudlane.installations SET state = 'setup_pending', updated_at = clock_timestamp() WHERE id = $1",
        [installation.id],
      );
      await this.audit(client, 'claim', requestId, true);
      return yes({ credential, csrf });
    });
  }

  async setup(credential: string): Promise<SetupRecord | null> {
    const { rows } = await this.pool.query<SetupRecord>(
      `SELECT s.id, s.installation_id, s.generation, s.csrf_token
      FROM cloudlane.bootstrap_setups s JOIN cloudlane.bootstrap_claims c ON c.installation_id = s.installation_id AND c.generation = s.generation
      JOIN cloudlane.installations i ON i.id = s.installation_id
      WHERE s.verifier_hash = $1 AND s.expires_at > clock_timestamp() AND s.consumed_at IS NULL AND s.revoked_at IS NULL
        AND c.consumed_at IS NOT NULL AND i.state = 'setup_pending'`,
      [verifier('setup', credential)],
    );
    return rows[0] ?? null;
  }

  async createOwner(
    setupId: string,
    values: { email: string; displayName: string; passwordHash: string },
    requestId: string,
  ): Promise<boolean> {
    return this.transaction(async (client) => {
      const { rows: installations } = await client.query<{
        id: string;
        state: string;
        owned: boolean;
      }>(`
        SELECT i.id, i.state, EXISTS (SELECT 1 FROM cloudlane.users u WHERE u.installation_id = i.id) AS owned
        FROM cloudlane.installations i WHERE singleton FOR UPDATE`);
      const installation = installations[0];
      const { rows } = await client.query<SetupRecord>(
        `SELECT s.id, s.installation_id, s.generation, s.csrf_token FROM cloudlane.bootstrap_setups s
        JOIN cloudlane.bootstrap_claims c ON c.installation_id = s.installation_id AND c.generation = s.generation
        WHERE s.id = $1 AND s.expires_at > clock_timestamp() AND s.consumed_at IS NULL AND s.revoked_at IS NULL AND c.consumed_at IS NOT NULL FOR UPDATE OF s`,
        [setupId],
      );
      if (
        !installation ||
        installation.owned ||
        installation.state !== 'setup_pending' ||
        !rows[0] ||
        rows[0].installation_id !== installation.id
      ) {
        await this.audit(client, 'owner', requestId, false);
        return false;
      }
      const userId = randomUUID();
      await client.query(
        'INSERT INTO cloudlane.users (id, installation_id, email, display_name, password_hash) VALUES ($1, $2, $3, $4, $5)',
        [
          userId,
          installation.id,
          values.email,
          values.displayName,
          values.passwordHash,
        ],
      );
      await client.query(
        "INSERT INTO cloudlane.workspaces (installation_id, owner_user_id, name) VALUES ($1, $2, 'Cloudlane workspace')",
        [installation.id, userId],
      );
      await client.query(
        'UPDATE cloudlane.bootstrap_setups SET consumed_at = clock_timestamp() WHERE id = $1',
        [setupId],
      );
      await client.query(
        'UPDATE cloudlane.bootstrap_setups SET revoked_at = clock_timestamp() WHERE installation_id = $1 AND id <> $2 AND revoked_at IS NULL',
        [installation.id, setupId],
      );
      await client.query(
        "UPDATE cloudlane.installations SET state = 'active', updated_at = clock_timestamp() WHERE id = $1",
        [installation.id],
      );
      await this.audit(client, 'owner', requestId, true, userId);
      return true;
    });
  }

  async findUser(email: string): Promise<LoginUser | null> {
    const { rows } = await this.pool.query<LoginUser>(
      'SELECT id, password_hash, disabled_at FROM cloudlane.users WHERE lower(email) = $1',
      [email],
    );
    return rows[0] ?? null;
  }

  async insertSession(
    client: PoolClient,
    userId: string,
    workspaceId: string,
    familyId: string,
    proof: { epoch: string; verifiedAt: Date; method: 'totp' | 'recovery' },
    absolute?: Date,
  ): Promise<NewSession> {
    const credential = opaque(),
      csrf = randomBytes(32);
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO cloudlane.sessions
      (user_id, workspace_id, family_id, token_hash, csrf_token, idle_expires_at, absolute_expires_at, mfa_epoch, mfa_verified_at, authentication_method)
      VALUES ($1, $2, $3, $4, $5, LEAST(clock_timestamp() + interval '30 minutes', COALESCE($6::timestamptz, clock_timestamp() + interval '12 hours')),
        COALESCE($6::timestamptz, clock_timestamp() + interval '12 hours'), $7, $8, $9) RETURNING id`,
      [
        userId,
        workspaceId,
        familyId,
        verifier('session', credential),
        csrf,
        absolute ?? null,
        proof.epoch,
        proof.verifiedAt,
        proof.method,
      ],
    );
    const row = await this.lookup(credential, false, client);
    if (!rows[0] || !row) throw new ApiException(503, 'API_UNAVAILABLE');
    return { credential, csrf, row };
  }

  async lookup(
    credential: string,
    logout: boolean,
    connection: Pool | PoolClient = this.pool,
  ): Promise<SessionRecord | null> {
    const { rows } = await connection.query<SessionRecord>(
      `SELECT s.*, u.email, u.display_name, w.name AS workspace_name,
        s.revocation_reason = 'rotated' AS rotated,
        CASE WHEN $2 THEN s.absolute_expires_at ELSE LEAST(s.idle_expires_at, s.absolute_expires_at) END AS authorization_expires_at
      FROM cloudlane.sessions s JOIN cloudlane.session_families f ON f.id = s.family_id AND f.user_id = s.user_id AND f.workspace_id = s.workspace_id
      JOIN cloudlane.users u ON u.id = s.user_id JOIN cloudlane.workspaces w ON w.id = s.workspace_id AND w.owner_user_id = u.id
      JOIN cloudlane.installations i ON i.id = u.installation_id
      JOIN cloudlane.mfa_factors m ON m.user_id = u.id AND m.installation_id = i.id AND m.state = 'active' AND m.auth_epoch = s.mfa_epoch
      WHERE s.token_hash = $1 AND s.csrf_token IS NOT NULL AND s.absolute_expires_at > clock_timestamp()
        AND s.mfa_verified_at IS NOT NULL AND s.authentication_method IS NOT NULL
        AND f.revoked_at IS NULL AND u.disabled_at IS NULL AND u.role = 'owner' AND i.state = 'active'
        AND ((s.revoked_at IS NULL AND s.idle_expires_at > clock_timestamp()) OR ($2 AND s.revocation_reason = 'rotated'))`,
      [verifier('session', credential), logout],
    );
    return rows[0] ?? null;
  }

  async touch(session: SessionRecord): Promise<boolean> {
    if (session.rotated) return true; // Only the logout resolver can supply this record.
    const { rowCount } = await this.pool.query(
      `UPDATE cloudlane.sessions SET last_seen_at = clock_timestamp(),
      idle_expires_at = LEAST(clock_timestamp() + interval '30 minutes', absolute_expires_at)
      WHERE id = $1 AND revoked_at IS NULL AND idle_expires_at > clock_timestamp() AND absolute_expires_at > clock_timestamp()
        AND EXISTS (SELECT 1 FROM cloudlane.session_families f WHERE f.id = family_id AND f.revoked_at IS NULL)`,
      [session.id],
    );
    return rowCount === 1;
  }

  async revokeFamily(
    client: PoolClient,
    familyId: string,
    reason: 'login' | 'logout' | 'limit',
  ): Promise<void> {
    await client.query(
      'SELECT id FROM cloudlane.session_families WHERE id = $1 FOR UPDATE',
      [familyId],
    );
    await client.query(
      'UPDATE cloudlane.session_families SET revoked_at = clock_timestamp() WHERE id = $1 AND revoked_at IS NULL',
      [familyId],
    );
    await client.query(
      'UPDATE cloudlane.sessions SET revoked_at = clock_timestamp(), revocation_reason = $2 WHERE family_id = $1 AND revoked_at IS NULL',
      [familyId, reason],
    );
  }

  async rotate(
    session: SessionRecord,
    requestId: string,
  ): Promise<NewSession | null> {
    return this.transaction(async (client) => {
      const { rows: families } = await client.query(
        'SELECT id FROM cloudlane.session_families WHERE id = $1 AND revoked_at IS NULL FOR UPDATE',
        [session.family_id],
      );
      const { rows } = await client.query<{ absolute_expires_at: Date }>(
        `SELECT absolute_expires_at FROM cloudlane.sessions WHERE id = $1 AND revoked_at IS NULL
        AND idle_expires_at > clock_timestamp() AND absolute_expires_at > clock_timestamp() FOR UPDATE`,
        [session.id],
      );
      if (!families[0] || !rows[0]) return null;
      await client.query(
        "UPDATE cloudlane.sessions SET revoked_at = clock_timestamp(), revocation_reason = 'rotated' WHERE id = $1",
        [session.id],
      );
      const next = await this.insertSession(
        client,
        session.user_id,
        session.workspace_id,
        session.family_id,
        {
          epoch: session.mfa_epoch,
          verifiedAt: session.mfa_verified_at,
          method: session.authentication_method,
        },
        rows[0].absolute_expires_at,
      );
      await this.audit(client, 'rotate', requestId, true, session.user_id);
      return next;
    });
  }

  async logout(session: SessionRecord, requestId: string): Promise<void> {
    await this.transaction(async (client) => {
      await this.revokeFamily(client, session.family_id, 'logout');
      await this.audit(client, 'logout', requestId, true, session.user_id);
    });
  }

  async status(): Promise<{
    state: 'unclaimed' | 'setup_pending' | 'active';
    ownerConfigured: boolean;
    setupAvailable: boolean;
  }> {
    const { rows } = await this.pool.query<{
      state: string;
      owned: boolean;
      available: boolean;
    }>(`SELECT i.state,
      EXISTS (SELECT 1 FROM cloudlane.users u WHERE u.installation_id = i.id) AS owned,
      EXISTS (SELECT 1 FROM cloudlane.bootstrap_claims c WHERE c.installation_id = i.id AND c.expires_at > clock_timestamp() AND c.consumed_at IS NULL AND c.attempts < 10) AS available
      FROM cloudlane.installations i WHERE singleton`);
    const row = rows[0];
    if (!row || !['unclaimed', 'setup_pending', 'active'].includes(row.state))
      throw new ApiException(503, 'API_UNAVAILABLE');
    return {
      state: row.state as 'unclaimed' | 'setup_pending' | 'active',
      ownerConfigured: row.owned,
      setupAvailable: !row.owned && row.state === 'unclaimed' && row.available,
    };
  }
}
