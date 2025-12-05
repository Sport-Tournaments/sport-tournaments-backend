import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
  Headers,
  Req,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles, CurrentUser, Public } from '../../common/decorators';
import { UserRole } from '../../common/enums';
import { JwtPayload } from '../../common/interfaces';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('create-intent')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create payment intent for registration' })
  @ApiResponse({ status: 201, description: 'Payment intent created' })
  createPaymentIntent(
    @CurrentUser() user: JwtPayload,
    @Body('registrationId') registrationId: string,
  ) {
    return this.paymentsService.createPaymentIntent(registrationId, user.sub);
  }

  @Post('webhook')
  @Public()
  @ApiOperation({ summary: 'Stripe webhook handler' })
  @ApiResponse({ status: 200, description: 'Webhook processed' })
  async handleWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() req: RawBodyRequest<Request>,
  ) {
    return this.paymentsService.handleWebhook(signature, req.rawBody as Buffer);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get payment by ID' })
  @ApiResponse({ status: 200, description: 'Payment details' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  getPayment(@Param('id', ParseUUIDPipe) id: string) {
    return this.paymentsService.getPaymentById(id);
  }

  @Post(':id/refund')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Initiate refund for a payment' })
  @ApiResponse({ status: 200, description: 'Refund initiated' })
  initiateRefund(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('reason') reason?: string,
  ) {
    return this.paymentsService.initiateRefund(id, reason);
  }

  @Get('tournament/:tournamentId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all payments for a tournament' })
  @ApiResponse({ status: 200, description: 'Tournament payments' })
  getPaymentsByTournament(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
  ) {
    return this.paymentsService.getPaymentsByTournament(tournamentId);
  }
}
