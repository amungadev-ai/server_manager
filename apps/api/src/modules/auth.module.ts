import {
  Body,
  Controller,
  Get,
  Module,
  Post,
  Req,
  Res,
  Inject,
  Injectable,
  UseGuards,
  Global,
  type CanActivate,
  type ExecutionContext,
  type DynamicModule,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
import {
  ClaimRequestSchema,
  CreateOwnerRequestSchema,
  EmptyRequestSchema,
  LoginRequestSchema,
} from '@cloudlane/contracts/api';
import { RouteContract } from '../common/documentation';
import { unavailable } from '../common/errors';
import { SchemaPipe } from '../common/schema.pipe';
import { OwnerAuthReview } from '../auth/review';
import { REVIEW_TOKEN } from '../auth/policy';

@Injectable()
class AuthBoundaryGuard implements CanActivate {
  constructor(
    @Inject(REVIEW_TOKEN) private readonly review: OwnerAuthReview | null,
  ) {}
  canActivate(context: ExecutionContext) {
    this.review?.boundary.assert(context.switchToHttp().getRequest<Request>());
    return true;
  }
}

@ApiTags('Authentication — unavailable')
@Controller()
@UseGuards(AuthBoundaryGuard)
class AuthController {
  constructor(
    @Inject(REVIEW_TOKEN) private readonly review: OwnerAuthReview | null,
  ) {}
  private runtime(): OwnerAuthReview {
    return this.review ?? unavailable();
  }
  @Get('auth/session')
  @RouteContract('getSession', 'Owner session', 'SessionResponse', {
    review: true,
  })
  session(@Req() request: Request) {
    return this.runtime().session(request);
  }

  @Post('auth/login')
  @RouteContract('login', 'Owner login', 'SessionResponse', {
    body: 'LoginRequest',
    access: 'public',
    review: true,
  })
  login(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Body(new SchemaPipe(LoginRequestSchema))
    body: { email: string; password: string },
  ) {
    return this.runtime().login(request, response, body);
  }

  @Post('auth/logout')
  @RouteContract('logout', 'End owner session', 'LogoutResponse', {
    body: 'EmptyRequest',
    review: true,
  })
  logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Body(new SchemaPipe(EmptyRequestSchema)) _body: unknown,
  ) {
    return this.runtime().logout(request, response);
  }

  @Post('auth/session/rotate')
  @RouteContract(
    'rotateSession',
    'Rotate owner session and CSRF nonce (review candidate)',
    'SessionResponse',
    { body: 'EmptyRequest', review: true },
  )
  rotate(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Body(new SchemaPipe(EmptyRequestSchema)) _body: unknown,
  ) {
    return this.runtime().rotate(request, response);
  }

  @Post('bootstrap/claim')
  @RouteContract(
    'claimInstallation',
    'Claim installation',
    'BootstrapResponse',
    { body: 'ClaimRequest', access: 'public', review: true },
  )
  claim(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Body(new SchemaPipe(ClaimRequestSchema)) body: { code: string },
  ) {
    return this.runtime().claim(request, response, body);
  }

  @Post('bootstrap/owner')
  @RouteContract('createOwner', 'Create initial owner', 'BootstrapResponse', {
    body: 'CreateOwnerRequest',
    access: 'public',
    review: true,
  })
  owner(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Body(new SchemaPipe(CreateOwnerRequestSchema))
    body: { email: string; displayName: string; password: string },
  ) {
    return this.runtime().owner(request, response, body);
  }
}
@Global()
@Module({})
export class AuthContractModule {
  static configure(review?: OwnerAuthReview): DynamicModule {
    return {
      module: AuthContractModule,
      controllers: [AuthController],
      providers: [
        { provide: REVIEW_TOKEN, useValue: review ?? null },
        AuthBoundaryGuard,
      ],
      exports: [REVIEW_TOKEN],
    };
  }
}
