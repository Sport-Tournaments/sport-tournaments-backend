import {
  IsString,
  IsOptional,
  IsEmail,
  IsEnum,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LeadStatus } from '../../../common/enums';

export class CreateLeadDto {
  @ApiProperty({ example: 'Barcelona Easter Cup' })
  @IsString()
  @MaxLength(255)
  tournamentName: string;

  @ApiPropertyOptional({ example: '2027-04-02', description: 'YYYY-MM-DD' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'startDate must be YYYY-MM-DD' })
  startDate?: string;

  @ApiPropertyOptional({ example: 'Barcelona, Spain' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ example: 'https://example.com/tournament' })
  @IsOptional()
  @IsString()
  sourceUrl?: string;

  @ApiPropertyOptional({ example: 'FC Barcelona Youth' })
  @IsOptional()
  @IsString()
  organiser?: string;

  @ApiPropertyOptional({ example: 'Jordi Puig' })
  @IsOptional()
  @IsString()
  contactName?: string;

  @ApiPropertyOptional({ example: 'organiser@example.com' })
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @ApiPropertyOptional({ example: '+34 600 000 000' })
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiPropertyOptional({ enum: LeadStatus, default: LeadStatus.NEW })
  @IsOptional()
  @IsEnum(LeadStatus)
  status?: LeadStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'User id to assign this lead to' })
  @IsOptional()
  @IsUUID()
  assignedToId?: string;

  @ApiPropertyOptional({ description: 'Link to an existing tournament' })
  @IsOptional()
  @IsUUID()
  tournamentId?: string;
}
