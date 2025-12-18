import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { User } from '../users/entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import {
  RegisterDto,
  LoginDto,
  RefreshTokenDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto,
} from './dto';
import { UserRole } from '../../common/enums';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(RefreshToken)
    private refreshTokenRepository: Repository<RefreshToken>,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async register(
    registerDto: RegisterDto,
  ): Promise<{ user: Partial<User>; message: string }> {
    const { email, password, firstName, lastName, phone, country, role } =
      registerDto;

    // Check if user already exists
    const existingUser = await this.usersRepository.findOne({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Only allow ORGANIZER and PARTICIPANT roles during registration
    const allowedRoles = [UserRole.ORGANIZER, UserRole.PARTICIPANT];
    const userRole =
      role && allowedRoles.includes(role) ? role : UserRole.PARTICIPANT;

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Check if email verification is required
    const requireEmailVerification = this.configService.get<boolean>(
      'requireEmailVerification',
      false,
    );

    // Generate email verification token only if verification is required
    const emailVerificationToken = requireEmailVerification
      ? uuidv4()
      : undefined;

    // Create user
    const user = this.usersRepository.create({
      email: email.toLowerCase(),
      password: hashedPassword,
      firstName,
      lastName,
      phone,
      country,
      role: userRole,
      emailVerificationToken,
      isVerified: !requireEmailVerification, // Auto-verify if verification not required
    });

    await this.usersRepository.save(user);

    // Send verification email only if required
    if (requireEmailVerification) {
      // TODO: Send verification email
      this.logger.log(
        `User registered: ${email}, verification token: ${emailVerificationToken}`,
      );
    } else {
      this.logger.log(
        `User registered and auto-verified: ${email} (email verification disabled)`,
      );
    }

    // Return user without sensitive data

    const {
      password: _password,
      emailVerificationToken: _emailToken,
      ...userWithoutPassword
    } = user;

    return {
      user: userWithoutPassword,
      message: requireEmailVerification
        ? 'Registration successful. Please check your email to verify your account.'
        : 'Registration successful. You can now log in.',
    };
  }

  async validateUser(
    email: string,
    password: string,
  ): Promise<Partial<User> | null> {
    const user = await this.usersRepository.findOne({
      where: { email: email.toLowerCase() },
      select: [
        'id',
        'email',
        'password',
        'firstName',
        'lastName',
        'role',
        'isActive',
        'isVerified',
      ],
    });

    if (!user || !user.password) {
      return null;
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Your account has been deactivated');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return null;
    }

    const { password: _pw, ...result } = user;
    return result;
  }

  async login(
    loginDto: LoginDto,
    ipAddress?: string,
    deviceInfo?: string,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    user: Partial<User>;
  }> {
    const user = await this.validateUser(loginDto.email, loginDto.password);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokens(user as User);
    await this.saveRefreshToken(
      user.id as string,
      tokens.refreshToken,
      ipAddress,
      deviceInfo,
    );

    return {
      ...tokens,
      user,
    };
  }

  async refreshTokens(
    refreshTokenDto: RefreshTokenDto,
    ipAddress?: string,
    deviceInfo?: string,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const { refreshToken } = refreshTokenDto;

    // Find the refresh token in database
    const storedToken = await this.refreshTokenRepository.findOne({
      where: { token: refreshToken, isRevoked: false },
      relations: ['user'],
    });

    if (!storedToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Check if token is expired
    if (new Date() > storedToken.expiresAt) {
      await this.refreshTokenRepository.update(storedToken.id, {
        isRevoked: true,
      });
      throw new UnauthorizedException('Refresh token expired');
    }

    // Check if user is still active
    if (!storedToken.user.isActive) {
      throw new UnauthorizedException('User account is deactivated');
    }

    // Revoke old refresh token
    await this.refreshTokenRepository.update(storedToken.id, {
      isRevoked: true,
    });

    // Generate new tokens
    const tokens = await this.generateTokens(storedToken.user);
    await this.saveRefreshToken(
      storedToken.user.id,
      tokens.refreshToken,
      ipAddress,
      deviceInfo,
    );

    return tokens;
  }

  async verifyEmail(token: string): Promise<{ message: string }> {
    const user = await this.usersRepository.findOne({
      where: { emailVerificationToken: token },
    });

    if (!user) {
      throw new BadRequestException('Invalid verification token');
    }

    user.isVerified = true;
    user.emailVerificationToken = undefined;
    await this.usersRepository.save(user);

    return { message: 'Email verified successfully' };
  }

  async forgotPassword(
    forgotPasswordDto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    const { email } = forgotPasswordDto;

    const user = await this.usersRepository.findOne({
      where: { email: email.toLowerCase() },
    });

    if (user) {
      // Generate reset token
      const resetToken = uuidv4();
      const resetExpires = new Date();
      resetExpires.setHours(resetExpires.getHours() + 1); // 1 hour expiry

      await this.usersRepository.update(user.id, {
        passwordResetToken: resetToken,
        passwordResetExpires: resetExpires,
      });

      // TODO: Send password reset email
      this.logger.log(`Password reset token for ${email}: ${resetToken}`);
    }

    // Always return success to prevent email enumeration
    return {
      message:
        'If an account exists with this email, a password reset link has been sent.',
    };
  }

  async resetPassword(
    resetPasswordDto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    const { token, newPassword } = resetPasswordDto;

    const user = await this.usersRepository.findOne({
      where: {
        passwordResetToken: token,
        passwordResetExpires: MoreThan(new Date()),
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    user.password = hashedPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await this.usersRepository.save(user);

    // Revoke all refresh tokens for this user
    await this.refreshTokenRepository.update(
      { userId: user.id, isRevoked: false },
      { isRevoked: true },
    );

    return { message: 'Password reset successfully' };
  }

  async changePassword(
    userId: string,
    changePasswordDto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    const { currentPassword, newPassword } = changePasswordDto;

    const user = await this.usersRepository.findOne({
      where: { id: userId },
      select: ['id', 'password'],
    });

    if (!user || !user.password) {
      throw new UnauthorizedException('User not found');
    }

    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password,
    );

    if (!isCurrentPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await this.usersRepository.update(userId, { password: hashedPassword });

    return { message: 'Password changed successfully' };
  }

  async logout(
    userId: string,
    refreshToken?: string,
  ): Promise<{ message: string }> {
    if (refreshToken) {
      // Revoke specific refresh token
      await this.refreshTokenRepository.update(
        { userId, token: refreshToken },
        { isRevoked: true },
      );
    } else {
      // Revoke all refresh tokens for the user
      await this.refreshTokenRepository.update(
        { userId, isRevoked: false },
        { isRevoked: true },
      );
    }

    return { message: 'Logged out successfully' };
  }

  private async generateTokens(user: User | Partial<User>): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const payload = {
      sub: user.id as string,
      email: user.email as string,
      role: user.role as string,
    };

    const jwtSecret =
      this.configService.get<string>('jwt.secret') || 'default-secret';
    const jwtRefreshSecret =
      this.configService.get<string>('jwt.refreshSecret') ||
      'default-refresh-secret';

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: jwtSecret,
        expiresIn: '15m',
      }),
      this.jwtService.signAsync(payload, {
        secret: jwtRefreshSecret,
        expiresIn: '7d',
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private async saveRefreshToken(
    userId: string,
    token: string,
    ipAddress?: string,
    deviceInfo?: string,
  ): Promise<void> {
    const expiresIn =
      this.configService.get<string>('jwt.refreshExpiresIn') || '7d';
    const expiresAt = new Date();

    // Parse expiry time
    const match = expiresIn.match(/(\d+)([dhms])/);
    if (match) {
      const value = parseInt(match[1], 10);
      const unit = match[2];

      switch (unit) {
        case 'd':
          expiresAt.setDate(expiresAt.getDate() + value);
          break;
        case 'h':
          expiresAt.setHours(expiresAt.getHours() + value);
          break;
        case 'm':
          expiresAt.setMinutes(expiresAt.getMinutes() + value);
          break;
        case 's':
          expiresAt.setSeconds(expiresAt.getSeconds() + value);
          break;
      }
    } else {
      // Default to 7 days
      expiresAt.setDate(expiresAt.getDate() + 7);
    }

    const refreshToken = this.refreshTokenRepository.create({
      userId,
      token,
      expiresAt,
      ipAddress,
      deviceInfo,
    });

    await this.refreshTokenRepository.save(refreshToken);
  }

  // Clean up expired tokens (can be called by a cron job)
  async cleanupExpiredTokens(): Promise<void> {
    await this.refreshTokenRepository.delete({
      expiresAt: MoreThan(new Date()),
    });
  }
}
