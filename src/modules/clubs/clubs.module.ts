import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClubsService } from './clubs.service';
import { ClubsController } from './clubs.controller';
import { Club } from './entities/club.entity';
import { FilesModule } from '../files/files.module';

@Module({
  imports: [TypeOrmModule.forFeature([Club]), FilesModule],
  controllers: [ClubsController],
  providers: [ClubsService],
  exports: [ClubsService],
})
export class ClubsModule {}
