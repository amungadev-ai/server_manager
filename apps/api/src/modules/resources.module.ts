import {
  Body,
  Controller,
  Get,
  Module,
  Param,
  Post,
  Query,
  Req,
  Res,
  Inject,
  type DynamicModule,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ownerContext } from '../common/authorization';
import { ProjectStore, PROJECT_STORE } from '../projects/store';
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
  constructor(
    @Inject(PROJECT_STORE) private readonly store: ProjectStore | null,
  ) {}
  private projectsStore() {
    return this.store ?? unavailable();
  }
  @Get('overview')
  @RouteContract(
    'getOverview',
    'Workspace overview projection',
    'OverviewResponse',
    { review: true },
  )
  overview(@Req() request: Request) {
    return this.projectsStore().overview(ownerContext(request));
  }

  @Get('projects')
  @PaginationContract()
  @RouteContract(
    'listProjects',
    'List projects in the authenticated workspace',
    'ProjectListResponse',
    { review: true },
  )
  projects(
    @Req() request: Request,
    @Query(new SchemaPipe(PaginationQuerySchema))
    query: { limit: number; cursor?: string },
  ) {
    return this.projectsStore().list(ownerContext(request), query);
  }

  @Post('projects')
  @RouteContract(
    'createProject',
    'Create a project and production environment',
    'CreateProjectResponse',
    {
      body: 'CreateProjectRequest',
      status: 201,
      mutation: true,
      review: true,
      retryImplemented: true,
    },
  )
  createProject(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Body(new SchemaPipe(CreateProjectRequestSchema))
    body: { name: string; slug?: string; description?: string },
    @RetryKey() key: string,
  ) {
    return this.projectsStore().create(
      ownerContext(request),
      body,
      key,
      String(response.getHeader('X-Request-Id')),
    );
  }

  @Get('projects/:projectId')
  @IdParameter('projectId')
  @RouteContract('getProject', 'Read an owned project', 'ProjectRecord', {
    review: true,
  })
  project(
    @Req() request: Request,
    @Param('projectId', resourceId()) id: string,
  ) {
    return this.projectsStore().get(ownerContext(request), id);
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
@Module({})
export class ResourceContractModule {
  static configure(store?: ProjectStore): DynamicModule {
    return {
      module: ResourceContractModule,
      controllers: [ResourcesController],
      providers: [{ provide: PROJECT_STORE, useValue: store ?? null }],
    };
  }
}
