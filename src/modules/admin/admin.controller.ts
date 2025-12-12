import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Param,
  Body,
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
import { AdminService } from './admin.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles } from '../../common/decorators';
import { UserRole } from '../../common/enums';
import {
  AdminUserFilterDto,
  AdminTournamentFilterDto,
  AdminPaymentFilterDto,
  UpdateUserRoleDto,
  UpdateUserStatusDto,
  AdminActionDto,
} from './dto';

@ApiTags('Admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // Platform Statistics
  @Get('statistics')
  @ApiOperation({ summary: 'Get platform statistics' })
  @ApiResponse({ status: 200, description: 'Platform statistics' })
  getPlatformStatistics() {
    return this.adminService.getPlatformStatistics();
  }

  // User Management
  @Get('users')
  @ApiOperation({ summary: 'Get all users with filters' })
  @ApiResponse({ status: 200, description: 'Paginated list of users' })
  getUsers(@Query() filterDto: AdminUserFilterDto) {
    return this.adminService.getUsers(filterDto);
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Get user details' })
  @ApiResponse({ status: 200, description: 'User details' })
  getUserDetails(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getUserDetails(id);
  }

  @Put('users/:id/role')
  @ApiOperation({ summary: 'Update user role' })
  @ApiResponse({ status: 200, description: 'User role updated' })
  updateUserRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserRoleDto,
  ) {
    return this.adminService.updateUserRole(id, dto);
  }

  @Put('users/:id/status')
  @ApiOperation({ summary: 'Update user status (active/verified)' })
  @ApiResponse({ status: 200, description: 'User status updated' })
  updateUserStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.adminService.updateUserStatus(id, dto);
  }

  @Delete('users/:id')
  @ApiOperation({ summary: 'Deactivate user account' })
  @ApiResponse({ status: 200, description: 'User deactivated' })
  deleteUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminActionDto,
  ) {
    return this.adminService.deleteUser(id, dto);
  }

  // Tournament Moderation
  @Get('tournaments')
  @ApiOperation({ summary: 'Get all tournaments with filters' })
  @ApiResponse({ status: 200, description: 'Paginated list of tournaments' })
  getTournaments(@Query() filterDto: AdminTournamentFilterDto) {
    return this.adminService.getTournaments(filterDto);
  }

  @Post('tournaments/:id/cancel')
  @ApiOperation({ summary: 'Force cancel a tournament' })
  @ApiResponse({ status: 200, description: 'Tournament cancelled' })
  forceCancelTournament(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminActionDto,
  ) {
    return this.adminService.forceCancelTournament(id, dto);
  }

  @Put('tournaments/:id/feature')
  @ApiOperation({ summary: 'Toggle tournament featured status' })
  @ApiResponse({
    status: 200,
    description: 'Tournament featured status updated',
  })
  featureTournament(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('featured') featured: boolean,
  ) {
    return this.adminService.featureTournament(id, featured);
  }

  // Payment Management
  @Get('payments')
  @ApiOperation({ summary: 'Get all payments with filters' })
  @ApiResponse({ status: 200, description: 'Paginated list of payments' })
  getPayments(@Query() filterDto: AdminPaymentFilterDto) {
    return this.adminService.getPayments(filterDto);
  }

  @Get('payments/report')
  @ApiOperation({ summary: 'Get payment report for date range' })
  @ApiResponse({ status: 200, description: 'Payment report' })
  getPaymentReport(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.adminService.getPaymentReport(
      new Date(startDate),
      new Date(endDate),
    );
  }

  // System Actions
  @Post('notifications/broadcast')
  @ApiOperation({ summary: 'Send broadcast notification to users' })
  @ApiResponse({ status: 201, description: 'Notification sent' })
  sendBroadcastNotification(
    @Body('title') title: string,
    @Body('message') message: string,
    @Body('targetRole') targetRole?: string,
  ) {
    return this.adminService.sendBroadcastNotification(
      title,
      message,
      targetRole,
    );
  }

  @Get('audit-log')
  @ApiOperation({ summary: 'Get system audit log' })
  @ApiResponse({ status: 200, description: 'Audit log entries' })
  getAuditLog(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.adminService.getAuditLog(page, limit);
  }
}
