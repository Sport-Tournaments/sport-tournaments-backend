import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { createOrganizerFixture, createTournamentFixture } from './fixtures';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';

describe('Tournaments (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let organizerToken: string;

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

    // Clean up any existing test data before starting
    if (dataSource.isInitialized) {
      await dataSource.query('DELETE FROM refresh_tokens');
      await dataSource.query('DELETE FROM registrations');
      await dataSource.query('DELETE FROM tournaments');
      await dataSource.query('DELETE FROM users');
    }

    // Create test organizer and get token
    const organizerFixture = createOrganizerFixture({
      email: 'organizer@tournament-test.com',
    });

    // Register the organizer
    const registerRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(organizerFixture);

    if (registerRes.status !== 201) {
      console.error('Registration failed:', registerRes.body);
    }

    // Login to get the token
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: organizerFixture.email,
        password: organizerFixture.password,
      });

    if (loginRes.status !== 200 || !loginRes.body.data) {
      console.error('Login failed:', loginRes.status, loginRes.body);
    }

    organizerToken = loginRes.body.data?.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clear tournaments before each test
    if (dataSource.isInitialized) {
      await dataSource.query('DELETE FROM registrations');
      await dataSource.query('DELETE FROM tournaments');
    }
  });

  describe('POST /api/v1/tournaments', () => {
    it('should create tournament with valid data', async () => {
      const tournamentFixture = createTournamentFixture();

      const response = await request(app.getHttpServer())
        .post('/api/v1/tournaments')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send(tournamentFixture);

      if (response.status !== 201) {
        console.error(
          'Tournament creation failed:',
          response.status,
          response.body,
        );
        console.error('organizer token:', organizerToken);
        console.error('tournament fixture:', tournamentFixture);
      }

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.name).toBe(tournamentFixture.name);
      expect(response.body.data.status).toBe('DRAFT');
    });

    it('should reject tournament creation without auth', async () => {
      const tournamentFixture = createTournamentFixture();

      await request(app.getHttpServer())
        .post('/api/v1/tournaments')
        .send(tournamentFixture)
        .expect(401);
    });

    it('should reject tournament with invalid dates', async () => {
      const invalidTournament = createTournamentFixture({
        startDate: '2025-06-17',
        endDate: '2025-06-15', // End before start
      });

      const response = await request(app.getHttpServer())
        .post('/api/v1/tournaments')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send(invalidTournament)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/tournaments', () => {
    let tournamentId: string;

    beforeEach(async () => {
      // Create a published tournament
      const tournamentFixture = createTournamentFixture();

      const createRes = await request(app.getHttpServer())
        .post('/api/v1/tournaments')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send(tournamentFixture);

      tournamentId = createRes.body.data.id;

      // Publish the tournament (POST, not PATCH)
      await request(app.getHttpServer())
        .post(`/api/v1/tournaments/${tournamentId}/publish`)
        .set('Authorization', `Bearer ${organizerToken}`);
    });

    it('should retrieve all published tournaments', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/tournaments')
        .expect(200);

      expect(response.body.success).toBe(true);
      // Response is wrapped: { success, data: { data: [], meta: {} } }
      expect(Array.isArray(response.body.data.data)).toBe(true);
    });

    it('should apply pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/tournaments')
        .query({ page: 1, pageSize: 10 })
        .expect(200);

      expect(response.body.success).toBe(true);
      // Response is wrapped: { success, data: { data: [], meta: {} } }
      expect(response.body.data.meta.page).toBe(1);
      expect(response.body.data.meta.limit).toBe(10);
    });

    it('should filter by age category', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/tournaments')
        .query({ ageCategory: 'U12' })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/v1/tournaments/:id', () => {
    let tournamentId: string;

    beforeEach(async () => {
      const tournamentFixture = createTournamentFixture();

      const createRes = await request(app.getHttpServer())
        .post('/api/v1/tournaments')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send(tournamentFixture);

      tournamentId = createRes.body.data.id;
    });

    it('should retrieve tournament by id', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/tournaments/${tournamentId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(tournamentId);
    });

    it('should return 404 for non-existent tournament', async () => {
      // Use a valid UUID format that doesn't exist
      await request(app.getHttpServer())
        .get('/api/v1/tournaments/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });
  });

  describe('PATCH /api/v1/tournaments/:id', () => {
    let tournamentId: string;

    beforeEach(async () => {
      const tournamentFixture = createTournamentFixture();

      const createRes = await request(app.getHttpServer())
        .post('/api/v1/tournaments')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send(tournamentFixture);

      tournamentId = createRes.body.data.id;
    });

    it('should update tournament', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/tournaments/${tournamentId}`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({ name: 'Updated Tournament Name' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Updated Tournament Name');
    });

    it('should reject update without auth', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/tournaments/${tournamentId}`)
        .send({ name: 'Updated Name' })
        .expect(401);
    });
  });

  describe('DELETE /api/v1/tournaments/:id', () => {
    let tournamentId: string;

    beforeEach(async () => {
      const tournamentFixture = createTournamentFixture();

      const createRes = await request(app.getHttpServer())
        .post('/api/v1/tournaments')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send(tournamentFixture);

      tournamentId = createRes.body.data.id;
    });

    it('should delete tournament', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/api/v1/tournaments/${tournamentId}`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should reject delete without auth', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/tournaments/${tournamentId}`)
        .expect(401);
    });
  });

  describe('POST /api/v1/tournaments/:id/publish', () => {
    let tournamentId: string;

    beforeEach(async () => {
      const tournamentFixture = createTournamentFixture();

      const createRes = await request(app.getHttpServer())
        .post('/api/v1/tournaments')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send(tournamentFixture);

      if (createRes.status !== 201 || !createRes.body.data?.id) {
        console.error(
          'Failed to create tournament for publish test:',
          createRes.status,
          createRes.body,
        );
      }

      tournamentId = createRes.body.data?.id;
    });

    it('should publish tournament', async () => {
      expect(tournamentId).toBeDefined();

      const response = await request(app.getHttpServer())
        .post(`/api/v1/tournaments/${tournamentId}/publish`)
        .set('Authorization', `Bearer ${organizerToken}`);

      if (response.status !== 201) {
        console.error('Publish failed:', response.status, response.body);
      }

      // POST returns 201 Created by default in NestJS
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('PUBLISHED');
      expect(response.body.data.isPublished).toBe(true);
    });
  });
});
