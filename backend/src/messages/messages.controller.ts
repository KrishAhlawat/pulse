import { Controller, Get, Post, Body, Param, Query, UseGuards, Request, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { SendMessageDto } from './dto/send-message.dto';
import { AuthGuard } from '../auth/auth.guard';

@Controller('messages')
@UseGuards(AuthGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post()
  send(@Request() req: any, @Body() sendMessageDto: SendMessageDto) {
    return this.messagesService.send(req.user.sub, sendMessageDto);
  }

  @Get(':conversationId')
  findByConversation(
    @Param('conversationId') conversationId: string,
    @Request() req: any,
    @Query('cursor') cursor?: string,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ) {
    return this.messagesService.findByConversation(
      conversationId,
      req.user.sub,
      cursor,
      limit,
    );
  }

  @Get('single/:messageId')
  getOne(@Param('messageId') messageId: string, @Request() req: any) {
    return this.messagesService.getMessageById(messageId, req.user.sub);
  }
}
