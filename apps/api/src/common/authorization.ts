import {
  Injectable,
  Module,
  SetMetadata,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { z } from 'zod';
import { ResourceIdSchema, TimestampSchema } from '@cloudlane/contracts';
import { ApiException } from './errors';

const ACCESS = Symbol('cloudlane.route-access');
export const PublicRoute = () => SetMetadata(ACCESS, 'public');
export const OwnerRoute = () => SetMetadata(ACCESS, 'owner');

// Only a server-side resolver may establish authority. Request fields and headers
// are never treated as a principal. Session issuance is deferred to CL-033.
export abstract class OwnerSessionResolver {
  abstract resolve(request: Request): Promise<unknown>;
}
@Injectable()
export class DisabledSessionResolver extends OwnerSessionResolver {
  async resolve(_request: Request): Promise<null> {
    return null;
  }
}
const sessionSchema = z.strictObject({
  actorType: z.enum(['human', 'agent', 'api-key']),
  role: z.enum(['owner', 'admin', 'developer', 'viewer']),
  userId: ResourceIdSchema,
  workspaceId: ResourceIdSchema,
  sessionId: ResourceIdSchema,
  expiresAt: TimestampSchema,
  revoked: z.boolean(),
});
export type OwnerContext = Readonly<{
  userId: string;
  workspaceId: string;
  sessionId: string;
}>;
const contexts = new WeakMap<Request, OwnerContext>();
export function ownerContext(request: Request): OwnerContext {
  const context = contexts.get(request);
  if (!context) throw new ApiException(403, 'FORBIDDEN');
  return context;
}

@Injectable()
export class AuthorizationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: OwnerSessionResolver,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    contexts.delete(request);
    const access = this.reflector.getAllAndOverride<unknown>(ACCESS, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (access === 'public') return true;
    // A forgotten or unknown annotation never creates an accidentally public API.
    if (access !== 'owner') throw new ApiException(403, 'FORBIDDEN');
    let resolved: unknown;
    try {
      resolved = await this.sessions.resolve(request);
    } catch {
      throw new ApiException(503, 'API_UNAVAILABLE');
    }
    const result = sessionSchema.safeParse(resolved);
    if (
      !result.success ||
      result.data.revoked ||
      Date.parse(result.data.expiresAt) <= Date.now()
    )
      throw new ApiException(401, 'SESSION_REQUIRED');
    if (result.data.actorType !== 'human' || result.data.role !== 'owner')
      throw new ApiException(403, 'FORBIDDEN');
    const { userId, workspaceId, sessionId } = result.data;
    contexts.set(request, Object.freeze({ userId, workspaceId, sessionId }));
    return true;
  }
}

@Module({
  providers: [
    { provide: OwnerSessionResolver, useClass: DisabledSessionResolver },
    { provide: APP_GUARD, useClass: AuthorizationGuard },
  ],
})
export class AuthorizationModule {}
