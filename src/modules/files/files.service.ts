import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { FileEntity } from './entities/file.entity';
import { UserRole } from '../../common/enums';

export interface UploadFileDto {
  file: Express.Multer.File;
  userId: string;
  entityType?: string;
  entityId?: string;
  isPublic?: boolean;
}

@Injectable()
export class FilesService {
  private s3Client: S3Client | null = null;
  private bucket: string;
  private useLocalStorage = false;
  private localStoragePath: string;
  private readonly logger = new Logger(FilesService.name);

  // Allowed MIME types
  private readonly allowedImageTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
  ];
  private readonly allowedDocumentTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];

  constructor(
    @InjectRepository(FileEntity)
    private filesRepository: Repository<FileEntity>,
    private configService: ConfigService,
  ) {
    const accessKeyId = this.configService.get<string>('aws.accessKeyId');
    const secretAccessKey = this.configService.get<string>('aws.secretAccessKey');
    const region = this.configService.get<string>('aws.region');
    const endpoint = this.configService.get<string>('aws.s3Endpoint');

    if (accessKeyId && secretAccessKey) {
      this.s3Client = new S3Client({
        region,
        endpoint,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
        forcePathStyle: true, // Required for some S3-compatible services
      });
      this.logger.log('S3 client initialized');
    } else {
      // Use local file storage when S3 is not configured
      this.useLocalStorage = true;
      this.logger.warn('AWS S3 credentials not configured. Using local file storage.');
    }

    this.bucket = this.configService.get<string>('aws.s3Bucket') || 'football-tournament-files';
    this.localStoragePath = path.join(process.cwd(), 'uploads');
    
    // Ensure local uploads directory exists
    if (this.useLocalStorage && !fs.existsSync(this.localStoragePath)) {
      fs.mkdirSync(this.localStoragePath, { recursive: true });
    }
  }

  async upload(uploadFileDto: UploadFileDto): Promise<FileEntity> {
    const { file, userId, entityType, entityId, isPublic } = uploadFileDto;

    // Validate file type
    const isImage = this.allowedImageTypes.includes(file.mimetype);
    const isDocument = this.allowedDocumentTypes.includes(file.mimetype);

    if (!isImage && !isDocument) {
      throw new BadRequestException(
        'Invalid file type. Allowed types: JPEG, PNG, GIF, WebP, PDF, DOC, DOCX',
      );
    }

    // Validate file size
    const maxImageSize = 2 * 1024 * 1024; // 2MB
    const maxDocumentSize = 10 * 1024 * 1024; // 10MB

    if (isImage && file.size > maxImageSize) {
      throw new BadRequestException('Image file size must be less than 2MB');
    }

    if (isDocument && file.size > maxDocumentSize) {
      throw new BadRequestException('Document file size must be less than 10MB');
    }

    // Generate unique filename
    const fileExtension = file.originalname.split('.').pop();
    const filename = `${randomUUID()}.${fileExtension}`;
    const fileKey = entityType
      ? `${entityType}/${entityId || 'general'}/${filename}`
      : `uploads/${filename}`;

    let fileUrl: string;

    if (this.useLocalStorage) {
      // Save to local storage
      try {
        const localDir = path.join(this.localStoragePath, path.dirname(fileKey));
        if (!fs.existsSync(localDir)) {
          fs.mkdirSync(localDir, { recursive: true });
        }
        const localFilePath = path.join(this.localStoragePath, fileKey);
        fs.writeFileSync(localFilePath, file.buffer);
        
        // URL will be served by the static file endpoint
        const port = this.configService.get<number>('port') || 3010;
        fileUrl = `http://localhost:${port}/uploads/${fileKey}`;
        this.logger.log(`File saved locally: ${localFilePath}`);
      } catch (error) {
        this.logger.error(`Failed to save file locally: ${error.message}`);
        throw new BadRequestException('Failed to upload file');
      }
    } else if (this.s3Client) {
      // Upload to S3/MinIO
      try {
        await this.s3Client.send(
          new PutObjectCommand({
            Bucket: this.bucket,
            Key: fileKey,
            Body: file.buffer,
            ContentType: file.mimetype,
          }),
        );
        const endpoint = this.configService.get<string>('aws.s3Endpoint');
        if (endpoint) {
          // MinIO or custom S3 endpoint
          fileUrl = `${endpoint}/${this.bucket}/${fileKey}`;
        } else {
          // AWS S3
          fileUrl = `https://${this.bucket}.s3.${this.configService.get<string>('aws.region')}.amazonaws.com/${fileKey}`;
        }
      } catch (error) {
        this.logger.error(`Failed to upload file to S3: ${error.message}`);
        throw new BadRequestException('Failed to upload file');
      }
    } else {
      throw new BadRequestException('No storage backend configured');
    }

    const fileEntity = this.filesRepository.create({
      originalName: file.originalname,
      filename,
      mimeType: file.mimetype,
      size: file.size,
      s3Key: fileKey,
      s3Url: fileUrl,
      uploadedBy: userId,
      entityType,
      entityId,
      isPublic: isPublic || false,
    });

    return this.filesRepository.save(fileEntity);
  }

  async findById(id: string): Promise<FileEntity | null> {
    return this.filesRepository.findOne({ where: { id } });
  }

  async findByIdOrFail(id: string): Promise<FileEntity> {
    const file = await this.findById(id);

    if (!file) {
      throw new NotFoundException(`File with ID ${id} not found`);
    }

    return file;
  }

  async getDownloadUrl(
    id: string,
    userId: string,
    userRole: string,
    inline = false,
  ): Promise<string> {
    const file = await this.findByIdOrFail(id);

    // Check access
    if (
      !file.isPublic &&
      file.uploadedBy !== userId &&
      userRole !== UserRole.ADMIN
    ) {
      throw new ForbiddenException('You do not have access to this file');
    }

    // For local storage, return the direct URL
    if (this.useLocalStorage) {
      return file.s3Url;
    }

    // For public MinIO bucket, return direct URL
    const endpoint = this.configService.get<string>('aws.s3Endpoint');
    if (endpoint && file.isPublic) {
      // MinIO public bucket URL
      return `${endpoint}/${this.bucket}/${file.s3Key}`;
    }

    // Generate presigned URL for S3/MinIO
    if (!this.s3Client) {
      return file.s3Url;
    }

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: file.s3Key,
      // Set Content-Disposition to inline for viewing in browser
      ResponseContentDisposition: inline ? 'inline' : `attachment; filename="${file.originalName}"`,
      ResponseContentType: file.mimeType,
    });

    return getSignedUrl(this.s3Client, command, { expiresIn: 3600 }); // 1 hour expiry
  }

  async delete(id: string, userId: string, userRole: string): Promise<void> {
    const file = await this.findByIdOrFail(id);

    // Check permission
    if (file.uploadedBy !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException('You are not allowed to delete this file');
    }

    // Delete from S3
    if (this.s3Client) {
      try {
        await this.s3Client.send(
          new DeleteObjectCommand({
            Bucket: this.bucket,
            Key: file.s3Key,
          }),
        );
      } catch (error) {
        this.logger.error(`Failed to delete file from S3: ${error.message}`);
      }
    }

    // Delete record
    await this.filesRepository.remove(file);
  }

  async findByEntity(entityType: string, entityId: string): Promise<FileEntity[]> {
    return this.filesRepository.find({
      where: { entityType, entityId },
      order: { createdAt: 'DESC' },
    });
  }

  async findByUser(userId: string): Promise<FileEntity[]> {
    return this.filesRepository.find({
      where: { uploadedBy: userId },
      order: { createdAt: 'DESC' },
    });
  }
}
