import {
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  Min,
  Max,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { RegistrationStatus, PaymentStatus } from '../../../common/enums';
import { PaginationDto } from '../../../common/dto';

export class CreateRegistrationDto {
  @ApiProperty({ description: 'Club ID to register' })
  @IsUUID()
  clubId: string;

  @ApiPropertyOptional({ example: 15 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  numberOfPlayers?: number;

  @ApiPropertyOptional({ example: 'John Smith' })
  @IsOptional()
  @IsString()
  coachName?: string;

  @ApiPropertyOptional({ example: '+34 123 456 789' })
  @IsOptional()
  @IsString()
  coachPhone?: string;

  @ApiPropertyOptional({ example: '+34 987 654 321' })
  @IsOptional()
  @IsString()
  emergencyContact?: string;

  @ApiPropertyOptional({
    example: 'Special dietary requirements for 2 players',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateRegistrationDto {
  @ApiPropertyOptional({ example: 15 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  numberOfPlayers?: number;

  @ApiPropertyOptional({ example: 'John Smith' })
  @IsOptional()
  @IsString()
  coachName?: string;

  @ApiPropertyOptional({ example: '+34 123 456 789' })
  @IsOptional()
  @IsString()
  coachPhone?: string;

  @ApiPropertyOptional({ example: '+34 987 654 321' })
  @IsOptional()
  @IsString()
  emergencyContact?: string;

  @ApiPropertyOptional({ example: 'Special dietary requirements' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class AdminUpdateRegistrationDto extends UpdateRegistrationDto {
  @ApiPropertyOptional({ enum: RegistrationStatus })
  @IsOptional()
  @IsEnum(RegistrationStatus)
  status?: RegistrationStatus;

  @ApiPropertyOptional({ example: 'A' })
  @IsOptional()
  @IsString()
  groupAssignment?: string;

  @ApiPropertyOptional({ enum: PaymentStatus })
  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;
}

export class RegistrationFilterDto extends PaginationDto {
  @ApiPropertyOptional({ enum: RegistrationStatus })
  @IsOptional()
  @IsEnum(RegistrationStatus)
  status?: RegistrationStatus;

  @ApiPropertyOptional({ enum: PaymentStatus })
  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}
