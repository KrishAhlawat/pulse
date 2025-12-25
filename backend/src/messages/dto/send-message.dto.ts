import { IsString, IsNotEmpty, IsIn } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  conversationId: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsString()
  @IsIn(['text', 'image', 'video'])
  type: string;
}
