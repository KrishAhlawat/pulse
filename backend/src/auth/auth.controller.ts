import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { IsEmail, IsString, IsOptional } from 'class-validator';

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
  constructor(private authService: AuthService) {}

  @Post('sync')
  @UseGuards(AuthGuard)
  async syncUser(@Body() syncUserDto: SyncUserDto) {
    const user = await this.authService.syncUser(syncUserDto);
    console.log(`User synced: ${user.email}`);
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
