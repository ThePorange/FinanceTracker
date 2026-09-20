export interface ReportFilterBundle {
  startDate?: string;
  endDate?: string;
  sourceId?: string;
  groupId?: string;
  category?: string;
  typeId?: string;
  ruleId?: string;
  ruleGroupId?: string;
  drcr?: string;
  amountOp?: string;
  amountVal?: string;
  search?: string;
}

export interface ReportSeries {
  id: string;
  name: string;
  filters: ReportFilterBundle[];
}

export interface ReportDefinitionJson {
  series: ReportSeries[];
  interval: 'monthly' | 'daily' | 'yearly' | 'comparative_monthly';
  amountMode: 'net' | 'dr' | 'cr';
}

export interface ReportDefinition {
  sys_report_definition_id?: number;
  report_name: string;
  chart_type: 'line' | 'bar' | 'area';
  definition_json: string | ReportDefinitionJson;
  created_date?: string;
  updated_date?: string;
}

export interface SeriesSummary {
  id: string;
  name: string;
  totalAmount: number;
  count: number;
}

export interface EvaluateReportResponse {
  chartData: Array<Record<string, any>>;
  seriesSummaries: SeriesSummary[];
}
