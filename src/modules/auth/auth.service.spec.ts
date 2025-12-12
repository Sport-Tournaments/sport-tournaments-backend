import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { User } from '../users/entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import { UserRole } from '../../common/enums';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-v4'),
}));

describe('AuthService', () => {
  let service: AuthService;

  const mockUser: Partial<User> = {
    id: 'user-1',
    email: 'test@example.com',
    password: '$2b$10$hashedpassword',
    firstName: 'John',
    lastName: 'Doe',
    role: UserRole.PARTICIPANT,
    isActive: true,
    isVerified: true,
    country: 'Romania',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUserRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockRefreshTokenRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    update: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mock-jwt-token'),
    signAsync: jest.fn().mockResolvedValue('mock-jwt-token'),
    verify: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        'jwt.secret': 'test-secret',
        'jwt.expiresIn': '15m',
        'jwt.refreshSecret': 'test-refresh-secret',
        'jwt.refreshExpiresIn': '7d',
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: mockRefreshTokenRepository,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    const registerDto = {
      email: 'newuser@example.com',
      password: 'SecurePass123!',
      firstName: 'Jane',
      lastName: 'Doe',
      country: 'Romania',
      role: UserRole.PARTICIPANT,
    };

    it('should register a new user successfully', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      mockUserRepository.create.mockReturnValue({
        ...mockUser,
        ...registerDto,
        emailVerificationToken: 'mock-uuid-v4',
      });
      mockUserRepository.save.mockResolvedValue({
        ...mockUser,
        ...registerDto,
        id: 'new-user-id',
        emailVerificationToken: 'mock-uuid-v4',
      });

      const result = await service.register(registerDto);

      // Register returns { user, message } not tokens
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('message');
      expect(result.message).toContain('Registration successful');
      expect(mockUserRepository.save).toHaveBeenCalled();
    });

    it('should throw ConflictException if email already exists', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('login', () => {
    const loginDto = {
      email: 'test@example.com',
      password: 'TestPass123!',
    };

    it('should login successfully with correct credentials', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockRefreshTokenRepository.create.mockReturnValue({});
      mockRefreshTokenRepository.save.mockResolvedValue({});

      const result = await service.login(loginDto);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('user');
    });

    it('should throw UnauthorizedException with wrong password', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if user is inactive', async () => {
      mockUserRepository.findOne.mockResolvedValue({
        ...mockUser,
        isActive: false,
      });

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('refreshTokens', () => {
    it('should refresh tokens successfully', async () => {
      const mockRefreshTokenEntity = {
        id: 'refresh-1',
        token: 'valid-refresh-token',
        user: mockUser,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        isRevoked: false,
      };

      mockRefreshTokenRepository.findOne.mockResolvedValue(
        mockRefreshTokenEntity,
      );
      mockRefreshTokenRepository.update.mockResolvedValue({ affected: 1 });
      mockRefreshTokenRepository.save.mockResolvedValue({});
      mockRefreshTokenRepository.create.mockReturnValue({});

      const result = await service.refreshTokens({
        refreshToken: 'valid-refresh-token',
      });

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('should throw UnauthorizedException for invalid refresh token', async () => {
      mockRefreshTokenRepository.findOne.mockResolvedValue(null);

      await expect(
        service.refreshTokens({ refreshToken: 'invalid-token' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for expired refresh token', async () => {
      const expiredToken = {
        id: 'refresh-1',
        token: 'expired-refresh-token',
        user: mockUser,
        expiresAt: new Date(Date.now() - 1000),
        isRevoked: false,
      };

      mockRefreshTokenRepository.findOne.mockResolvedValue(expiredToken);
      mockRefreshTokenRepository.update.mockResolvedValue({ affected: 1 });

      await expect(
        service.refreshTokens({ refreshToken: 'expired-refresh-token' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('should revoke refresh token on logout', async () => {
      mockRefreshTokenRepository.update.mockResolvedValue({ affected: 1 });

      await service.logout('user-1', 'refresh-token');

      expect(mockRefreshTokenRepository.update).toHaveBeenCalled();
    });

    it('should revoke all tokens when no refresh token provided', async () => {
      mockRefreshTokenRepository.update.mockResolvedValue({ affected: 3 });

      await service.logout('user-1');

      expect(mockRefreshTokenRepository.update).toHaveBeenCalled();
    });
  });

  describe('validateUser', () => {
    it('should return user without password for valid credentials', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser(
        'test@example.com',
        'TestPass123!',
      );

      expect(result).toBeDefined();
      expect(result).not.toHaveProperty('password');
    });

    it('should return null for invalid password', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await service.validateUser(
        'test@example.com',
        'WrongPassword',
      );

      expect(result).toBeNull();
    });

    it('should return null for non-existent user', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      const result = await service.validateUser(
        'nonexistent@example.com',
        'TestPass123!',
      );

      expect(result).toBeNull();
    });
  });
});
