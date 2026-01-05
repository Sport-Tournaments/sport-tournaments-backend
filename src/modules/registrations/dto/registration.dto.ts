import {
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  IsArray,
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

  @ApiPropertyOptional({ example: 'Special dietary requirements for 2 players' })
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

// Review workflow DTOs
export class ApproveRegistrationDto {
  @ApiPropertyOptional({ 
    example: 'All documents verified and in order.',
    description: 'Notes from the reviewer about the approval'
  })
  @IsOptional()
  @IsString()
  reviewNotes?: string;
}

export class RejectRegistrationDto {
  @ApiProperty({ 
    example: 'Missing medical certificates for 3 players.',
    description: 'Reason for rejecting the registration'
  })
  @IsString()
  rejectionReason: string;

  @ApiPropertyOptional({ 
    example: 'Please resubmit with complete documentation.',
    description: 'Additional notes for the registrant'
  })
  @IsOptional()
  @IsString()
  reviewNotes?: string;
}

export class BulkReviewDto {
  @ApiProperty({ 
    description: 'Array of registration IDs to process',
    type: [String]
  })
  @IsUUID('4', { each: true })
  registrationIds: string[];

  @ApiPropertyOptional({ 
    example: 'Bulk approval for verified teams.',
    description: 'Notes for all registrations being processed'
  })
  @IsOptional()
  @IsString()
  reviewNotes?: string;
}
