import { IsArray, IsEnum, IsIn, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { LeadType } from '../../../common/enums';

/** Filter for the CRM's club / organizer directories. */
export class CrmDirectoryFilterDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({
    enum: ['tracked', 'untracked'],
    description: 'Only records that do / do not have a lead yet',
  })
  @IsOptional()
  @IsIn(['tracked', 'untracked'])
  tracking?: 'tracked' | 'untracked';
}

export class ImportLeadsDto {
  @ApiPropertyOptional({
    enum: LeadType,
    isArray: true,
    description: 'Which records to import leads from (default: all)',
  })
  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  @IsArray()
  @IsEnum(LeadType, { each: true })
  types?: LeadType[];
}
