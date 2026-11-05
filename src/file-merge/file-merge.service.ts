import { Injectable, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { parse } from 'csv-parse/sync';
import { parseOfx, extractOfxSchemaHeaders } from '../etl/ofx-parser';
import { evaluateExpression, EvalContext } from './calculation-engine';

export interface MergeMapRow {
  sys_merge_map_id?: number;
  sys_account_source_id: number;
  source: string; // 'input.csv' | 'input.ofx' | 'derived.csv' | 'derived.ofx'
  fieldname: string;
  in_output: string; // 'y' | 'n'
  output_fieldname: string;
  output_field_order: string;
  list_index: string; // '1.1', '2.1', etc.
  datatype: string; // 'text' | 'date' | 'number'
  format?: string;
  calculation_json?: string;
}

export function formatValue(val: any, datatype: string, formatPattern?: string): string {
  if (val === null || val === undefined || val === '') return '';

  const dtype = (datatype || '').toLowerCase();
  const fmt = (formatPattern || '').toLowerCase().replace(/['"]/g, '').trim();

  if (dtype === 'date') {
    let raw = String(val).trim();
    let year = '', month = '', day = '';

    if (/^\d{8}/.test(raw)) {
      // Format: 20260924090000 or 20260924
      year = raw.slice(0, 4);
      month = raw.slice(4, 6);
      day = raw.slice(6, 8);
    } else {
      const parts = raw.split(/[\/\-\.]/);
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          // YYYY-MM-DD
          year = parts[0];
          month = parts[1].padStart(2, '0');
          day = parts[2].padStart(2, '0');
        } else if (parts[2].length === 4) {
          // MM/DD/YYYY
          month = parts[0].padStart(2, '0');
          day = parts[1].padStart(2, '0');
          year = parts[2];
        }
      }
    }

    if (year && month && day) {
      if (fmt === 'mm/dd/yyyy') return `${month}/${day}/${year}`;
      if (fmt === 'dd/mm/yyyy') return `${day}/${month}/${year}`;
      if (fmt === 'yyyy-mm-dd') return `${year}-${month}-${day}`;
      if (fmt === 'yyyy/mm/dd') return `${year}/${month}/${day}`;
      // default: mm/dd/yyyy
      return `${month}/${day}/${year}`;
    }
    return raw;
  }

  if (dtype === 'number') {
    const num = Number(val);
    if (!isNaN(num)) {
      if (fmt === '0.00' || fmt === '2' || fmt === '%.2f') {
        return num.toFixed(2);
      }
      if (fmt === '0') {
        return Math.round(num).toString();
      }
      return Number.isInteger(num) ? num.toString() : num.toFixed(2);
    }
    return String(val);
  }

  return String(val).trim();
}

@Injectable()
export class FileMergeService {
  constructor(private readonly dbService: DatabaseService) {}

  /**
   * Fetch existing mapping records from sys_merge_map by sys_account_source_id.
   */
  getMergeMapping(sysAccountSourceId: number): MergeMapRow[] {
    const db = this.dbService.getDb();
    const rows = db.prepare(`
      SELECT sys_merge_map_id, sys_account_source_id, source, fieldname, in_output, 
             output_fieldname, output_field_order, list_index, datatype, format, calculation_json
      FROM sys_merge_map
      WHERE sys_account_source_id = ?
      ORDER BY 
        CASE 
          WHEN CAST(output_field_order AS INTEGER) > 0 THEN CAST(output_field_order AS INTEGER) 
          ELSE 9999 
        END,
        sys_merge_map_id ASC
    `).all(sysAccountSourceId) as MergeMapRow[];

    return rows;
  }

  /**
   * Persist / update merge mapping records for an account source.
   */
  saveMergeMapping(sysAccountSourceId: number, mappings: MergeMapRow[]): MergeMapRow[] {
    const db = this.dbService.getDb();

    const insertTx = db.transaction((rows: MergeMapRow[]) => {
      db.prepare('DELETE FROM sys_merge_map WHERE sys_account_source_id = ?').run(sysAccountSourceId);

      const stmt = db.prepare(`
        INSERT INTO sys_merge_map (
          sys_account_source_id, source, fieldname, in_output, output_fieldname,
          output_field_order, list_index, datatype, format, calculation_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const m of rows) {
        stmt.run(
          sysAccountSourceId,
          m.source || 'input.csv',
          m.fieldname || '',
          m.in_output ? String(m.in_output).toLowerCase() : 'n',
          m.output_fieldname || m.fieldname || '',
          m.output_field_order !== undefined && m.output_field_order !== null ? String(m.output_field_order) : '',
          m.list_index || '',
          m.datatype || 'text',
          m.format || '',
          m.calculation_json || ''
        );
      }
    });

    insertTx(mappings);
    return this.getMergeMapping(sysAccountSourceId);
  }

  /**
   * Auto-generate default mapping rules when no mapping exists for an account source.
   */
  generateDefaultMapping(
    sysAccountSourceId: number,
    csvHeaders: string[],
    ofxHeaders: string[],
    persist: boolean = true
  ): MergeMapRow[] {
    const defaultMappings: MergeMapRow[] = [];
    let orderIndex = 1;

    // 1. Process CSV Headers
    for (const header of csvHeaders) {
      const clean = header.trim();
      const lower = clean.toLowerCase();
      let datatype = 'text';
      let format = '';

      if (lower.includes('date')) {
        datatype = 'date';
        format = 'mm/dd/yyyy';
      } else if (lower.includes('amount') || lower.includes('debit') || lower.includes('credit') || lower.includes('balance')) {
        datatype = 'number';
        format = '0.00';
      }

      defaultMappings.push({
        sys_account_source_id: sysAccountSourceId,
        source: 'input.csv',
        fieldname: clean,
        in_output: 'y',
        output_fieldname: clean,
        output_field_order: String(orderIndex++),
        list_index: '',
        datatype,
        format,
        calculation_json: '',
      });
    }

    // 2. Process OFX Headers
    for (const header of ofxHeaders) {
      const clean = header.trim();
      const upper = clean.toUpperCase();
      let datatype = 'text';
      let format = '';

      if (upper === 'DTPOSTED' || upper.includes('DATE')) {
        datatype = 'date';
        format = 'mm/dd/yyyy';
      } else if (upper === 'TRNAMT' || upper.includes('AMT') || upper.includes('BAL')) {
        datatype = 'number';
        format = '0.00';
      }

      defaultMappings.push({
        sys_account_source_id: sysAccountSourceId,
        source: 'input.ofx',
        fieldname: clean,
        in_output: upper === 'FITID' ? 'y' : 'n',
        output_fieldname: clean,
        output_field_order: upper === 'FITID' ? String(orderIndex++) : '',
        list_index: '',
        datatype,
        format,
        calculation_json: '',
      });
    }

    if (persist && defaultMappings.length > 0) {
      return this.saveMergeMapping(sysAccountSourceId, defaultMappings);
    }

    return defaultMappings;
  }

  /**
   * Inspect uploaded CSV and OFX buffers to extract field headers and initial counts.
   */
  inspectFiles(csvBuffer: Buffer | string, ofxBuffer: Buffer | string) {
    const csvContent = typeof csvBuffer === 'string' ? csvBuffer : csvBuffer.toString('utf8');
    const ofxContent = typeof ofxBuffer === 'string' ? ofxBuffer : ofxBuffer.toString('utf8');

    // Parse CSV headers
    let csvHeaders: string[] = [];
    let csvRowCount = 0;
    try {
      const records = parse(csvContent, {
        columns: false,
        skip_empty_lines: true,
        trim: true,
      }) as string[][];

      if (records.length > 0) {
        csvHeaders = records[0];
        csvRowCount = records.length - 1;
      }
    } catch (e: any) {
      throw new BadRequestException(`Failed to parse CSV file: ${e.message}`);
    }

    // Parse OFX headers
    let ofxHeaders: string[] = [];
    let ofxRowCount = 0;
    try {
      const ofxRecords = parseOfx(ofxContent);
      ofxRowCount = ofxRecords.length;
      ofxHeaders = extractOfxSchemaHeaders(ofxContent);
    } catch (e: any) {
      throw new BadRequestException(`Failed to parse OFX file: ${e.message}`);
    }

    return {
      csvHeaders,
      csvRowCount,
      ofxHeaders,
      ofxRowCount,
    };
  }

  /**
   * Core Merge Engine: Merges CSV and OFX files based on mapping definitions,
   * calculations, format normalization, and list_index matching.
   */
  executeMerge(
    csvBuffer: Buffer | string,
    ofxBuffer: Buffer | string,
    mappingRules: MergeMapRow[],
    sourceId?: number
  ) {
    const csvContent = typeof csvBuffer === 'string' ? csvBuffer : csvBuffer.toString('utf8');
    const ofxContent = typeof ofxBuffer === 'string' ? ofxBuffer : ofxBuffer.toString('utf8');

    // 1. Parse CSV rows
    let csvRecords: Record<string, string>[] = [];
    try {
      csvRecords = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });
    } catch (e: any) {
      throw new BadRequestException(`CSV parse error: ${e.message}`);
    }

    // 2. Parse OFX rows
    const ofxRecords: Record<string, string>[] = parseOfx(ofxContent);

    // Normalize mapping rules: map aliases like sample.csv -> input.csv
    const normalizedRules = mappingRules.map(r => {
      let src = (r.source || 'input.csv').toLowerCase().trim();
      if (src === 'sample.csv') src = 'input.csv';
      if (src === 'sample.ofx') src = 'input.ofx';
      return {
        ...r,
        source: src,
        in_output: (r.in_output === 'y' || r.in_output === 'yes' || r.in_output === '1' || (r.in_output as any) === true) ? 'y' : 'n',
      };
    });

    // Extract index rules (1.n for CSV, 2.n for OFX)
    const csvIndexRules = normalizedRules
      .filter(r => r.list_index && r.list_index.startsWith('1.'))
      .sort((a, b) => a.list_index.localeCompare(b.list_index, undefined, { numeric: true }));

    const ofxIndexRules = normalizedRules
      .filter(r => r.list_index && r.list_index.startsWith('2.'))
      .sort((a, b) => a.list_index.localeCompare(b.list_index, undefined, { numeric: true }));

    // Helper: evaluate derived & direct values for a file row
    const evaluateFileRow = (
      row: Record<string, string>,
      fileType: 'csv' | 'ofx',
      extraCtx: { recordNumber?: number; ofRecords?: number } = {}
    ) => {
      const derived: Record<string, any> = {};
      const relevantDerivedRules = normalizedRules.filter(
        r => r.source === `derived.${fileType}` || r.source === `derived`
      );

      // Evaluate derived fields for this row
      for (const rule of relevantDerivedRules) {
        const fieldKey = rule.output_fieldname || rule.fieldname;
        if (!fieldKey) continue;

        const ctx: EvalContext = {
          csvRow: fileType === 'csv' ? row : undefined,
          ofxRow: fileType === 'ofx' ? row : undefined,
          derivedCsv: fileType === 'csv' ? derived : undefined,
          derivedOfx: fileType === 'ofx' ? derived : undefined,
          currentVal: '',
          recordNumber: extraCtx.recordNumber,
          ofRecords: extraCtx.ofRecords,
        };

        let val = evaluateExpression(rule.calculation_json || '', ctx);
        if (rule.format) {
          val = formatValue(val, rule.datatype, rule.format);
        }
        derived[fieldKey] = val;
      }

      return derived;
    };

    // Helper: build base index key (excluding recordNumber/ofRecords) to partition duplicates
    const getBaseIndexKey = (
      row: Record<string, string>,
      derived: Record<string, any>,
      indexRules: MergeMapRow[],
      fileType: 'csv' | 'ofx'
    ): string => {
      return indexRules
        .filter(r => {
          const calc = (r.calculation_json || '').toLowerCase();
          const fname = (r.output_fieldname || r.fieldname || '').toLowerCase();
          return calc !== 'record' && calc !== 'records' &&
                 fname !== 'recordnumber' && fname !== 'ofrecords';
        })
        .map(r => {
          const fname = r.fieldname || r.output_fieldname;
          let rawVal = '';
          if (r.source === `derived.${fileType}`) {
            rawVal = derived[r.output_fieldname || r.fieldname];
          } else {
            rawVal = row[fname] || '';
            if (r.calculation_json) {
              const ctx: EvalContext = {
                csvRow: fileType === 'csv' ? row : undefined,
                ofxRow: fileType === 'ofx' ? row : undefined,
                derivedCsv: fileType === 'csv' ? derived : undefined,
                derivedOfx: fileType === 'ofx' ? derived : undefined,
                currentVal: rawVal,
              };
              rawVal = evaluateExpression(r.calculation_json, ctx);
            }
          }
          return formatValue(rawVal, r.datatype, r.format);
        })
        .join('|');
    };

    // --- CSV PASS 1: Base Duplicate Partitioning ---
    const csvBaseKeys: string[] = [];
    const csvDerivedList: Record<string, any>[] = [];
    const csvBaseCounts = new Map<string, number>();

    for (const csvRow of csvRecords) {
      const derived = evaluateFileRow(csvRow, 'csv');
      csvDerivedList.push(derived);
      const baseKey = getBaseIndexKey(csvRow, derived, csvIndexRules, 'csv');
      csvBaseKeys.push(baseKey);
      csvBaseCounts.set(baseKey, (csvBaseCounts.get(baseKey) || 0) + 1);
    }

    // --- CSV PASS 2: Assign recordNumber & ofRecords ---
    const csvBaseCurrentCounters = new Map<string, number>();
    const csvFinalKeys: string[] = [];
    const csvFinalDerived: Record<string, any>[] = [];

    for (let i = 0; i < csvRecords.length; i++) {
      const csvRow = csvRecords[i];
      const baseKey = csvBaseKeys[i];
      const count = (csvBaseCurrentCounters.get(baseKey) || 0) + 1;
      csvBaseCurrentCounters.set(baseKey, count);
      const total = csvBaseCounts.get(baseKey) || 1;

      // Re-evaluate derived with accurate recordNumber and ofRecords
      const derived = evaluateFileRow(csvRow, 'csv', { recordNumber: count, ofRecords: total });
      csvFinalDerived.push(derived);

      // Build full composite index key (e.g. 1.1 | 1.2 | 1.3 | 1.4)
      const fullKey = csvIndexRules.map(r => {
        let rawVal = '';
        if (r.source === 'derived.csv') {
          rawVal = derived[r.output_fieldname || r.fieldname];
        } else {
          rawVal = csvRow[r.fieldname] || '';
          if (r.calculation_json) {
            const ctx: EvalContext = {
              csvRow,
              derivedCsv: derived,
              currentVal: rawVal,
              recordNumber: count,
              ofRecords: total,
            };
            rawVal = evaluateExpression(r.calculation_json, ctx);
          }
        }
        return formatValue(rawVal, r.datatype, r.format);
      }).join('|');

      csvFinalKeys.push(fullKey);
    }

    // --- OFX PASS 1: Base Duplicate Partitioning ---
    const ofxBaseKeys: string[] = [];
    const ofxDerivedList: Record<string, any>[] = [];
    const ofxBaseCounts = new Map<string, number>();

    for (const ofxRow of ofxRecords) {
      const derived = evaluateFileRow(ofxRow, 'ofx');
      ofxDerivedList.push(derived);
      const baseKey = getBaseIndexKey(ofxRow, derived, ofxIndexRules, 'ofx');
      ofxBaseKeys.push(baseKey);
      ofxBaseCounts.set(baseKey, (ofxBaseCounts.get(baseKey) || 0) + 1);
    }

    // --- OFX PASS 2: Assign recordNumber & ofRecords ---
    const ofxBaseCurrentCounters = new Map<string, number>();
    const ofxItems: Array<{
      fullKey: string;
      ofxRow: Record<string, string>;
      derived: Record<string, any>;
      index: number;
      used: boolean;
    }> = [];

    for (let i = 0; i < ofxRecords.length; i++) {
      const ofxRow = ofxRecords[i];
      const baseKey = ofxBaseKeys[i];
      const count = (ofxBaseCurrentCounters.get(baseKey) || 0) + 1;
      ofxBaseCurrentCounters.set(baseKey, count);
      const total = ofxBaseCounts.get(baseKey) || 1;

      const derived = evaluateFileRow(ofxRow, 'ofx', { recordNumber: count, ofRecords: total });

      const fullKey = ofxIndexRules.map(r => {
        let rawVal = '';
        if (r.source === 'derived.ofx') {
          rawVal = derived[r.output_fieldname || r.fieldname];
        } else {
          rawVal = ofxRow[r.fieldname] || '';
          if (r.calculation_json) {
            const ctx: EvalContext = {
              ofxRow,
              derivedOfx: derived,
              currentVal: rawVal,
              recordNumber: count,
              ofRecords: total,
            };
            rawVal = evaluateExpression(r.calculation_json, ctx);
          }
        }
        return formatValue(rawVal, r.datatype, r.format);
      }).join('|');

      ofxItems.push({
        fullKey,
        ofxRow,
        derived,
        index: i,
        used: false,
      });
    }

    // Build OFX index map for fast matching
    const ofxKeyMap = new Map<string, typeof ofxItems>();
    for (const item of ofxItems) {
      if (!ofxKeyMap.has(item.fullKey)) {
        ofxKeyMap.set(item.fullKey, []);
      }
      ofxKeyMap.get(item.fullKey)!.push(item);
    }

    // --- STEP 3: LEFT JOIN (CSV as primary) ---
    const mergedOutputRows: Record<string, any>[] = [];
    let matchedCount = 0;
    let unmatchedCsvCount = 0;

    // Filter output fields
    const outputFields = normalizedRules
      .filter(r => r.in_output === 'y')
      .sort((a, b) => {
        const orderA = parseInt(a.output_field_order, 10) || 9999;
        const orderB = parseInt(b.output_field_order, 10) || 9999;
        return orderA - orderB;
      });

    for (let i = 0; i < csvRecords.length; i++) {
      const csvRow = csvRecords[i];
      const derivedCsv = csvFinalDerived[i];
      const fullKey = csvFinalKeys[i];

      // Find matching OFX record
      let matchedOfx: (typeof ofxItems)[0] | undefined;
      const candidates = ofxKeyMap.get(fullKey);
      if (candidates && candidates.length > 0) {
        matchedOfx = candidates.find(c => !c.used);
        if (matchedOfx) {
          matchedOfx.used = true;
          matchedCount++;
        }
      }

      if (!matchedOfx) {
        unmatchedCsvCount++;
      }

      const ofxRow = matchedOfx ? matchedOfx.ofxRow : {};
      const derivedOfx = matchedOfx ? matchedOfx.derived : {};

      // Assemble final output row based on configured output fields
      const outRow: Record<string, any> = {};

      for (const fieldRule of outputFields) {
        const outName = fieldRule.output_fieldname || fieldRule.fieldname;
        let value = '';

        if (fieldRule.source === 'input.csv') {
          value = csvRow[fieldRule.fieldname] !== undefined ? csvRow[fieldRule.fieldname] : '';
        } else if (fieldRule.source === 'input.ofx') {
          value = ofxRow[fieldRule.fieldname] !== undefined ? ofxRow[fieldRule.fieldname] : '';
        } else if (fieldRule.source === 'derived.csv') {
          value = derivedCsv[outName] !== undefined ? derivedCsv[outName] : '';
        } else if (fieldRule.source === 'derived.ofx') {
          value = derivedOfx[outName] !== undefined ? derivedOfx[outName] : '';
        }

        // Apply calculation_json if rule has an explicit formula not yet evaluated
        if (fieldRule.calculation_json && fieldRule.source !== 'derived.csv' && fieldRule.source !== 'derived.ofx') {
          const ctx: EvalContext = {
            csvRow,
            ofxRow,
            derivedCsv,
            derivedOfx,
            currentVal: value,
            recordNumber: derivedCsv.recordNumber || derivedOfx.recordNumber,
            ofRecords: derivedCsv.ofRecords || derivedOfx.ofRecords,
          };
          value = evaluateExpression(fieldRule.calculation_json, ctx);
        }

        // Apply output formatting
        if (fieldRule.format) {
          value = formatValue(value, fieldRule.datatype, fieldRule.format);
        }

        outRow[outName] = value;
      }

      mergedOutputRows.push(outRow);
    }

    // --- STEP 4: Unmatched OFX Records & FITID Logging ---
    const unmatchedOfxItems = ofxItems.filter(item => !item.used);
    const unmatchedOfxFitids = unmatchedOfxItems.map(item => item.ofxRow['FITID'] || item.ofxRow['FTID'] || 'UNKNOWN');
    const unmatchedOfxRecords = unmatchedOfxItems.map(item => ({
      fitid: item.ofxRow['FITID'] || item.ofxRow['FTID'] || '',
      date: item.ofxRow['DTPOSTED'] || '',
      amount: item.ofxRow['TRNAMT'] || '',
      name: item.ofxRow['NAME'] || '',
      memo: item.ofxRow['MEMO'] || '',
    }));

    // --- STEP 5: Generate CSV String Output ---
    const headers = outputFields.map(f => f.output_fieldname || f.fieldname);
    const csvLines: string[] = [];

    // Header line
    csvLines.push(headers.map(h => this.escapeCsvValue(h)).join(','));

    // Data lines
    for (const row of mergedOutputRows) {
      const line = headers.map(h => this.escapeCsvValue(row[h] !== undefined ? String(row[h]) : ''));
      csvLines.push(line.join(','));
    }
    const csvString = csvLines.join('\n');

    const { minTransactionDate, maxTransactionDate } = this.extractMinMaxTransactionDates(
      mergedOutputRows,
      outputFields,
      sourceId
    );

    return {
      columns: headers,
      preview: mergedOutputRows,
      totalCsvRows: csvRecords.length,
      totalOfxRows: ofxRecords.length,
      matchedRows: matchedCount,
      unmatchedCsvRows: unmatchedCsvCount,
      unmatchedOfxRows: unmatchedOfxItems.length,
      unmatchedOfxFitids,
      unmatchedOfxRecords,
      csvString,
      minTransactionDate,
      maxTransactionDate,
    };
  }

  private parseDateToYyyyMmDd(val: any, formatPattern?: string): string | null {
    if (val === null || val === undefined || val === '') return null;
    const raw = String(val).trim();
    if (!raw) return null;

    const fmt = (formatPattern || '').toLowerCase().replace(/['"]/g, '').trim();
    let year = '';
    let month = '';
    let day = '';

    if (/^\d{8}/.test(raw)) {
      year = raw.slice(0, 4);
      month = raw.slice(4, 6);
      day = raw.slice(6, 8);
    } else {
      const parts = raw.split(/[\/\-\.]/);
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          year = parts[0];
          month = parts[1].padStart(2, '0');
          day = parts[2].padStart(2, '0');
        } else if (parts[2].length === 4 || parts[2].length === 2) {
          year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
          if (fmt === 'dd/mm/yyyy') {
            day = parts[0].padStart(2, '0');
            month = parts[1].padStart(2, '0');
          } else {
            month = parts[0].padStart(2, '0');
            day = parts[1].padStart(2, '0');
          }
        }
      }
    }

    if (/^\d{4}$/.test(year) && /^\d{2}$/.test(month) && /^\d{2}$/.test(day)) {
      return `${year}${month}${day}`;
    }
    return null;
  }

  private extractMinMaxTransactionDates(
    mergedOutputRows: Record<string, any>[],
    outputFields: MergeMapRow[],
    sourceId?: number
  ): { minTransactionDate?: string; maxTransactionDate?: string } {
    if (!mergedOutputRows || mergedOutputRows.length === 0) {
      return {};
    }

    const normalizeKey = (s: string) => (s || '').toLowerCase().replace(/[\s_-]/g, '');

    // 1. Look for explicit TransactionDate column in output fields
    let targetRule = outputFields.find(
      f => normalizeKey(f.output_fieldname || f.fieldname) === 'transactiondate'
    );

    // 2. Check sys_account_mapping for the source's mapped transaction_date field if sourceId provided
    if (!targetRule && sourceId) {
      try {
        const db = this.dbService.getDb();
        const mappingRow = db
          .prepare(
            `SELECT sourcefile_fieldname FROM sys_account_mapping 
             WHERE sys_account_source_id = ? AND account_source_type = 'csv' AND transaction_table_fieldname = 'transaction_date'
             LIMIT 1`
          )
          .get(sourceId) as { sourcefile_fieldname?: string } | undefined;

        if (mappingRow?.sourcefile_fieldname) {
          const mappedNorm = normalizeKey(mappingRow.sourcefile_fieldname);
          targetRule = outputFields.find(
            f => normalizeKey(f.output_fieldname || f.fieldname) === mappedNorm
          );
        }
      } catch {
        // Ignore DB lookup errors and fall back to heuristics
      }
    }

    // 3. Fallback to 'date' / 'postingdate' / first date datatype field in output
    if (!targetRule) {
      targetRule =
        outputFields.find(f => normalizeKey(f.output_fieldname || f.fieldname) === 'date') ||
        outputFields.find(f => normalizeKey(f.output_fieldname || f.fieldname) === 'postingdate') ||
        outputFields.find(f => (f.datatype || '').toLowerCase() === 'date');
    }

    if (!targetRule) {
      return {};
    }

    const colName = targetRule.output_fieldname || targetRule.fieldname;
    const dates: string[] = [];

    for (const row of mergedOutputRows) {
      const parsed = this.parseDateToYyyyMmDd(row[colName], targetRule.format);
      if (parsed) {
        dates.push(parsed);
      }
    }

    if (dates.length === 0) {
      return {};
    }

    dates.sort();
    return {
      minTransactionDate: dates[0],
      maxTransactionDate: dates[dates.length - 1],
    };
  }

  getSourceName(sysAccountSourceId: number): string | null {
    try {
      const db = this.dbService.getDb();
      const row = db.prepare('SELECT account_source_name FROM sys_account_source WHERE sys_account_source_id = ?').get(sysAccountSourceId) as any;
      return row ? row.account_source_name : null;
    } catch {
      return null;
    }
  }

  buildMergedFilename(
    accountSourceName?: string,
    minTransactionDate?: string,
    maxTransactionDate?: string,
    date: Date = new Date()
  ): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());
    const timestamp = `${year}${month}${day}${hours}${minutes}${seconds}`;

    const cleanName = (accountSourceName || '')
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9_-]/g, '');

    const parts = ['merged'];
    if (cleanName) parts.push(cleanName);
    if (minTransactionDate) parts.push(minTransactionDate);
    if (maxTransactionDate) parts.push(maxTransactionDate);
    parts.push(timestamp);

    return `${parts.join('_')}.csv`;
  }

  private escapeCsvValue(val: string): string {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }
}
