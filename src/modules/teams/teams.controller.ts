import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { TeamsService } from './teams.service';
import { CreateTeamDto } from './dto/team.dto';
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
  @ApiOperation({ summary: 'Get teams by club ID' })
  @ApiResponse({ status: 200, description: 'List of teams for club' })
  findByClub(
    @CurrentUser() user: JwtPayload,
    @Query('clubId', ParseUUIDPipe) clubId: string,
  ) {
    return this.teamsService.findByClub(clubId, user);
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
}