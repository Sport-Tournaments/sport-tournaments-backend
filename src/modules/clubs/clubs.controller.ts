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
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { ClubsService } from './clubs.service';
import {
  CreateClubDto,
  UpdateClubDto,
  ClubFilterDto,
  AdminUpdateClubDto,
} from './dto';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles, CurrentUser, Public } from '../../common/decorators';
import { UserRole } from '../../common/enums';
import { JwtPayload } from '../../common/interfaces';

@ApiTags('Clubs')
@Controller('clubs')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ClubsController {
  constructor(private readonly clubsService: ClubsService) {}

  @Post()
  @Roles(UserRole.ORGANIZER, UserRole.PARTICIPANT, UserRole.USER)
  @ApiOperation({ summary: 'Create a new club' })
  @ApiResponse({ status: 201, description: 'Club created successfully' })
  @ApiResponse({
    status: 409,
    description: 'Club with this name already exists',
  })
  create(
    @CurrentUser() user: JwtPayload,
    @Body() createClubDto: CreateClubDto,
  ) {
    return this.clubsService.create(user.sub, createClubDto);
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'Get all clubs with pagination and filters' })
  @ApiResponse({ status: 200, description: 'List of clubs' })
  findAll(@Query() filters: ClubFilterDto) {
    return this.clubsService.findAll(filters, filters);
  }

  @Get('my-clubs')
  @Roles(UserRole.ORGANIZER, UserRole.PARTICIPANT, UserRole.USER)
  @ApiOperation({ summary: 'Get clubs owned by current user' })
  @ApiResponse({ status: 200, description: 'List of user clubs' })
  getMyClubs(@CurrentUser() user: JwtPayload) {
    return this.clubsService.findByOrganizer(user.sub);
  }

  @Get('search')
  @Public()
  @ApiOperation({ summary: 'Search clubs by name or city' })
  @ApiResponse({ status: 200, description: 'Search results' })
  search(@Query('q') query: string, @Query('limit') limit?: number) {
    return this.clubsService.searchClubs(query, limit);
  }

  @Get('statistics')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get club statistics (Admin only)' })
  @ApiResponse({ status: 200, description: 'Club statistics' })
  getStatistics() {
    return this.clubsService.getStatistics();
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get club by ID' })
  @ApiResponse({ status: 200, description: 'Club details' })
  @ApiResponse({ status: 404, description: 'Club not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.clubsService.findByIdOrFail(id);
  }

  @Patch(':id')
  @Roles(UserRole.ORGANIZER, UserRole.PARTICIPANT, UserRole.USER)
  @ApiOperation({ summary: 'Update club' })
  @ApiResponse({ status: 200, description: 'Club updated successfully' })
  @ApiResponse({ status: 403, description: 'Not allowed to update this club' })
  @ApiResponse({ status: 404, description: 'Club not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() updateClubDto: UpdateClubDto,
  ) {
    return this.clubsService.update(id, user.sub, user.role, updateClubDto);
  }

  @Patch(':id/logo')
  @Roles(UserRole.ORGANIZER, UserRole.PARTICIPANT, UserRole.USER)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload club logo' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Logo uploaded successfully' })
  @ApiResponse({ status: 403, description: 'Not allowed to update this club' })
  @ApiResponse({ status: 404, description: 'Club not found' })
  uploadLogo(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.clubsService.uploadLogo(id, user.sub, user.role, file);
  }

  @Patch(':id/admin')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin update club (Admin only)' })
  @ApiResponse({ status: 200, description: 'Club updated successfully' })
  adminUpdate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() adminUpdateClubDto: AdminUpdateClubDto,
  ) {
    return this.clubsService.adminUpdate(id, adminUpdateClubDto);
  }

  @Patch(':id/verify')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Verify club (Admin only)' })
  @ApiResponse({ status: 200, description: 'Club verified' })
  verify(@Param('id', ParseUUIDPipe) id: string) {
    return this.clubsService.verify(id);
  }

  @Patch(':id/unverify')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Unverify club (Admin only)' })
  @ApiResponse({ status: 200, description: 'Club unverified' })
  unverify(@Param('id', ParseUUIDPipe) id: string) {
    return this.clubsService.unverify(id);
  }

  @Patch(':id/premium')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Set club premium status (Admin only)' })
  @ApiResponse({ status: 200, description: 'Club premium status updated' })
  setPremium(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('isPremium') isPremium: boolean,
  ) {
    return this.clubsService.setPremium(id, isPremium);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete club' })
  @ApiResponse({ status: 200, description: 'Club deleted' })
  @ApiResponse({ status: 403, description: 'Not allowed to delete this club' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.clubsService.remove(id, user.sub, user.role);
  }
}
