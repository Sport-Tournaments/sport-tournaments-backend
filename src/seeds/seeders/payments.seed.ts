import { DataSource } from 'typeorm';
import { faker } from '@faker-js/faker';
import {
  generateUUID,
  generateStripePaymentIntentId,
  generateStripeChargeId,
  generateStripeRefundId,
  generateStripeCustomerId,
} from '../utils/helpers';
import { PaymentStatus, Currency } from '../../common/enums';

export interface SeededPayment {
  id: string;
  registrationId: string;
  userId: string;
  amount: number;
  status: PaymentStatus;
}

export async function seedPayments(
  dataSource: DataSource,
  registrations: {
    id: string;
    clubId: string;
    tournamentId: string;
    userId: string;
    paymentStatus: string;
    fee: number;
  }[],
): Promise<SeededPayment[]> {
  const paymentRepository = dataSource.getRepository('Payment');

  const seededPayments: SeededPayment[] = [];

  // Create payments for registrations that have payment activity
  const registrationsWithPayments = registrations.filter(
    (r) => r.paymentStatus !== 'PENDING' || Math.random() > 0.3, // 70% chance even pending have payment attempts
  );

  for (const registration of registrationsWithPayments) {
    const paymentId = generateUUID();

    // Map registration payment status to payment status
    let paymentStatus: PaymentStatus;
    switch (registration.paymentStatus) {
      case 'COMPLETED':
        paymentStatus = PaymentStatus.COMPLETED;
        break;
      case 'FAILED':
        paymentStatus = PaymentStatus.FAILED;
        break;
      case 'REFUNDED':
        paymentStatus = PaymentStatus.REFUNDED;
        break;
      default:
        // For pending, randomly choose pending or failed
        paymentStatus =
          Math.random() > 0.7 ? PaymentStatus.FAILED : PaymentStatus.PENDING;
    }

    const amount = registration.fee || faker.number.int({ min: 100, max: 500 });
    const currency = Currency.EUR;

    const paymentData: Record<string, unknown> = {
      id: paymentId,
      registration: { id: registration.id },
      user: { id: registration.userId },
      tournament: { id: registration.tournamentId },
      amount,
      currency,
      status: paymentStatus,
      stripePaymentIntentId: generateStripePaymentIntentId(),
      stripeCustomerId: generateStripeCustomerId(),
      metadata: {
        tournamentId: registration.tournamentId,
        clubId: registration.clubId,
        registrationId: registration.id,
      },
      createdAt: faker.date.recent({ days: 60 }),
      updatedAt: new Date(),
    };

    // Add charge ID and transaction date for completed payments
    if (
      paymentStatus === PaymentStatus.COMPLETED ||
      paymentStatus === PaymentStatus.REFUNDED
    ) {
      paymentData.stripeChargeId = generateStripeChargeId();
      paymentData.transactionDate = faker.date.recent({ days: 30 });
      paymentData.stripeFee = Number((amount * 0.029 + 0.3).toFixed(2)); // Stripe standard fee
    }

    // Add refund info for refunded payments
    if (paymentStatus === PaymentStatus.REFUNDED) {
      paymentData.refundId = generateStripeRefundId();
      paymentData.refundAmount = amount;
      paymentData.refundReason = faker.helpers.arrayElement([
        'Tournament cancelled',
        'Club withdrew',
        'Duplicate payment',
        'Customer request',
      ]);
    }

    await paymentRepository.insert(paymentData);

    seededPayments.push({
      id: paymentId,
      registrationId: registration.id,
      userId: registration.userId,
      amount,
      status: paymentStatus,
    });
  }

  console.log(`✅ Seeded ${seededPayments.length} payments`);
  return seededPayments;
}
