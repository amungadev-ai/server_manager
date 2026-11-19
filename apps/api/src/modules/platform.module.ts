import { Controller, Get, Module, Res, Inject } from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
import {
  HealthResponseSchema,
  InstallationStatusSchema,
  ReadinessResponseSchema,
} from '@cloudlane/contracts/api';
import { RouteContract } from '../common/documentation';
import { PlatformDatabase } from '../database/database';
import { OwnerAuthReview } from '../auth/review';
import { REVIEW_TOKEN } from '../auth/policy';

@ApiTags('Platform')
@Controller()
class PlatformController {
  constructor(
    private readonly database: PlatformDatabase,
    @Inject(REVIEW_TOKEN) private readonly review: OwnerAuthReview | null,
  ) {}
  @Get('health')
  @RouteContract(
    'getHealth',
    'API liveness, distinct from readiness',
    'HealthResponse',
    { implemented: true, access: 'public' },
  )
  health() {
    return HealthResponseSchema.parse({
      status: 'ok',
      component: 'api',
      version: '0.1.0',
      readiness: 'unconfigured',
    });
  }

  @Get('health/ready')
  @RouteContract(
    'getReadiness',
    'Dependency readiness; liveness does not imply readiness',
    'ReadinessResponse',
    {
      implemented: true,
      access: 'public',
      status: 503,
    },
  )
  async ready(@Res({ passthrough: true }) response: Response) {
    response.status(503);
    return ReadinessResponseSchema.parse({
      status: 'not_ready',
      database: await this.database.status(),
      authentication: this.review ? 'review_only' : 'unavailable',
    });
  }

  @Get('installation/status')
  @RouteContract(
    'getInstallationStatus',
    'Public-safe installation status',
    'InstallationStatus',
    { implemented: true, access: 'public' },
  )
  async installation() {
    if (this.review)
      return InstallationStatusSchema.parse(await this.review.store.status());
    return InstallationStatusSchema.parse({
      state: 'unconfigured',
      ownerConfigured: false,
      setupAvailable: false,
    });
  }
}
@Module({ controllers: [PlatformController] })
export class PlatformModule {}
