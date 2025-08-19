/**
 * 財務計算ユーティリティ関数
 */

export type Month = `${number}-${number}`; // e.g. "2025-03"

export interface MonthlyPL {
  month: Month;
  sales: number;           // 売上高（返金等は負の可能性あり）
  cogs: number;            // 売上原価
  sga: number;             // 販売費および一般管理費
  nonOperating?: number;   // 営業外損益（+/-）
  extraordinary?: number;  // 特別損益（+/-）
  taxes?: number;          // 法人税等（+）
  isActual: boolean;       // 実績= true / 計画= false
}

export interface ForecastInput {
  companyName: string;     // 組織名
  scopeLabel: string;      // 例: "全社" や 部門名
  currency: 'JPY' | 'USD' | string;
  periodStart: Month;
  periodEnd: Month;
  data: MonthlyPL[];       // 期間内の月次
}

export interface Handlers {
  onExportCSV?: () => void;
  onExportPDF?: () => void;
}

export interface CalculatedPL extends MonthlyPL {
  grossProfit: number;      // 売上総利益
  operatingProfit: number;  // 営業利益
  netIncome: number;        // 当期純利益
  grossMargin: number | null;     // 売上総利益率
  operatingMargin: number | null; // 営業利益率
}

/**
 * 月次PLデータから各種利益と利益率を計算
 */
export function calculatePL(data: MonthlyPL): CalculatedPL {
  const grossProfit = data.sales - data.cogs;
  const operatingProfit = grossProfit - data.sga;
  const netIncome = operatingProfit + 
    (data.nonOperating || 0) + 
    (data.extraordinary || 0) - 
    (data.taxes || 0);
  
  const grossMargin = data.sales !== 0 ? grossProfit / data.sales : null;
  const operatingMargin = data.sales !== 0 ? operatingProfit / data.sales : null;

  return {
    ...data,
    grossProfit,
    operatingProfit,
    netIncome,
    grossMargin,
    operatingMargin
  };
}

/**
 * 期間内の累計値を計算
 */
export function calculateCumulative(data: MonthlyPL[]): CalculatedPL {
  const totals = data.reduce((acc, curr) => ({
    sales: acc.sales + curr.sales,
    cogs: acc.cogs + curr.cogs,
    sga: acc.sga + curr.sga,
    nonOperating: (acc.nonOperating || 0) + (curr.nonOperating || 0),
    extraordinary: (acc.extraordinary || 0) + (curr.extraordinary || 0),
    taxes: (acc.taxes || 0) + (curr.taxes || 0),
  }), {
    sales: 0,
    cogs: 0,
    sga: 0,
    nonOperating: 0,
    extraordinary: 0,
    taxes: 0,
  });

  const grossProfit = totals.sales - totals.cogs;
  const operatingProfit = grossProfit - totals.sga;
  const netIncome = operatingProfit + 
    (totals.nonOperating || 0) + 
    (totals.extraordinary || 0) - 
    (totals.taxes || 0);

  return {
    month: 'cumulative' as Month,
    sales: totals.sales,
    cogs: totals.cogs,
    sga: totals.sga,
    nonOperating: totals.nonOperating,
    extraordinary: totals.extraordinary,
    taxes: totals.taxes,
    isActual: false,
    grossProfit,
    operatingProfit,
    netIncome,
    grossMargin: totals.sales !== 0 ? grossProfit / totals.sales : null,
    operatingMargin: totals.sales !== 0 ? operatingProfit / totals.sales : null,
  };
}

/**
 * 通貨フォーマット
 */
export function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * パーセンテージフォーマット
 */
export function formatPercentage(value: number | null): string {
  if (value === null) return '–';
  return new Intl.NumberFormat('ja-JP', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

/**
 * 月のラベル形式化 (YYYY-MM -> MM月)
 */
export function formatMonthLabel(month: Month): string {
  const [year, monthNum] = month.split('-');
  return `${parseInt(monthNum)}月`;
}

/**
 * 期間内の月次データをフィルタリング
 */
export function filterDataByPeriod(
  data: MonthlyPL[],
  startMonth: Month,
  endMonth: Month
): MonthlyPL[] {
  return data.filter(item => {
    return item.month >= startMonth && item.month <= endMonth;
  });
}