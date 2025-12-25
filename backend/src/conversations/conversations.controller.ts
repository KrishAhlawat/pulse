import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { AuthGuard } from '../auth/auth.guard';

@Controller('conversations')
@UseGuards(AuthGuard)
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Post()
  create(@Request() req: any, @Body() createConversationDto: CreateConversationDto) {
    return this.conversationsService.create(req.user.sub, createConversationDto);
  }

  @Get()
  findAll(@Request() req: any) {
    return this.conversationsService.findAllForUser(req.user.sub);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.conversationsService.findOne(id, req.user.sub);
  }
}
