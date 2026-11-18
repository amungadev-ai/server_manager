import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { json, type Request, type Response, type NextFunction } from 'express';
import { API_PREFIX, JSON_BODY_LIMIT } from '@cloudlane/contracts/api';
import { ApiException, ApiExceptionFilter } from './common/errors';
import { PlatformModule } from './modules/platform.module';
import { AuthContractModule } from './modules/auth.module';
import { ResourceContractModule } from './modules/resources.module';
import { createOpenApiDocument } from './openapi';

@Module({
  imports: [PlatformModule, AuthContractModule, ResourceContractModule],
})
class AppModule {}

export async function createApp(options: { documentation?: boolean } = {}) {
  const app = await NestFactory.create(AppModule, {
    logger: false,
    bodyParser: false,
  });
  app.setGlobalPrefix(API_PREFIX.slice(1));
  app.use((_request: Request, response: Response, next: NextFunction) => {
    response.setHeader('X-Request-Id', randomUUID());
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    next();
  });
  app.use(
    API_PREFIX,
    (request: Request, _response: Response, next: NextFunction) => {
      if (request.method === 'POST' && !request.is('application/json'))
        return next(new ApiException(415, 'UNSUPPORTED_MEDIA_TYPE'));
      next();
    },
  );
  const parseJson = json({ limit: JSON_BODY_LIMIT, strict: true });
  app.use(
    API_PREFIX,
    (request: Request, response: Response, next: NextFunction) => {
      parseJson(request, response, (error?: unknown) => {
        if (!error) return next();
        const kind =
          typeof error === 'object' && 'type' in error ? error.type : undefined;
        // Normalize parser errors before Nest's adapter discards parser metadata.
        if (kind === 'entity.too.large')
          return next(new ApiException(413, 'PAYLOAD_TOO_LARGE'));
        if (kind === 'charset.unsupported' || kind === 'encoding.unsupported')
          return next(new ApiException(415, 'UNSUPPORTED_MEDIA_TYPE'));
        return next(new ApiException(400, 'INVALID_JSON'));
      });
    },
  );
  app.useGlobalFilters(new ApiExceptionFilter());
  if (options.documentation !== false) {
    SwaggerModule.setup('api/v1/docs', app, createOpenApiDocument(app), {
      jsonDocumentUrl: '/api/v1/openapi.json',
      swaggerOptions: { supportedSubmitMethods: [] },
      customSiteTitle: 'Cloudlane API — development contract',
    });
  }
  return app;
}
