import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { MediaService } from './media.service';
import { RequestUploadUrlDto } from './dto/request-upload-url.dto';
import { AuthGuard } from '../auth/auth.guard';

@Controller('media')
@UseGuards(AuthGuard)
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  /**
   * Request a signed upload URL for media files
   * 
   * POST /media/upload-url
   * 
   * Security:
   * - JWT authentication required
   * - Conversation membership validated
   * - File size and type validated
   * 
   * Flow:
   * 1. Client requests upload URL
   * 2. Backend validates and generates signed URL
   * 3. Client uploads directly to Supabase Storage
   * 4. Client sends message with file path
   */
  @Post('upload-url')
  async requestUploadUrl(
    @Request() req: any,
    @Body() requestUploadUrlDto: RequestUploadUrlDto,
  ) {
    return this.mediaService.requestUploadUrl(
      req.user.sub,
      requestUploadUrlDto,
    );
  }
}
