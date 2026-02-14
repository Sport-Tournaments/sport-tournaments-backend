import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly fromEmail: string;
  private readonly fromName: string;
  private readonly frontendUrl: string;
  private readonly isConfigured: boolean;
  private transporter: Transporter | null = null;

  constructor(private configService: ConfigService) {
    const smtpHost = this.configService.get<string>('smtp.host');
    const smtpUser = this.configService.get<string>('smtp.user');
    const smtpPass = this.configService.get<string>('smtp.pass');
    const smtpPort = this.configService.get<number>('smtp.port') || 465;
    const smtpSecure = this.configService.get<boolean>('smtp.secure') ?? true;

    this.fromEmail =
      this.configService.get<string>('smtp.fromEmail') || smtpUser || 'noreply@yourdomain.com';
    this.fromName =
      this.configService.get<string>('smtp.fromName') || 'Tournamente';
    this.frontendUrl =
      this.configService.get<string>('frontendUrl') ||
      'http://localhost:3000';

    if (smtpHost && smtpUser && smtpPass) {
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });
      this.isConfigured = true;
      this.logger.log('SMTP mail service configured');
    } else {
      this.isConfigured = false;
      this.logger.warn(
        'SMTP not configured - emails will be logged only',
      );
    }
  }

  async sendPasswordResetEmail(
    email: string,
    resetToken: string,
    userName?: string,
  ): Promise<boolean> {
    const resetUrl = `${this.frontendUrl}/auth/reset-password?token=${resetToken}`;

    const subject = 'Reset Your Password';
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1E40AF;">Password Reset Request</h2>
        <p>Hello${userName ? ` ${userName}` : ''},</p>
        <p>We received a request to reset your password for your Football Tournament Platform account.</p>
        <p>Click the button below to reset your password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}"
             style="background-color: #1E40AF; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Reset Password
          </a>
        </div>
        <p>Or copy and paste this link into your browser:</p>
        <p style="color: #666; word-break: break-all;">${resetUrl}</p>
        <p><strong>This link will expire in 1 hour.</strong></p>
        <p>If you didn't request this password reset, you can safely ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="color: #888; font-size: 12px;">
          This email was sent by Football Tournament Platform.<br>
          If you have any questions, please contact our support team.
        </p>
      </div>
    `;

    const textContent = `
Password Reset Request

Hello${userName ? ` ${userName}` : ''},

We received a request to reset your password for your Football Tournament Platform account.

Click this link to reset your password:
${resetUrl}

This link will expire in 1 hour.

If you didn't request this password reset, you can safely ignore this email.

---
Football Tournament Platform
    `.trim();

    return this.sendEmail(email, subject, htmlContent, textContent);
  }

  async sendWelcomeEmail(
    email: string,
    userName: string,
    verificationToken?: string,
  ): Promise<boolean> {
    const subject = 'Welcome to Football Tournament Platform!';

    let verificationSection = '';
    if (verificationToken) {
      const verifyUrl = `${this.frontendUrl}/auth/verify-email?token=${verificationToken}`;
      verificationSection = `
        <p>Please verify your email address by clicking the button below:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verifyUrl}"
             style="background-color: #22C55E; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Verify Email
          </a>
        </div>
      `;
    }

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1E40AF;">Welcome to Football Tournament Platform!</h2>
        <p>Hello ${userName},</p>
        <p>Thank you for joining our platform! We're excited to have you.</p>
        ${verificationSection}
        <p>With your account, you can:</p>
        <ul>
          <li>Create and manage football clubs</li>
          <li>Organize tournaments</li>
          <li>Register teams for competitions</li>
          <li>Track standings and results</li>
        </ul>
        <p>Get started by exploring our tournaments or creating your first club!</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="color: #888; font-size: 12px;">Football Tournament Platform</p>
      </div>
    `;

    const textContent = `
Welcome to Football Tournament Platform!

Hello ${userName},

Thank you for joining our platform! We're excited to have you.

With your account, you can:
- Create and manage football clubs
- Organize tournaments
- Register teams for competitions
- Track standings and results

Get started by exploring our tournaments or creating your first club!

---
Football Tournament Platform
    `.trim();

    return this.sendEmail(email, subject, htmlContent, textContent);
  }

  private async sendEmail(
    to: string,
    subject: string,
    html: string,
    text: string,
  ): Promise<boolean> {
    const mailOptions = {
      from: {
        name: this.fromName,
        address: this.fromEmail,
      },
      to,
      subject,
      text,
      html,
    };

    if (!this.isConfigured || !this.transporter) {
      this.logger.log(`[EMAIL - NOT SENT - SMTP not configured]`);
      this.logger.log(`To: ${to}`);
      this.logger.log(`Subject: ${subject}`);
      this.logger.debug(`Content: ${text}`);
      return true;
    }

    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Email sent successfully to ${to}: ${subject}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}:`, error);
      return false;
    }
  }
}
