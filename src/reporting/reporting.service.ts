import { Injectable, OnModuleInit } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class ReportingService implements OnModuleInit {
  constructor(private readonly dbService: DatabaseService) {}

  onModuleInit() {
    this.ensureTablesExist();
  }

  private ensureTablesExist() {
    const db = this.dbService.getDb();
    db.exec(`
      CREATE TABLE IF NOT EXISTS sys_report_definition (
          sys_report_definition_id INTEGER PRIMARY KEY,
          report_name VARCHAR(250) NOT NULL UNIQUE,
          chart_type VARCHAR(50) NOT NULL DEFAULT 'line',
          definition_json TEXT NOT NULL,
          created_date DATE DEFAULT CURRENT_TIMESTAMP,
          updated_date DATE DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  getTransactions(page: number = 1, limit: number = 50, queryFilters: Record<string, any> = {}): any {
    const offset = limit > 0 ? (page - 1) * limit : 0;

    let sql = `
      SELECT t.sys_transaction_id AS id,
             t.posting_date,      
             t.transaction_date,  
             COALESCE(t.transaction_date, t.posting_date, t.created_date) AS date,
             t.description,
             t.base_amount AS amount,
             t.drcr,              
             tt.transaction_type, 
             s.account_source_name AS account,
             CASE WHEN v.is_auto = 1 THEN v.category_name ELSE NULL END AS autoCategory,
             CASE WHEN v.is_auto = 0 THEN v.category_name ELSE NULL END AS userCategory,
             v.confidence AS category_confidence,
             v.sys_rule_id,
             t.row_checksum
      FROM sys_transaction t 
      LEFT JOIN sys_account_source s ON t.sys_account_source_id = s.sys_account_source_id
      LEFT JOIN vw_transaction_final_category v ON t.sys_transaction_id = v.sys_transaction_id
      LEFT JOIN sys_transaction_type tt ON t.sys_transaction_type_id = tt.sys_transaction_type_id
    `;

    if (queryFilters.groupId) {
      sql += ` INNER JOIN sys_account_group_map gm ON t.sys_account_source_id = gm.sys_account_source_id AND gm.sys_account_group_id = ?`;
    }

    const where = [];
    const params = [];

    if (queryFilters.groupId) params.push(queryFilters.groupId);

    if (queryFilters.ruleGroupId) {
      where.push(`t.sys_transaction_id IN (
          SELECT map.sys_transaction_id
          FROM sys_transaction_category_map map
          JOIN sys_rule_group_map rgm ON map.sys_rule_id = rgm.sys_rule_id
          WHERE rgm.sys_rule_group_id = ? AND rgm.exclude_rules = 0
      )`);
      params.push(queryFilters.ruleGroupId);

      where.push(`t.sys_transaction_id NOT IN (
          SELECT map.sys_transaction_id
          FROM sys_transaction_category_map map
          JOIN sys_rule_group_map rgm ON map.sys_rule_id = rgm.sys_rule_id
          WHERE rgm.sys_rule_group_id = ? AND rgm.exclude_rules = 1
      )`);
      params.push(queryFilters.ruleGroupId);
    }

    if (queryFilters.startDate) { where.push(`COALESCE(t.transaction_date, t.posting_date, t.created_date) >= ?`); params.push(queryFilters.startDate); }
    if (queryFilters.endDate) { where.push(`COALESCE(t.transaction_date, t.posting_date, t.created_date) <= ?`); params.push(`${queryFilters.endDate} 23:59:59`); }

    if (queryFilters.checksums) {
      const checksumArray = Array.isArray(queryFilters.checksums)
        ? queryFilters.checksums
        : queryFilters.checksums.split(',').filter(Boolean);
      if (checksumArray.length > 0) {
        if (checksumArray.length > 500) {
          const results = [];
          for (let i = 0; i < checksumArray.length; i += 500) {
            const chunk = checksumArray.slice(i, i + 500);
            const chunkResult = this.getTransactions(page, limit, { ...queryFilters, checksums: chunk });
            results.push(...chunkResult.data);
          }
          return {
            data: results,
            total: results.length,
            page,
            limit
          };
        }
        where.push(`t.row_checksum IN (${checksumArray.map(() => '?').join(',')})`);
        params.push(...checksumArray);
      }
    }
    
    if (queryFilters.amountOp && queryFilters.amountVal !== undefined && queryFilters.amountVal !== '') {
      const op = queryFilters.amountOp === '>' ? '>' : queryFilters.amountOp === '<' ? '<' : '=';
      where.push(`t.base_amount ${op} ?`);
      params.push(queryFilters.amountVal);
    } else if (queryFilters.amountVal !== undefined && queryFilters.amountVal !== '') {
      where.push(`t.base_amount = ?`);
      params.push(queryFilters.amountVal);
    }

    if (queryFilters.sourceId) { where.push(`t.sys_account_source_id = ?`); params.push(queryFilters.sourceId); }
    if (queryFilters.typeId) { where.push(`t.sys_transaction_type_id = ?`); params.push(queryFilters.typeId); }
    if (queryFilters.drcr) { where.push(`t.drcr = ?`); params.push(queryFilters.drcr); }
    if (queryFilters.ruleId) { 
        where.push(`EXISTS (SELECT 1 FROM sys_transaction_category_map mf WHERE mf.sys_transaction_id = t.sys_transaction_id AND mf.sys_rule_id = ?)`); 
        params.push(queryFilters.ruleId); 
    }
    if (queryFilters.category) { 
      where.push(`v.category_name LIKE ?`); 
      params.push(`%${queryFilters.category}%`); 
    }

    if (where.length > 0) sql += ` WHERE ` + where.join(' AND ');

    sql += ` ORDER BY COALESCE(t.transaction_date, t.posting_date, t.created_date) DESC`;

    if (limit > 0) {
       sql += ` LIMIT ? OFFSET ?`;
       params.push(limit, offset);
    }

    const data = this.dbService.getDb().prepare(sql).all(...params);

    let countSql = `SELECT COUNT(*) as total FROM sys_transaction t LEFT JOIN vw_transaction_final_category v ON t.sys_transaction_id = v.sys_transaction_id`;
    if (queryFilters.groupId) countSql += ` INNER JOIN sys_account_group_map gm ON t.sys_account_source_id = gm.sys_account_source_id AND gm.sys_account_group_id = ?`;
    if (where.length > 0) countSql += ` WHERE ` + where.join(' AND ');
    
    const countParams = limit > 0 ? params.slice(0, params.length - 2) : params;
    const count = this.dbService.getDb().prepare(countSql).get(...countParams) as any;

    return {
      data,
      total: count.total,
      page,
      limit
    };
  }

  updateTransaction(id: number, updates: { userCategory?: string }) {
    const db = this.dbService.getDb();
    
    if (updates.userCategory !== undefined) {
      const categoryName = updates.userCategory;
      const txn = db.prepare('SELECT sys_account_source_id FROM sys_transaction WHERE sys_transaction_id = ?').get(id) as any;
      if (!txn) throw new Error('Transaction not found');

      let cat = db.prepare('SELECT sys_transaction_category_id FROM sys_transaction_category WHERE category_name = ?').get(categoryName) as any;
      
      if (!cat && categoryName) {
        const res = db.prepare('INSERT INTO sys_transaction_category (category_name) VALUES (?)').run(categoryName);
        cat = { sys_transaction_category_id: res.lastInsertRowid };
      }

      db.prepare('DELETE FROM sys_transaction_category_map WHERE sys_transaction_id = ? AND is_auto = 0').run(id);

      if (cat) {
        db.prepare('INSERT INTO sys_transaction_category_map (sys_transaction_id, sys_transaction_category_id, is_auto, confidence) VALUES (?, ?, 0, 1.0)').run(id, cat.sys_transaction_category_id);
      }
    }

    return { success: true };
  }

  // Report Definitions CRUD
  getReportDefinitions() {
    this.ensureTablesExist();
    return this.dbService.getDb().prepare('SELECT * FROM sys_report_definition ORDER BY updated_date DESC').all();
  }

  getReportDefinitionById(id: number) {
    this.ensureTablesExist();
    return this.dbService.getDb().prepare('SELECT * FROM sys_report_definition WHERE sys_report_definition_id = ?').get(id);
  }

  createReportDefinition(report_name: string, chart_type: string, definition_json: string) {
    this.ensureTablesExist();
    const db = this.dbService.getDb();
    const result = db.prepare(`
      INSERT INTO sys_report_definition (report_name, chart_type, definition_json, updated_date)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `).run(report_name, chart_type, definition_json);

    return this.getReportDefinitionById(Number(result.lastInsertRowid));
  }

  updateReportDefinition(id: number, report_name: string, chart_type: string, definition_json: string) {
    this.ensureTablesExist();
    const db = this.dbService.getDb();
    db.prepare(`
      UPDATE sys_report_definition
      SET report_name = ?, chart_type = ?, definition_json = ?, updated_date = CURRENT_TIMESTAMP
      WHERE sys_report_definition_id = ?
    `).run(report_name, chart_type, definition_json, id);

    return this.getReportDefinitionById(id);
  }

  deleteReportDefinition(id: number) {
    this.ensureTablesExist();
    this.dbService.getDb().prepare('DELETE FROM sys_report_definition WHERE sys_report_definition_id = ?').run(id);
    return { success: true, id };
  }

  // Multi-Series Dynamic Evaluation
  evaluateReport(body: {
    series: Array<{
      id: string;
      name: string;
      filters: Array<Record<string, any>>;
    }>;
    interval?: 'monthly' | 'daily' | 'yearly' | 'comparative_monthly';
    amountMode?: 'net' | 'dr' | 'cr';
  }) {
    const rawInterval = body.interval || 'monthly';
    const amountMode = body.amountMode || 'net';
    const seriesList = body.series || [];

    const isMultipleSeries = seriesList.length > 1;
    // Monthly + Multiple Data Sources = 12-month (Jan-Dec) comparative overlay
    const isMonthlyOverlay = (rawInterval === 'monthly' || rawInterval === 'comparative_monthly') && isMultipleSeries;
    const interval = rawInterval === 'comparative_monthly' ? 'monthly' : rawInterval;

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const timeSeriesMap: Record<string, Record<string, number>> = {};
    const seriesYearsMap: Record<string, Record<string, Set<number>>> = {};
    const seriesSummaries: Array<{ id: string; name: string; totalAmount: number; count: number }> = [];

    let globalMinDate: Date | null = null;
    let globalMaxDate: Date | null = null;

    seriesList.forEach((s) => {
      const txnMap = new Map<number, any>();

      (s.filters || []).forEach((filter) => {
        const res = this.getTransactions(1, -1, filter);
        const list = res.data || [];

        list.forEach((t: any) => {
          if (filter.search && typeof filter.search === 'string' && filter.search.trim() !== '') {
            const searchLower = filter.search.trim().toLowerCase();
            if (!t.description || !t.description.toLowerCase().includes(searchLower)) {
              return;
            }
          }
          txnMap.set(t.id, t);
        });
      });

      let seriesTotal = 0;
      const seriesCount = txnMap.size;

      txnMap.forEach((t) => {
        const rawDate = t.date || t.posting_date || t.transaction_date;
        if (!rawDate) return;
        const d = new Date(rawDate);
        if (isNaN(d.getTime())) return;

        if (!globalMinDate || d < globalMinDate) globalMinDate = d;
        if (!globalMaxDate || d > globalMaxDate) globalMaxDate = d;

        const yr = d.getFullYear();
        let timeKey = '';

        if (isMonthlyOverlay) {
          timeKey = monthNames[d.getMonth()];
          if (!seriesYearsMap[s.name]) seriesYearsMap[s.name] = {};
          if (!seriesYearsMap[s.name][timeKey]) seriesYearsMap[s.name][timeKey] = new Set<number>();
          seriesYearsMap[s.name][timeKey].add(yr);
        } else if (interval === 'daily') {
          timeKey = d.toISOString().split('T')[0];
        } else if (interval === 'yearly') {
          timeKey = String(yr);
        } else {
          timeKey = `${yr}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        }

        const rawAmt = Math.abs(t.amount || 0);
        let calcAmt = 0;
        if (amountMode === 'dr') {
          calcAmt = t.drcr === 'DR' ? rawAmt : 0;
        } else if (amountMode === 'cr') {
          calcAmt = t.drcr === 'CR' ? rawAmt : 0;
        } else {
          calcAmt = t.drcr === 'CR' ? rawAmt : -rawAmt;
        }

        seriesTotal += calcAmt;

        if (!timeSeriesMap[timeKey]) {
          timeSeriesMap[timeKey] = {};
        }
        if (!timeSeriesMap[timeKey][s.name]) {
          timeSeriesMap[timeKey][s.name] = 0;
        }
        timeSeriesMap[timeKey][s.name] += calcAmt;
      });

      seriesSummaries.push({
        id: s.id,
        name: s.name,
        totalAmount: Number(Math.abs(seriesTotal).toFixed(2)),
        count: seriesCount
      });
    });

    let chartData: Array<Record<string, any>> = [];

    if (isMonthlyOverlay) {
      // Multiple Data Sources + Monthly: X-axis is strictly Jan to Dec (12 months)
      chartData = monthNames.map((m) => {
        const row: Record<string, any> = { date: m, _actualDates: {} };
        seriesList.forEach((s) => {
          const val = timeSeriesMap[m]?.[s.name] || 0;
          row[s.name] = Number(Math.abs(val).toFixed(2));
          const yearsSet = seriesYearsMap[s.name]?.[m];
          if (yearsSet && yearsSet.size > 0) {
            const sortedYears = Array.from(yearsSet).sort();
            row._actualDates[s.name] = `${m} ${sortedYears.join(', ')}`;
          } else {
            row._actualDates[s.name] = m;
          }
        });
        return row;
      });
    } else if (interval === 'monthly' && !isMultipleSeries && globalMinDate && globalMaxDate) {
      // Single Data Source + Monthly: X-axis goes from month of first date to month of last date
      const startYr = (globalMinDate as Date).getFullYear();
      const startMo = (globalMinDate as Date).getMonth();
      const endYr = (globalMaxDate as Date).getFullYear();
      const endMo = (globalMaxDate as Date).getMonth();

      const timeKeys: string[] = [];
      let curYr = startYr;
      let curMo = startMo;

      while (curYr < endYr || (curYr === endYr && curMo <= endMo)) {
        const key = `${curYr}-${String(curMo + 1).padStart(2, '0')}`;
        timeKeys.push(key);
        curMo++;
        if (curMo > 11) {
          curMo = 0;
          curYr++;
        }
      }

      chartData = timeKeys.map((key) => {
        const row: Record<string, any> = { date: key, _actualDates: {} };
        seriesList.forEach((s) => {
          const val = timeSeriesMap[key]?.[s.name] || 0;
          row[s.name] = Number(Math.abs(val).toFixed(2));
          row._actualDates[s.name] = key;
        });
        return row;
      });
    } else if (interval === 'yearly' && globalMinDate && globalMaxDate) {
      // Yearly: X-axis goes from min year to max year (e.g. 2020..2024) across all data sources
      const startYr = (globalMinDate as Date).getFullYear();
      const endYr = (globalMaxDate as Date).getFullYear();

      const timeKeys: string[] = [];
      for (let yr = startYr; yr <= endYr; yr++) {
        timeKeys.push(String(yr));
      }

      chartData = timeKeys.map((key) => {
        const row: Record<string, any> = { date: key, _actualDates: {} };
        seriesList.forEach((s) => {
          const val = timeSeriesMap[key]?.[s.name] || 0;
          row[s.name] = Number(Math.abs(val).toFixed(2));
          row._actualDates[s.name] = key;
        });
        return row;
      });
    } else {
      // Fallback or daily: continuous sorted timeline
      const sortedTimeKeys = Object.keys(timeSeriesMap).sort();
      chartData = sortedTimeKeys.map((timeKey) => {
        const row: Record<string, any> = { date: timeKey, _actualDates: {} };
        seriesList.forEach((s) => {
          const val = timeSeriesMap[timeKey]?.[s.name] || 0;
          row[s.name] = Number(Math.abs(val).toFixed(2));
          row._actualDates[s.name] = timeKey;
        });
        return row;
      });
    }

    return {
      chartData,
      seriesSummaries
    };
  }
}

