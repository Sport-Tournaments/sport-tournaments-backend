import {
  Controller,
  Get,
  Post,
  Param,
  Delete,
  UseGuards,
  ParseUUIDPipe,
  UseInterceptors,
  UploadedFile,
  Body,
  Query,
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
import { FilesService } from './files.service';
import { JwtAuthGuard } from '../auth/guards';
import { CurrentUser } from '../../common/decorators';
import { JwtPayload } from '../../common/interfaces';

@ApiTags('Files')
@Controller('files')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a file' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        entityType: {
          type: 'string',
          description: 'Entity type (tournament, club, user)',
        },
        entityId: {
          type: 'string',
          description: 'Entity ID',
        },
        isPublic: {
          type: 'boolean',
          description: 'Whether the file should be publicly accessible',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'File uploaded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid file type or size' })
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: JwtPayload,
    @Body('entityType') entityType?: string,
    @Body('entityId') entityId?: string,
    @Body('isPublic') isPublic?: string,
  ) {
    return this.filesService.upload({
      file,
      userId: user.sub,
      entityType,
      entityId,
      isPublic: isPublic === 'true',
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get file details' })
  @ApiResponse({ status: 200, description: 'File details' })
  @ApiResponse({ status: 404, description: 'File not found' })
  getFile(@Param('id', ParseUUIDPipe) id: string) {
    return this.filesService.findByIdOrFail(id);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Get download URL for a file' })
  @ApiResponse({ status: 200, description: 'Download URL' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  getDownloadUrl(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.filesService.getDownloadUrl(id, user.sub, user.role);
  }

  @Get('entity/:entityType/:entityId')
  @ApiOperation({ summary: 'Get files by entity' })
  @ApiResponse({ status: 200, description: 'List of files' })
  getFilesByEntity(
    @Param('entityType') entityType: string,
    @Param('entityId', ParseUUIDPipe) entityId: string,
  ) {
    return this.filesService.findByEntity(entityType, entityId);
  }

  @Get('my-files')
  @ApiOperation({ summary: 'Get files uploaded by current user' })
  @ApiResponse({ status: 200, description: 'List of files' })
  getMyFiles(@CurrentUser() user: JwtPayload) {
    return this.filesService.findByUser(user.sub);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a file' })
  @ApiResponse({ status: 200, description: 'File deleted' })
  @ApiResponse({ status: 403, description: 'Not allowed to delete this file' })
  delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.filesService.delete(id, user.sub, user.role);
  }
}
