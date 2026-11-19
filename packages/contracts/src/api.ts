import { z } from 'zod';
import {
  CursorSchema,
  ResourceIdSchema,
  RequestIdSchema,
  TimestampSchema,
} from './ids.js';

export const API_PREFIX = '/api/v1' as const;
export const CONTRACT_VERSION = '0.1.0-draft.1' as const;
export const JSON_BODY_LIMIT = 16 * 1024;
export const ErrorCodeSchema = z.enum([
  'VALIDATION_ERROR',
  'INVALID_JSON',
  'PAYLOAD_TOO_LARGE',
  'UNSUPPORTED_MEDIA_TYPE',
  'SESSION_REQUIRED',
  'AUTHENTICATION_FAILED',
  'FORBIDDEN',
  'NOT_FOUND',
  'METHOD_NOT_ALLOWED',
  'CONFLICT',
  'RATE_LIMITED',
  'NOT_IMPLEMENTED',
  'API_UNAVAILABLE',
  'INTERNAL_ERROR',
]);
export const ValidationIssueSchema = z.strictObject({
  path: z.string().max(120),
  code: z.string().min(1).max(50),
});
export const ApiErrorEnvelopeSchema = z.strictObject({
  error: z.strictObject({
    code: ErrorCodeSchema,
    message: z.string().min(1).max(200),
    requestId: RequestIdSchema,
    details: z
      .strictObject({ issues: z.array(ValidationIssueSchema).max(20) })
      .optional(),
  }),
});
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;
export type ApiErrorEnvelope = z.infer<typeof ApiErrorEnvelopeSchema>;
export const HealthResponseSchema = z.strictObject({
  status: z.literal('ok'),
  component: z.literal('api'),
  version: z.string().min(1).max(40),
  readiness: z.literal('unconfigured'),
});
export const InstallationStatusSchema = z.discriminatedUnion('state', [
  z.strictObject({
    state: z.literal('unconfigured'),
    ownerConfigured: z.literal(false),
    setupAvailable: z.literal(false),
  }),
  z.strictObject({
    state: z.literal('unclaimed'),
    ownerConfigured: z.literal(false),
    setupAvailable: z.boolean(),
  }),
  z.strictObject({
    state: z.literal('setup_pending'),
    ownerConfigured: z.literal(false),
    setupAvailable: z.literal(false),
  }),
  z.strictObject({
    state: z.literal('active'),
    ownerConfigured: z.literal(true),
    setupAvailable: z.literal(false),
  }),
]);
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
export type InstallationStatus = z.infer<typeof InstallationStatusSchema>;
export const DatabaseStatusSchema = z.enum([
  'unconfigured',
  'unavailable',
  'migration_required',
  'ready',
]);
export type DatabaseStatus = z.infer<typeof DatabaseStatusSchema>;
export const ReadinessResponseSchema = z.strictObject({
  status: z.literal('not_ready'),
  database: DatabaseStatusSchema,
  authentication: z.enum(['unavailable', 'review_only']),
});

const ProjectNameSchema = z.string().trim().min(1).max(80);
const SlugSchema = z
  .string()
  .min(1)
  .max(63)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const DescriptionSchema = z.string().max(240);
export const CreateProjectRequestSchema = z.strictObject({
  name: ProjectNameSchema,
  slug: SlugSchema.optional(),
  description: DescriptionSchema.optional(),
});
export const ProjectRecordSchema = z.strictObject({
  id: ResourceIdSchema,
  workspaceId: ResourceIdSchema,
  name: ProjectNameSchema,
  slug: SlugSchema,
  description: DescriptionSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});
export const EnvironmentRecordSchema = z.strictObject({
  id: ResourceIdSchema,
  projectId: ResourceIdSchema,
  name: z.literal('production'),
});
export const CreateProjectResponseSchema = z.strictObject({
  project: ProjectRecordSchema,
  environment: EnvironmentRecordSchema,
});
export const PaginationQuerySchema = z.strictObject({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: CursorSchema.optional(),
});
export const ProjectListResponseSchema = z.strictObject({
  items: z.array(ProjectRecordSchema).max(100),
  nextCursor: CursorSchema.nullable(),
});
export type CreateProjectRequest = z.infer<typeof CreateProjectRequestSchema>;

export const LoginRequestSchema = z.strictObject({
  email: z.email().max(254),
  password: z.string().min(1).max(1024).meta({ writeOnly: true }),
});
export const ClaimRequestSchema = z.strictObject({
  code: z.string().min(1).max(128).meta({
    writeOnly: true,
    description: 'Opaque installer claim code. Never log or echo.',
  }),
});
export const CreateOwnerRequestSchema = z.strictObject({
  email: z.email().max(254),
  displayName: z.string().trim().min(1).max(80),
  password: z
    .string()
    .min(15)
    .max(1024)
    .refine(
      (value) => Array.from(value).length >= 15,
      'Password requires at least 15 Unicode code points',
    )
    .refine(
      (value) => new TextEncoder().encode(value).length <= 1024,
      'Password exceeds the UTF-8 byte limit',
    )
    .meta({
      writeOnly: true,
      description:
        'Review candidate: minimum 15 characters and maximum 1024 UTF-8 bytes; no trimming. Production password/MFA policy requires security review.',
    }),
});
export const BootstrapResponseSchema = z.strictObject({
  state: z.enum(['owner_setup_required', 'mfa_setup_required', 'active']),
  csrfToken: z
    .string()
    .regex(/^[A-Za-z0-9_-]{43}$/)
    .optional(),
});
const CsrfTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export const AuthChallengeResponseSchema = z.strictObject({
  state: z.enum(['mfa_setup_required', 'mfa_required']),
  csrfToken: CsrfTokenSchema,
  expiresAt: TimestampSchema,
});
export const MfaCodeRequestSchema = z.strictObject({
  code: z
    .string()
    .regex(/^[0-9]{6}$/)
    .meta({ writeOnly: true }),
});
export const MfaEnrollmentResponseSchema = z.strictObject({
  secret: z
    .string()
    .regex(/^[A-Z2-7]{32}$/)
    .meta({
      description: 'Displayed once; do not log or persist in the browser.',
    }),
  uri: z.string().max(1024).startsWith('otpauth://totp/'),
  expiresAt: TimestampSchema,
});
export const RecoveryCodeSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{4}(?:-[0-9a-fA-F]{4}){7}$/);
export const RecoveryRequestSchema = z.strictObject({
  code: RecoveryCodeSchema.meta({ writeOnly: true }),
});
export const RecoveryCodesResponseSchema = z.strictObject({
  state: z.literal('recovery_codes_required'),
  csrfToken: CsrfTokenSchema,
  expiresAt: TimestampSchema,
  codes: z.array(RecoveryCodeSchema).length(10),
});
export const RecoveryAcknowledgeRequestSchema = z.strictObject({
  acknowledged: z.literal(true),
});
export const RegenerateRecoveryRequestSchema = z.strictObject({
  password: z.string().min(1).max(1024).meta({ writeOnly: true }),
  code: MfaCodeRequestSchema.shape.code,
});
export const EmptyRequestSchema = z.strictObject({});
export const LogoutResponseSchema = z.strictObject({
  signedOut: z.literal(true),
});
export const SessionResponseSchema = z.strictObject({
  authenticated: z.literal(true),
  mfaVerified: z.literal(true).optional(),
  authenticationMethod: z.enum(['totp', 'recovery']).optional(),
  csrfToken: z
    .string()
    .regex(/^[A-Za-z0-9_-]{43}$/)
    .optional(),
  user: z.strictObject({
    id: ResourceIdSchema,
    email: z.email().max(254),
    displayName: z.string().min(1).max(80),
    role: z.literal('owner'),
  }),
  workspace: z.strictObject({
    id: ResourceIdSchema,
    name: z.string().min(1).max(80),
  }),
});

export const MfaProofResponseSchema = z.union([
  SessionResponseSchema,
  RecoveryCodesResponseSchema,
]);

// ASCII/Punycode hostname; ownership, public-suffix handling and DNS are separate checks.
const DomainNameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(253)
  .regex(
    /^(?=.{3,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])$/,
  );
export const CreateDomainRequestSchema = z.strictObject({
  name: DomainNameSchema,
});
export const DomainRecordSchema = z.strictObject({
  id: ResourceIdSchema,
  workspaceId: ResourceIdSchema,
  name: DomainNameSchema,
  status: z.enum(['pending', 'verified']),
  dnsMode: z.enum(['manual', 'managed']),
  revision: z.number().int().min(1),
});
export const DomainListResponseSchema = z.strictObject({
  items: z.array(DomainRecordSchema).max(100),
  nextCursor: CursorSchema.nullable(),
});
export const DnsModeTransitionRequestSchema = z.strictObject({
  targetMode: z.enum(['manual', 'managed']),
  expectedRevision: z.number().int().min(1),
});
export const ServiceKindSchema = z.enum([
  'application',
  'database',
  'cron',
  'storage',
]);
export const ServiceStatusSchema = z.enum([
  'running',
  'active',
  'stopped',
  'failed',
]);
export const OverviewProjectSchema = z.strictObject({
  createdAt: TimestampSchema.optional(),
  id: ResourceIdSchema,
  name: ProjectNameSchema,
  description: DescriptionSchema,
  updatedLabel: z.string().max(80),
});
export const OverviewServiceSchema = z.strictObject({
  id: ResourceIdSchema,
  projectId: ResourceIdSchema,
  name: z.string().min(1).max(80),
  kind: ServiceKindSchema,
  framework: z.string().max(80),
  status: ServiceStatusSchema,
});
export const OverviewDomainSchema = z.strictObject({
  id: ResourceIdSchema,
  name: DomainNameSchema,
  status: z.enum(['verified', 'pending']),
  dnsMode: z.enum(['manual', 'managed']),
  connections: z.number().int().min(0).max(10000),
});
export const OverviewActivitySchema = z.strictObject({
  id: ResourceIdSchema,
  title: z.string().max(160),
  detail: z.string().max(240),
  timeLabel: z.string().max(80),
  kind: z.enum(['application', 'database', 'cron', 'storage', 'domain']),
});
export const ServerMetricsSchema = z
  .strictObject({
    name: z.string().min(1).max(80),
    os: z.string().min(1).max(80),
    health: z.enum(['healthy', 'degraded', 'offline']),
    observedAt: TimestampSchema,
    cpuPercent: z.number().min(0).max(100),
    memoryUsedMb: z.number().min(0),
    memoryTotalMb: z.number().positive(),
    diskUsedGb: z.number().min(0),
    diskTotalGb: z.number().positive(),
  })
  .refine(
    (value) =>
      value.memoryUsedMb <= value.memoryTotalMb &&
      value.diskUsedGb <= value.diskTotalGb,
    'Usage cannot exceed capacity',
  );
export const OverviewResponseSchema = z.strictObject({
  scope: z.literal('project_metadata').optional(),
  projects: z.array(OverviewProjectSchema).max(1000),
  services: z.array(OverviewServiceSchema).max(1000),
  domains: z.array(OverviewDomainSchema).max(1000),
  activity: z.array(OverviewActivitySchema).max(100),
  server: ServerMetricsSchema.nullable(),
});

export const DeploymentStageSchema = z.enum([
  'REQUESTED',
  'QUEUED',
  'FETCHING',
  'VALIDATING',
  'DETECTING',
  'BUILDING',
  'STARTING_CANDIDATE',
  'HEALTH_CHECKING',
  'ACTIVATING',
  'LIVE',
  'FAILED',
  'CANCELLED',
  'TIMED_OUT',
  'ROLLBACK_REQUESTED',
  'REACTIVATING_PREVIOUS',
]);
export const CreateDeploymentRequestSchema = z.strictObject({
  sourceUploadId: ResourceIdSchema,
  framework: z.literal('static'),
});
export const RollbackRequestSchema = z.strictObject({
  targetDeploymentId: ResourceIdSchema,
});
export const OperationAcceptedSchema = z.strictObject({
  operationId: ResourceIdSchema,
  status: z.literal('queued'),
});
export const DeploymentRecordSchema = z.strictObject({
  id: ResourceIdSchema,
  serviceId: ResourceIdSchema,
  operationId: ResourceIdSchema,
  stage: DeploymentStageSchema,
  createdAt: TimestampSchema,
});
export const DeploymentEventSchema = z.strictObject({
  eventId: ResourceIdSchema,
  deploymentId: ResourceIdSchema,
  sequence: z.number().int().min(0),
  stage: DeploymentStageSchema,
  message: z.string().max(4096),
  createdAt: TimestampSchema,
  requestId: RequestIdSchema,
});

/** Nest runtime validation and generated OpenAPI consume this single registry. */
export const httpSchemas = {
  ResourceId: ResourceIdSchema,
  ApiErrorEnvelope: ApiErrorEnvelopeSchema,
  HealthResponse: HealthResponseSchema,
  ReadinessResponse: ReadinessResponseSchema,
  InstallationStatus: InstallationStatusSchema,
  CreateProjectRequest: CreateProjectRequestSchema,
  ProjectRecord: ProjectRecordSchema,
  EnvironmentRecord: EnvironmentRecordSchema,
  CreateProjectResponse: CreateProjectResponseSchema,
  PaginationQuery: PaginationQuerySchema,
  ProjectListResponse: ProjectListResponseSchema,
  LoginRequest: LoginRequestSchema,
  AuthChallengeResponse: AuthChallengeResponseSchema,
  MfaCodeRequest: MfaCodeRequestSchema,
  MfaEnrollmentResponse: MfaEnrollmentResponseSchema,
  MfaProofResponse: MfaProofResponseSchema,
  RecoveryRequest: RecoveryRequestSchema,
  RecoveryCodesResponse: RecoveryCodesResponseSchema,
  RecoveryAcknowledgeRequest: RecoveryAcknowledgeRequestSchema,
  RegenerateRecoveryRequest: RegenerateRecoveryRequestSchema,
  ClaimRequest: ClaimRequestSchema,
  CreateOwnerRequest: CreateOwnerRequestSchema,
  BootstrapResponse: BootstrapResponseSchema,
  EmptyRequest: EmptyRequestSchema,
  LogoutResponse: LogoutResponseSchema,
  SessionResponse: SessionResponseSchema,
  CreateDomainRequest: CreateDomainRequestSchema,
  DomainRecord: DomainRecordSchema,
  DomainListResponse: DomainListResponseSchema,
  DnsModeTransitionRequest: DnsModeTransitionRequestSchema,
  OverviewResponse: OverviewResponseSchema,
  CreateDeploymentRequest: CreateDeploymentRequestSchema,
  RollbackRequest: RollbackRequestSchema,
  OperationAccepted: OperationAcceptedSchema,
  DeploymentRecord: DeploymentRecordSchema,
  DeploymentEvent: DeploymentEventSchema,
};
export type HttpSchemaName = keyof typeof httpSchemas;
