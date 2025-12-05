import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { User } from '../users/entities/user.entity';
import { Tournament } from '../tournaments/entities/tournament.entity';
import { Registration } from '../registrations/entities/registration.entity';
import { Payment } from '../payments/entities/payment.entity';
import { Club } from '../clubs/entities/club.entity';
import { Notification } from '../notifications/entities/notification.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Tournament,
      Registration,
      Payment,
      Club,
      Notification,
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
