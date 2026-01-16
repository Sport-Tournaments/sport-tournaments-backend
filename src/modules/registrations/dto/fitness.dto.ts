import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class ConfirmFitnessDto {
  @ApiProperty({
    description: 'Coach confirmation that team members are fit to play',
    example: true,
  })
  @IsBoolean()
  coachConfirmation: boolean;

  @ApiPropertyOptional({
    description: 'Optional notes about fitness status',
    example: 'All players medically cleared and ready to participate',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class FitnessStatusDto {
  @ApiProperty({ description: 'Whether fitness has been confirmed' })
  fitnessConfirmed: boolean;

  @ApiProperty({ description: 'User ID who confirmed', required: false })
  confirmedById?: string;

  @ApiProperty({ description: 'Confirmation timestamp', required: false })
  confirmedAt?: Date;

  @ApiProperty({ description: 'Fitness notes', required: false })
  notes?: string;
}
