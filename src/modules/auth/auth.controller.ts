import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, RefreshTokenDto } from './dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register new user' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(
      dto.phone,
      dto.password,
      dto.name,
      dto.role,
    );
  }

  @Post('login')
  @ApiOperation({ summary: 'Login with phone and password' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto.phone, dto.password);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token' })
  async refreshTokens(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshTokens(dto.refreshToken);
  }
}
