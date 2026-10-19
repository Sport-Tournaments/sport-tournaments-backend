import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LeadActivityType } from '../../../common/enums';

/** Activity kinds a user can log by hand (the rest are system-recorded). */
export const MANUAL_ACTIVITY_TYPES = [
  LeadActivityType.NOTE,
  LeadActivityType.CALL,
  LeadActivityType.EMAIL,
  LeadActivityType.MEETING,
] as const;

export class CreateLeadActivityDto {
  @ApiProperty({ enum: MANUAL_ACTIVITY_TYPES, default: LeadActivityType.NOTE })
  @IsIn(MANUAL_ACTIVITY_TYPES)
  type: (typeof MANUAL_ACTIVITY_TYPES)[number];

  @ApiProperty({ example: 'Spoke with Jordi, call back after Easter.' })
  @IsString()
  @MaxLength(5000)
  content: string;

  @ApiPropertyOptional({
    description: 'Also set the lead next follow-up (ISO timestamp)',
  })
  @IsOptional()
  @IsDateString()
  nextFollowUpAt?: string;
}

export class UpdateLeadActivityDto {
  @ApiProperty()
  @IsString()
  @MaxLength(5000)
  content: string;
}
