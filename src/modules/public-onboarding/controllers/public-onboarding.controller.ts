import { Body, Controller, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { Public } from '@common/decorators/public.decorator';
import { PublicSubscribeDto, PublicSubscribeResponseDto } from '../dtos';
import { PublicOnboardingService } from '../services/public-onboarding.service';

interface OnboardingRequest {
  ip?: string;
  headers: { 'user-agent'?: string };
}

@ApiTags('Public Onboarding')
@Controller('public')
export class PublicOnboardingController {
  constructor(private readonly onboardingService: PublicOnboardingService) {}

  @Post('subscribe')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary: 'Self-service tenant signup with company data',
    description:
      'Creates a tenant (company), an owner user (SUPER_ADMIN), and a trialing subscription for a public plan. Returns auth tokens for immediate login. Rate-limited to 5 requests per minute per IP.',
  })
  @ApiCreatedResponse({
    description: 'Tenant, owner, and subscription created with auth tokens.',
    type: PublicSubscribeResponseDto,
  })
  @ApiConflictResponse({
    description: 'Company slug, phone, or email already exists.',
  })
  @ApiNotFoundResponse({
    description: 'Selected plan slug is not available or not public.',
  })
  @ApiTooManyRequestsResponse({
    description: 'Too many signup attempts from this IP.',
  })
  async subscribe(
    @Body() dto: PublicSubscribeDto,
    @Req() req: OnboardingRequest,
  ): Promise<PublicSubscribeResponseDto> {
    return this.onboardingService.subscribe(dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }
}
