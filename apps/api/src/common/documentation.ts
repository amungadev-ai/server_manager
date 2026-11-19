import { applyDecorators } from '@nestjs/common';
import {
  ApiBody,
  ApiExtension,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { z } from 'zod';
import {
  httpSchemas,
  PaginationQuerySchema,
  type HttpSchemaName,
} from '@cloudlane/contracts/api';
import { IdempotencyKeySchema, ResourceIdSchema } from '@cloudlane/contracts';
import type { SchemaObject } from '@nestjs/swagger';
import { OwnerRoute, PublicRoute } from './authorization';

export const ref = (name: HttpSchemaName) => ({
  $ref: `#/components/schemas/${name}`,
});
export function RouteContract(
  operationId: string,
  summary: string,
  response: HttpSchemaName,
  options: {
    implemented?: boolean;
    body?: HttpSchemaName;
    status?: number;
    mutation?: boolean;
    access?: 'public' | 'owner';
  } = {},
) {
  const implemented = options.implemented === true;
  const ownerOnly = options.access !== 'public';
  return applyDecorators(
    ownerOnly ? OwnerRoute() : PublicRoute(),
    ApiOperation({
      operationId,
      summary,
      description: implemented
        ? 'Implemented read-only platform endpoint.'
        : `DECLARED, UNAVAILABLE: ${ownerOnly ? 'requires a server-resolved owner session before request validation; anonymous callers receive 401. Session resolution is disabled until CL-033. Authorized requests will validate shape and return 501.' : 'Validates request shape and returns 501.'} The success shape is a draft; no authentication issuance, resource mutation or queued work is performed.`,
    }),
    ApiExtension(
      'x-cloudlane-implementation',
      implemented ? 'implemented' : 'unavailable',
    ),
    ApiExtension('x-cloudlane-access', ownerOnly ? 'owner' : 'public'),
    ...(ownerOnly
      ? [
          ApiCookieAuth('ownerSession'),
          ApiResponse({
            status: 401,
            description:
              'Owner session required; current default for protected operations.',
            schema: ref('ApiErrorEnvelope'),
          }),
          ApiResponse({
            status: 403,
            description: 'Actor or route policy denied.',
            schema: ref('ApiErrorEnvelope'),
          }),
          ApiResponse({
            status: 503,
            description: 'Session verifier unavailable; access denied.',
            schema: ref('ApiErrorEnvelope'),
          }),
        ]
      : []),
    ApiResponse({
      status: options.status ?? 200,
      description: implemented
        ? 'Current response.'
        : 'Planned success response; not emitted by the current scaffold.',
      schema: ref(response),
    }),
    ApiResponse({
      status: 400,
      description: 'Invalid request or JSON.',
      schema: ref('ApiErrorEnvelope'),
    }),
    ...(!implemented
      ? [
          ApiResponse({
            status: 501,
            description:
              'Result for valid requests after required authorization. No operation is performed.',
            schema: ref('ApiErrorEnvelope'),
          }),
        ]
      : []),
    ...(options.body
      ? [
          ApiBody({ required: true, schema: ref(options.body) }),
          ApiResponse({
            status: 413,
            description: 'JSON body too large.',
            schema: ref('ApiErrorEnvelope'),
          }),
          ApiResponse({
            status: 415,
            description: 'JSON content type required.',
            schema: ref('ApiErrorEnvelope'),
          }),
        ]
      : []),
    ...(options.mutation
      ? [
          ApiHeader({
            name: 'Idempotency-Key',
            required: true,
            description:
              'UUID v4 retry key. Persistence/deduplication is not implemented.',
            schema: z.toJSONSchema(IdempotencyKeySchema, {
              target: 'openapi-3.0',
            }) as SchemaObject,
          }),
        ]
      : []),
  );
}
export function PaginationContract() {
  const shape = z.toJSONSchema(PaginationQuerySchema, {
    target: 'openapi-3.0',
  });
  return applyDecorators(
    ...Object.entries(shape.properties ?? {}).map(([name, schema]) =>
      ApiQuery({ name, required: false, schema: schema as SchemaObject }),
    ),
  );
}
export function componentSchemas() {
  return Object.fromEntries(
    Object.entries(httpSchemas).map(([name, schema]) => [
      name,
      z.toJSONSchema(schema, { target: 'openapi-3.0' }) as SchemaObject,
    ]),
  );
}

export function IdParameter(name: string) {
  return ApiParam({
    name,
    schema: z.toJSONSchema(ResourceIdSchema, {
      target: 'openapi-3.0',
    }) as SchemaObject,
  });
}
