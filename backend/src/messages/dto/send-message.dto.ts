import { IsString, IsNotEmpty, IsIn, IsOptional, IsObject } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  conversationId: string;

  @IsString()
  @IsOptional()
  content?: string;

  @IsString()
  @IsIn(['text', 'image', 'video'])
  type: string;

  @IsString()
  @IsOptional()
  mediaUrl?: string;

  @IsObject()
  @IsOptional()
  mediaMeta?: {
    fileName?: string;
    mimeType?: string;
    fileSize?: number;
    width?: number;
    height?: number;
    duration?: number;
  };
}
