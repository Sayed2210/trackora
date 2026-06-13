import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '@common/decorators/public.decorator';
import { AppService } from './app.service';

@ApiTags('App')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get API welcome message' })
  @ApiOkResponse({ schema: { example: { message: 'Hello World!' } } })
  getHello(): { message: string } {
    return { message: this.appService.getHello() };
  }

  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Check API health' })
  @ApiOkResponse({ schema: { example: { status: 'ok' } } })
  getHealth(): { status: string } {
    return { status: 'ok' };
  }
}
