import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { DocumentType } from '../entities/registration-document.entity';

export class UploadDocumentDto {
  @ApiProperty({
    enum: DocumentType,
    description: 'Type of document being uploaded',
    example: DocumentType.MEDICAL_DECLARATION,
  })
  @IsEnum(DocumentType)
  documentType: DocumentType;

  @ApiPropertyOptional({
    description: 'Optional notes about the document',
    example: 'Medical clearance for all players',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class DocumentResponseDto {
  @ApiProperty({ description: 'Document ID' })
  id: string;

  @ApiProperty({ description: 'Registration ID' })
  registrationId: string;

  @ApiProperty({ enum: DocumentType, description: 'Document type' })
  documentType: DocumentType;

  @ApiProperty({ description: 'File name' })
  fileName: string;

  @ApiProperty({ description: 'File size in bytes' })
  fileSize: number;

  @ApiProperty({ description: 'MIME type' })
  mimeType: string;

  @ApiProperty({ description: 'User ID who uploaded' })
  uploadedBy: string;

  @ApiProperty({ description: 'Upload timestamp' })
  uploadedAt: Date;

  @ApiProperty({ description: 'Optional notes', required: false })
  notes?: string;
}
