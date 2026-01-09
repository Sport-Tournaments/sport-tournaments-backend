import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { TournamentsService } from './tournaments.service';
import {
  CreateTournamentDto,
  UpdateTournamentDto,
  TournamentFilterDto,
  AdminUpdateTournamentDto,
  ValidateInvitationCodeDto,
  RegenerateInvitationCodeDto,
} from './dto';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles, CurrentUser, Public } from '../../common/decorators';
import { UserRole } from '../../common/enums';
import { JwtPayload } from '../../common/interfaces';

@ApiTags('Tournaments')
@Controller('tournaments')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class TournamentsController {
  constructor(private readonly tournamentsService: TournamentsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new tournament' })
  @ApiResponse({ status: 201, description: 'Tournament created successfully' })
  create(
    @CurrentUser() user: JwtPayload,
    @Body() createTournamentDto: CreateTournamentDto,
  ) {
    return this.tournamentsService.create(user.sub, createTournamentDto);
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'Get all tournaments with pagination and filters' })
  @ApiResponse({ status: 200, description: 'List of tournaments' })
  findAll(@Query() filters: TournamentFilterDto) {
    return this.tournamentsService.findAll(filters, filters);
  }

  @Get('search')
  @Public()
  @ApiOperation({ summary: 'Search tournaments with advanced filters' })
  @ApiResponse({ status: 200, description: 'Search results' })
  search(@Query() filters: TournamentFilterDto) {
    return this.tournamentsService.findAll(filters, filters);
  }

  @Get('featured')
  @Public()
  @ApiOperation({ summary: 'Get featured tournaments' })
  @ApiResponse({ status: 200, description: 'Featured tournaments' })
  getFeatured(@Query('limit') limit?: number) {
    return this.tournamentsService.getFeaturedTournaments(limit);
  }

  @Get('upcoming')
  @Public()
  @ApiOperation({ summary: 'Get upcoming tournaments' })
  @ApiResponse({ status: 200, description: 'Upcoming tournaments' })
  getUpcoming(@Query('limit') limit?: number) {
    return this.tournamentsService.getUpcomingTournaments(limit);
  }

  @Get('my-tournaments')
  @Roles(UserRole.ORGANIZER, UserRole.ADMIN, UserRole.PARTICIPANT)
  @ApiOperation({ summary: 'Get tournaments created by current user' })
  @ApiResponse({ status: 200, description: 'List of user tournaments' })
  getMyTournaments(@CurrentUser() user: JwtPayload) {
    return this.tournamentsService.findByOrganizer(user.sub);
  }

  @Get('statistics')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get tournament statistics (Admin only)' })
  @ApiResponse({ status: 200, description: 'Tournament statistics' })
  getStatistics() {
    return this.tournamentsService.getStatistics();
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get tournament by ID' })
  @ApiResponse({ status: 200, description: 'Tournament details' })
  @ApiResponse({ status: 404, description: 'Tournament not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.tournamentsService.findByIdOrFail(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update tournament' })
  @ApiResponse({ status: 200, description: 'Tournament updated successfully' })
  @ApiResponse({
    status: 403,
    description: 'Not allowed to update this tournament',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() updateTournamentDto: UpdateTournamentDto,
  ) {
    return this.tournamentsService.update(
      id,
      user.sub,
      user.role,
      updateTournamentDto,
    );
  }

  @Patch(':id/admin')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin update tournament (Admin only)' })
  @ApiResponse({ status: 200, description: 'Tournament updated successfully' })
  adminUpdate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() adminUpdateTournamentDto: AdminUpdateTournamentDto,
  ) {
    return this.tournamentsService.adminUpdate(id, adminUpdateTournamentDto);
  }

  @Post(':id/publish')
  @ApiOperation({ summary: 'Publish tournament' })
  @ApiResponse({ status: 200, description: 'Tournament published' })
  publish(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tournamentsService.publish(id, user.sub, user.role);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel tournament' })
  @ApiResponse({ status: 200, description: 'Tournament cancelled' })
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tournamentsService.cancel(id, user.sub, user.role);
  }

  @Post(':id/start')
  @ApiOperation({ summary: 'Start tournament' })
  @ApiResponse({ status: 200, description: 'Tournament started' })
  start(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tournamentsService.start(id, user.sub, user.role);
  }

  @Post(':id/complete')
  @ApiOperation({ summary: 'Complete tournament' })
  @ApiResponse({ status: 200, description: 'Tournament completed' })
  complete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tournamentsService.complete(id, user.sub, user.role);
  }

  @Post(':id/download-regulations')
  @Public()
  @ApiOperation({ summary: 'Track regulations download' })
  @ApiResponse({ status: 200, description: 'Download tracked' })
  downloadRegulations(@Param('id', ParseUUIDPipe) id: string) {
    return this.tournamentsService.incrementRegulationsDownload(id);
  }

  // Invitation code endpoints
  @Get(':id/invitation-code')
  @Roles(UserRole.ORGANIZER)
  @ApiOperation({ summary: 'Get invitation code for a private tournament' })
  @ApiResponse({ status: 200, description: 'Invitation code details' })
  @ApiResponse({ status: 403, description: 'Not authorized' })
  @ApiResponse({ status: 404, description: 'Tournament not found' })
  getInvitationCode(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tournamentsService.getInvitationCode(id, user.sub, user.role);
  }

  @Post(':id/regenerate-invitation-code')
  @Roles(UserRole.ORGANIZER)
  @ApiOperation({ summary: 'Regenerate invitation code for a private tournament' })
  @ApiResponse({ status: 200, description: 'New invitation code generated' })
  @ApiResponse({ status: 400, description: 'Tournament is not private' })
  @ApiResponse({ status: 403, description: 'Not authorized' })
  @ApiResponse({ status: 404, description: 'Tournament not found' })
  regenerateInvitationCode(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: RegenerateInvitationCodeDto,
  ) {
    return this.tournamentsService.regenerateInvitationCode(
      id,
      user.sub,
      user.role,
      dto.expiresInDays,
    );
  }

  @Post('validate-invitation-code')
  @Public()
  @ApiOperation({ summary: 'Validate an invitation code' })
  @ApiResponse({ status: 200, description: 'Validation result' })
  validateInvitationCode(@Body() dto: ValidateInvitationCodeDto) {
    return this.tournamentsService.validateInvitationCode(dto.code);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete tournament' })
  @ApiResponse({ status: 200, description: 'Tournament deleted' })
  @ApiResponse({
    status: 403,
    description: 'Not allowed to delete this tournament',
  })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tournamentsService.remove(id, user.sub, user.role);
  }
}
