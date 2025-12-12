import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { PaymentsService } from './payments.service';
import { Payment } from './entities/payment.entity';
import { Registration } from '../registrations/entities/registration.entity';
import { Tournament } from '../tournaments/entities/tournament.entity';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PaymentStatus, Currency } from '../../common/enums';

// Mock Stripe
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    paymentIntents: {
      create: jest.fn().mockResolvedValue({
        id: 'pi_test123',
        client_secret: 'pi_test123_secret_xxx',
      }),
    },
    webhooks: {
      constructEvent: jest.fn(),
    },
  }));
});

describe('PaymentsService', () => {
  let service: PaymentsService;

  const mockTournament: Partial<Tournament> = {
    id: 'tournament-1',
    name: 'Test Tournament',
    participationFee: 200,
    currency: Currency.EUR,
  };

  const mockClub = {
    id: 'club-1',
    name: 'Test FC',
    organizerId: 'user-1',
  };

  const mockRegistration: Partial<Registration> = {
    id: 'registration-1',
    tournamentId: 'tournament-1',
    clubId: 'club-1',
    tournament: mockTournament as Tournament,
    club: mockClub as unknown as Registration['club'],
  };

  const mockPayment: Partial<Payment> = {
    id: 'payment-1',
    registrationId: 'registration-1',
    amount: 200,
    currency: Currency.EUR,
    status: PaymentStatus.PENDING,
    stripePaymentIntentId: 'pi_test123',
  };

  const mockPaymentsRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([mockPayment]),
    })),
  };

  const mockRegistrationsRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
  };

  const mockTournamentsRepo = {
    findOne: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        'stripe.secretKey': 'sk_test_xxx',
        'stripe.webhookSecret': 'whsec_xxx',
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: getRepositoryToken(Payment),
          useValue: mockPaymentsRepo,
        },
        {
          provide: getRepositoryToken(Registration),
          useValue: mockRegistrationsRepo,
        },
        {
          provide: getRepositoryToken(Tournament),
          useValue: mockTournamentsRepo,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createPaymentIntent', () => {
    it('should create a payment intent successfully', async () => {
      mockRegistrationsRepo.findOne.mockResolvedValue(mockRegistration);
      mockPaymentsRepo.findOne.mockResolvedValue(null);
      mockPaymentsRepo.create.mockReturnValue(mockPayment);
      mockPaymentsRepo.save.mockResolvedValue(mockPayment);

      const result = await service.createPaymentIntent(
        'registration-1',
        'user-1',
      );

      expect(result).toHaveProperty('clientSecret');
      expect(result).toHaveProperty('paymentId');
      expect(result).toHaveProperty('amount');
      expect(result.amount).toBe(200);
    });

    it('should throw NotFoundException if registration not found', async () => {
      mockRegistrationsRepo.findOne.mockResolvedValue(null);

      await expect(
        service.createPaymentIntent('non-existent', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if user does not own the club', async () => {
      mockRegistrationsRepo.findOne.mockResolvedValue({
        ...mockRegistration,
        club: { ...mockClub, organizerId: 'other-user' },
      });

      await expect(
        service.createPaymentIntent('registration-1', 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if payment already completed', async () => {
      mockRegistrationsRepo.findOne.mockResolvedValue(mockRegistration);
      mockPaymentsRepo.findOne.mockResolvedValue({
        ...mockPayment,
        status: PaymentStatus.COMPLETED,
      });

      await expect(
        service.createPaymentIntent('registration-1', 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should update existing pending payment', async () => {
      const existingPayment = {
        ...mockPayment,
        status: PaymentStatus.PENDING,
      };
      mockRegistrationsRepo.findOne.mockResolvedValue(mockRegistration);
      mockPaymentsRepo.findOne.mockResolvedValue(existingPayment);
      mockPaymentsRepo.save.mockResolvedValue(existingPayment);

      const result = await service.createPaymentIntent(
        'registration-1',
        'user-1',
      );

      expect(result).toBeDefined();
      expect(mockPaymentsRepo.save).toHaveBeenCalled();
    });
  });

  describe('getPaymentById', () => {
    it('should return a payment by id', async () => {
      mockPaymentsRepo.findOne.mockResolvedValue(mockPayment);

      const result = await service.getPaymentById('payment-1');

      expect(result).toEqual(mockPayment);
    });

    it('should throw NotFoundException if payment not found', async () => {
      mockPaymentsRepo.findOne.mockResolvedValue(null);

      await expect(service.getPaymentById('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getPaymentsByTournament', () => {
    it('should return payments for a tournament', async () => {
      mockRegistrationsRepo.find.mockResolvedValue([{ id: 'registration-1' }]);
      mockPaymentsRepo.createQueryBuilder.mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockPayment]),
      });

      const result = await service.getPaymentsByTournament('tournament-1');

      expect(result.payments).toHaveLength(1);
      expect(result.summary).toBeDefined();
    });

    it('should return empty array when no registrations', async () => {
      mockRegistrationsRepo.find.mockResolvedValue([]);
      mockTournamentsRepo.findOne.mockResolvedValue({
        id: 'tournament-1',
        currency: 'EUR',
      });

      const result = await service.getPaymentsByTournament('tournament-1');

      expect(result.payments).toHaveLength(0);
      expect(result.summary.total).toBe(0);
    });
  });

  describe('initiateRefund', () => {
    it('should initiate refund for completed payment', async () => {
      const completedPayment = {
        ...mockPayment,
        status: PaymentStatus.COMPLETED,
        stripePaymentIntentId: 'pi_test123',
      };
      mockPaymentsRepo.findOne.mockResolvedValue(completedPayment);
      mockPaymentsRepo.save.mockResolvedValue({
        ...completedPayment,
        status: PaymentStatus.REFUNDED,
      });
      mockRegistrationsRepo.update.mockResolvedValue({ affected: 1 });

      // Mock stripe refund
      (
        service as unknown as { stripe: { refunds: { create: jest.Mock } } }
      ).stripe = {
        refunds: {
          create: jest.fn().mockResolvedValue({ id: 're_test123' }),
        },
      };

      const result = await service.initiateRefund(
        'payment-1',
        'Admin requested refund',
      );

      expect(result.status).toBe(PaymentStatus.REFUNDED);
    });

    it('should throw BadRequestException if payment is not completed', async () => {
      mockPaymentsRepo.findOne.mockResolvedValue(mockPayment);

      await expect(service.initiateRefund('payment-1', 'Test')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if stripe not configured', async () => {
      const completedPayment = {
        ...mockPayment,
        status: PaymentStatus.COMPLETED,
      };
      mockPaymentsRepo.findOne.mockResolvedValue(completedPayment);

      // Clear stripe instance
      (service as unknown as { stripe: null }).stripe = null;

      await expect(service.initiateRefund('payment-1', 'Test')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
