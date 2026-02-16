import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { createOrganizerFixture, createUserFixture } from './fixtures';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { UserRole } from '../src/common/enums';

/**
 * E2E Test Suite: Pot Management System
 * Tests the full pot-based group draw workflow including:
 * - Pot assignment (single + bulk)
 * - Pot retrieval & validation
 * - Pot-based group draw execution
 * - Pot clearing
 * - Authorization guards
 */
describe('Pot Management (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  // Organizer who owns the tournament
  let organizerToken: string;
  let organizerId: string;

  // Another organizer (should be denied access)
  let otherOrganizerToken: string;

  // Tournament + registration IDs
  let tournamentId: string;
  const clubIds: string[] = [];
  const teamIds: string[] = [];
  const registrationIds: string[] = [];

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

    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalFilters(new AllExceptionsFilter());

    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);

    // Clean slate
    if (dataSource.isInitialized) {
      await dataSource.query('DELETE FROM tournament_pots');
      await dataSource.query('DELETE FROM groups');
      await dataSource.query('DELETE FROM registrations');
      await dataSource.query('DELETE FROM team_players');
      await dataSource.query('DELETE FROM teams');
      await dataSource.query('DELETE FROM clubs');
      await dataSource.query('DELETE FROM refresh_tokens');
      await dataSource.query('DELETE FROM tournaments');
      await dataSource.query('DELETE FROM users');
    }

    // ---- Create organizer (owner) ----
    const orgFixture = createOrganizerFixture({
      email: 'pot-organizer@test.com',
    });
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(orgFixture)
      .expect(201);

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: orgFixture.email, password: orgFixture.password });

    organizerToken = loginRes.body.data.accessToken;
    organizerId = loginRes.body.data.user?.id;

    // ---- Create another organizer ----
    const otherOrgFixture = createOrganizerFixture({
      email: 'other-organizer@test.com',
    });
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(otherOrgFixture)
      .expect(201);

    const otherLoginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: otherOrgFixture.email,
        password: otherOrgFixture.password,
      });

    otherOrganizerToken = otherLoginRes.body.data.accessToken;

    // ---- Create tournament ----
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() + 3);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 2);

    const tournamentRes = await request(app.getHttpServer())
      .post('/api/v1/tournaments')
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({
        name: 'Pot Draw Test Cup 2026',
        description: 'E2E testing for pot management',
        ageCategory: 'U12',
        level: 'LEVEL_I',
        gameSystem: '4+1',
        numberOfMatches: 6,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        location: 'Test City, Romania',
        latitude: 45.0,
        longitude: 25.0,
        maxTeams: 16,
        participationFee: 100,
        currency: 'EUR',
      })
      .expect(201);

    tournamentId = tournamentRes.body.data.id;

    // Publish tournament so registrations are allowed
    await request(app.getHttpServer())
      .post(`/api/v1/tournaments/${tournamentId}/publish`)
      .set('Authorization', `Bearer ${organizerToken}`)
      .expect(201);

    // ---- Create 6 clubs, teams, and registrations ----
    for (let i = 0; i < 6; i++) {
      // Create club
      const clubRes = await request(app.getHttpServer())
        .post('/api/v1/clubs')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          name: `Test Club ${i + 1}`,
          country: 'Romania',
          city: 'Bucharest',
        })
        .expect(201);

      const clubId = clubRes.body.data.id;
      clubIds.push(clubId);

      // Create team
      const teamRes = await request(app.getHttpServer())
        .post('/api/v1/teams')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          clubId,
          name: `Team ${i + 1} U12`,
          ageCategory: 'U12',
          birthyear: 2014,
          coach: `Coach ${i + 1}`,
        })
        .expect(201);

      const teamId = teamRes.body.data.id;
      teamIds.push(teamId);

      // Register for tournament
      const regRes = await request(app.getHttpServer())
        .post(`/api/v1/tournaments/${tournamentId}/register`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          clubId,
          teamId,
          numberOfPlayers: 12,
          coachName: `Coach ${i + 1}`,
          coachPhone: '+40 700 000 00' + i,
        })
        .expect(201);

      registrationIds.push(regRes.body.data.id);

      // Approve registration
      await request(app.getHttpServer())
        .post(`/api/v1/registrations/${regRes.body.data.id}/approve-without-payment`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .expect(201);
    }
  }, 120000);

  afterAll(async () => {
    // Cleanup
    if (dataSource.isInitialized) {
      await dataSource.query('DELETE FROM tournament_pots');
      await dataSource.query('DELETE FROM groups');
      await dataSource.query('DELETE FROM registrations');
      await dataSource.query('DELETE FROM team_players');
      await dataSource.query('DELETE FROM teams');
      await dataSource.query('DELETE FROM clubs');
      await dataSource.query('DELETE FROM refresh_tokens');
      await dataSource.query('DELETE FROM tournaments');
      await dataSource.query('DELETE FROM users');
    }
    await app.close();
  });

  // -------------------------------------------------------
  // 1. GET Pots (empty state)
  // -------------------------------------------------------
  describe('GET /api/v1/tournaments/:id/pots', () => {
    it('should return 4 empty pots initially', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/tournaments/${tournamentId}/pots`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(4);
      for (const pot of res.body.data) {
        expect(pot.count).toBe(0);
        expect(pot.teams).toHaveLength(0);
      }
    });
  });

  // -------------------------------------------------------
  // 2. Single Assignment
  // -------------------------------------------------------
  describe('POST /api/v1/tournaments/:id/pots/assign', () => {
    it('should assign a team to pot 1', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/tournaments/${tournamentId}/pots/assign`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({ registrationId: registrationIds[0], potNumber: 1 })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.potNumber).toBe(1);
      expect(res.body.data.registrationId).toBe(registrationIds[0]);
    });

    it('should move team to different pot (update)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/tournaments/${tournamentId}/pots/assign`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({ registrationId: registrationIds[0], potNumber: 2 })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.potNumber).toBe(2);
    });

    it('should reject invalid pot number', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/tournaments/${tournamentId}/pots/assign`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({ registrationId: registrationIds[0], potNumber: 5 })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('should reject non-existent registration', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/tournaments/${tournamentId}/pots/assign`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          registrationId: '00000000-0000-0000-0000-000000000000',
          potNumber: 1,
        })
        .expect(404);

      expect(res.body.success).toBe(false);
    });

    it('should reject if other organizer tries to assign', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/tournaments/${tournamentId}/pots/assign`)
        .set('Authorization', `Bearer ${otherOrganizerToken}`)
        .send({ registrationId: registrationIds[1], potNumber: 1 })
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  // -------------------------------------------------------
  // 3. Bulk Assignment
  // -------------------------------------------------------
  describe('POST /api/v1/tournaments/:id/pots/bulk-assign', () => {
    beforeAll(async () => {
      // Clear current pots first
      await request(app.getHttpServer())
        .delete(`/api/v1/tournaments/${tournamentId}/pots`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .expect(200);
    });

    it('should assign all 6 teams to pots (2 per pot)', async () => {
      const assignments = [
        { registrationId: registrationIds[0], potNumber: 1 },
        { registrationId: registrationIds[1], potNumber: 1 },
        { registrationId: registrationIds[2], potNumber: 2 },
        { registrationId: registrationIds[3], potNumber: 2 },
        { registrationId: registrationIds[4], potNumber: 3 },
        { registrationId: registrationIds[5], potNumber: 3 },
      ];

      const res = await request(app.getHttpServer())
        .post(`/api/v1/tournaments/${tournamentId}/pots/bulk-assign`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({ assignments })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(6);
    });

    it('should verify pot distribution after bulk assign', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/tournaments/${tournamentId}/pots`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .expect(200);

      expect(res.body.data[0].potNumber).toBe(1);
      expect(res.body.data[0].count).toBe(2);
      expect(res.body.data[1].potNumber).toBe(2);
      expect(res.body.data[1].count).toBe(2);
      expect(res.body.data[2].potNumber).toBe(3);
      expect(res.body.data[2].count).toBe(2);
      expect(res.body.data[3].potNumber).toBe(4);
      expect(res.body.data[3].count).toBe(0);

      // Verify team data is populated
      const firstTeam = res.body.data[0].teams[0];
      expect(firstTeam.registrationId).toBeDefined();
      expect(firstTeam.clubName).toBeDefined();
      expect(firstTeam.clubName).not.toBe('Unknown Club');
    });
  });

  // -------------------------------------------------------
  // 4. Validate Pot Distribution
  // -------------------------------------------------------
  describe('POST /api/v1/tournaments/:id/pots/validate', () => {
    it('should validate current distribution', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/tournaments/${tournamentId}/pots/validate`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.valid).toBe(true);
      expect(res.body.data.message).toContain('6');
      // potCounts should be a plain object (not empty from Map serialization)
      expect(res.body.data.potCounts).toBeDefined();
      expect(typeof res.body.data.potCounts).toBe('object');
      expect(Object.keys(res.body.data.potCounts).length).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------
  // 5. Execute Pot-Based Draw
  // -------------------------------------------------------
  describe('POST /api/v1/tournaments/:id/pots/draw', () => {
    it('should reject draw if other organizer tries', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/tournaments/${tournamentId}/pots/draw`)
        .set('Authorization', `Bearer ${otherOrganizerToken}`)
        .send({ numberOfGroups: 2 })
        .expect(403);
    });

    it('should reject invalid numberOfGroups (0)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/tournaments/${tournamentId}/pots/draw`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({ numberOfGroups: 0 })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('should execute pot draw with 2 groups', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/tournaments/${tournamentId}/pots/draw`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({ numberOfGroups: 2 })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);

      // Group A and Group B
      const groupA = res.body.data.find((g: any) => g.groupLetter === 'A');
      const groupB = res.body.data.find((g: any) => g.groupLetter === 'B');
      expect(groupA).toBeDefined();
      expect(groupB).toBeDefined();

      // Each group should have 3 teams (6 total / 2 groups)
      expect(groupA.teams).toHaveLength(3);
      expect(groupB.teams).toHaveLength(3);

      // All 6 registrations should be distributed
      const allTeams = [...groupA.teams, ...groupB.teams];
      expect(allTeams).toHaveLength(6);
      for (const regId of registrationIds) {
        expect(allTeams).toContain(regId);
      }
    });

    it('should reject second draw (already completed)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/tournaments/${tournamentId}/pots/draw`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({ numberOfGroups: 2 })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('already been completed');
    });
  });

  // -------------------------------------------------------
  // 6. Clear Pot Assignments
  // -------------------------------------------------------
  describe('DELETE /api/v1/tournaments/:id/pots', () => {
    it('should reject clear by other organizer', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/tournaments/${tournamentId}/pots`)
        .set('Authorization', `Bearer ${otherOrganizerToken}`)
        .expect(403);
    });

    it('should clear all pot assignments', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/tournaments/${tournamentId}/pots`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);

      // Verify pots are empty
      const potsRes = await request(app.getHttpServer())
        .get(`/api/v1/tournaments/${tournamentId}/pots`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .expect(200);

      for (const pot of potsRes.body.data) {
        expect(pot.count).toBe(0);
        expect(pot.teams).toHaveLength(0);
      }
    });
  });
});
