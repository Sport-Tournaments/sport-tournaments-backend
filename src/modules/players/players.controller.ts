import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PlayersService } from './players.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { CurrentUser, Roles } from '../../common/decorators';
import { UserRole } from '../../common/enums';
import { JwtPayload } from '../../common/interfaces';
import {
  CreatePlayerDto,
  PlayerFilterDto,
  PlayerSearchDto,
  UpdatePlayerDto,
} from './dto/player.dto';

@ApiTags('Players')
@Controller('players')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class PlayersController {
  constructor(private readonly playersService: PlayersService) {}

  @Get()
  @Roles(UserRole.ORGANIZER, UserRole.PARTICIPANT, UserRole.USER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get players with optional filters' })
  @ApiResponse({ status: 200, description: 'List of players' })
  findAll(@CurrentUser() user: JwtPayload, @Query() filters: PlayerFilterDto) {
    return this.playersService.findAll(filters, user);
  }

  @Get('search')
  @Roles(UserRole.ORGANIZER, UserRole.PARTICIPANT, UserRole.USER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Search players by text query' })
  @ApiResponse({ status: 200, description: 'Search results' })
  search(@CurrentUser() user: JwtPayload, @Query() query: PlayerSearchDto) {
    return this.playersService.search(query.q || '', user, query.teamId, query.limit || 10);
  }

  @Get('autocomplete')
  @Roles(UserRole.ORGANIZER, UserRole.PARTICIPANT, UserRole.USER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Autocomplete players by text query' })
  @ApiResponse({ status: 200, description: 'Autocomplete suggestions' })
  autocomplete(@CurrentUser() user: JwtPayload, @Query() query: PlayerSearchDto) {
    return this.playersService.autocomplete(query.q || '', user, query.teamId, query.limit || 10);
  }

  @Post()
  @Roles(UserRole.ORGANIZER, UserRole.PARTICIPANT, UserRole.USER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a player' })
  @ApiResponse({ status: 201, description: 'Player created successfully' })
  create(@CurrentUser() user: JwtPayload, @Body() createPlayerDto: CreatePlayerDto) {
    return this.playersService.create(user, createPlayerDto);
  }

  @Get(':id')
  @Roles(UserRole.ORGANIZER, UserRole.PARTICIPANT, UserRole.USER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get player by ID' })
  @ApiResponse({ status: 200, description: 'Player details' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.playersService.findOne(id, user);
  }

  @Patch(':id')
  @Roles(UserRole.ORGANIZER, UserRole.PARTICIPANT, UserRole.USER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update player' })
  @ApiResponse({ status: 200, description: 'Player updated successfully' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() updatePlayerDto: UpdatePlayerDto,
  ) {
    return this.playersService.update(id, user, updatePlayerDto);
  }

  @Delete(':id')
  @Roles(UserRole.ORGANIZER, UserRole.PARTICIPANT, UserRole.USER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete player' })
  @ApiResponse({ status: 200, description: 'Player deleted successfully' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.playersService.remove(id, user);
  }
}
