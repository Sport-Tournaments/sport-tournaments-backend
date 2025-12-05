import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { Payment } from './entities/payment.entity';
import { Registration } from '../registrations/entities/registration.entity';
import { Tournament } from '../tournaments/entities/tournament.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Payment, Registration, Tournament])],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
