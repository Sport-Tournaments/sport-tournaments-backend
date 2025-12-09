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
} from './dto';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles, CurrentUser } from '../../common/decorators';
import { UserRole } from '../../common/enums';
import { JwtPayload } from '../../common/interfaces';

@ApiTags('Registrations')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class RegistrationsController {
  constructor(private readonly registrationsService: RegistrationsService) {}

  @Post('tournaments/:tournamentId/register')
  @Roles(UserRole.PARTICIPANT, UserRole.ORGANIZER)
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
  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
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

  @Get('tournaments/:tournamentId/registrations/status')
  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get registration statistics for a tournament' })
  @ApiResponse({ status: 200, description: 'Registration statistics' })
  getStatusStatistics(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
  ) {
    return this.registrationsService.getStatusStatistics(tournamentId);
  }

  @Get('registrations/my-registrations')
  @Roles(UserRole.PARTICIPANT, UserRole.ORGANIZER)
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
  @Roles(UserRole.PARTICIPANT, UserRole.ORGANIZER)
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
    return this.registrationsService.adminUpdate(id, adminUpdateRegistrationDto);
  }

  @Post('registrations/:id/approve')
  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Approve registration' })
  @ApiResponse({ status: 200, description: 'Registration approved' })
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.registrationsService.approve(id, user.sub, user.role);
  }

  @Post('registrations/:id/reject')
  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Reject registration' })
  @ApiResponse({ status: 200, description: 'Registration rejected' })
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.registrationsService.reject(id, user.sub, user.role);
  }

  @Post('registrations/:id/withdraw')
  @Roles(UserRole.PARTICIPANT, UserRole.ORGANIZER)
  @ApiOperation({ summary: 'Withdraw registration' })
  @ApiResponse({ status: 200, description: 'Registration withdrawn' })
  withdraw(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.registrationsService.withdraw(id, user.sub, user.role);
  }

  @Delete('registrations/:id')
  @Roles(UserRole.PARTICIPANT, UserRole.ORGANIZER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete registration' })
  @ApiResponse({ status: 200, description: 'Registration deleted' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.registrationsService.remove(id, user.sub, user.role);
  }
}
