import { IsOptional, IsEnum, IsString, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { LeadStatus } from '../../../common/enums';

export class LeadFilterDto extends PaginationDto {
  @ApiPropertyOptional({ enum: LeadStatus })
  @IsOptional()
  @IsEnum(LeadStatus)
  status?: LeadStatus;

  @ApiPropertyOptional({
    description: 'Search tournament name, organiser, contact name/email',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by assigned user id' })
  @IsOptional()
  @IsUUID()
  assignedToId?: string;

  @ApiPropertyOptional({ description: 'Filter by origin source' })
  @IsOptional()
  @IsString()
  source?: string;
}
