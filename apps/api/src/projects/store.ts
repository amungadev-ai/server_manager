import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import type { PoolClient, QueryResultRow } from 'pg';
import {
  CreateProjectResponseSchema,
  ProjectListResponseSchema,
  ProjectRecordSchema,
  OverviewResponseSchema,
  type CreateProjectRequest,
} from '@cloudlane/contracts/api';
import type { OwnerContext } from '../common/authorization';
import { ApiException } from '../common/errors';
import { AuthStore } from '../auth/store';
import { projectCursor, readProjectCursor } from './cursor';

interface ProjectRow extends QueryResultRow {
  id: string;
  workspace_id: string;
  name: string;
  slug: string;
  description: string;
  created_at: Date;
  updated_at: Date;
}
const fields = (p: ProjectRow) =>
  ProjectRecordSchema.parse({
    id: p.id,
    workspaceId: p.workspace_id,
    name: p.name,
    slug: p.slug,
    description: p.description,
    createdAt: p.created_at.toISOString(),
    updatedAt: p.updated_at.toISOString(),
  });
const projectDate = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Africa/Nairobi',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const sessionRequired = (): never => {
  throw new ApiException(401, 'SESSION_REQUIRED');
};
export const PROJECT_STORE = Symbol('cloudlane.project-review');
export class ProjectStore {
  constructor(readonly auth: AuthStore) {}
  private async authority(
    client: PoolClient,
    ctx: OwnerContext,
  ): Promise<void> {
    await client.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
    await client.query(
      'SELECT i.id FROM cloudlane.installations i JOIN cloudlane.users u ON u.installation_id=i.id WHERE u.id=$1 FOR SHARE OF i',
      [ctx.userId],
    );
    // Order also used by MFA/recovery; family-only rotation/logout never locks users/factors.
    const user = await client.query(
      'SELECT id FROM cloudlane.users WHERE id=$1 FOR UPDATE',
      [ctx.userId],
    );
    if (!user.rows[0]) sessionRequired();
    await client.query(
      'SELECT user_id FROM cloudlane.mfa_factors WHERE user_id=$1 FOR UPDATE',
      [ctx.userId],
    );
    const family = await client.query<{ family_id: string }>(
      'SELECT family_id FROM cloudlane.sessions WHERE id=$1 AND user_id=$2 AND workspace_id=$3',
      [ctx.sessionId, ctx.userId, ctx.workspaceId],
    );
    if (!family.rows[0]?.family_id) sessionRequired();
    await client.query(
      'SELECT id FROM cloudlane.session_families WHERE id=$1 FOR UPDATE',
      [family.rows[0]!.family_id],
    );
    await client.query(
      'SELECT id FROM cloudlane.sessions WHERE id=$1 FOR UPDATE',
      [ctx.sessionId],
    );
    await client.query(
      'SELECT id FROM cloudlane.workspaces WHERE id=$1 AND owner_user_id=$2 FOR UPDATE',
      [ctx.workspaceId, ctx.userId],
    );
    const valid = await client.query(
      `SELECT s.id FROM cloudlane.sessions s
      JOIN cloudlane.session_families f ON f.id=s.family_id AND f.user_id=s.user_id AND f.workspace_id=s.workspace_id
      JOIN cloudlane.users u ON u.id=s.user_id JOIN cloudlane.workspaces w ON w.id=s.workspace_id AND w.owner_user_id=u.id
      JOIN cloudlane.installations i ON i.id=u.installation_id AND i.id=w.installation_id
      JOIN cloudlane.mfa_factors m ON m.user_id=u.id AND m.installation_id=i.id AND m.state='active' AND m.auth_epoch=s.mfa_epoch
      WHERE s.id=$1 AND u.id=$2 AND w.id=$3 AND s.revoked_at IS NULL AND f.revoked_at IS NULL
      AND s.csrf_token IS NOT NULL AND s.mfa_verified_at IS NOT NULL AND s.authentication_method IS NOT NULL
      AND s.idle_expires_at>clock_timestamp() AND s.absolute_expires_at>clock_timestamp()
      AND u.disabled_at IS NULL AND u.role='owner' AND i.state='active'`,
      [ctx.sessionId, ctx.userId, ctx.workspaceId],
    );
    if (!valid.rows[0]) sessionRequired();
  }
  private async created(
    client: PoolClient,
    workspaceId: string,
    projectId: string,
  ) {
    const { rows } = await client.query<
      ProjectRow & { environment_id: string }
    >(
      `SELECT p.*, e.id AS environment_id FROM cloudlane.projects p
      JOIN cloudlane.environments e ON e.project_id=p.id AND e.workspace_id=p.workspace_id AND e.name='production'
      WHERE p.workspace_id=$1 AND p.id=$2`,
      [workspaceId, projectId],
    );
    const row = rows[0];
    if (!row) throw new ApiException(503, 'API_UNAVAILABLE');
    return CreateProjectResponseSchema.parse({
      project: fields(row),
      environment: {
        id: row.environment_id,
        projectId: row.id,
        name: 'production',
      },
    });
  }
  async create(
    ctx: OwnerContext,
    body: CreateProjectRequest,
    key: string,
    requestId: string,
  ) {
    const normalized = {
      name: body.name,
      slug: body.slug ?? null,
      description: body.description ?? '',
    };
    const hash = createHash('sha256')
      .update(JSON.stringify(normalized))
      .digest();
    return this.auth.transaction(async (client) => {
      await this.authority(client, ctx);
      const prior = await client.query<{
        request_hash: Buffer;
        project_id: string;
      }>(
        `SELECT request_hash, project_id FROM cloudlane.project_create_requests WHERE workspace_id=$1 AND user_id=$2 AND retry_key=$3`,
        [ctx.workspaceId, ctx.userId, key],
      );
      let id = prior.rows[0]?.project_id;
      if (id && !timingSafeEqual(prior.rows[0]!.request_hash, hash))
        throw new ApiException(409, 'CONFLICT');
      if (!id) {
        const count = await client.query<{ n: number }>(
          'SELECT count(*)::integer AS n FROM cloudlane.projects WHERE workspace_id=$1',
          [ctx.workspaceId],
        );
        if (count.rows[0]!.n >= 1000) throw new ApiException(409, 'CONFLICT');
        id = randomUUID();
        const stem =
          body.name
            .normalize('NFKD')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 50)
            .replace(/-+$/g, '') || 'project';
        const slug =
          body.slug ?? `${stem}-${randomUUID().replace(/-/g, '').slice(0, 12)}`;
        try {
          await client.query(
            'INSERT INTO cloudlane.projects (id,workspace_id,name,slug,description) VALUES ($1,$2,$3,$4,$5)',
            [id, ctx.workspaceId, body.name, slug, normalized.description],
          );
        } catch (error) {
          if (
            typeof error === 'object' &&
            error &&
            'code' in error &&
            error.code === '23505' &&
            'constraint' in error &&
            error.constraint === 'projects_workspace_id_slug_key'
          )
            throw new ApiException(409, 'CONFLICT');
          throw error;
        }
        await client.query(
          "INSERT INTO cloudlane.environments (workspace_id,project_id,name) VALUES ($1,$2,'production')",
          [ctx.workspaceId, id],
        );
        await client.query(
          'INSERT INTO cloudlane.project_create_requests (workspace_id,user_id,retry_key,request_hash,project_id) VALUES ($1,$2,$3,$4,$5)',
          [ctx.workspaceId, ctx.userId, key, hash, id],
        );
      }
      await client.query(
        'INSERT INTO cloudlane.project_audit (workspace_id,user_id,project_id,request_id,action) VALUES ($1,$2,$3,$4,$5)',
        [
          ctx.workspaceId,
          ctx.userId,
          id,
          requestId,
          prior.rows[0] ? 'replayed' : 'created',
        ],
      );
      return this.created(client, ctx.workspaceId, id);
    });
  }
  async list(ctx: OwnerContext, query: { limit: number; cursor?: string }) {
    return this.auth.transaction(async (client) => {
      await this.authority(client, ctx);
      const anchor = readProjectCursor(query.cursor, ctx.workspaceId);
      if (anchor) {
        const exists = await client.query(
          'SELECT id FROM cloudlane.projects WHERE workspace_id=$1 AND id=$2',
          [ctx.workspaceId, anchor],
        );
        if (!exists.rows[0]) throw new ApiException(400, 'VALIDATION_ERROR');
      }
      const { rows } = await client.query<ProjectRow>(
        `SELECT p.* FROM cloudlane.projects p WHERE p.workspace_id=$1
        AND ($2::uuid IS NULL OR (p.created_at,p.id) > (SELECT a.created_at,a.id FROM cloudlane.projects a WHERE a.workspace_id=$1 AND a.id=$2))
        ORDER BY p.created_at,p.id LIMIT $3`,
        [ctx.workspaceId, anchor, query.limit + 1],
      );
      const page = rows.slice(0, query.limit),
        last = page.at(-1);
      return ProjectListResponseSchema.parse({
        items: page.map(fields),
        nextCursor:
          rows.length > query.limit && last
            ? projectCursor(ctx.workspaceId, last.id)
            : null,
      });
    });
  }
  async get(ctx: OwnerContext, id: string) {
    return this.auth.transaction(async (client) => {
      await this.authority(client, ctx);
      const { rows } = await client.query<ProjectRow>(
        'SELECT * FROM cloudlane.projects WHERE workspace_id=$1 AND id=$2',
        [ctx.workspaceId, id],
      );
      if (!rows[0]) throw new ApiException(404, 'NOT_FOUND');
      return fields(rows[0]);
    });
  }
  async overview(ctx: OwnerContext) {
    return this.auth.transaction(async (client) => {
      await this.authority(client, ctx);
      const { rows } = await client.query<ProjectRow>(
        'SELECT * FROM cloudlane.projects WHERE workspace_id=$1 ORDER BY created_at,id LIMIT 1000',
        [ctx.workspaceId],
      );
      return OverviewResponseSchema.parse({
        scope: 'project_metadata',
        projects: rows.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          createdAt: p.created_at.toISOString(),
          updatedLabel: `Updated ${projectDate.format(p.updated_at)}`,
        })),
        services: [],
        domains: [],
        activity: [],
        server: null,
      });
    });
  }
}
