import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { TeamsService } from './teams.service';
import { CreateTeamDto, TeamFilterDto, UpdateTeamDto } from './dto/team.dto';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles, CurrentUser } from '../../common/decorators';
import { UserRole } from '../../common/enums';
import { JwtPayload } from '../../common/interfaces';

@ApiTags('Teams')
@Controller('teams')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Get()
  @Roles(UserRole.ORGANIZER, UserRole.PARTICIPANT, UserRole.USER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get teams with optional filters' })
  @ApiResponse({ status: 200, description: 'List of teams' })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query() filters: TeamFilterDto,
  ) {
    return this.teamsService.findAll(filters, user);
  }

  @Get('search')
  @Roles(UserRole.ORGANIZER, UserRole.PARTICIPANT, UserRole.USER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Search teams by text query' })
  @ApiResponse({ status: 200, description: 'Search results' })
  search(
    @CurrentUser() user: JwtPayload,
    @Query('q') query: string,
    @Query('clubId') clubId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.teamsService.search(query, user, clubId, Number(limit) || 10);
  }

  @Post()
  @Roles(UserRole.ORGANIZER, UserRole.PARTICIPANT, UserRole.USER)
  @ApiOperation({ summary: 'Create a new team' })
  @ApiResponse({ status: 201, description: 'Team created successfully' })
  create(
    @CurrentUser() user: JwtPayload,
    @Body() createTeamDto: CreateTeamDto,
  ) {
    return this.teamsService.create(user, createTeamDto);
  }

  @Get(':id')
  @Roles(UserRole.ORGANIZER, UserRole.PARTICIPANT, UserRole.USER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get team by ID' })
  @ApiResponse({ status: 200, description: 'Team details' })
  @ApiResponse({ status: 404, description: 'Team not found' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.teamsService.findOne(id, user);
  }

  @Patch(':id')
  @Roles(UserRole.ORGANIZER, UserRole.PARTICIPANT, UserRole.USER)
  @ApiOperation({ summary: 'Update team' })
  @ApiResponse({ status: 200, description: 'Team updated successfully' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() updateTeamDto: UpdateTeamDto,
  ) {
    return this.teamsService.update(id, user, updateTeamDto);
  }

  @Delete(':id')
  @Roles(UserRole.ORGANIZER, UserRole.PARTICIPANT, UserRole.USER)
  @ApiOperation({ summary: 'Delete team' })
  @ApiResponse({ status: 200, description: 'Team deleted successfully' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.teamsService.remove(id, user);
  }
}
