import { IsOptional, IsEnum, IsString, IsIn, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { LeadPriority, LeadStatus, LeadType } from '../../../common/enums';

export const LEAD_SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'name',
  'startDate',
  'nextFollowUpAt',
  'lastContactedAt',
  'priority',
] as const;
export type LeadSortField = (typeof LEAD_SORT_FIELDS)[number];

export const FOLLOW_UP_FILTERS = ['overdue', 'today', 'week', 'none'] as const;
export type FollowUpFilter = (typeof FOLLOW_UP_FILTERS)[number];

export class LeadFilterDto extends PaginationDto {
  @ApiPropertyOptional({ enum: LeadStatus })
  @IsOptional()
  @IsEnum(LeadStatus)
  status?: LeadStatus;

  @ApiPropertyOptional({ enum: LeadType })
  @IsOptional()
  @IsEnum(LeadType)
  type?: LeadType;

  @ApiPropertyOptional({ enum: LeadPriority })
  @IsOptional()
  @IsEnum(LeadPriority)
  priority?: LeadPriority;

  @ApiPropertyOptional({
    description: 'Search name, organiser, contact name/email, location',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: "Filter by assigned user id; 'me' for the current user",
  })
  @IsOptional()
  @IsString()
  assignedToId?: string;

  @ApiPropertyOptional({ description: 'Only leads with no assignee' })
  @IsOptional()
  // Read the raw value: implicit conversion would turn 'false' into true.
  @Transform(({ obj, key }) => obj[key] === true || obj[key] === 'true')
  @IsBoolean()
  unassigned?: boolean;

  @ApiPropertyOptional({
    description: 'true: only leads with a phone number; false: only without',
  })
  @IsOptional()
  // Read the raw value: implicit conversion would turn 'false' into true.
  @Transform(({ obj, key }) =>
    obj[key] === true || obj[key] === 'true'
      ? true
      : obj[key] === false || obj[key] === 'false'
        ? false
        : undefined,
  )
  @IsBoolean()
  hasPhone?: boolean;

  @ApiPropertyOptional({ description: 'Filter by origin source' })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional({ description: 'Filter by tag' })
  @IsOptional()
  @IsString()
  tag?: string;

  @ApiPropertyOptional({ description: 'Filter by country' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ enum: FOLLOW_UP_FILTERS })
  @IsOptional()
  @IsIn(FOLLOW_UP_FILTERS)
  followUp?: FollowUpFilter;

  @ApiPropertyOptional({ enum: LEAD_SORT_FIELDS, default: 'createdAt' })
  @IsOptional()
  @IsIn(LEAD_SORT_FIELDS)
  sortBy?: LeadSortField;

  @ApiPropertyOptional({ enum: ['ASC', 'DESC'], default: 'DESC' })
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC';
}
