import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthService } from '../services/auth.service';
import { OtpService } from '../services/otp.service';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { Public } from '@common/decorators/public.decorator';
import { RegisterDto, LoginDto, RefreshTokenDto } from '../dtos';

interface RequestWithUser extends Request {
  user: { userId: string };
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly otpService: OtpService,
  ) {}

  @Post('register')
  @Public()
  @ApiOperation({ summary: 'Register new user' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto.phone, dto.password, dto.name, dto.role);
  }

  @Post('login')
  @Public()
  @ApiOperation({ summary: 'Login with phone and password' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto.phone, dto.password);
  }

  @Post('refresh')
  @Public()
  @ApiOperation({ summary: 'Refresh access token' })
  async refreshTokens(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshTokens(dto.refreshToken);
  }

  @Post('logout')
  @ApiOperation({ summary: 'Logout user' })
  @ApiBearerAuth()
  async logout(@Req() req: RequestWithUser) {
    await this.authService.logout(req.user.userId);
    return { message: 'Logged out successfully' };
  }

  @Post('otp/send')
  @Public()
  @ApiOperation({ summary: 'Send OTP to phone' })
  async sendOtp(@Body('phone') phone: string) {
    await this.otpService.sendOtp(phone);
    return { message: 'OTP sent' };
  }

  @Post('otp/verify')
  @Public()
  @ApiOperation({ summary: 'Verify OTP' })
  async verifyOtp(@Body('phone') phone: string, @Body('code') code: string) {
    const valid = await this.otpService.verifyOtp(phone, code);
    return { valid };
  }
}