import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { UserRole } from '../../../common/enums';
import { ROLES_KEY } from '../../../common/decorators';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  const mockReflector = {
    getAllAndOverride: jest.fn(),
  };

  beforeEach(() => {
    reflector = mockReflector as unknown as Reflector;
    guard = new RolesGuard(reflector);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const createMockExecutionContext = (
    user: { sub?: string; email?: string; role?: UserRole } | null = null,
  ): ExecutionContext => ({
    getHandler: jest.fn(),
    getClass: jest.fn(),
    getArgs: jest.fn(),
    getArgByIndex: jest.fn(),
    switchToRpc: jest.fn(),
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn().mockReturnValue({ user }),
      getResponse: jest.fn(),
      getNext: jest.fn(),
    }),
    switchToWs: jest.fn(),
    getType: jest.fn(),
  });

  describe('canActivate', () => {
    it('should return true when no roles are required', () => {
      mockReflector.getAllAndOverride.mockReturnValue(undefined);
      const context = createMockExecutionContext();

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should return true when roles is null', () => {
      mockReflector.getAllAndOverride.mockReturnValue(null);
      const context = createMockExecutionContext({
        role: UserRole.PARTICIPANT,
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should return false when no user in request', () => {
      mockReflector.getAllAndOverride.mockReturnValue([UserRole.ORGANIZER]);
      const context = createMockExecutionContext(null);

      const result = guard.canActivate(context);

      expect(result).toBe(false);
    });

    it('should return true when user has required role', () => {
      mockReflector.getAllAndOverride.mockReturnValue([UserRole.ORGANIZER]);
      const context = createMockExecutionContext({
        sub: 'user-1',
        email: 'test@example.com',
        role: UserRole.ORGANIZER,
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should return false when user does not have required role', () => {
      mockReflector.getAllAndOverride.mockReturnValue([UserRole.ORGANIZER]);
      const context = createMockExecutionContext({
        sub: 'user-1',
        email: 'test@example.com',
        role: UserRole.PARTICIPANT,
      });

      const result = guard.canActivate(context);

      expect(result).toBe(false);
    });

    it('should return true when user has one of multiple required roles', () => {
      mockReflector.getAllAndOverride.mockReturnValue([
        UserRole.ORGANIZER,
        UserRole.PARTICIPANT,
      ]);
      const context = createMockExecutionContext({
        sub: 'user-1',
        email: 'test@example.com',
        role: UserRole.PARTICIPANT,
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should always return true for ADMIN user regardless of required roles', () => {
      mockReflector.getAllAndOverride.mockReturnValue([UserRole.ORGANIZER]);
      const context = createMockExecutionContext({
        sub: 'admin-1',
        email: 'admin@example.com',
        role: UserRole.ADMIN,
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should give admin access even when only PARTICIPANT is required', () => {
      mockReflector.getAllAndOverride.mockReturnValue([UserRole.PARTICIPANT]);
      const context = createMockExecutionContext({
        sub: 'admin-1',
        email: 'admin@example.com',
        role: UserRole.ADMIN,
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should check both handler and class for roles decorator', () => {
      mockReflector.getAllAndOverride.mockReturnValue([UserRole.ORGANIZER]);
      const context = createMockExecutionContext({
        sub: 'user-1',
        role: UserRole.ORGANIZER,
      });

      guard.canActivate(context);

      expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
    });

    it('should work with USER role', () => {
      mockReflector.getAllAndOverride.mockReturnValue([UserRole.USER]);
      const context = createMockExecutionContext({
        sub: 'user-1',
        email: 'test@example.com',
        role: UserRole.USER,
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });
  });
});
