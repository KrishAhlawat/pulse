import { IsString, IsNotEmpty, IsIn, IsInt, Min, Max } from 'class-validator';

export class RequestUploadUrlDto {
  @IsString()
  @IsNotEmpty()
  conversationId: string;

  @IsString()
  @IsNotEmpty()
  fileName: string;

  @IsString()
  @IsIn([
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/quicktime',
    'video/webm',
  ])
  mimeType: string;

  @IsInt()
  @Min(1)
  @Max(20971520) // 20MB max
  fileSize: number;
}
