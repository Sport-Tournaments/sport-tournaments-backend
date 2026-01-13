import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { GroupsService } from './groups.service';
import { PotDrawService } from './services/pot-draw.service';
import { ExecuteDrawDto, UpdateBracketDto, CreateGroupDto } from './dto';
import { AssignTeamToPotDto, AssignPotsBulkDto, ExecutePotDrawDto } from './dto/pot.dto';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { CurrentUser, Public } from '../../common/decorators';
import { JwtPayload } from '../../common/interfaces';

@ApiTags('Groups & Draw')
@Controller('tournaments/:tournamentId')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class GroupsController {
  constructor(
    private readonly groupsService: GroupsService,
    private readonly potDrawService: PotDrawService,
  ) {}

  @Post('draw')
  @ApiOperation({ summary: 'Execute random group draw' })
  @ApiResponse({ status: 201, description: 'Draw completed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid tournament state' })
  executeDraw(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @CurrentUser() user: JwtPayload,
    @Body() executeDrawDto: ExecuteDrawDto,
  ) {
    return this.groupsService.executeDraw(
      tournamentId,
      user.sub,
      user.role,
      executeDrawDto,
    );
  }

  @Get('groups')
  @Public()
  @ApiOperation({ summary: 'Get all groups and team assignments' })
  @ApiResponse({ status: 200, description: 'Groups retrieved' })
  getGroups(@Param('tournamentId', ParseUUIDPipe) tournamentId: string) {
    return this.groupsService.getGroups(tournamentId);
  }

  @Get('bracket')
  @Public()
  @ApiOperation({ summary: 'Get full bracket/schedule' })
  @ApiResponse({ status: 200, description: 'Bracket retrieved' })
  getBracket(@Param('tournamentId', ParseUUIDPipe) tournamentId: string) {
    return this.groupsService.getBracket(tournamentId);
  }

  @Patch('bracket')
  @ApiOperation({ summary: 'Manually adjust bracket' })
  @ApiResponse({ status: 200, description: 'Bracket updated' })
  updateBracket(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @CurrentUser() user: JwtPayload,
    @Body() updateBracketDto: UpdateBracketDto,
  ) {
    return this.groupsService.updateBracket(
      tournamentId,
      user.sub,
      user.role,
      updateBracketDto,
    );
  }

  @Post('groups')
  @ApiOperation({ summary: 'Create a new group' })
  @ApiResponse({ status: 201, description: 'Group created' })
  createGroup(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @CurrentUser() user: JwtPayload,
    @Body() createGroupDto: CreateGroupDto,
  ) {
    return this.groupsService.createGroup(
      tournamentId,
      user.sub,
      user.role,
      createGroupDto,
    );
  }

  @Delete('draw')
  @ApiOperation({ summary: 'Reset draw and clear all groups' })
  @ApiResponse({ status: 200, description: 'Draw reset' })
  resetDraw(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.groupsService.resetDraw(tournamentId, user.sub, user.role);
  }

  // =====================================================
  // Pot-based draw endpoints
  // =====================================================

  @Post('pots/assign')
  @ApiOperation({ summary: 'Assign a team to a pot for seeding' })
  @ApiResponse({ status: 201, description: 'Team assigned to pot' })
  @ApiResponse({ status: 400, description: 'Invalid pot assignment' })
  @ApiResponse({ status: 403, description: 'Not authorized to manage pots' })
  async assignTeamToPot(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Body() dto: AssignTeamToPotDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.potDrawService.assignTeamToPot(tournamentId, dto, user.sub, user.role);
  }

  @Post('pots/bulk-assign')
  @ApiOperation({ summary: 'Bulk assign teams to pots' })
  @ApiResponse({ status: 201, description: 'Teams assigned to pots' })
  @ApiResponse({ status: 400, description: 'Invalid pot assignments' })
  @ApiResponse({ status: 403, description: 'Not authorized to manage pots' })
  async assignTeamsToPotsBulk(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Body() dto: AssignPotsBulkDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.potDrawService.assignTeamsToPotsBulk(tournamentId, dto, user.sub, user.role);
  }

  @Get('pots')
  @ApiOperation({ summary: 'Get all pot assignments for tournament' })
  @ApiResponse({ status: 200, description: 'Pot assignments retrieved' })
  async getPotAssignments(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
  ) {
    const potMap = await this.potDrawService.getPotAssignments(tournamentId);
    
    // Convert map to array format for API response
    const result: any[] = [];
    for (let i = 1; i <= 4; i++) {
      const teams = potMap.get(i) || [];
      result.push({
        potNumber: i,
        count: teams.length,
        teams: teams.map((t) => ({
          registrationId: t.registrationId,
          clubName: t.registration?.club?.name || 'Unknown Club',
          coachName: t.registration?.coachName || 'Unknown Coach',
        })),
      });
    }
    return result;
  }

  @Post('pots/validate')
  @ApiOperation({ summary: 'Validate pot distribution' })
  @ApiResponse({ status: 200, description: 'Validation complete' })
  async validatePotDistribution(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
  ) {
    return this.potDrawService.validatePotDistribution(tournamentId);
  }

  @Post('pots/draw')
  @ApiOperation({ summary: 'Execute pot-based group draw' })
  @ApiResponse({ status: 201, description: 'Groups created with pot seeding' })
  @ApiResponse({ status: 400, description: 'Invalid tournament state' })
  @ApiResponse({ status: 403, description: 'Not authorized to execute draw' })
  async executePotBasedDraw(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Body() dto: ExecutePotDrawDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.potDrawService.executePotBasedDraw(tournamentId, dto, user.sub, user.role);
  }

  @Delete('pots')
  @ApiOperation({ summary: 'Clear all pot assignments for tournament' })
  @ApiResponse({ status: 200, description: 'Pot assignments cleared' })
  @ApiResponse({ status: 403, description: 'Not authorized to manage pots' })
  async clearPotAssignments(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.potDrawService.clearPotAssignments(tournamentId, user.sub, user.role);
    return { message: 'Pot assignments cleared' };
  }
}
