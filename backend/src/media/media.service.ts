import {
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { ConversationsService } from '../conversations/conversations.service';
import { RequestUploadUrlDto } from './dto/request-upload-url.dto';

@Injectable()
export class MediaService {
  // File size limits in bytes
  private readonly MAX_IMAGE_SIZE = 5242880; // 5MB
  private readonly MAX_VIDEO_SIZE = 20971520; // 20MB

  // Allowed MIME types
  private readonly ALLOWED_IMAGE_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
  ];

  private readonly ALLOWED_VIDEO_TYPES = [
    'video/mp4',
    'video/quicktime',
    'video/webm',
  ];

  constructor(
    private supabaseService: SupabaseService,
    private conversationsService: ConversationsService,
  ) {}

  /**
   * Generate a signed upload URL for media uploads
   * 
   * Security:
   * - Validates user is a member of the conversation
   * - Enforces file size limits based on type
   * - Only allows whitelisted MIME types
   * - Generates unique file path to prevent collisions
   */
  async requestUploadUrl(userId: string, dto: RequestUploadUrlDto) {
    const { conversationId, fileName, mimeType, fileSize } = dto;

    // 1. Validate conversation membership
    const isMember = await this.conversationsService.validateMembership(
      conversationId,
      userId,
    );

    if (!isMember) {
      throw new ForbiddenException('You are not a member of this conversation');
    }

    // 2. Determine media type
    const mediaType = this.getMediaType(mimeType);

    if (!mediaType) {
      throw new BadRequestException('Unsupported file type');
    }

    // 3. Validate file size
    this.validateFileSize(mediaType, fileSize);

    // 4. Generate unique file path
    const filePath = this.generateFilePath(conversationId, userId, fileName);

    // 5. Generate signed upload URL
    const uploadData = await this.supabaseService.generateSignedUploadUrl(
      filePath,
      300, // 5 minutes to upload
    );

    return {
      uploadUrl: uploadData.signedUrl,
      filePath: uploadData.path,
      token: uploadData.token,
      mediaType,
      expiresIn: 300,
    };
  }

  /**
   * Generate a signed URL for accessing media
   * Used when fetching messages with media
   */
  async getMediaUrl(filePath: string): Promise<string> {
    return this.supabaseService.generateSignedDownloadUrl(filePath, 3600);
  }

  /**
   * Validate file size based on media type
   */
  private validateFileSize(mediaType: 'image' | 'video', fileSize: number): void {
    if (mediaType === 'image' && fileSize > this.MAX_IMAGE_SIZE) {
      throw new BadRequestException(
        `Image size exceeds maximum allowed size of ${this.MAX_IMAGE_SIZE / 1048576}MB`,
      );
    }

    if (mediaType === 'video' && fileSize > this.MAX_VIDEO_SIZE) {
      throw new BadRequestException(
        `Video size exceeds maximum allowed size of ${this.MAX_VIDEO_SIZE / 1048576}MB`,
      );
    }
  }

  /**
   * Determine media type from MIME type
   */
  private getMediaType(mimeType: string): 'image' | 'video' | null {
    if (this.ALLOWED_IMAGE_TYPES.includes(mimeType)) {
      return 'image';
    }

    if (this.ALLOWED_VIDEO_TYPES.includes(mimeType)) {
      return 'video';
    }

    return null;
  }

  /**
   * Generate unique file path for storage
   * Format: conversations/{conversationId}/{userId}_{timestamp}_{filename}
   */
  private generateFilePath(
    conversationId: string,
    userId: string,
    fileName: string,
  ): string {
    const timestamp = Date.now();
    const sanitizedFileName = this.sanitizeFileName(fileName);
    return `conversations/${conversationId}/${userId}_${timestamp}_${sanitizedFileName}`;
  }

  /**
   * Sanitize file name to prevent path traversal attacks
   */
  private sanitizeFileName(fileName: string): string {
    // Remove any path components
    const baseName = fileName.split('/').pop() || fileName;
    
    // Replace potentially dangerous characters
    return baseName.replace(/[^a-zA-Z0-9._-]/g, '_');
  }
}
