import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { createOrganizerFixture, createTournamentFixture } from './fixtures';

describe('Tournaments (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let organizerToken: string;
  let organizerId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    
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

    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);

    // Create test organizer and get token
    const organizerFixture = createOrganizerFixture({
      email: 'organizer@tournament-test.com',
    });

    const registerRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(organizerFixture);

    organizerToken = registerRes.body.data.accessToken;
    organizerId = registerRes.body.data.user.id;
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
        .send(tournamentFixture)
        .expect(201);

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

      // Publish the tournament
      await request(app.getHttpServer())
        .patch(`/api/v1/tournaments/${tournamentId}/publish`)
        .set('Authorization', `Bearer ${organizerToken}`);
    });

    it('should retrieve all published tournaments', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/tournaments')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should apply pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/tournaments')
        .query({ page: 1, pageSize: 10 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.meta.page).toBe(1);
      expect(response.body.meta.limit).toBe(10);
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
      await request(app.getHttpServer())
        .get('/api/v1/tournaments/non-existent-uuid')
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

  describe('PATCH /api/v1/tournaments/:id/publish', () => {
    let tournamentId: string;

    beforeEach(async () => {
      const tournamentFixture = createTournamentFixture();

      const createRes = await request(app.getHttpServer())
        .post('/api/v1/tournaments')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send(tournamentFixture);

      tournamentId = createRes.body.data.id;
    });

    it('should publish tournament', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/tournaments/${tournamentId}/publish`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('PUBLISHED');
      expect(response.body.data.isPublished).toBe(true);
    });
  });
});
