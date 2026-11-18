import { randomUUID } from 'node:crypto';
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import type { Response } from 'express';
import type { ApiErrorEnvelope, ErrorCode } from '@cloudlane/contracts/api';

export const errorMessages: Record<ErrorCode, string> = {
  VALIDATION_ERROR: 'The request does not match the API contract.',
  INVALID_JSON: 'The request body must be valid JSON.',
  PAYLOAD_TOO_LARGE: 'The JSON request body exceeds the allowed size.',
  UNSUPPORTED_MEDIA_TYPE: 'Use the application/json content type.',
  SESSION_REQUIRED: 'An authenticated owner session is required.',
  FORBIDDEN: 'This action is not permitted.',
  NOT_FOUND: 'The requested route or resource was not found.',
  METHOD_NOT_ALLOWED: 'This HTTP method is not supported.',
  CONFLICT: 'The request conflicts with current resource state.',
  RATE_LIMITED: 'Too many requests. Try again later.',
  NOT_IMPLEMENTED: 'This operation is declared but is not implemented yet.',
  API_UNAVAILABLE: 'The API is temporarily unavailable.',
  INTERNAL_ERROR: 'An unexpected error occurred.',
};
export class ApiException extends HttpException {
  constructor(
    status: number,
    readonly code: ErrorCode,
    readonly details?: ApiErrorEnvelope['error']['details'],
  ) {
    super(errorMessages[code], status);
  }
}
export function unavailable(): never {
  throw new ApiException(501, 'NOT_IMPLEMENTED');
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    if (response.headersSent) return;
    let status =
      exception instanceof HttpException ? exception.getStatus() : 500;
    let code: ErrorCode =
      status === 404
        ? 'NOT_FOUND'
        : status === 400
          ? 'VALIDATION_ERROR'
          : 'INTERNAL_ERROR';
    const parserType =
      exception instanceof Error && 'type' in exception
        ? exception.type
        : undefined;
    if (parserType === 'entity.parse.failed') {
      status = 400;
      code = 'INVALID_JSON';
    } else if (parserType === 'entity.too.large') {
      status = 413;
      code = 'PAYLOAD_TOO_LARGE';
    } else if (exception instanceof ApiException) {
      code = exception.code;
    }
    // Never expose exception/parser messages or input values to callers.
    const envelope: ApiErrorEnvelope = {
      error: {
        code,
        message: errorMessages[code],
        requestId: String(response.getHeader('X-Request-Id') ?? randomUUID()),
        ...(exception instanceof ApiException && exception.details
          ? { details: exception.details }
          : {}),
      },
    };
    response.status(status).json(envelope);
  }
}
