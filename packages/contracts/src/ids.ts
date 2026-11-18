import { z } from 'zod';

/** IDs are opaque UUID v4 values, never ownership or authorization evidence. */
export const ResourceIdSchema = z.uuidv4();
export const RequestIdSchema = z.uuidv4();
export const IdempotencyKeySchema = z.uuidv4();
export const TimestampSchema = z.iso.datetime();
export const CursorSchema = z
  .string()
  .min(1)
  .max(512)
  .regex(/^[A-Za-z0-9_-]+$/);
export type ResourceId = z.infer<typeof ResourceIdSchema>;
