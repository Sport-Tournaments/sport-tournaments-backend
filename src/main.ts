import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);

  // Security middleware
  app.use(helmet());

  // CORS configuration
  app.enableCors({
    origin: configService.get<string>('cors.origins')?.split(',') || ['http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept-Language'],
    credentials: true,
  });

  // API prefix
  app.setGlobalPrefix('api');

  // API versioning
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip properties not defined in DTO
      forbidNonWhitelisted: true, // Throw error for unknown properties
      transform: true, // Transform payloads to DTO instances
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global exception filter
  app.useGlobalFilters(new AllExceptionsFilter());

  // Global response transformer
  app.useGlobalInterceptors(new TransformInterceptor());

  // Swagger documentation (development only)
  if (configService.get<string>('nodeEnv') === 'development') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Football Tournament Platform API')
      .setDescription(
        `
## Overview
API for the Football Tournament Management Platform.

## Authentication
Most endpoints require JWT authentication. Include the access token in the Authorization header:
\`Authorization: Bearer <access_token>\`

## User Roles
- **ADMIN**: Full platform access
- **ORGANIZER**: Can create and manage tournaments
- **PARTICIPANT**: Can manage clubs and register for tournaments

## Rate Limiting
- Standard endpoints: 100 requests per minute
- Authentication endpoints: 10 requests per minute
        `,
      )
      .setVersion('1.0')
      .setContact(
        'Football Tournament Platform',
        'https://football-tournament.example.com',
        'support@football-tournament.example.com',
      )
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'JWT',
          description: 'Enter JWT token',
          in: 'header',
        },
        'JWT-auth',
      )
      .addTag('Auth', 'Authentication and authorization endpoints')
      .addTag('Users', 'User management endpoints')
      .addTag('Clubs', 'Club management endpoints')
      .addTag('Tournaments', 'Tournament management endpoints')
      .addTag('Registrations', 'Tournament registration endpoints')
      .addTag('Groups', 'Group draw and management endpoints')
      .addTag('Payments', 'Payment processing endpoints')
      .addTag('Notifications', 'Notification management endpoints')
      .addTag('Files', 'File upload and management endpoints')
      .addTag('Admin', 'Admin panel endpoints')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
      },
      customSiteTitle: 'Football Tournament API Docs',
    });

    // Swagger JSON endpoint
    app.use('/api/swagger-json', (req, res) => {
      res.json(document);
    });

    logger.log('Swagger documentation enabled at /api/docs');
  }

  // Health check endpoint
  app.getHttpAdapter().get('/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  const port = configService.get<number>('port') || 3000;
  const nodeEnv = configService.get<string>('nodeEnv') || 'development';
  await app.listen(port);

  logger.log(`Application is running on: http://localhost:${port}`);
  if (nodeEnv === 'development') {
    logger.log(`API Documentation: http://localhost:${port}/api/docs`);
    logger.log(`Swagger JSON: http://localhost:${port}/api/swagger-json`);
  }
  logger.log(`Environment: ${nodeEnv}`);
}

bootstrap();
