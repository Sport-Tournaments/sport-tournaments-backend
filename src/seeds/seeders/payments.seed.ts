import { DataSource } from 'typeorm';
import {
  faker,
  generateUUID,
  generateStripePaymentIntentId,
  generateStripeChargeId,
  generateStripeRefundId,
  generateStripeCustomerId,
  seedDate,
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

  const registrationsWithPayments = registrations.filter(
    (r) => r.paymentStatus !== 'PENDING' || Math.random() > 0.3,
  );

  for (const registration of registrationsWithPayments) {
    const paymentId = generateUUID();

    let paymentStatus: PaymentStatus;
    switch (registration.paymentStatus) {
      case 'COMPLETED': paymentStatus = PaymentStatus.COMPLETED; break;
      case 'FAILED': paymentStatus = PaymentStatus.FAILED; break;
      case 'REFUNDED': paymentStatus = PaymentStatus.REFUNDED; break;
      default: paymentStatus = Math.random() > 0.7 ? PaymentStatus.FAILED : PaymentStatus.PENDING;
    }

    const amount = registration.fee || faker.number.int({ min: 200, max: 2000 });
    const currency = Currency.RON;

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
      createdAt: seedDate(),
      updatedAt: new Date(),
    };

    if (paymentStatus === PaymentStatus.COMPLETED || paymentStatus === PaymentStatus.REFUNDED) {
      paymentData.stripeChargeId = generateStripeChargeId();
      paymentData.transactionDate = seedDate();
      paymentData.stripeFee = Number((amount * 0.029 + 0.3).toFixed(2));
    }

    if (paymentStatus === PaymentStatus.REFUNDED) {
      paymentData.refundId = generateStripeRefundId();
      paymentData.refundAmount = amount;
      paymentData.refundReason = faker.helpers.arrayElement([
        'Turneu anulat',
        'Clubul s-a retras',
        'Plată duplicat',
        'Cerere client',
      ]);
    }

    await paymentRepository.insert(paymentData);
    seededPayments.push({ id: paymentId, registrationId: registration.id, userId: registration.userId, amount, status: paymentStatus });
  }

  console.log(`✅ Seeded ${seededPayments.length} payments`);
  return seededPayments;
}
