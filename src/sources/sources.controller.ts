import { Controller, Get, Post, Patch, Put, Body, Param, ParseIntPipe } from '@nestjs/common';
import { SourcesService } from './sources.service';

@Controller('sources')
export class SourcesController {
  constructor(private readonly sourcesService: SourcesService) {}

  @Get()
  getSources() {
    return this.sourcesService.getSources();
  }

  @Post()
  createSource(@Body() body: any) {
    return this.sourcesService.createSource(body);
  }

  @Post('setup')
  setupSource(@Body() body: any) {
    try {
      return this.sourcesService.setupSource(body);
    } catch(e: any) {
      require('fs').writeFileSync('last_error.log', e.stack || e.message);
      throw e;
    }
  }

  @Get(':id/mappings')
  getSourceMappings(@Param('id', ParseIntPipe) id: number) {
    return this.sourcesService.getSourceMappings(id);
  }

  @Put(':id/mappings')
  updateSourceMappings(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    try {
      return this.sourcesService.updateSourceMappings(id, body);
    } catch(e: any) {
      require('fs').writeFileSync('last_error.log', e.stack || e.message);
      throw e;
    }
  }

  @Patch(':id')
  updateSource(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.sourcesService.updateSource(id, body);
  }
}
