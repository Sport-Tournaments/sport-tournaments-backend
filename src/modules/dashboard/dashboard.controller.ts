import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators';
import { JwtPayload } from '../../common/interfaces';
import { JwtAuthGuard } from '../auth/guards';
import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@Controller('dashboard')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Get compact dashboard summary for current user' })
  @ApiResponse({ status: 200, description: 'Dashboard summary' })
  getSummary(@CurrentUser() user: JwtPayload) {
    return this.dashboardService.getSummary(user);
  }
}
