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
} from '@nestjs/swagger';
import { RegistrationsService } from './registrations.service';
import {
  CreateRegistrationDto,
  UpdateRegistrationDto,
  AdminUpdateRegistrationDto,
  RegistrationFilterDto,
  ApproveRegistrationDto,
  RejectRegistrationDto,
  BulkReviewDto,
  UploadDocumentDto,
  ConfirmFitnessDto,
} from './dto';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles, CurrentUser, Public } from '../../common/decorators';
import { UserRole } from '../../common/enums';
import { JwtPayload } from '../../common/interfaces';

@ApiTags('Registrations')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class RegistrationsController {
  constructor(private readonly registrationsService: RegistrationsService) {}

  @Post('tournaments/:tournamentId/register')
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
  @Public()
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

  @Get('tournaments/:tournamentId/registrations/pending')
  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get pending registrations for review' })
  @ApiResponse({ status: 200, description: 'List of pending registrations' })
  getPendingReview(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.registrationsService.getPendingReview(
      tournamentId,
      user.sub,
      user.role,
    );
  }

  @Get('tournaments/:tournamentId/registrations/status')
  @Public()
  @ApiOperation({ summary: 'Get registration statistics for a tournament' })
  @ApiResponse({ status: 200, description: 'Registration statistics' })
  getStatusStatistics(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
  ) {
    return this.registrationsService.getStatusStatistics(tournamentId);
  }

  @Get('registrations/my-registrations')
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
    return this.registrationsService.adminUpdate(
      id,
      adminUpdateRegistrationDto,
    );
  }

  @Post('registrations/:id/approve')
  @ApiOperation({ summary: 'Approve registration' })
  @ApiResponse({ status: 200, description: 'Registration approved' })
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: ApproveRegistrationDto,
  ) {
    return this.registrationsService.approve(id, user.sub, user.role, dto);
  }

  @Post('registrations/:id/approve-with-payment')
  @ApiOperation({ summary: 'Approve registration with payment' })
  @ApiResponse({ status: 200, description: 'Registration approved with payment' })
  approveWithPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: ApproveRegistrationDto,
  ) {
    return this.registrationsService.approveWithPayment(
      id,
      user.sub,
      user.role,
      dto,
    );
  }

  @Post('registrations/:id/approve-without-payment')
  @ApiOperation({ summary: 'Approve registration without payment' })
  @ApiResponse({ status: 200, description: 'Registration approved without payment' })
  approveWithoutPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: ApproveRegistrationDto,
  ) {
    return this.registrationsService.approveWithoutPayment(
      id,
      user.sub,
      user.role,
      dto,
    );
  }

  @Post('registrations/:id/reject')
  @ApiOperation({ summary: 'Reject registration' })
  @ApiResponse({ status: 200, description: 'Registration rejected' })
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: RejectRegistrationDto,
  ) {
    return this.registrationsService.reject(id, user.sub, user.role, dto);
  }

  @Post('tournaments/:tournamentId/registrations/bulk-approve')
  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Bulk approve multiple registrations' })
  @ApiResponse({ status: 200, description: 'Bulk approval results' })
  bulkApprove(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: BulkReviewDto,
  ) {
    return this.registrationsService.bulkApprove(
      tournamentId,
      user.sub,
      user.role,
      dto,
    );
  }

  @Post('tournaments/:tournamentId/registrations/bulk-reject')
  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Bulk reject multiple registrations' })
  @ApiResponse({ status: 200, description: 'Bulk rejection results' })
  bulkReject(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: BulkReviewDto & { rejectionReason: string },
  ) {
    return this.registrationsService.bulkReject(
      tournamentId,
      user.sub,
      user.role,
      dto,
    );
  }

  @Post('registrations/:id/withdraw')
  @ApiOperation({ summary: 'Withdraw registration' })
  @ApiResponse({ status: 200, description: 'Registration withdrawn' })
  withdraw(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.registrationsService.withdraw(id, user.sub, user.role);
  }

  @Delete('registrations/:id')
  @ApiOperation({ summary: 'Delete registration' })
  @ApiResponse({ status: 200, description: 'Registration deleted' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.registrationsService.remove(id, user.sub, user.role);
  }

  // Document Upload Endpoints
  @Post('registrations/:id/documents')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload document for registration' })
  @ApiResponse({ status: 201, description: 'Document uploaded successfully' })
  uploadDocument(
    @Param('id', ParseUUIDPipe) registrationId: string,
    @Body() uploadDocumentDto: UploadDocumentDto,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.registrationsService.uploadDocument(
      registrationId,
      uploadDocumentDto,
      file,
      user.sub,
      user.role,
    );
  }

  @Get('registrations/:id/documents')
  @ApiOperation({ summary: 'Get all documents for registration' })
  @ApiResponse({ status: 200, description: 'List of documents' })
  getDocuments(
    @Param('id', ParseUUIDPipe) registrationId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.registrationsService.getDocuments(
      registrationId,
      user.sub,
      user.role,
    );
  }

  @Delete('registrations/:id/documents/:docId')
  @ApiOperation({ summary: 'Delete a document' })
  @ApiResponse({ status: 200, description: 'Document deleted' })
  deleteDocument(
    @Param('id', ParseUUIDPipe) registrationId: string,
    @Param('docId', ParseUUIDPipe) docId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.registrationsService.deleteDocument(
      registrationId,
      docId,
      user.sub,
      user.role,
    );
  }

  // Fitness Confirmation Endpoints
  @Post('registrations/:id/confirm-fitness')
  @ApiOperation({ summary: 'Confirm fitness for registration' })
  @ApiResponse({ status: 200, description: 'Fitness confirmed' })
  confirmFitness(
    @Param('id', ParseUUIDPipe) registrationId: string,
    @Body() confirmFitnessDto: ConfirmFitnessDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.registrationsService.confirmFitness(
      registrationId,
      confirmFitnessDto,
      user.sub,
      user.role,
    );
  }

  @Get('registrations/:id/fitness')
  @ApiOperation({ summary: 'Get fitness confirmation status' })
  @ApiResponse({ status: 200, description: 'Fitness status' })
  getFitnessStatus(
    @Param('id', ParseUUIDPipe) registrationId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.registrationsService.getFitnessStatus(
      registrationId,
      user.sub,
      user.role,
    );
  }

  // My Registration Endpoint
  @Get('tournaments/:tournamentId/my-registration')
  @ApiOperation({ summary: 'Get current user registration for tournament' })
  @ApiResponse({ status: 200, description: 'User registration' })
  @ApiResponse({ status: 404, description: 'No registration found' })
  getMyRegistration(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @CurrentUser() user: JwtPayload,
    @Query('ageGroupId') ageGroupId?: string,
  ) {
    return this.registrationsService.getMyRegistration(
      tournamentId,
      user.sub,
      ageGroupId,
    );
  }

  @Get('tournaments/:tournamentId/my-registrations')
  @ApiOperation({ summary: 'Get current user registrations for tournament' })
  @ApiResponse({ status: 200, description: 'User registrations' })
  getMyRegistrationsForTournament(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.registrationsService.getMyRegistrationsForTournament(
      tournamentId,
      user.sub,
    );
  }
}
