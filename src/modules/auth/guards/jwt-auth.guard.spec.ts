import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../../common/decorators';

// Mock the AuthGuard before importing JwtAuthGuard
jest.mock('@nestjs/passport', () => ({
  AuthGuard: jest.fn(() => {
    return class MockAuthGuard {
      canActivate() {
        return true;
      }
    };
  }),
}));

// Import after mocking
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: Reflector;

  const mockReflector = {
    getAllAndOverride: jest.fn(),
  };

  beforeEach(() => {
    reflector = mockReflector as unknown as Reflector;
    guard = new JwtAuthGuard(reflector);
    jest.clearAllMocks();
  });

  const mockHandler = jest.fn();
  const mockClass = jest.fn();

  const createMockExecutionContext = (): ExecutionContext => ({
    getHandler: () => mockHandler,
    getClass: () => mockClass,
    getArgs: jest.fn(),
    getArgByIndex: jest.fn(),
    switchToRpc: jest.fn(),
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn().mockReturnValue({}),
      getResponse: jest.fn(),
      getNext: jest.fn(),
    }),
    switchToWs: jest.fn(),
    getType: jest.fn(),
  });

  describe('canActivate', () => {
    it('should return true for public routes', () => {
      mockReflector.getAllAndOverride.mockReturnValue(true);
      const context = createMockExecutionContext();

      const result = guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith(
        IS_PUBLIC_KEY,
        [mockHandler, mockClass],
      );
    });

    it('should call parent canActivate for protected routes', () => {
      mockReflector.getAllAndOverride.mockReturnValue(false);
      const context = createMockExecutionContext();

      const result = guard.canActivate(context);

      // The mocked parent should return true
      expect(result).toBe(true);
      expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith(
        IS_PUBLIC_KEY,
        [mockHandler, mockClass],
      );
    });

    it('should pass handler and class to reflector', () => {
      mockReflector.getAllAndOverride.mockReturnValue(false);
      const context = createMockExecutionContext();

      void guard.canActivate(context);

      expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith(
        IS_PUBLIC_KEY,
        [mockHandler, mockClass],
      );
    });
  });
});
