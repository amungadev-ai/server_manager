import { applyDecorators } from '@nestjs/common';
import {
  ApiBody,
  ApiExtension,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { z } from 'zod';
import {
  httpSchemas,
  PaginationQuerySchema,
  type HttpSchemaName,
} from '@cloudlane/contracts/api';
import { IdempotencyKeySchema, ResourceIdSchema } from '@cloudlane/contracts';
import type { SchemaObject } from '@nestjs/swagger';

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
  } = {},
) {
  const implemented = options.implemented === true;
  return applyDecorators(
    ApiOperation({
      operationId,
      summary,
      description: implemented
        ? 'Implemented read-only platform endpoint.'
        : 'DECLARED, UNAVAILABLE: validates request shape and currently returns 501. The success shape is a draft for a future implementation; no authentication, resource mutation or queued work is performed.',
    }),
    ApiExtension(
      'x-cloudlane-implementation',
      implemented ? 'implemented' : 'unavailable',
    ),
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
              'Current result for valid requests. No operation is performed.',
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
