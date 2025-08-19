"use client";

import React, { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileDown, FileText, TrendingUp, TrendingDown } from 'lucide-react';
import {
  ForecastInput,
  Handlers,
  MonthlyPL,
  calculatePL,
  calculateCumulative,
  formatCurrency,
  formatPercentage,
  formatMonthLabel,
  filterDataByPeriod,
  CalculatedPL,
} from '@/lib/finance';

interface ForecastReportProps {
  input: ForecastInput;
  handlers?: Handlers;
}

interface KPICardProps {
  title: string;
  value: string;
  subValue?: string;
  trend?: 'up' | 'down' | 'neutral';
  className?: string;
}

const KPICard: React.FC<KPICardProps> = ({ title, value, subValue, trend, className = '' }) => {
  return (
    <Card className={`${className}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-gray-600">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold">{value}</div>
            {subValue && (
              <div className="text-sm text-gray-500 mt-1">{subValue}</div>
            )}
          </div>
          {trend && (
            <div className="ml-2">
              {trend === 'up' && <TrendingUp className="h-5 w-5 text-green-500" />}
              {trend === 'down' && <TrendingDown className="h-5 w-5 text-red-500" />}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export const ForecastReport: React.FC<ForecastReportProps> = ({ input, handlers = {} }) => {
  const [viewMode, setViewMode] = useState<'monthly' | 'cumulative'>('monthly');
  const [selectedPeriod, setSelectedPeriod] = useState<{ start: string; end: string }>({
    start: input.periodStart,
    end: input.periodEnd,
  });

  // データの計算
  const calculatedData = useMemo(() => {
    const filtered = filterDataByPeriod(
      input.data,
      selectedPeriod.start as any,
      selectedPeriod.end as any
    );
    return filtered.map(calculatePL);
  }, [input.data, selectedPeriod]);

  // 累計データの計算
  const cumulativeData = useMemo(() => {
    return calculateCumulative(calculatedData);
  }, [calculatedData]);

  // 表示用データの準備
  const chartData = useMemo(() => {
    if (viewMode === 'cumulative') {
      return [{
        month: '累計',
        売上高: cumulativeData.sales,
        売上総利益: cumulativeData.grossProfit,
        営業利益: cumulativeData.operatingProfit,
        当期純利益: cumulativeData.netIncome,
        売上総利益率: (cumulativeData.grossMargin || 0) * 100,
        営業利益率: (cumulativeData.operatingMargin || 0) * 100,
      }];
    }
    
    return calculatedData.map(d => ({
      month: formatMonthLabel(d.month),
      売上高: d.sales,
      売上総利益: d.grossProfit,
      営業利益: d.operatingProfit,
      当期純利益: d.netIncome,
      売上総利益率: (d.grossMargin || 0) * 100,
      営業利益率: (d.operatingMargin || 0) * 100,
      isActual: d.isActual,
    }));
  }, [calculatedData, cumulativeData, viewMode]);

  // 最新月のデータ取得
  const latestMonth = calculatedData[calculatedData.length - 1] || cumulativeData;

  // 前月比の計算
  const monthOverMonth = useMemo(() => {
    if (calculatedData.length < 2) return null;
    const current = calculatedData[calculatedData.length - 1];
    const previous = calculatedData[calculatedData.length - 2];
    return {
      sales: previous.sales !== 0 ? (current.sales - previous.sales) / previous.sales : null,
      operatingProfit: previous.operatingProfit !== 0 
        ? (current.operatingProfit - previous.operatingProfit) / previous.operatingProfit 
        : null,
    };
  }, [calculatedData]);

  const getTrend = (value: number | null): 'up' | 'down' | 'neutral' => {
    if (value === null) return 'neutral';
    if (value > 0) return 'up';
    if (value < 0) return 'down';
    return 'neutral';
  };

  return (
    <div className="w-full space-y-6">
      {/* ヘッダー */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-center md:text-left">業績見通し</h2>
          <div className="text-sm text-gray-600 mt-2 space-y-1">
            <div>組織名: {input.companyName}</div>
            <div>会計期間: {input.periodStart} – {input.periodEnd}</div>
            <div>対象: {input.scopeLabel}</div>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2">
          <Select value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">単月</SelectItem>
              <SelectItem value="cumulative">累計</SelectItem>
            </SelectContent>
          </Select>
          
          <div className="flex gap-2">
            {handlers.onExportCSV && (
              <Button variant="outline" size="sm" onClick={handlers.onExportCSV}>
                <FileDown className="h-4 w-4 mr-2" />
                CSV
              </Button>
            )}
            {handlers.onExportPDF && (
              <Button variant="outline" size="sm" onClick={handlers.onExportPDF}>
                <FileText className="h-4 w-4 mr-2" />
                PDF
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* KPIカード */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KPICard
          title="売上高"
          value={formatCurrency(latestMonth.sales, input.currency)}
          subValue={monthOverMonth ? formatPercentage(monthOverMonth.sales) : undefined}
          trend={getTrend(monthOverMonth?.sales || null)}
        />
        <KPICard
          title="売上原価"
          value={formatCurrency(latestMonth.cogs, input.currency)}
        />
        <KPICard
          title="売上総利益"
          value={formatCurrency(latestMonth.grossProfit, input.currency)}
          subValue={formatPercentage(latestMonth.grossMargin)}
        />
        <KPICard
          title="販管費"
          value={formatCurrency(latestMonth.sga, input.currency)}
        />
        <KPICard
          title="営業利益"
          value={formatCurrency(latestMonth.operatingProfit, input.currency)}
          subValue={formatPercentage(latestMonth.operatingMargin)}
          trend={getTrend(monthOverMonth?.operatingProfit || null)}
        />
        <KPICard
          title="当期純利益"
          value={formatCurrency(latestMonth.netIncome, input.currency)}
        />
      </div>

      {/* グラフ */}
      <Card>
        <CardHeader>
          <CardTitle>損益推移</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis 
                yAxisId="left" 
                orientation="left" 
                tickFormatter={(value) => formatCurrency(value, input.currency)} 
              />
              <YAxis 
                yAxisId="right" 
                orientation="right" 
                tickFormatter={(value) => `${value.toFixed(1)}%`}
              />
              <Tooltip 
                formatter={(value: number, name: string) => {
                  if (name.includes('率')) {
                    return `${value.toFixed(1)}%`;
                  }
                  return formatCurrency(value, input.currency);
                }}
              />
              <Legend />
              
              {/* 棒グラフ */}
              <Bar yAxisId="left" dataKey="売上高" fill="#1e3a8a" />
              <Bar yAxisId="left" dataKey="売上総利益" fill="#94a3b8" />
              <Bar yAxisId="left" dataKey="営業利益" fill="#14b8a6" />
              <Bar yAxisId="left" dataKey="当期純利益" fill="#e2e8f0" />
              
              {/* 折れ線グラフ */}
              <Line 
                yAxisId="right" 
                type="monotone" 
                dataKey="売上総利益率" 
                stroke="#fb923c" 
                strokeWidth={2}
                dot={{ r: 4 }}
              />
              <Line 
                yAxisId="right" 
                type="monotone" 
                dataKey="営業利益率" 
                stroke="#ef4444" 
                strokeWidth={2}
                dot={{ r: 4, shape: 'square' }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};