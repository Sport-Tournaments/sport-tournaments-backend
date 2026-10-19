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
  ParseEnumPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { LeadsService } from './leads.service';
import {
  CreateLeadDto,
  UpdateLeadDto,
  LeadFilterDto,
  CreateLeadActivityDto,
  UpdateLeadActivityDto,
  BulkUpdateLeadsDto,
  CrmDirectoryFilterDto,
  ImportLeadsDto,
} from './dto';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { CurrentUser, Roles } from '../../common/decorators';
import { LeadType, UserRole } from '../../common/enums';
import { JwtPayload } from '../../common/interfaces';

/** CRM endpoints. Admins and managers can use all of them except delete. */
@ApiTags('CRM')
@Controller('admin/leads')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MANAGER)
@ApiBearerAuth()
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get()
  @ApiOperation({ summary: 'List leads (filter, sort + paginate)' })
  @ApiResponse({ status: 200, description: 'Paginated list of leads' })
  findAll(@Query() filter: LeadFilterDto, @CurrentUser() user: JwtPayload) {
    return this.leadsService.findAll(filter, user);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Pipeline and follow-up counters' })
  getStats(@CurrentUser() user: JwtPayload) {
    return this.leadsService.getStats(user);
  }

  @Get('tags')
  @ApiOperation({ summary: 'Distinct tags in use' })
  getTags() {
    return this.leadsService.getTags();
  }

  @Get('assignees')
  @ApiOperation({ summary: 'Admin and manager accounts leads can go to' })
  getAssignees() {
    return this.leadsService.getAssignees();
  }

  @Get('clubs')
  @ApiOperation({ summary: 'All clubs, with their CRM lead if tracked' })
  listClubs(@Query() filter: CrmDirectoryFilterDto) {
    return this.leadsService.listClubs(filter);
  }

  @Get('organizers')
  @ApiOperation({
    summary: 'All tournament organizers, with their CRM lead if tracked',
  })
  listOrganizers(@Query() filter: CrmDirectoryFilterDto) {
    return this.leadsService.listOrganizers(filter);
  }

  @Get('export')
  @ApiOperation({ summary: 'Export the (filtered) leads as CSV' })
  async exportCsv(
    @Query() filter: LeadFilterDto,
    @CurrentUser() user: JwtPayload,
    @Res() res: Response,
  ): Promise<void> {
    const csv = await this.leadsService.exportCsv(filter, user);
    res
      .type('text/csv; charset=utf-8')
      .set('Content-Disposition', 'attachment; filename="leads.csv"')
      // Prepend a BOM so Excel opens UTF-8 correctly.
      .send('﻿' + csv);
  }

  @Post('import')
  @ApiOperation({
    summary:
      'Create a lead for every tournament / club / organizer without one (idempotent)',
  })
  importLeads(@Body() dto: ImportLeadsDto) {
    return this.leadsService.importLeads(dto?.types);
  }

  @Post('track/:type/:recordId')
  @ApiOperation({
    summary: 'Get or create the lead for a tournament, club or organizer',
  })
  track(
    @Param('type', new ParseEnumPipe(LeadType)) type: LeadType,
    @Param('recordId', ParseUUIDPipe) recordId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.leadsService.track(type, recordId, user);
  }

  @Patch('bulk')
  @ApiOperation({
    summary: 'Update status / priority / assignee of many leads',
  })
  bulkUpdate(@Body() dto: BulkUpdateLeadsDto, @CurrentUser() user: JwtPayload) {
    return this.leadsService.bulkUpdate(dto, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a lead' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.leadsService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a lead manually' })
  create(@Body() dto: CreateLeadDto, @CurrentUser() user: JwtPayload) {
    return this.leadsService.create(dto, user);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a lead (status, priority, notes, follow-up, assignee)',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLeadDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.leadsService.update(id, dto, user);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a lead (admin only)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.leadsService.remove(id);
  }

  // ── Activity timeline ──

  @Get(':id/activities')
  @ApiOperation({ summary: "A lead's activity timeline, newest first" })
  getActivities(@Param('id', ParseUUIDPipe) id: string) {
    return this.leadsService.getActivities(id);
  }

  @Post(':id/activities')
  @ApiOperation({ summary: 'Add an internal note or log a call/email/meeting' })
  addActivity(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateLeadActivityDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.leadsService.addActivity(id, dto, user);
  }

  @Patch(':id/activities/:activityId')
  @ApiOperation({ summary: 'Edit a note (author or admin)' })
  updateActivity(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('activityId', ParseUUIDPipe) activityId: string,
    @Body() dto: UpdateLeadActivityDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.leadsService.updateActivity(id, activityId, dto, user);
  }

  @Delete(':id/activities/:activityId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a note (author or admin)' })
  removeActivity(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('activityId', ParseUUIDPipe) activityId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.leadsService.removeActivity(id, activityId, user);
  }
}
