import { z } from 'zod';
import {
  IdempotencyKeySchema,
  ResourceIdSchema,
  TimestampSchema,
} from './ids.js';
export const AGENT_CONTRACT_VERSION = 1 as const;
const envelope = {
  commandVersion: z.literal(AGENT_CONTRACT_VERSION),
  commandId: ResourceIdSchema,
  workspaceId: ResourceIdSchema,
  serverId: ResourceIdSchema,
  resourceId: ResourceIdSchema,
  desiredGeneration: z.number().int().min(1),
  idempotencyKey: IdempotencyKeySchema,
  issuedAt: TimestampSchema,
  expiresAt: TimestampSchema,
  authorization: z.strictObject({
    scheme: z
      .string()
      .min(1)
      .max(32)
      .regex(/^[a-z][a-z0-9-]*$/),
    keyId: ResourceIdSchema,
    proof: z
      .string()
      .min(32)
      .max(512)
      .regex(/^[A-Za-z0-9_-]+$/),
  }),
};
export const AgentCommandSchema = z
  .discriminatedUnion('operation', [
    z.strictObject({
      ...envelope,
      operation: z.literal('release.startCandidate'),
      payload: z.strictObject({
        deploymentId: ResourceIdSchema,
        imageDigest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
        internalPort: z.number().int().min(1).max(65535),
        limits: z.strictObject({
          memoryMb: z.number().int().min(16).max(1048576),
          cpuMilli: z.number().int().min(10).max(256000),
          pids: z.number().int().min(1).max(4096),
        }),
        volumes: z
          .array(
            z.strictObject({
              volumeId: ResourceIdSchema,
              mountPoint: z.enum(['/data', '/app/uploads', '/app/storage']),
            }),
          )
          .max(8),
      }),
    }),
    z.strictObject({
      ...envelope,
      operation: z.literal('release.stopCandidate'),
      payload: z.strictObject({ deploymentId: ResourceIdSchema }),
    }),
    z.strictObject({
      ...envelope,
      operation: z.literal('release.inspect'),
      payload: z.strictObject({ deploymentId: ResourceIdSchema }),
    }),
    z.strictObject({
      ...envelope,
      operation: z.literal('route.promote'),
      payload: z.strictObject({
        bindingId: ResourceIdSchema,
        candidateDeploymentId: ResourceIdSchema,
        expectedActiveDeploymentId: ResourceIdSchema.nullable(),
      }),
    }),
  ])
  .refine((value) => Date.parse(value.expiresAt) > Date.parse(value.issuedAt), {
    path: ['expiresAt'],
    message: 'Expiry must follow issuance',
  });
export const AgentResultSchema = z.strictObject({
  commandVersion: z.literal(1),
  commandId: ResourceIdSchema,
  resourceId: ResourceIdSchema,
  desiredGeneration: z.number().int().min(1),
  outcome: z.enum(['accepted', 'rejected', 'completed', 'failed']),
  observedAt: TimestampSchema,
});
export type AgentCommand = z.infer<typeof AgentCommandSchema>;
export type AgentResult = z.infer<typeof AgentResultSchema>;
