import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { InvitationsService } from './invitations.service';
import {
  CreateInvitationDto,
  BulkInvitationDto,
  RespondToInvitationDto,
  InvitationFilterDto,
  InvitePartnerTeamsDto,
  InvitePastParticipantsDto,
} from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { UserRole } from '../../common/enums';
import { JwtPayload } from '../../common/interfaces';

@ApiTags('Invitations')
@Controller('invitations')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Post()
  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a single invitation' })
  @ApiResponse({ status: 201, description: 'Invitation created successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Tournament or club not found' })
  @ApiResponse({ status: 409, description: 'Invitation already exists' })
  async create(
    @Body() dto: CreateInvitationDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.invitationsService.create(dto, user.sub, user.role);
  }

  @Post('bulk')
  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create multiple invitations at once' })
  @ApiResponse({ status: 201, description: 'Invitations created successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async createBulk(
    @Body() dto: BulkInvitationDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.invitationsService.createBulk(dto, user.sub, user.role);
  }

  @Post('partner-teams')
  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Invite all partner teams defined in tournament settings',
  })
  @ApiResponse({ status: 201, description: 'Partner team invitations sent' })
  async invitePartnerTeams(
    @Body() dto: InvitePartnerTeamsDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.invitationsService.invitePartnerTeams(dto, user.sub, user.role);
  }

  @Post('past-participants')
  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Invite past tournament participants' })
  @ApiResponse({
    status: 201,
    description: 'Past participant invitations sent',
  })
  async invitePastParticipants(
    @Body() dto: InvitePastParticipantsDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.invitationsService.invitePastParticipants(
      dto,
      user.sub,
      user.role,
    );
  }

  @Get('tournament/:tournamentId')
  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all invitations for a tournament' })
  @ApiParam({ name: 'tournamentId', description: 'Tournament ID' })
  @ApiResponse({ status: 200, description: 'List of invitations' })
  async findByTournament(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Query() filters: InvitationFilterDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.invitationsService.findByTournament(
      tournamentId,
      user.sub,
      user.role,
      filters,
    );
  }

  @Get('tournament/:tournamentId/stats')
  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get invitation statistics for a tournament' })
  @ApiParam({ name: 'tournamentId', description: 'Tournament ID' })
  @ApiResponse({ status: 200, description: 'Invitation statistics' })
  async getStats(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.invitationsService.getInvitationStats(
      tournamentId,
      user.sub,
      user.role,
    );
  }

  @Get('club/:clubId')
  @ApiOperation({ summary: 'Get all pending invitations for a club' })
  @ApiParam({ name: 'clubId', description: 'Club ID' })
  @ApiResponse({ status: 200, description: 'List of pending invitations' })
  async findByClub(
    @Param('clubId', ParseUUIDPipe) clubId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.invitationsService.findByClub(clubId, user.sub);
  }

  @Get('token/:token')
  @Public()
  @ApiOperation({ summary: 'Get invitation details by token (public)' })
  @ApiParam({ name: 'token', description: 'Invitation token' })
  @ApiResponse({ status: 200, description: 'Invitation details' })
  @ApiResponse({ status: 400, description: 'Invitation expired' })
  @ApiResponse({ status: 404, description: 'Invalid token' })
  async findByToken(@Param('token') token: string) {
    return this.invitationsService.findByToken(token);
  }

  @Post(':id/respond')
  @ApiOperation({ summary: 'Respond to an invitation (accept or decline)' })
  @ApiParam({ name: 'id', description: 'Invitation ID' })
  @ApiResponse({ status: 200, description: 'Response recorded' })
  @ApiResponse({ status: 400, description: 'Already responded or expired' })
  async respond(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RespondToInvitationDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.invitationsService.respond(id, dto, user.sub);
  }

  @Post('token/:token/respond')
  @Public()
  @ApiOperation({ summary: 'Respond to an invitation using token (public)' })
  @ApiParam({ name: 'token', description: 'Invitation token' })
  @ApiResponse({ status: 200, description: 'Response recorded' })
  async respondByToken(
    @Param('token') token: string,
    @Body() dto: RespondToInvitationDto,
  ) {
    return this.invitationsService.respondByToken(token, dto);
  }

  @Post(':id/resend')
  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Resend an invitation' })
  @ApiParam({ name: 'id', description: 'Invitation ID' })
  @ApiResponse({ status: 200, description: 'Invitation resent' })
  async resend(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.invitationsService.resendInvitation(id, user.sub, user.role);
  }

  @Delete(':id')
  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cancel/delete an invitation' })
  @ApiParam({ name: 'id', description: 'Invitation ID' })
  @ApiResponse({ status: 204, description: 'Invitation cancelled' })
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.invitationsService.cancel(id, user.sub, user.role);
  }
}
