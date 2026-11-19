import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { CONTRACT_VERSION } from '@cloudlane/contracts/api';
import { componentSchemas } from './common/documentation';

export function createOpenApiDocument(app: INestApplication) {
  const metadata = new DocumentBuilder()
    .setTitle('Cloudlane API')
    .setVersion(CONTRACT_VERSION)
    .setDescription(
      'Development contract. Public liveness, dependency readiness and unconfigured installation status are implemented. Readiness remains 503 until authentication is implemented, even when the PostgreSQL schema is current. Protected operations require an owner session; the default resolver denies every session until CL-033. Anonymous protected requests return 401 before shape validation. Public login/bootstrap declarations return 501 for valid requests. Success schemas and the cookie scheme are drafts, not evidence of operational authentication or infrastructure. The same-origin API runs on the VPS, not the static preview host.',
    )
    .addCookieAuth(
      '__Host-cloudlane_session',
      {
        type: 'apiKey',
        in: 'cookie',
        description:
          'Proposed owner cookie; this batch does not issue or accept sessions.',
      },
      'ownerSession',
    )
    .addServer('/')
    .build();
  const document = SwaggerModule.createDocument(app, metadata);
  document.components = {
    ...document.components,
    schemas: { ...document.components?.schemas, ...componentSchemas() },
  };
  return document;
}
