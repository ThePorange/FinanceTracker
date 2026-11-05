import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
  ParseIntPipe,
  Res,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { FileMergeService } from './file-merge.service';

@Controller('file-merge')
export class FileMergeController {
  constructor(private readonly fileMergeService: FileMergeService) {}

  @Get('mapping/:sourceId')
  getMergeMapping(@Param('sourceId', ParseIntPipe) sourceId: number) {
    return this.fileMergeService.getMergeMapping(sourceId);
  }

  @Post('mapping/:sourceId')
  saveMergeMapping(
    @Param('sourceId', ParseIntPipe) sourceId: number,
    @Body() body: { mappings: any[] }
  ) {
    if (!body || !Array.isArray(body.mappings)) {
      throw new BadRequestException('Mappings array is required');
    }
    return this.fileMergeService.saveMergeMapping(sourceId, body.mappings);
  }

  @Post('inspect')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'csvFile', maxCount: 1 },
      { name: 'ofxFile', maxCount: 1 },
    ])
  )
  inspectFiles(
    @UploadedFiles()
    files: {
      csvFile?: Express.Multer.File[];
      ofxFile?: Express.Multer.File[];
    },
    @Body('sourceId') sourceIdStr?: string
  ) {
    const csvFile = files?.csvFile?.[0];
    const ofxFile = files?.ofxFile?.[0];

    if (!csvFile || !ofxFile) {
      throw new BadRequestException('Both CSV and OFX files are required for inspection');
    }

    const inspection = this.fileMergeService.inspectFiles(csvFile.buffer, ofxFile.buffer);

    let defaultMappings = [];
    const sourceId = sourceIdStr ? parseInt(sourceIdStr, 10) : undefined;
    if (sourceId) {
      const existing = this.fileMergeService.getMergeMapping(sourceId);
      if (existing.length === 0) {
        // Auto-generate defaults and persist them
        defaultMappings = this.fileMergeService.generateDefaultMapping(
          sourceId,
          inspection.csvHeaders,
          inspection.ofxHeaders,
          true
        );
      } else {
        defaultMappings = existing;
      }
    } else {
      defaultMappings = this.fileMergeService.generateDefaultMapping(
        0,
        inspection.csvHeaders,
        inspection.ofxHeaders,
        false
      );
    }

    return {
      ...inspection,
      defaultMappings,
    };
  }

  @Post('execute')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'csvFile', maxCount: 1 },
      { name: 'ofxFile', maxCount: 1 },
    ])
  )
  executeMerge(
    @UploadedFiles()
    files: {
      csvFile?: Express.Multer.File[];
      ofxFile?: Express.Multer.File[];
    },
    @Body('sourceId') sourceIdStr?: string,
    @Body('accountSourceName') accountSourceName?: string,
    @Body('mappings') mappingsJson?: string
  ) {
    const csvFile = files?.csvFile?.[0];
    const ofxFile = files?.ofxFile?.[0];

    if (!csvFile || !ofxFile) {
      throw new BadRequestException('Both CSV and OFX files are required');
    }

    let mappings: any[] = [];
    if (mappingsJson) {
      try {
        mappings = typeof mappingsJson === 'string' ? JSON.parse(mappingsJson) : mappingsJson;
      } catch (e: any) {
        throw new BadRequestException(`Invalid mappings JSON: ${e.message}`);
      }
    } else if (sourceIdStr) {
      const sourceId = parseInt(sourceIdStr, 10);
      mappings = this.fileMergeService.getMergeMapping(sourceId);
    }

    if (!mappings || mappings.length === 0) {
      throw new BadRequestException('No mapping rules provided or found for this source');
    }

    const sourceId = sourceIdStr ? parseInt(sourceIdStr, 10) : undefined;
    let sourceName = accountSourceName;
    if (!sourceName && sourceId) {
      sourceName = this.fileMergeService.getSourceName(sourceId) || undefined;
    }
    const result = this.fileMergeService.executeMerge(csvFile.buffer, ofxFile.buffer, mappings, sourceId);
    const filename = this.fileMergeService.buildMergedFilename(
      sourceName,
      result.minTransactionDate,
      result.maxTransactionDate
    );

    return {
      ...result,
      filename,
    };
  }

  @Post('download')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'csvFile', maxCount: 1 },
      { name: 'ofxFile', maxCount: 1 },
    ])
  )
  downloadMergedCsv(
    @UploadedFiles()
    files: {
      csvFile?: Express.Multer.File[];
      ofxFile?: Express.Multer.File[];
    },
    @Body('mappings') mappingsJson: string,
    @Res() res: Response,
    @Body('sourceId') sourceIdStr?: string,
    @Body('accountSourceName') accountSourceName?: string
  ) {
    const csvFile = files?.csvFile?.[0];
    const ofxFile = files?.ofxFile?.[0];

    if (!csvFile || !ofxFile) {
      throw new BadRequestException('Both CSV and OFX files are required');
    }

    let mappings: any[] = [];
    try {
      mappings = typeof mappingsJson === 'string' ? JSON.parse(mappingsJson) : mappingsJson;
    } catch (e: any) {
      throw new BadRequestException(`Invalid mappings JSON: ${e.message}`);
    }

    const sourceId = sourceIdStr ? parseInt(sourceIdStr, 10) : undefined;
    const result = this.fileMergeService.executeMerge(csvFile.buffer, ofxFile.buffer, mappings, sourceId);

    let sourceName = accountSourceName;
    if (!sourceName && sourceId) {
      sourceName = this.fileMergeService.getSourceName(sourceId) || undefined;
    }

    const filename = this.fileMergeService.buildMergedFilename(
      sourceName,
      result.minTransactionDate,
      result.maxTransactionDate
    );

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    res.status(200).send(result.csvString);
  }
}
