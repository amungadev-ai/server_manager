import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import type { PoolClient, QueryResultRow } from 'pg';
import { ApiException } from '../common/errors';
import {
  AuthStore,
  type LoginUser,
  type NewSession,
  type SessionRecord,
} from './store';
import { MfaCrypto } from './mfa-crypto';
import { opaque, sameNonce, verifier } from './policy';

export interface NewChallenge {
  credential: string;
  csrf: Buffer;
  stage: 'mfa_setup_required' | 'mfa_required' | 'recovery_codes_required';
  expiresAt: Date;
}
export interface RecoveryBatch {
  challenge: NewChallenge;
  codes: string[];
}
export type ProofResult = RecoveryBatch | { session: NewSession };
interface Factor extends QueryResultRow {
  user_id: string;
  installation_id: string;
  state: string;
  encrypted_seed: Buffer;
  seed_nonce: Buffer;
  seed_tag: Buffer;
  last_used_step: string;
  auth_epoch: string;
  recovery_generation: string;
  pending_challenge_id: string | null;
  pending_expires_at: Date | null;
}
interface Challenge extends QueryResultRow {
  id: string;
  user_id: string;
  workspace_id: string;
  csrf_token: Buffer;
  password_fingerprint: Buffer;
  prior_session_hash: Buffer | null;
  factor_epoch: string;
  stage: NewChallenge['stage'];
  recovery_generation: string | null;
  proof_at: Date | null;
  expires_at: Date;
  valid: boolean;
}
interface CurrentUser extends LoginUser {
  installation_id: string;
  workspace_id: string;
  email: string;
}
interface Context {
  user: CurrentUser;
  factor: Factor;
  challenge: Challenge;
  now: Date;
}

/** Review-only state machine. Every factor mutation locks user -> factor -> challenge -> families. */
export class MfaStore {
  constructor(
    readonly auth: AuthStore,
    readonly crypto: MfaCrypto,
  ) {}
  private async user(
    client: PoolClient,
    id: string | null,
  ): Promise<CurrentUser | null> {
    const { rows } = await client.query<CurrentUser>(
      `SELECT u.*, w.id AS workspace_id
      FROM cloudlane.users u JOIN cloudlane.workspaces w ON w.owner_user_id = u.id
      JOIN cloudlane.installations i ON i.id = u.installation_id
      WHERE u.id = $1 AND u.role = 'owner' AND i.state = 'active'
      ORDER BY w.created_at, w.id LIMIT 1 FOR UPDATE OF u`,
      [id],
    );
    return rows[0] ?? null;
  }
  private async factor(client: PoolClient, userId: string): Promise<Factor> {
    const { rows } = await client.query<Factor>(
      'SELECT * FROM cloudlane.mfa_factors WHERE user_id = $1 FOR UPDATE',
      [userId],
    );
    if (!rows[0]) throw new ApiException(503, 'API_UNAVAILABLE');
    return rows[0];
  }
  private async challenge(
    client: PoolClient,
    user: CurrentUser,
    factor: Factor,
    prior: Buffer | null,
    stage: NewChallenge['stage'],
    proofAt: Date | null = null,
  ): Promise<NewChallenge> {
    const credential = opaque(),
      csrf = randomBytes(32);
    const { rows } = await client.query<{ expires_at: Date }>(
      `INSERT INTO cloudlane.auth_challenges
      (user_id, workspace_id, verifier_hash, csrf_token, password_fingerprint, prior_session_hash, factor_epoch, stage, recovery_generation, proof_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING expires_at`,
      [
        user.id,
        user.workspace_id,
        verifier('challenge', credential),
        csrf,
        verifier('password', user.password_hash),
        prior,
        factor.auth_epoch,
        stage,
        factor.recovery_generation,
        proofAt,
      ],
    );
    return { credential, csrf, stage, expiresAt: rows[0]!.expires_at };
  }
  private async revokeChallenges(
    client: PoolClient,
    userId: string,
  ): Promise<void> {
    await client.query(
      'UPDATE cloudlane.auth_challenges SET revoked_at = clock_timestamp() WHERE user_id = $1 AND revoked_at IS NULL AND consumed_at IS NULL',
      [userId],
    );
  }
  async beginLogin(
    snapshot: LoginUser | null,
    verified: boolean,
    priorCredential: string | null,
    requestId: string,
  ): Promise<NewChallenge | null> {
    return this.auth.transaction(async (client) => {
      const user = await this.user(client, snapshot?.id ?? null);
      if (
        !verified ||
        !snapshot ||
        !user ||
        user.disabled_at ||
        user.password_hash !== snapshot.password_hash
      ) {
        await this.auth.audit(client, 'login', requestId, false);
        return null;
      }
      await client.query(
        'INSERT INTO cloudlane.mfa_factors (user_id, installation_id) VALUES ($1,$2) ON CONFLICT (user_id) DO NOTHING',
        [user.id, user.installation_id],
      );
      const factor = await this.factor(client, user.id);
      await this.revokeChallenges(client, user.id);
      const challenge = await this.challenge(
        client,
        user,
        factor,
        priorCredential ? verifier('session', priorCredential) : null,
        factor.state === 'enrollment_required'
          ? 'mfa_setup_required'
          : 'mfa_required',
      );
      await this.auth.audit(client, 'login', requestId, true, user.id);
      return challenge;
    });
  }
  private async context(
    client: PoolClient,
    credential: string | null,
    csrf: unknown,
  ): Promise<Context | null> {
    if (!credential) return null;
    const hash = verifier('challenge', credential);
    const hint = await client.query<{ user_id: string }>(
      'SELECT user_id FROM cloudlane.auth_challenges WHERE verifier_hash = $1',
      [hash],
    );
    if (!hint.rows[0]) return null;
    const user = await this.user(client, hint.rows[0].user_id);
    if (!user || user.disabled_at) return null;
    const factor = await this.factor(client, user.id);
    const { rows } = await client.query<Challenge>(
      `SELECT *, expires_at > clock_timestamp() AND consumed_at IS NULL AND revoked_at IS NULL AND attempts < 5 AS valid
      FROM cloudlane.auth_challenges WHERE verifier_hash = $1 FOR UPDATE`,
      [hash],
    );
    const challenge = rows[0];
    if (
      !challenge?.valid ||
      challenge.factor_epoch !== factor.auth_epoch ||
      !timingSafeEqual(
        challenge.password_fingerprint,
        verifier('password', user.password_hash),
      )
    )
      return null;
    if (!sameNonce(challenge.csrf_token, csrf))
      throw new ApiException(403, 'FORBIDDEN');
    const time = await client.query<{ now: Date }>(
      'SELECT clock_timestamp() AS now',
    );
    return { user, factor, challenge, now: time.rows[0]!.now };
  }
  private async deny(
    client: PoolClient,
    ctx: Context | null,
    action: 'mfa_verify' | 'mfa_enroll' | 'recovery_use' | 'recovery_ack',
    requestId: string,
  ): Promise<null> {
    if (ctx)
      await client.query(
        'UPDATE cloudlane.auth_challenges SET attempts = LEAST(attempts + 1,5) WHERE id = $1',
        [ctx.challenge.id],
      );
    await this.auth.audit(
      client,
      action,
      requestId,
      false,
      ctx?.user.id ?? null,
    );
    return null; // Return, then commit the failed-attempt counter. Never throw inside this transaction.
  }
  async enroll(credential: string | null, csrf: unknown, requestId: string) {
    return this.auth.transaction(async (client) => {
      const ctx = await this.context(client, credential, csrf);
      if (
        !ctx ||
        ctx.challenge.stage !== 'mfa_setup_required' ||
        ctx.factor.state !== 'enrollment_required'
      )
        return this.deny(client, ctx, 'mfa_enroll', requestId);
      if (ctx.factor.pending_challenge_id === ctx.challenge.id)
        throw new ApiException(409, 'CONFLICT');
      const secret = this.crypto.generate();
      const sealed = this.crypto.seal(
        secret,
        ctx.user.installation_id,
        ctx.user.id,
      );
      await client.query(
        `UPDATE cloudlane.mfa_factors SET encrypted_seed=$2, seed_nonce=$3, seed_tag=$4,
        pending_challenge_id=$5, pending_expires_at=$6, last_used_step=-1 WHERE user_id=$1`,
        [
          ctx.user.id,
          sealed.ciphertext,
          sealed.nonce,
          sealed.tag,
          ctx.challenge.id,
          ctx.challenge.expires_at,
        ],
      );
      await this.auth.audit(client, 'mfa_enroll', requestId, true, ctx.user.id);
      return {
        secret: secret.base32,
        uri: this.crypto.uri(secret, ctx.user.email),
        expiresAt: ctx.challenge.expires_at.toISOString(),
      };
    });
  }
  private accepted(ctx: Context, token: string): number | null {
    if (!ctx.factor.encrypted_seed) return null;
    const secret = this.crypto.open(
      ctx.factor.encrypted_seed,
      ctx.factor.seed_nonce,
      ctx.factor.seed_tag,
      ctx.user.installation_id,
      ctx.user.id,
    );
    return this.crypto.acceptedStep(
      secret,
      token,
      ctx.now.getTime(),
      ctx.factor.last_used_step,
    );
  }
  private async recoveryBatch(
    client: PoolClient,
    ctx: Context,
    epochChange: boolean,
  ): Promise<RecoveryBatch> {
    const codes = Array.from({ length: 10 }, () =>
      randomBytes(16).toString('hex').match(/.{4}/g)!.join('-'),
    );
    const { rows } = await client.query<Factor>(
      `UPDATE cloudlane.mfa_factors SET state='pending_ack', recovery_generation=recovery_generation+1,
      auth_epoch=auth_epoch+$2, acknowledged_at=NULL, pending_challenge_id=NULL, pending_expires_at=NULL WHERE user_id=$1 RETURNING *`,
      [ctx.user.id, epochChange ? 1 : 0],
    );
    const factor = rows[0]!;
    await client.query(
      'DELETE FROM cloudlane.mfa_recovery_codes WHERE user_id=$1',
      [ctx.user.id],
    );
    for (const code of codes)
      await client.query(
        'INSERT INTO cloudlane.mfa_recovery_codes (user_id,generation,verifier_hash) VALUES ($1,$2,$3)',
        [
          ctx.user.id,
          factor.recovery_generation,
          verifier(
            `recovery:${ctx.user.id}:${factor.recovery_generation}`,
            code,
          ),
        ],
      );
    await this.revokeChallenges(client, ctx.user.id);
    return {
      codes,
      challenge: await this.challenge(
        client,
        ctx.user,
        factor,
        ctx.challenge.prior_session_hash,
        'recovery_codes_required',
        ctx.now,
      ),
    };
  }
  async verify(
    credential: string | null,
    csrf: unknown,
    token: string,
    enrollment: boolean,
    requestId: string,
  ): Promise<ProofResult | null> {
    return this.auth.transaction(async (client) => {
      const ctx = await this.context(client, credential, csrf);
      const expected = enrollment ? 'mfa_setup_required' : 'mfa_required';
      if (
        !ctx ||
        ctx.challenge.stage !== expected ||
        (enrollment &&
          (ctx.factor.state !== 'enrollment_required' ||
            ctx.factor.pending_challenge_id !== ctx.challenge.id ||
            !ctx.factor.pending_expires_at ||
            ctx.factor.pending_expires_at <= ctx.now))
      )
        return this.deny(client, ctx, 'mfa_verify', requestId);
      const step = this.accepted(ctx, token);
      if (step === null) return this.deny(client, ctx, 'mfa_verify', requestId);
      await client.query(
        'UPDATE cloudlane.mfa_factors SET last_used_step=$2 WHERE user_id=$1',
        [ctx.user.id, step],
      );
      await this.auth.audit(client, 'mfa_verify', requestId, true, ctx.user.id);
      if (ctx.factor.state !== 'active')
        return this.recoveryBatch(client, ctx, false);
      return { session: await this.finish(client, ctx, 'totp') };
    });
  }
  private async revokeSessions(
    client: PoolClient,
    userId: string,
  ): Promise<void> {
    const { rows } = await client.query<{ id: string }>(
      'SELECT id FROM cloudlane.session_families WHERE user_id=$1 AND revoked_at IS NULL ORDER BY id',
      [userId],
    );
    for (const family of rows)
      await this.auth.revokeFamily(client, family.id, 'login');
  }
  private async finish(
    client: PoolClient,
    ctx: Context,
    method: 'totp' | 'recovery',
  ): Promise<NewSession> {
    if (ctx.challenge.prior_session_hash) {
      const { rows } = await client.query<{ family_id: string }>(
        'SELECT family_id FROM cloudlane.sessions WHERE token_hash=$1 AND user_id=$2 AND family_id IS NOT NULL',
        [ctx.challenge.prior_session_hash, ctx.user.id],
      );
      if (rows[0])
        await this.auth.revokeFamily(client, rows[0].family_id, 'login');
    }
    const old = await client.query<{ id: string }>(
      'SELECT id FROM cloudlane.session_families WHERE user_id=$1 AND revoked_at IS NULL ORDER BY created_at DESC,id DESC OFFSET 9',
      [ctx.user.id],
    );
    for (const family of old.rows)
      await this.auth.revokeFamily(client, family.id, 'limit');
    const family = randomUUID();
    await client.query(
      'INSERT INTO cloudlane.session_families (id,user_id,workspace_id) VALUES ($1,$2,$3)',
      [family, ctx.user.id, ctx.user.workspace_id],
    );
    await client.query(
      'UPDATE cloudlane.auth_challenges SET consumed_at=clock_timestamp() WHERE id=$1',
      [ctx.challenge.id],
    );
    return this.auth.insertSession(
      client,
      ctx.user.id,
      ctx.user.workspace_id,
      family,
      {
        epoch: ctx.factor.auth_epoch,
        verifiedAt: ctx.challenge.proof_at ?? ctx.now,
        method,
      },
    );
  }
  async acknowledge(
    credential: string | null,
    csrf: unknown,
    requestId: string,
  ): Promise<NewSession | null> {
    return this.auth.transaction(async (client) => {
      const ctx = await this.context(client, credential, csrf);
      if (
        !ctx ||
        ctx.challenge.stage !== 'recovery_codes_required' ||
        ctx.factor.state !== 'pending_ack' ||
        ctx.challenge.recovery_generation !== ctx.factor.recovery_generation ||
        !ctx.challenge.proof_at
      )
        return this.deny(client, ctx, 'recovery_ack', requestId);
      await client.query(
        "UPDATE cloudlane.mfa_factors SET state='active', acknowledged_at=clock_timestamp() WHERE user_id=$1",
        [ctx.user.id],
      );
      await this.auth.audit(
        client,
        'recovery_ack',
        requestId,
        true,
        ctx.user.id,
      );
      return this.finish(client, ctx, 'totp');
    });
  }
  async recover(
    credential: string | null,
    csrf: unknown,
    code: string,
    requestId: string,
  ): Promise<NewSession | null> {
    return this.auth.transaction(async (client) => {
      const ctx = await this.context(client, credential, csrf);
      if (
        !ctx ||
        ctx.challenge.stage !== 'mfa_required' ||
        ctx.factor.state !== 'active'
      )
        return this.deny(client, ctx, 'recovery_use', requestId);
      const { rowCount } = await client.query(
        `UPDATE cloudlane.mfa_recovery_codes SET consumed_at=clock_timestamp()
        WHERE user_id=$1 AND generation=$2 AND verifier_hash=$3 AND consumed_at IS NULL`,
        [
          ctx.user.id,
          ctx.factor.recovery_generation,
          verifier(
            `recovery:${ctx.user.id}:${ctx.factor.recovery_generation}`,
            code.toLowerCase(),
          ),
        ],
      );
      if (rowCount !== 1)
        return this.deny(client, ctx, 'recovery_use', requestId);
      const { rows } = await client.query<Factor>(
        'UPDATE cloudlane.mfa_factors SET auth_epoch=auth_epoch+1 WHERE user_id=$1 RETURNING *',
        [ctx.user.id],
      );
      ctx.factor = rows[0]!;
      await this.revokeSessions(client, ctx.user.id);
      await this.revokeChallenges(client, ctx.user.id);
      await this.auth.audit(
        client,
        'recovery_use',
        requestId,
        true,
        ctx.user.id,
      );
      return this.finish(client, ctx, 'recovery');
    });
  }
  async regenerate(
    session: SessionRecord,
    snapshot: LoginUser | null,
    passwordVerified: boolean,
    token: string,
    requestId: string,
  ): Promise<RecoveryBatch | null> {
    return this.auth.transaction(async (client) => {
      const user = await this.user(client, session.user_id);
      if (
        !user ||
        user.disabled_at ||
        !snapshot ||
        !passwordVerified ||
        user.password_hash !== snapshot.password_hash
      ) {
        await this.auth.audit(
          client,
          'recovery_regenerate',
          requestId,
          false,
          user?.id ?? null,
        );
        return null;
      }
      const factor = await this.factor(client, user.id);
      const { rows: families } = await client.query(
        'SELECT id FROM cloudlane.session_families WHERE id=$1 AND revoked_at IS NULL FOR UPDATE',
        [session.family_id],
      );
      const current = await client.query(
        'SELECT id FROM cloudlane.sessions WHERE id=$1 AND revoked_at IS NULL AND idle_expires_at>clock_timestamp() AND absolute_expires_at>clock_timestamp()',
        [session.id],
      );
      if (
        !families[0] ||
        !current.rows[0] ||
        factor.state !== 'active' ||
        factor.auth_epoch !== session.mfa_epoch
      )
        return null;
      const { rows: time } = await client.query<{ now: Date }>(
        'SELECT clock_timestamp() AS now',
      );
      const ctx: Context = {
        user,
        factor,
        now: time[0]!.now,
        challenge: { prior_session_hash: null } as Challenge,
      };
      const step = this.accepted(ctx, token);
      if (step === null) {
        await this.auth.audit(
          client,
          'recovery_regenerate',
          requestId,
          false,
          user.id,
        );
        return null;
      }
      await client.query(
        'UPDATE cloudlane.mfa_factors SET last_used_step=$2 WHERE user_id=$1',
        [user.id, step],
      );
      await this.revokeSessions(client, user.id);
      const batch = await this.recoveryBatch(client, ctx, true);
      await this.auth.audit(
        client,
        'recovery_regenerate',
        requestId,
        true,
        user.id,
      );
      return batch;
    });
  }
}
