import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { CONTRACT_VERSION } from '@cloudlane/contracts/api';
import { componentSchemas } from './common/documentation';

export function createOpenApiDocument(app: INestApplication) {
  const metadata = new DocumentBuilder()
    .setTitle('Cloudlane API')
    .setVersion(CONTRACT_VERSION)
    .setDescription(
      'Development contract. Only health and unconfigured installation status are implemented. All other documented operations validate shape and return 501. Success response schemas are drafts, not evidence of operational authentication or infrastructure. The same-origin API is served by NestJS on the VPS, not by the static preview host.',
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
