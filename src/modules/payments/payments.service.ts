import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { Payment } from './entities/payment.entity';
import { Registration } from '../registrations/entities/registration.entity';
import { Tournament } from '../tournaments/entities/tournament.entity';
import { PaymentStatus, Currency } from '../../common/enums';

@Injectable()
export class PaymentsService {
  private stripe: Stripe;
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(Payment)
    private paymentsRepository: Repository<Payment>,
    @InjectRepository(Registration)
    private registrationsRepository: Repository<Registration>,
    @InjectRepository(Tournament)
    private tournamentsRepository: Repository<Tournament>,
    private configService: ConfigService,
  ) {
    const stripeKey = this.configService.get<string>('stripe.secretKey');
    if (stripeKey) {
      this.stripe = new Stripe(stripeKey);
    }
  }

  async createPaymentIntent(
    registrationId: string,
    userId: string,
  ): Promise<{
    clientSecret: string;
    paymentId: string;
    amount: number;
    currency: string;
  }> {
    if (!this.stripe) {
      throw new BadRequestException('Payment system is not configured');
    }

    // Get registration with tournament
    const registration = await this.registrationsRepository.findOne({
      where: { id: registrationId },
      relations: ['tournament', 'club'],
    });

    if (!registration) {
      throw new NotFoundException('Registration not found');
    }

    // Check if club belongs to user
    if (registration.club.organizerId !== userId) {
      throw new BadRequestException('You can only pay for your own registrations');
    }

    // Check if payment already exists
    const existingPayment = await this.paymentsRepository.findOne({
      where: { registrationId },
    });

    if (existingPayment && existingPayment.status === PaymentStatus.COMPLETED) {
      throw new BadRequestException('Payment has already been completed');
    }

    const tournament = registration.tournament;
    const amount = Math.round(Number(tournament.participationFee) * 100); // Convert to cents
    const currency = tournament.currency.toLowerCase();

    // Create Stripe payment intent
    const paymentIntent = await this.stripe.paymentIntents.create({
      amount,
      currency,
      metadata: {
        registrationId,
        tournamentId: tournament.id,
        clubId: registration.clubId,
        userId,
      },
    });

    // Create or update payment record
    let payment: Payment;
    if (existingPayment) {
      existingPayment.stripePaymentIntentId = paymentIntent.id;
      existingPayment.amount = Number(tournament.participationFee);
      existingPayment.currency = tournament.currency;
      payment = await this.paymentsRepository.save(existingPayment);
    } else {
      payment = this.paymentsRepository.create({
        registrationId,
        amount: Number(tournament.participationFee),
        currency: tournament.currency,
        stripePaymentIntentId: paymentIntent.id,
        status: PaymentStatus.PENDING,
      });
      payment = await this.paymentsRepository.save(payment);
    }

    return {
      clientSecret: paymentIntent.client_secret!,
      paymentId: payment.id,
      amount: Number(tournament.participationFee),
      currency: tournament.currency,
    };
  }

  async handleWebhook(
    signature: string,
    payload: Buffer,
  ): Promise<{ received: boolean }> {
    if (!this.stripe) {
      throw new BadRequestException('Payment system is not configured');
    }

    const webhookSecret = this.configService.get<string>('stripe.webhookSecret');

    if (!webhookSecret) {
      throw new BadRequestException('Webhook secret is not configured');
    }

    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        webhookSecret,
      );
    } catch (err) {
      this.logger.error(`Webhook signature verification failed: ${err.message}`);
      throw new BadRequestException('Invalid webhook signature');
    }

    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.handlePaymentSuccess(event.data.object as Stripe.PaymentIntent);
        break;
      case 'payment_intent.payment_failed':
        await this.handlePaymentFailure(event.data.object as Stripe.PaymentIntent);
        break;
      case 'charge.refunded':
        await this.handleRefund(event.data.object as Stripe.Charge);
        break;
      default:
        this.logger.log(`Unhandled event type: ${event.type}`);
    }

    return { received: true };
  }

  private async handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const payment = await this.paymentsRepository.findOne({
      where: { stripePaymentIntentId: paymentIntent.id },
    });

    if (!payment) {
      this.logger.warn(`Payment not found for intent: ${paymentIntent.id}`);
      return;
    }

    payment.status = PaymentStatus.COMPLETED;
    payment.transactionDate = new Date();
    payment.stripeChargeId = paymentIntent.latest_charge as string;
    await this.paymentsRepository.save(payment);

    // Update registration payment status
    await this.registrationsRepository.update(payment.registrationId, {
      paymentStatus: PaymentStatus.COMPLETED,
      paymentId: payment.id,
    });

    this.logger.log(`Payment completed for registration: ${payment.registrationId}`);
  }

  private async handlePaymentFailure(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const payment = await this.paymentsRepository.findOne({
      where: { stripePaymentIntentId: paymentIntent.id },
    });

    if (!payment) {
      this.logger.warn(`Payment not found for intent: ${paymentIntent.id}`);
      return;
    }

    payment.status = PaymentStatus.FAILED;
    await this.paymentsRepository.save(payment);

    // Update registration payment status
    await this.registrationsRepository.update(payment.registrationId, {
      paymentStatus: PaymentStatus.FAILED,
    });

    this.logger.log(`Payment failed for registration: ${payment.registrationId}`);
  }

  private async handleRefund(charge: Stripe.Charge): Promise<void> {
    const payment = await this.paymentsRepository.findOne({
      where: { stripeChargeId: charge.id },
    });

    if (!payment) {
      this.logger.warn(`Payment not found for charge: ${charge.id}`);
      return;
    }

    payment.status = PaymentStatus.REFUNDED;
    payment.refundAmount = charge.amount_refunded / 100;
    await this.paymentsRepository.save(payment);

    // Update registration payment status
    await this.registrationsRepository.update(payment.registrationId, {
      paymentStatus: PaymentStatus.REFUNDED,
    });

    this.logger.log(`Payment refunded for registration: ${payment.registrationId}`);
  }

  async getPaymentById(id: string): Promise<Payment> {
    const payment = await this.paymentsRepository.findOne({
      where: { id },
      relations: ['registration', 'registration.tournament', 'registration.club'],
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return payment;
  }

  async initiateRefund(
    paymentId: string,
    reason?: string,
  ): Promise<Payment> {
    if (!this.stripe) {
      throw new BadRequestException('Payment system is not configured');
    }

    const payment = await this.getPaymentById(paymentId);

    if (payment.status !== PaymentStatus.COMPLETED) {
      throw new BadRequestException('Can only refund completed payments');
    }

    if (!payment.stripePaymentIntentId) {
      throw new BadRequestException('No Stripe payment intent found');
    }

    // Create refund
    const refund = await this.stripe.refunds.create({
      payment_intent: payment.stripePaymentIntentId,
      reason: 'requested_by_customer',
    });

    payment.status = PaymentStatus.REFUNDED;
    payment.refundId = refund.id;
    payment.refundReason = reason;
    payment.refundAmount = Number(payment.amount);

    await this.paymentsRepository.save(payment);

    // Update registration
    await this.registrationsRepository.update(payment.registrationId, {
      paymentStatus: PaymentStatus.REFUNDED,
    });

    return payment;
  }

  async getPaymentsByTournament(tournamentId: string): Promise<{
    payments: Payment[];
    summary: {
      total: number;
      completed: number;
      pending: number;
      failed: number;
      refunded: number;
      totalAmount: number;
      currency: string;
    };
  }> {
    const registrations = await this.registrationsRepository.find({
      where: { tournamentId },
      select: ['id'],
    });

    const registrationIds = registrations.map((r) => r.id);

    if (registrationIds.length === 0) {
      const tournament = await this.tournamentsRepository.findOne({
        where: { id: tournamentId },
      });

      return {
        payments: [],
        summary: {
          total: 0,
          completed: 0,
          pending: 0,
          failed: 0,
          refunded: 0,
          totalAmount: 0,
          currency: tournament?.currency || Currency.EUR,
        },
      };
    }

    const payments = await this.paymentsRepository
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.registration', 'registration')
      .leftJoinAndSelect('registration.club', 'club')
      .where('payment.registrationId IN (:...registrationIds)', {
        registrationIds,
      })
      .getMany();

    const completed = payments.filter((p) => p.status === PaymentStatus.COMPLETED);
    const pending = payments.filter((p) => p.status === PaymentStatus.PENDING);
    const failed = payments.filter((p) => p.status === PaymentStatus.FAILED);
    const refunded = payments.filter((p) => p.status === PaymentStatus.REFUNDED);

    const totalAmount = completed.reduce(
      (sum, p) => sum + Number(p.amount),
      0,
    );

    return {
      payments,
      summary: {
        total: payments.length,
        completed: completed.length,
        pending: pending.length,
        failed: failed.length,
        refunded: refunded.length,
        totalAmount,
        currency: payments[0]?.currency || Currency.EUR,
      },
    };
  }
}
