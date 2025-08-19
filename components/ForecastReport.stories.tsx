import type { Meta, StoryObj } from '@storybook/react';
import { ForecastReport } from './ForecastReport';
import { ForecastInput } from '@/lib/finance';

const meta = {
  title: 'Components/ForecastReport',
  component: ForecastReport,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ForecastReport>;

export default meta;
type Story = StoryObj<typeof meta>;

const sampleData: ForecastInput = {
  companyName: "テスト株式会社",
  scopeLabel: "全社",
  currency: "JPY",
  periodStart: "2024-12",
  periodEnd: "2025-11",
  data: [
    { month: "2024-12", sales: 18000000, cogs: 9000000, sga: 7500000, nonOperating: 200000, taxes: 500000, isActual: true },
    { month: "2025-01", sales: 16500000, cogs: 8250000, sga: 7000000, nonOperating: -100000, taxes: 400000, isActual: true },
    { month: "2025-02", sales: 19000000, cogs: 9500000, sga: 7800000, nonOperating: 300000, taxes: 600000, isActual: true },
    { month: "2025-03", sales: 20000000, cogs: 10000000, sga: 8000000, nonOperating: 250000, taxes: 700000, isActual: false },
    { month: "2025-04", sales: 21000000, cogs: 10500000, sga: 8200000, nonOperating: 300000, taxes: 800000, isActual: false },
    { month: "2025-05", sales: 22000000, cogs: 11000000, sga: 8400000, nonOperating: 350000, taxes: 850000, isActual: false },
    { month: "2025-06", sales: 23000000, cogs: 11500000, sga: 8600000, nonOperating: 400000, taxes: 900000, isActual: false },
    { month: "2025-07", sales: 24000000, cogs: 12000000, sga: 8800000, nonOperating: 450000, taxes: 950000, isActual: false },
    { month: "2025-08", sales: 23500000, cogs: 11750000, sga: 8700000, nonOperating: 400000, taxes: 920000, isActual: false },
    { month: "2025-09", sales: 25000000, cogs: 12500000, sga: 9000000, nonOperating: 500000, taxes: 1000000, isActual: false },
    { month: "2025-10", sales: 26000000, cogs: 13000000, sga: 9200000, nonOperating: 550000, taxes: 1050000, isActual: false },
    { month: "2025-11", sales: 27000000, cogs: 13500000, sga: 9400000, nonOperating: 600000, taxes: 1100000, isActual: false },
  ]
};

export const Default: Story = {
  args: {
    input: sampleData,
    handlers: {
      onExportCSV: () => console.log('Export CSV clicked'),
      onExportPDF: () => console.log('Export PDF clicked'),
    },
  },
};

export const WithNegativeValues: Story = {
  args: {
    input: {
      ...sampleData,
      data: sampleData.data.map((d, i) => ({
        ...d,
        sales: i === 3 ? -1000000 : d.sales, // 返金による負の売上
        nonOperating: i % 2 === 0 ? -500000 : 300000, // 営業外損失
      })),
    },
    handlers: {
      onExportCSV: () => console.log('Export CSV clicked'),
      onExportPDF: () => console.log('Export PDF clicked'),
    },
  },
};

export const QuarterlyView: Story = {
  args: {
    input: {
      ...sampleData,
      periodStart: "2025-01",
      periodEnd: "2025-03",
      data: sampleData.data.filter(d => d.month >= "2025-01" && d.month <= "2025-03"),
    },
    handlers: {
      onExportCSV: () => console.log('Export CSV clicked'),
      onExportPDF: () => console.log('Export PDF clicked'),
    },
  },
};

export const NoHandlers: Story = {
  args: {
    input: sampleData,
  },
};

export const USDCurrency: Story = {
  args: {
    input: {
      ...sampleData,
      currency: "USD",
      data: sampleData.data.map(d => ({
        ...d,
        sales: d.sales / 150, // JPY to USD conversion
        cogs: d.cogs / 150,
        sga: d.sga / 150,
        nonOperating: (d.nonOperating || 0) / 150,
        taxes: (d.taxes || 0) / 150,
      })),
    },
    handlers: {
      onExportCSV: () => console.log('Export CSV clicked'),
      onExportPDF: () => console.log('Export PDF clicked'),
    },
  },
};