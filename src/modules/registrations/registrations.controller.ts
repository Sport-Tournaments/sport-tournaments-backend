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
import { RegistrationsService } from './registrations.service';
import {
  CreateRegistrationDto,
  UpdateRegistrationDto,
  AdminUpdateRegistrationDto,
  RegistrationFilterDto,
  ApproveRegistrationDto,
  RejectRegistrationDto,
  BulkReviewDto,
} from './dto';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles, CurrentUser, Public } from '../../common/decorators';
import { UserRole } from '../../common/enums';
import { JwtPayload } from '../../common/interfaces';

@ApiTags('Registrations')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class RegistrationsController {
  constructor(private readonly registrationsService: RegistrationsService) {}

  @Post('tournaments/:tournamentId/register')
  @ApiOperation({ summary: 'Register a team for a tournament' })
  @ApiResponse({ status: 201, description: 'Registration created' })
  @ApiResponse({ status: 409, description: 'Already registered' })
  create(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @CurrentUser() user: JwtPayload,
    @Body() createRegistrationDto: CreateRegistrationDto,
  ) {
    return this.registrationsService.create(
      tournamentId,
      user.sub,
      createRegistrationDto,
    );
  }

  @Get('tournaments/:tournamentId/registrations')
  @Public()
  @ApiOperation({ summary: 'Get all registrations for a tournament' })
  @ApiResponse({ status: 200, description: 'List of registrations' })
  findByTournament(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Query() filters: RegistrationFilterDto,
  ) {
    return this.registrationsService.findByTournament(
      tournamentId,
      filters,
      filters,
    );
  }

  @Get('tournaments/:tournamentId/registrations/pending')
  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get pending registrations for review' })
  @ApiResponse({ status: 200, description: 'List of pending registrations' })
  getPendingReview(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.registrationsService.getPendingReview(
      tournamentId,
      user.sub,
      user.role,
    );
  }

  @Get('tournaments/:tournamentId/registrations/status')
  @Public()
  @ApiOperation({ summary: 'Get registration statistics for a tournament' })
  @ApiResponse({ status: 200, description: 'Registration statistics' })
  getStatusStatistics(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
  ) {
    return this.registrationsService.getStatusStatistics(tournamentId);
  }

  @Get('registrations/my-registrations')
  @ApiOperation({ summary: 'Get all registrations for current user clubs' })
  @ApiResponse({ status: 200, description: 'List of registrations' })
  getMyRegistrations(@CurrentUser() user: JwtPayload) {
    return this.registrationsService.findByUser(user.sub);
  }

  @Get('registrations/:id')
  @ApiOperation({ summary: 'Get registration by ID' })
  @ApiResponse({ status: 200, description: 'Registration details' })
  @ApiResponse({ status: 404, description: 'Registration not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.registrationsService.findByIdOrFail(id);
  }

  @Patch('registrations/:id')
  @ApiOperation({ summary: 'Update registration' })
  @ApiResponse({ status: 200, description: 'Registration updated' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() updateRegistrationDto: UpdateRegistrationDto,
  ) {
    return this.registrationsService.update(
      id,
      user.sub,
      user.role,
      updateRegistrationDto,
    );
  }

  @Patch('registrations/:id/admin')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin update registration (Admin only)' })
  @ApiResponse({ status: 200, description: 'Registration updated' })
  adminUpdate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() adminUpdateRegistrationDto: AdminUpdateRegistrationDto,
  ) {
    return this.registrationsService.adminUpdate(
      id,
      adminUpdateRegistrationDto,
    );
  }

  @Post('registrations/:id/approve')
  @ApiOperation({ summary: 'Approve registration' })
  @ApiResponse({ status: 200, description: 'Registration approved' })
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: ApproveRegistrationDto,
  ) {
    return this.registrationsService.approve(id, user.sub, user.role, dto);
  }

  @Post('registrations/:id/reject')
  @ApiOperation({ summary: 'Reject registration' })
  @ApiResponse({ status: 200, description: 'Registration rejected' })
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: RejectRegistrationDto,
  ) {
    return this.registrationsService.reject(id, user.sub, user.role, dto);
  }

  @Post('tournaments/:tournamentId/registrations/bulk-approve')
  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Bulk approve multiple registrations' })
  @ApiResponse({ status: 200, description: 'Bulk approval results' })
  bulkApprove(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: BulkReviewDto,
  ) {
    return this.registrationsService.bulkApprove(
      tournamentId,
      user.sub,
      user.role,
      dto,
    );
  }

  @Post('tournaments/:tournamentId/registrations/bulk-reject')
  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Bulk reject multiple registrations' })
  @ApiResponse({ status: 200, description: 'Bulk rejection results' })
  bulkReject(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: BulkReviewDto & { rejectionReason: string },
  ) {
    return this.registrationsService.bulkReject(
      tournamentId,
      user.sub,
      user.role,
      dto,
    );
  }

  @Post('registrations/:id/withdraw')
  @ApiOperation({ summary: 'Withdraw registration' })
  @ApiResponse({ status: 200, description: 'Registration withdrawn' })
  withdraw(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.registrationsService.withdraw(id, user.sub, user.role);
  }

  @Delete('registrations/:id')
  @ApiOperation({ summary: 'Delete registration' })
  @ApiResponse({ status: 200, description: 'Registration deleted' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.registrationsService.remove(id, user.sub, user.role);
  }
}
