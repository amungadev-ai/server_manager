import type { PipeTransform } from '@nestjs/common';
import type { z } from 'zod';
import { ApiException } from './errors';

export class SchemaPipe implements PipeTransform {
  constructor(private readonly schema: z.ZodType) {}
  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new ApiException(400, 'VALIDATION_ERROR', {
        issues: result.error.issues.slice(0, 20).map((issue) => ({
          path: issue.path.map(String).join('.').slice(0, 120),
          code: issue.code,
        })),
      });
    }
    return result.data;
  }
}
