import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { FilesService } from './files.service';
import { FileEntity } from './entities/file.entity';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { UserRole } from '../../common/enums';

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid'),
}));

// Mock AWS S3
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({}),
  })),
  PutObjectCommand: jest.fn(),
  GetObjectCommand: jest.fn(),
  DeleteObjectCommand: jest.fn(),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest
    .fn()
    .mockResolvedValue('https://presigned-url.example.com'),
}));

describe('FilesService', () => {
  let service: FilesService;

  const mockFile: Partial<FileEntity> = {
    id: 'file-1',
    originalName: 'test-image.jpg',
    filename: 'mock-uuid.jpg',
    mimeType: 'image/jpeg',
    size: 1024,
    s3Key: 'uploads/mock-uuid.jpg',
    s3Url: 'https://s3.example.com/bucket/uploads/mock-uuid.jpg',
    uploadedBy: 'user-1',
    isPublic: false,
    createdAt: new Date(),
  };

  const mockMulterFile: Express.Multer.File = {
    fieldname: 'file',
    originalname: 'test-image.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    size: 1024,
    buffer: Buffer.from('test'),
    destination: '',
    filename: '',
    path: '',
    stream: null as unknown as NodeJS.ReadableStream,
  };

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    remove: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        'aws.accessKeyId': 'test-access-key',
        'aws.secretAccessKey': 'test-secret-key',
        'aws.region': 'eu-central-1',
        'aws.s3Bucket': 'test-bucket',
        'aws.s3Endpoint': 'https://s3.eu-central-1.amazonaws.com',
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilesService,
        {
          provide: getRepositoryToken(FileEntity),
          useValue: mockRepository,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<FilesService>(FilesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('upload', () => {
    it('should upload a file successfully', async () => {
      mockRepository.create.mockReturnValue(mockFile);
      mockRepository.save.mockResolvedValue(mockFile);

      const result = await service.upload({
        file: mockMulterFile,
        userId: 'user-1',
        isPublic: false,
      });

      expect(result).toEqual(mockFile);
      expect(mockRepository.create).toHaveBeenCalled();
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should upload with entity type and id', async () => {
      mockRepository.create.mockReturnValue({
        ...mockFile,
        entityType: 'club',
        entityId: 'club-1',
      });
      mockRepository.save.mockResolvedValue(mockFile);

      const result = await service.upload({
        file: mockMulterFile,
        userId: 'user-1',
        entityType: 'club',
        entityId: 'club-1',
      });

      expect(result).toBeDefined();
    });

    it('should throw BadRequestException for invalid file type', async () => {
      const invalidFile = {
        ...mockMulterFile,
        mimetype: 'application/exe',
      };

      await expect(
        service.upload({
          file: invalidFile,
          userId: 'user-1',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for oversized image', async () => {
      const largeFile = {
        ...mockMulterFile,
        size: 5 * 1024 * 1024, // 5MB
      };

      await expect(
        service.upload({
          file: largeFile,
          userId: 'user-1',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow larger document files', async () => {
      const pdfFile = {
        ...mockMulterFile,
        mimetype: 'application/pdf',
        size: 5 * 1024 * 1024, // 5MB - allowed for documents
      };

      mockRepository.create.mockReturnValue(mockFile);
      mockRepository.save.mockResolvedValue(mockFile);

      const result = await service.upload({
        file: pdfFile,
        userId: 'user-1',
      });

      expect(result).toBeDefined();
    });

    it('should throw BadRequestException for oversized document', async () => {
      const largePdf = {
        ...mockMulterFile,
        mimetype: 'application/pdf',
        size: 15 * 1024 * 1024, // 15MB - too large
      };

      await expect(
        service.upload({
          file: largePdf,
          userId: 'user-1',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findById', () => {
    it('should return a file by id', async () => {
      mockRepository.findOne.mockResolvedValue(mockFile);

      const result = await service.findById('file-1');

      expect(result).toEqual(mockFile);
    });

    it('should return null if file not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findByIdOrFail', () => {
    it('should return a file by id', async () => {
      mockRepository.findOne.mockResolvedValue(mockFile);

      const result = await service.findByIdOrFail('file-1');

      expect(result).toEqual(mockFile);
    });

    it('should throw NotFoundException if file not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findByIdOrFail('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getDownloadUrl', () => {
    it('should return signed URL for private file', async () => {
      mockRepository.findOne.mockResolvedValue(mockFile);

      const result = await service.getDownloadUrl(
        'file-1',
        'user-1',
        UserRole.PARTICIPANT,
      );

      expect(result).toBe('https://presigned-url.example.com');
    });

    it('should return direct URL for public file', async () => {
      mockRepository.findOne.mockResolvedValue({ ...mockFile, isPublic: true });

      const result = await service.getDownloadUrl(
        'file-1',
        'user-1',
        UserRole.PARTICIPANT,
      );

      expect(result).toBe(mockFile.s3Url);
    });

    it('should allow owner to access private file', async () => {
      mockRepository.findOne.mockResolvedValue(mockFile);

      const result = await service.getDownloadUrl(
        'file-1',
        'user-1',
        UserRole.PARTICIPANT,
      );

      expect(result).toBeDefined();
    });

    it('should allow admin to access any file', async () => {
      mockRepository.findOne.mockResolvedValue({
        ...mockFile,
        uploadedBy: 'other-user',
      });

      const result = await service.getDownloadUrl(
        'file-1',
        'admin',
        UserRole.ADMIN,
      );

      expect(result).toBeDefined();
    });

    it('should throw ForbiddenException for non-owner accessing private file', async () => {
      mockRepository.findOne.mockResolvedValue({
        ...mockFile,
        uploadedBy: 'other-user',
      });

      await expect(
        service.getDownloadUrl('file-1', 'user-1', UserRole.PARTICIPANT),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('delete', () => {
    it('should delete a file when user is owner', async () => {
      mockRepository.findOne.mockResolvedValue(mockFile);
      mockRepository.remove.mockResolvedValue(mockFile);

      await service.delete('file-1', 'user-1', UserRole.PARTICIPANT);

      expect(mockRepository.remove).toHaveBeenCalledWith(mockFile);
    });

    it('should allow admin to delete any file', async () => {
      mockRepository.findOne.mockResolvedValue({
        ...mockFile,
        uploadedBy: 'other-user',
      });
      mockRepository.remove.mockResolvedValue(mockFile);

      await service.delete('file-1', 'admin', UserRole.ADMIN);

      expect(mockRepository.remove).toHaveBeenCalled();
    });

    it('should throw ForbiddenException if user does not own the file', async () => {
      mockRepository.findOne.mockResolvedValue({
        ...mockFile,
        uploadedBy: 'other-user',
      });

      await expect(
        service.delete('file-1', 'user-1', UserRole.PARTICIPANT),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findByEntity', () => {
    it('should return files for an entity', async () => {
      mockRepository.find.mockResolvedValue([mockFile]);

      const result = await service.findByEntity('club', 'club-1');

      expect(result).toHaveLength(1);
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { entityType: 'club', entityId: 'club-1' },
        order: { createdAt: 'DESC' },
      });
    });
  });
});
