import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '@common/decorators/public.decorator';
import { PublicPlansService } from '../services/public-plans.service';
import { PublicPlanResponseDto } from '../dtos';

@ApiTags('Public Plans')
@Controller('public/plans')
export class PublicPlansController {
  constructor(private readonly publicPlansService: PublicPlansService) {}

  @Get()
  @Public()
  @ApiOperation({
    summary: 'List public subscription plans',
    description:
      'Returns active, public, non-archived plans sorted by sortOrder then monthlyPrice. No authentication required.',
  })
  @ApiResponse({
    description: 'List of public plans.',
    type: [PublicPlanResponseDto],
  })
  async findAll(): Promise<PublicPlanResponseDto[]> {
    return this.publicPlansService.findAll();
  }
}