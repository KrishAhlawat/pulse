import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { IsEmail, IsString, IsOptional } from 'class-validator';
import { LoggerService } from '../logger/logger.service';
import { LOG_CONTEXTS } from '../logger/logger.constants';

export class SyncUserDto {
  @IsString()
  id: string;

  @IsEmail()
  email: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  image?: string;
}

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private readonly logger: LoggerService,
  ) {}

  @Post('sync')
  @UseGuards(AuthGuard)
  async syncUser(@Body() syncUserDto: SyncUserDto) {
    const user = await this.authService.syncUser(syncUserDto);
    this.logger.info('User synced', LOG_CONTEXTS.AUTH, { email: user.email });
    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
      },
    };
  }

  @Get('me')
  @UseGuards(AuthGuard)
  async getMe(@Request() req: any) {
    const user = await this.authService.getUserById(req.user.id);
    
    if (!user) {
      return { error: 'User not found' };
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      createdAt: user.createdAt,
      lastSeen: user.lastSeen,
    };
  }
}
