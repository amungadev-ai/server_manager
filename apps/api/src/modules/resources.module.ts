import {
  Body,
  Controller,
  Get,
  Module,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  CreateDeploymentRequestSchema,
  CreateDomainRequestSchema,
  CreateProjectRequestSchema,
  DnsModeTransitionRequestSchema,
  EmptyRequestSchema,
  PaginationQuerySchema,
  RollbackRequestSchema,
} from '@cloudlane/contracts/api';
import { ResourceIdSchema } from '@cloudlane/contracts';
import {
  PaginationContract,
  IdParameter,
  RouteContract,
} from '../common/documentation';
import { unavailable } from '../common/errors';
import { SchemaPipe } from '../common/schema.pipe';
import { RetryKey } from '../common/retry-key.decorator';

const resourceId = () => new SchemaPipe(ResourceIdSchema);

@ApiTags('Resources — unavailable')
@Controller()
class ResourcesController {
  @Get('overview')
  @RouteContract(
    'getOverview',
    'Workspace overview projection',
    'OverviewResponse',
  )
  overview() {
    return unavailable();
  }

  @Get('projects')
  @PaginationContract()
  @RouteContract(
    'listProjects',
    'List projects in the authenticated workspace',
    'ProjectListResponse',
  )
  projects(@Query(new SchemaPipe(PaginationQuerySchema)) _query: unknown) {
    return unavailable();
  }

  @Post('projects')
  @RouteContract(
    'createProject',
    'Create a project and production environment',
    'CreateProjectResponse',
    { body: 'CreateProjectRequest', status: 201, mutation: true },
  )
  createProject(
    @Body(new SchemaPipe(CreateProjectRequestSchema)) _body: unknown,
    @RetryKey() _key: string,
  ) {
    return unavailable();
  }

  @Get('projects/:projectId')
  @IdParameter('projectId')
  @RouteContract('getProject', 'Read an owned project', 'ProjectRecord')
  project(@Param('projectId', resourceId()) _id: string) {
    return unavailable();
  }

  @Get('domains')
  @PaginationContract()
  @RouteContract(
    'listDomains',
    'List globally registered workspace domains',
    'DomainListResponse',
  )
  domains(@Query(new SchemaPipe(PaginationQuerySchema)) _query: unknown) {
    return unavailable();
  }

  @Post('domains')
  @RouteContract(
    'createDomain',
    'Register a pending domain with Manual DNS',
    'DomainRecord',
    { body: 'CreateDomainRequest', status: 201, mutation: true },
  )
  createDomain(
    @Body(new SchemaPipe(CreateDomainRequestSchema)) _body: unknown,
    @RetryKey() _key: string,
  ) {
    return unavailable();
  }

  @Post('domains/:zoneId/verify')
  @IdParameter('zoneId')
  @RouteContract(
    'verifyDomain',
    'Request actual DNS ownership verification',
    'OperationAccepted',
    { body: 'EmptyRequest', status: 202, mutation: true },
  )
  verifyDomain(
    @Param('zoneId', resourceId()) _id: string,
    @Body(new SchemaPipe(EmptyRequestSchema)) _body: unknown,
    @RetryKey() _key: string,
  ) {
    return unavailable();
  }

  @Post('domains/:zoneId/dns-mode-transitions')
  @IdParameter('zoneId')
  @RouteContract(
    'transitionDnsMode',
    'Stage a DNS mode change from domain Settings',
    'OperationAccepted',
    { body: 'DnsModeTransitionRequest', status: 202, mutation: true },
  )
  transition(
    @Param('zoneId', resourceId()) _id: string,
    @Body(new SchemaPipe(DnsModeTransitionRequestSchema)) _body: unknown,
    @RetryKey() _key: string,
  ) {
    return unavailable();
  }

  @Post('services/:serviceId/deployments')
  @IdParameter('serviceId')
  @RouteContract(
    'createDeployment',
    'Queue a static ZIP deployment',
    'OperationAccepted',
    { body: 'CreateDeploymentRequest', status: 202, mutation: true },
  )
  deploy(
    @Param('serviceId', resourceId()) _id: string,
    @Body(new SchemaPipe(CreateDeploymentRequestSchema)) _body: unknown,
    @RetryKey() _key: string,
  ) {
    return unavailable();
  }

  @Post('services/:serviceId/rollbacks')
  @IdParameter('serviceId')
  @RouteContract(
    'rollbackDeployment',
    'Queue rollback to a prior healthy release',
    'OperationAccepted',
    { body: 'RollbackRequest', status: 202, mutation: true },
  )
  rollback(
    @Param('serviceId', resourceId()) _id: string,
    @Body(new SchemaPipe(RollbackRequestSchema)) _body: unknown,
    @RetryKey() _key: string,
  ) {
    return unavailable();
  }

  @Get('deployments/:deploymentId')
  @IdParameter('deploymentId')
  @RouteContract(
    'getDeployment',
    'Read observed deployment state',
    'DeploymentRecord',
  )
  deployment(@Param('deploymentId', resourceId()) _id: string) {
    return unavailable();
  }
}
@Module({ controllers: [ResourcesController] })
export class ResourceContractModule {}
