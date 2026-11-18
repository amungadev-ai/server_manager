import { Body, Controller, Get, Module, Post } from '@nestjs/common';
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

@ApiTags('Authentication — unavailable')
@Controller()
class AuthController {
  @Get('auth/session')
  @RouteContract('getSession', 'Owner session', 'SessionResponse')
  session() {
    return unavailable();
  }

  @Post('auth/login')
  @RouteContract('login', 'Owner login', 'SessionResponse', {
    body: 'LoginRequest',
  })
  login(@Body(new SchemaPipe(LoginRequestSchema)) _body: unknown) {
    return unavailable();
  }

  @Post('auth/logout')
  @RouteContract('logout', 'End owner session', 'LogoutResponse', {
    body: 'EmptyRequest',
  })
  logout(@Body(new SchemaPipe(EmptyRequestSchema)) _body: unknown) {
    return unavailable();
  }

  @Post('bootstrap/claim')
  @RouteContract(
    'claimInstallation',
    'Claim installation',
    'BootstrapResponse',
    { body: 'ClaimRequest' },
  )
  claim(@Body(new SchemaPipe(ClaimRequestSchema)) _body: unknown) {
    return unavailable();
  }

  @Post('bootstrap/owner')
  @RouteContract('createOwner', 'Create initial owner', 'BootstrapResponse', {
    body: 'CreateOwnerRequest',
  })
  owner(@Body(new SchemaPipe(CreateOwnerRequestSchema)) _body: unknown) {
    return unavailable();
  }
}
@Module({ controllers: [AuthController] })
export class AuthContractModule {}
