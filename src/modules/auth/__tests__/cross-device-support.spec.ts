import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
import { User } from '../../users/entities/user.entity';
import { RefreshToken } from '../entities/refresh-token.entity';
import { UnauthorizedException } from '@nestjs/common';
import { UserRole } from '../../../common/enums';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-v4'),
}));

/**
 * Unit Test Suite: Cross-Device Token Support
 * Issue #31: Login credentials not shared between mobile and Chrome
 *
 * Verifies that the backend allows token refresh across different devices
 * without device validation restrictions.
 */
describe('Cross-Device Token Support (Issue #31)', () => {
  let service: AuthService;
  let refreshTokenRepository: any;

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
    refreshTokenRepository = module.get(getRepositoryToken(RefreshToken));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Cross-Device Token Refresh (Option B)', () => {
    /**
     * CRITICAL TEST: Verifies that the same refresh token generated on
     * one device (mobile) can be used on another device (desktop) without
     * being blocked by device validation logic.
     *
     * User Journey:
     * 1. User logs in on mobile (iPhone User-Agent)
     * 2. Backend stores device info: iPhone, IP address
     * 3. User attempts to refresh token from desktop (Chrome User-Agent)
     * 4. Backend allows refresh (NO device validation)
     * 5. User gets new tokens and can access API from desktop
     */
    it('should allow token refresh from a DIFFERENT device', async () => {
      // Simulate: User logged in on mobile, got refresh token with mobile device info
      const mobileRefreshToken = 'mobile-refresh-token-abc123';
      const mobileDeviceInfo = 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0)';
      const mobileIpAddress = '192.168.1.100';

      const storedMobileToken = {
        id: 'refresh-mobile-1',
        token: mobileRefreshToken,
        user: mockUser,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        isRevoked: false,
        deviceInfo: mobileDeviceInfo, // Device info IS stored
        ipAddress: mobileIpAddress, // IP address IS stored
      };

      mockRefreshTokenRepository.findOne.mockResolvedValue(
        storedMobileToken,
      );
      mockRefreshTokenRepository.update.mockResolvedValue({ affected: 1 });
      mockRefreshTokenRepository.create.mockReturnValue({});
      mockRefreshTokenRepository.save.mockResolvedValue({});

      // Now user tries to refresh from DIFFERENT device (desktop Chrome)
      const desktopDeviceInfo = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
      const desktopIpAddress = '192.168.1.200';

      // CRITICAL: Call refreshTokens with token from mobile, but simulating desktop
      const result = await service.refreshTokens({
        refreshToken: mobileRefreshToken,
        ipAddress: desktopIpAddress,
        deviceInfo: desktopDeviceInfo,
      });

      // Verify: Token refresh succeeds (NOT blocked by device change)
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(mockRefreshTokenRepository.findOne).toHaveBeenCalledWith({
        where: { token: mobileRefreshToken, isRevoked: false },
        relations: ['user'],
      });
    });

    /**
     * Secondary Test: Verify that device info is STORED but NOT VALIDATED
     * This is the core of Option B: we collect device data for audit trails
     * but don't restrict token usage based on device changes
     */
    it('should store device information for audit trail but NOT validate it', async () => {
      // Step 1: User logs in with specific device info
      const loginDeviceInfo = 'Mozilla/5.0 (iPhone)';
      const loginIpAddress = '10.0.0.1';

      const refreshTokenEntity = {
        id: 'audit-token-1',
        token: 'audit-refresh-token',
        user: mockUser,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        isRevoked: false,
        deviceInfo: loginDeviceInfo, // Stored ✓
        ipAddress: loginIpAddress, // Stored ✓
      };

      mockRefreshTokenRepository.findOne.mockResolvedValue(
        refreshTokenEntity,
      );
      mockRefreshTokenRepository.update.mockResolvedValue({ affected: 1 });
      mockRefreshTokenRepository.create.mockReturnValue({});
      mockRefreshTokenRepository.save.mockResolvedValue({});

      // Step 2: Later, refresh from COMPLETELY DIFFERENT device and IP
      const differentDeviceInfo = 'Mozilla/5.0 (Android)';
      const differentIpAddress = '20.0.0.1';

      // This should NOT throw an error because device validation is NOT performed
      const result = await service.refreshTokens({
        refreshToken: 'audit-refresh-token',
        ipAddress: differentIpAddress,
        deviceInfo: differentDeviceInfo,
      });

      // Verify: Token refresh succeeds despite device/IP change
      expect(result).toBeDefined();
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');

      // No device validation logic should have been called
      // (if there was device validation, the test would fail)
    });

    /**
     * Test: Confirm that REVOCATION still works
     * Even though we allow cross-device usage, we still enforce revocation
     */
    it('should reject revoked tokens regardless of device', async () => {
      // The auth service queries with isRevoked: false, so revoked tokens
      // are simply not found in the database query
      mockRefreshTokenRepository.findOne.mockResolvedValue(null); // Not found because isRevoked: false

      // Should throw UnauthorizedException because token is not found
      // (tokens are not found if they're revoked)
      await expect(
        service.refreshTokens({
          refreshToken: 'revoked-refresh-token',
          ipAddress: '192.168.1.200', // Different IP
          deviceInfo: 'Mozilla/5.0 (Windows)',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    /**
     * Test: Verify invalid tokens are still rejected
     */
    it('should reject invalid refresh tokens regardless of device', async () => {
      mockRefreshTokenRepository.findOne.mockResolvedValue(null);

      // Invalid token should be rejected
      await expect(
        service.refreshTokens({
          refreshToken: 'invalid-token-xyz',
          ipAddress: '192.168.1.100',
          deviceInfo: 'Mozilla/5.0 (iPhone)',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    /**
     * Test: Multiple devices can use the same refresh token
     * This simulates a user with multiple tabs/windows on different devices
     */
    it('should support rapid token refresh from multiple simulated devices', async () => {
      const originalToken = {
        id: 'multi-device-token',
        token: 'original-refresh-token',
        user: mockUser,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        isRevoked: false,
        deviceInfo: 'Mozilla/5.0 (iPhone)',
        ipAddress: '192.168.1.100',
      };

      let currentRefreshToken = 'original-refresh-token';

      // Simulate 5 different devices refreshing tokens
      const deviceSimulations = [
        { device: 'iPhone', ip: '192.168.1.100' },
        { device: 'Windows Chrome', ip: '192.168.1.200' },
        { device: 'MacBook Safari', ip: '192.168.1.300' },
        { device: 'Android', ip: '192.168.1.400' },
        { device: 'iPad', ip: '192.168.1.500' },
      ];

      for (const simulation of deviceSimulations) {
        // For each device simulation, reset the mock to return valid token
        mockRefreshTokenRepository.findOne.mockResolvedValue(originalToken);
        mockRefreshTokenRepository.update.mockResolvedValue({ affected: 1 });
        mockRefreshTokenRepository.create.mockReturnValue({});
        mockRefreshTokenRepository.save.mockResolvedValue({});

        const result = await service.refreshTokens({
          refreshToken: currentRefreshToken,
          ipAddress: simulation.ip,
          deviceInfo: `Mozilla/5.0 (${simulation.device})`,
        });

        // All devices should succeed
        expect(result).toHaveProperty('accessToken');
        expect(result).toHaveProperty('refreshToken');

        // Update for next iteration
        currentRefreshToken = result.refreshToken;
      }
    });
  });

  describe('Implementation Verification', () => {
    /**
     * Verify that NO device-based access control exists in refreshTokens
     * This test confirms the absence of device validation logic
     */
    it('should not perform device validation in refreshTokens method', async () => {
      const token = {
        id: 'test-1',
        token: 'test-token',
        user: mockUser,
        expiresAt: new Date(Date.now() + 1000000),
        isRevoked: false,
        deviceInfo: 'Original Device',
        ipAddress: '1.1.1.1',
      };

      mockRefreshTokenRepository.findOne.mockResolvedValue(token);
      mockRefreshTokenRepository.update.mockResolvedValue({ affected: 1 });
      mockRefreshTokenRepository.create.mockReturnValue({});
      mockRefreshTokenRepository.save.mockResolvedValue({});

      // Call with completely different device
      const result = await service.refreshTokens({
        refreshToken: 'test-token',
        ipAddress: '9.9.9.9', // Completely different IP
        deviceInfo: 'Completely Different Device',
      });

      // If device validation exists, this would fail
      expect(result).toBeDefined();
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });
  });
});
