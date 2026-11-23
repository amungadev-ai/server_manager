import { z } from 'zod';
import { ResourceIdSchema } from '@cloudlane/contracts';
import { ApiException } from '../common/errors';
const Position = z.strictObject({
  v: z.literal(1),
  workspaceId: ResourceIdSchema,
  after: ResourceIdSchema,
});
export function projectCursor(workspaceId: string, after: string): string {
  return Buffer.from(
    JSON.stringify(Position.parse({ v: 1, workspaceId, after })),
  ).toString('base64url');
}
/** Unsigned position only; every anchor/query is additionally workspace-scoped in SQL. */
export function readProjectCursor(
  cursor: string | undefined,
  workspaceId: string,
): string | null {
  if (cursor === undefined) return null;
  try {
    if (!/^[A-Za-z0-9_-]{1,512}$/.test(cursor)) throw new Error();
    const bytes = Buffer.from(cursor, 'base64url');
    if (bytes.toString('base64url') !== cursor) throw new Error();
    const position = Position.parse(JSON.parse(bytes.toString('utf8')));
    if (position.workspaceId !== workspaceId) throw new Error();
    return position.after;
  } catch {
    throw new ApiException(400, 'VALIDATION_ERROR');
  }
}
