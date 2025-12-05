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
import { ExecuteDrawDto, UpdateBracketDto, CreateGroupDto } from './dto';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles, CurrentUser, Public } from '../../common/decorators';
import { UserRole } from '../../common/enums';
import { JwtPayload } from '../../common/interfaces';

@ApiTags('Groups & Draw')
@Controller('tournaments/:tournamentId')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Post('draw')
  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
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
  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
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
  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
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
  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Reset draw and clear all groups' })
  @ApiResponse({ status: 200, description: 'Draw reset' })
  resetDraw(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.groupsService.resetDraw(tournamentId, user.sub, user.role);
  }
}
