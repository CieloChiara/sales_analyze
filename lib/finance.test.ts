import {
  calculatePL,
  calculateCumulative,
  formatCurrency,
  formatPercentage,
  formatMonthLabel,
  filterDataByPeriod,
  MonthlyPL,
} from './finance';

describe('Finance Utilities', () => {
  describe('calculatePL', () => {
    it('should calculate profits and margins correctly', () => {
      const input: MonthlyPL = {
        month: '2025-01',
        sales: 1000000,
        cogs: 400000,
        sga: 300000,
        nonOperating: 50000,
        extraordinary: -20000,
        taxes: 100000,
        isActual: true,
      };

      const result = calculatePL(input);

      expect(result.grossProfit).toBe(600000); // 1000000 - 400000
      expect(result.operatingProfit).toBe(300000); // 600000 - 300000
      expect(result.netIncome).toBe(230000); // 300000 + 50000 - 20000 - 100000
      expect(result.grossMargin).toBeCloseTo(0.6); // 600000 / 1000000
      expect(result.operatingMargin).toBeCloseTo(0.3); // 300000 / 1000000
    });

    it('should handle zero sales correctly', () => {
      const input: MonthlyPL = {
        month: '2025-01',
        sales: 0,
        cogs: 100000,
        sga: 50000,
        isActual: true,
      };

      const result = calculatePL(input);

      expect(result.grossProfit).toBe(-100000);
      expect(result.operatingProfit).toBe(-150000);
      expect(result.grossMargin).toBeNull();
      expect(result.operatingMargin).toBeNull();
    });

    it('should handle negative sales correctly', () => {
      const input: MonthlyPL = {
        month: '2025-01',
        sales: -500000, // 返金による負の売上
        cogs: 200000,
        sga: 100000,
        isActual: true,
      };

      const result = calculatePL(input);

      expect(result.grossProfit).toBe(-700000);
      expect(result.operatingProfit).toBe(-800000);
      expect(result.grossMargin).toBeCloseTo(1.4); // -700000 / -500000
      expect(result.operatingMargin).toBeCloseTo(1.6); // -800000 / -500000
    });
  });

  describe('calculateCumulative', () => {
    it('should calculate cumulative totals correctly', () => {
      const data: MonthlyPL[] = [
        {
          month: '2025-01',
          sales: 1000000,
          cogs: 400000,
          sga: 300000,
          nonOperating: 50000,
          taxes: 100000,
          isActual: true,
        },
        {
          month: '2025-02',
          sales: 1200000,
          cogs: 480000,
          sga: 350000,
          nonOperating: -30000,
          taxes: 120000,
          isActual: true,
        },
      ];

      const result = calculateCumulative(data);

      expect(result.sales).toBe(2200000);
      expect(result.cogs).toBe(880000);
      expect(result.sga).toBe(650000);
      expect(result.grossProfit).toBe(1320000); // 2200000 - 880000
      expect(result.operatingProfit).toBe(670000); // 1320000 - 650000
      expect(result.netIncome).toBe(500000); // 670000 + 20000 - 0 - 220000
      expect(result.grossMargin).toBeCloseTo(0.6); // 1320000 / 2200000
      expect(result.operatingMargin).toBeCloseTo(0.3045); // 670000 / 2200000
    });

    it('should handle empty array', () => {
      const result = calculateCumulative([]);

      expect(result.sales).toBe(0);
      expect(result.grossProfit).toBe(0);
      expect(result.grossMargin).toBeNull();
    });
  });

  describe('formatCurrency', () => {
    it('should format JPY correctly', () => {
      expect(formatCurrency(1000000, 'JPY')).toBe('¥1,000,000');
      expect(formatCurrency(-500000, 'JPY')).toBe('-¥500,000');
      expect(formatCurrency(0, 'JPY')).toBe('¥0');
    });

    it('should format USD correctly', () => {
      expect(formatCurrency(1000.50, 'USD')).toBe('$1,001');
      expect(formatCurrency(-500.99, 'USD')).toBe('-$501');
    });
  });

  describe('formatPercentage', () => {
    it('should format percentages correctly', () => {
      expect(formatPercentage(0.356)).toBe('35.6%');
      expect(formatPercentage(-0.125)).toBe('-12.5%');
      expect(formatPercentage(0)).toBe('0.0%');
      expect(formatPercentage(1.5)).toBe('150.0%');
    });

    it('should handle null values', () => {
      expect(formatPercentage(null)).toBe('–');
    });
  });

  describe('formatMonthLabel', () => {
    it('should format month labels correctly', () => {
      expect(formatMonthLabel('2025-01')).toBe('1月');
      expect(formatMonthLabel('2025-12')).toBe('12月');
      expect(formatMonthLabel('2025-09')).toBe('9月');
    });
  });

  describe('filterDataByPeriod', () => {
    const data: MonthlyPL[] = [
      { month: '2024-12', sales: 1000000, cogs: 400000, sga: 300000, isActual: true },
      { month: '2025-01', sales: 1100000, cogs: 440000, sga: 330000, isActual: true },
      { month: '2025-02', sales: 1200000, cogs: 480000, sga: 360000, isActual: true },
      { month: '2025-03', sales: 1300000, cogs: 520000, sga: 390000, isActual: false },
    ];

    it('should filter data within period correctly', () => {
      const result = filterDataByPeriod(data, '2025-01', '2025-02');
      expect(result).toHaveLength(2);
      expect(result[0].month).toBe('2025-01');
      expect(result[1].month).toBe('2025-02');
    });

    it('should include boundary months', () => {
      const result = filterDataByPeriod(data, '2024-12', '2025-03');
      expect(result).toHaveLength(4);
    });

    it('should return empty array if no data in period', () => {
      const result = filterDataByPeriod(data, '2025-06', '2025-07');
      expect(result).toHaveLength(0);
    });
  });
});