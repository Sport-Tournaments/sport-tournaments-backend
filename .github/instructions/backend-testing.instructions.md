---
description: "Use when writing, running, or debugging tests in the NestJS backend. Covers unit tests, integration tests, e2e tests with Supertest, test module setup, fixture patterns, and coverage configuration."
applyTo: "src/**/*.spec.ts"
---

# Backend Testing Patterns

## Test File Location

- **Unit/Integration specs**: co-located with source — `src/modules/auth/auth.service.spec.ts`
- **E2E specs**: `test/*.e2e-spec.ts`
- Test runner: `jest` with `ts-jest`, `testTimeout: 30000`

## Unit Test Pattern (Service)

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthService } from './auth.service';
import { UserEntity } from '../users/entities/user.entity';

describe('AuthService', () => {
  let service: AuthService;
  let usersRepository: Repository<UserEntity>;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(UserEntity),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersRepository = module.get(getRepositoryToken(UserEntity));
  });

  afterEach(() => jest.clearAllMocks());

  it('should return user on valid credentials', async () => {
    jest.spyOn(usersRepository, 'findOne').mockResolvedValue(mockUser);
    const result = await service.validateUser('test@example.com', 'password');
    expect(result).toMatchObject({ email: 'test@example.com' });
  });
});
```

## E2E Test Pattern

```typescript
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';

describe('Authentication (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Apply same global pipes/filters as main.ts
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(() => app.close());

  beforeEach(async () => {
    // Clean DB between tests
    await cleanDatabase();
  });

  it('POST /api/v1/auth/register → 201', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(userFixture)
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('accessToken');
  });
});
```

## Fixtures

Test fixtures live in `test/fixtures/` and provide factory functions:

```typescript
// test/fixtures/users.fixture.ts
export const createUserFixture = (overrides = {}) => ({
  email: 'test@example.com',
  password: 'Password1!',
  firstName: 'Test',
  lastName: 'User',
  role: UserRole.PARTICIPANT,
  ...overrides,
});
```

Import via `test/fixtures/index.ts` barrel.

## Mocking External Services

Mock services at module level for unit tests:

```typescript
{
  provide: MailService,
  useValue: { sendWelcomeEmail: jest.fn().mockResolvedValue(undefined) },
},
{
  provide: JwtService,
  useValue: { sign: jest.fn().mockReturnValue('mock-token'), verify: jest.fn() },
},
```

## Coverage Thresholds

Configured in `jest.config.js`:
- Branches: 30%
- Functions: 30%
- Lines: 50%
- Statements: 50%

Excluded from coverage: `*.module.ts`, `index.ts`, `*.interface.ts`, `*.dto.ts`, `main.ts`, `seeds/**`.
