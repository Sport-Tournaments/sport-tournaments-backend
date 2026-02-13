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
  const nodeEnv = configService.get<string>('nodeEnv') || 'development';
  const isDevelopment = nodeEnv === 'development';

  // Security middleware
  app.use(helmet());

  // CORS configuration with proper origin validation
  const allowedOrigins = configService
    .get<string>('cors.origins')
    ?.split(',')
    .map((origin) => origin.trim()) || ['http://localhost:3000'];

  const isLocalNetworkHost = (host: string) => {
    if (host === 'localhost' || host === '127.0.0.1') return true;
    if (host === 'host.containers.internal' || host === 'host.docker.internal') return true;
    if (/^10\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.test(host)) return true;
    if (/^192\.168\.(\d{1,3})\.(\d{1,3})$/.test(host)) return true;
    if (/^172\.(1[6-9]|2\d|3[0-1])\.(\d{1,3})\.(\d{1,3})$/.test(host)) return true;
    return false;
  };

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, Postman, or server-to-server)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      if (isDevelopment) {
        try {
          const { hostname } = new URL(origin);
          if (isLocalNetworkHost(hostname)) {
            callback(null, true);
            return;
          }
        } catch {
          // ignore malformed origin
        }
      }

      callback(
        new Error(`Origin ${origin} is not allowed by CORS policy`),
      );
    },
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
  await app.listen(port);

  logger.log(`Application is running on: http://localhost:${port}`);
  if (nodeEnv === 'development') {
    logger.log(`API Documentation: http://localhost:${port}/api/docs`);
    logger.log(`Swagger JSON: http://localhost:${port}/api/swagger-json`);
  }
  logger.log(`Environment: ${nodeEnv}`);
}

bootstrap();
