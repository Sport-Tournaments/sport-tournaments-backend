import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { createUserFixture } from './fixtures';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';

describe('Authentication (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    app.setGlobalPrefix('api');
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '1',
    });

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );

    // Apply global interceptors and filters like main.ts does
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalFilters(new AllExceptionsFilter());

    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);

    // Clean up any existing test data at the start
    if (dataSource.isInitialized) {
      await dataSource.query('DELETE FROM refresh_tokens');
      await dataSource.query('DELETE FROM registrations');
      await dataSource.query('DELETE FROM tournaments');
      await dataSource.query('DELETE FROM users');
    }
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clear users before each test
    if (dataSource.isInitialized) {
      await dataSource.query('DELETE FROM refresh_tokens');
      await dataSource.query('DELETE FROM users');
    }
  });

  describe('/api/v1/auth/register (POST)', () => {
    it('should register new user', async () => {
      const userFixture = createUserFixture({
        email: 'newuser@example.com',
      });

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(userFixture)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data).toHaveProperty('message');
      expect(response.body.data.user.email).toBe('newuser@example.com');
    });

    it('should reject registration with invalid email', async () => {
      const invalidUser = createUserFixture({
        email: 'invalid-email',
      });

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(invalidUser)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject registration with short password', async () => {
      const weakPasswordUser = createUserFixture({
        email: 'test@example.com',
        password: '123',
      });

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(weakPasswordUser)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject registration with duplicate email', async () => {
      const userFixture = createUserFixture({
        email: 'duplicate@example.com',
      });

      // Register first user
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(userFixture)
        .expect(201);

      // Try to register with same email
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(userFixture)
        .expect(409);

      expect(response.body.success).toBe(false);
    });
  });

  describe('/api/v1/auth/login (POST)', () => {
    const testUser = createUserFixture({
      email: 'login@example.com',
      password: 'TestPass123!',
    });

    beforeEach(async () => {
      // Create test user
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(testUser);
    });

    it('should login with correct credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
      expect(response.body.data.user.email).toBe(testUser.email.toLowerCase());
    });

    it('should reject login with wrong password', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword123!',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should reject login with non-existent email', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'Password123!',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('/api/v1/auth/refresh-token (POST)', () => {
    let refreshToken: string;

    beforeEach(async () => {
      const userFixture = createUserFixture({
        email: 'refresh@example.com',
      });

      // Register first
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(userFixture);

      // Then login to get tokens
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: userFixture.email,
          password: userFixture.password,
        });

      refreshToken = loginRes.body.data.refreshToken;
    });

    it('should refresh access token', async () => {
      // Small delay to ensure new JWT has different iat (issued at) timestamp
      // This prevents duplicate key constraint on refresh_tokens.token
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh-token')
        .send({ refreshToken })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
    });

    it('should reject refresh with invalid token', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh-token')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('/api/v1/auth/logout (POST)', () => {
    let accessToken: string;
    let refreshToken: string;

    beforeEach(async () => {
      const userFixture = createUserFixture({
        email: 'logout@example.com',
      });

      // Register first
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(userFixture);

      // Then login to get tokens
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: userFixture.email,
          password: userFixture.password,
        });

      accessToken = loginRes.body.data.accessToken;
      refreshToken = loginRes.body.data.refreshToken;
    });

    it('should logout successfully', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refreshToken })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should reject logout without authentication', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .send({ refreshToken })
        .expect(401);
    });
  });
});
