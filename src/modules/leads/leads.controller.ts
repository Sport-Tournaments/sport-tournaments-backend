import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Res,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { LeadsService } from './leads.service';
import { CreateLeadDto, UpdateLeadDto, LeadFilterDto } from './dto';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles } from '../../common/decorators';
import { UserRole } from '../../common/enums';

@ApiTags('Admin')
@Controller('admin/leads')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get()
  @ApiOperation({ summary: 'List leads (filter + paginate)' })
  @ApiResponse({ status: 200, description: 'Paginated list of leads' })
  findAll(@Query() filter: LeadFilterDto) {
    return this.leadsService.findAll(filter);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Lead counts per pipeline stage' })
  getStats() {
    return this.leadsService.getStats();
  }

  @Get('export')
  @ApiOperation({ summary: 'Export the (filtered) leads as CSV' })
  async exportCsv(
    @Query() filter: LeadFilterDto,
    @Res() res: Response,
  ): Promise<void> {
    const csv = await this.leadsService.exportCsv(filter);
    res
      .type('text/csv; charset=utf-8')
      .set('Content-Disposition', 'attachment; filename="leads.csv"')
      // Prepend a BOM so Excel opens UTF-8 correctly.
      .send('﻿' + csv);
  }

  @Post('import')
  @ApiOperation({
    summary: 'Create a lead for every tournament without one (idempotent)',
  })
  importFromTournaments() {
    return this.leadsService.importFromTournaments();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a lead' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.leadsService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a lead manually' })
  create(@Body() dto: CreateLeadDto) {
    return this.leadsService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a lead (status, notes, contact, assignee)' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateLeadDto) {
    return this.leadsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a lead' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.leadsService.remove(id);
  }
}
