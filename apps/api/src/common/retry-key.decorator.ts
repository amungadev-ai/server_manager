import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { IdempotencyKeySchema } from '@cloudlane/contracts';
import { SchemaPipe } from './schema.pipe';
const RawRetryKey = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<Request>().headers['idempotency-key'],
);
export const RetryKey = () =>
  RawRetryKey(undefined, new SchemaPipe(IdempotencyKeySchema));
