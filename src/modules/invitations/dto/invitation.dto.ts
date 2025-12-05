import {
  IsString,
  IsOptional,
  IsUUID,
  IsEmail,
  IsArray,
  IsEnum,
  IsDateString,
  ValidateIf,
  ArrayMinSize,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InvitationType } from '../entities/invitation.entity';

export class CreateInvitationDto {
  @ApiProperty({ description: 'Tournament ID' })
  @IsUUID()
  tournamentId: string;

  @ApiPropertyOptional({ description: 'Club ID for direct invitation' })
  @ValidateIf((o) => !o.email)
  @IsUUID()
  clubId?: string;

  @ApiPropertyOptional({ description: 'Email for email invitation' })
  @ValidateIf((o) => !o.clubId)
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ enum: InvitationType, default: InvitationType.DIRECT })
  @IsOptional()
  @IsEnum(InvitationType)
  type?: InvitationType;

  @ApiPropertyOptional({ description: 'Custom message to include in invitation' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;

  @ApiPropertyOptional({ description: 'Expiration date for the invitation' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class BulkInvitationDto {
  @ApiProperty({ description: 'Tournament ID' })
  @IsUUID()
  tournamentId: string;

  @ApiPropertyOptional({ description: 'Array of club IDs to invite', type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  clubIds?: string[];

  @ApiPropertyOptional({ description: 'Array of emails to invite', type: [String] })
  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  emails?: string[];

  @ApiPropertyOptional({ description: 'Custom message to include in all invitations' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;

  @ApiPropertyOptional({ description: 'Expiration date for all invitations' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({ enum: InvitationType })
  @IsOptional()
  @IsEnum(InvitationType)
  type?: InvitationType;
}

export class InvitePartnerTeamsDto {
  @ApiProperty({ description: 'Tournament ID' })
  @IsUUID()
  tournamentId: string;

  @ApiPropertyOptional({ description: 'Custom message' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;
}

export class InvitePastParticipantsDto {
  @ApiProperty({ description: 'Tournament ID' })
  @IsUUID()
  tournamentId: string;

  @ApiPropertyOptional({ description: 'Limit invitations to teams from specific past tournament' })
  @IsOptional()
  @IsUUID()
  fromTournamentId?: string;

  @ApiPropertyOptional({ description: 'Custom message' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;
}

export class RespondToInvitationDto {
  @ApiProperty({ description: 'Accept or decline the invitation' })
  @IsEnum(['ACCEPTED', 'DECLINED'])
  response: 'ACCEPTED' | 'DECLINED';

  @ApiPropertyOptional({ description: 'Optional response message' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  responseMessage?: string;
}

export class InvitationFilterDto {
  @ApiPropertyOptional({ description: 'Filter by tournament ID' })
  @IsOptional()
  @IsUUID()
  tournamentId?: string;

  @ApiPropertyOptional({ description: 'Filter by status' })
  @IsOptional()
  @IsEnum(['PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED'])
  status?: string;

  @ApiPropertyOptional({ description: 'Filter by type' })
  @IsOptional()
  @IsEnum(InvitationType)
  type?: InvitationType;
}
