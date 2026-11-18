import { Controller, Get, Module } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  HealthResponseSchema,
  InstallationStatusSchema,
} from '@cloudlane/contracts/api';
import { RouteContract } from '../common/documentation';

@ApiTags('Platform')
@Controller()
class PlatformController {
  @Get('health')
  @RouteContract(
    'getHealth',
    'API liveness, distinct from readiness',
    'HealthResponse',
    { implemented: true },
  )
  health() {
    return HealthResponseSchema.parse({
      status: 'ok',
      component: 'api',
      version: '0.1.0',
      readiness: 'unconfigured',
    });
  }

  @Get('installation/status')
  @RouteContract(
    'getInstallationStatus',
    'Public-safe installation status',
    'InstallationStatus',
    { implemented: true },
  )
  installation() {
    return InstallationStatusSchema.parse({
      state: 'unconfigured',
      ownerConfigured: false,
      setupAvailable: false,
    });
  }
}
@Module({ controllers: [PlatformController] })
export class PlatformModule {}
