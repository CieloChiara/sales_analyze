# ForecastReport Component

決算予測レポートを表示する再利用可能なReactコンポーネントです。

## 機能

- 📊 **KPIカード表示**: 売上高、売上原価、売上総利益、販管費、営業利益、当期純利益を表示
- 📈 **複合グラフ**: 棒グラフ（金額）と折れ線グラフ（利益率）の二軸表示
- 🔄 **表示モード切替**: 単月/累計の切り替え
- 📁 **エクスポート機能**: CSV/PDF出力（ハンドラー経由）
- 💰 **多通貨対応**: JPY, USD等の通貨フォーマット
- 📱 **レスポンシブデザイン**: モバイルからデスクトップまで対応

## インストール

```bash
npm install recharts
```

## 使用方法

```tsx
import { ForecastReport } from '@/components/ForecastReport';
import { ForecastInput } from '@/lib/finance';

const data: ForecastInput = {
  companyName: "株式会社サンプル",
  scopeLabel: "全社",
  currency: "JPY",
  periodStart: "2024-12",
  periodEnd: "2025-11",
  data: [
    {
      month: "2024-12",
      sales: 18000000,
      cogs: 9000000,
      sga: 7500000,
      nonOperating: 200000,
      taxes: 500000,
      isActual: true
    },
    // ... 他の月次データ
  ]
};

function App() {
  const handleExportCSV = () => {
    // CSV出力処理
  };

  const handleExportPDF = () => {
    // PDF出力処理
  };

  return (
    <ForecastReport
      input={data}
      handlers={{
        onExportCSV: handleExportCSV,
        onExportPDF: handleExportPDF,
      }}
    />
  );
}
```

## Props

### `input: ForecastInput`

会計データと設定情報を含むオブジェクト。

```typescript
interface ForecastInput {
  companyName: string;     // 組織名
  scopeLabel: string;      // 対象範囲（例: "全社"）
  currency: 'JPY' | 'USD' | string;  // 通貨コード
  periodStart: Month;      // 期間開始月 (YYYY-MM)
  periodEnd: Month;        // 期間終了月 (YYYY-MM)
  data: MonthlyPL[];       // 月次損益データ
}
```

### `handlers?: Handlers`

エクスポート機能のハンドラー（オプション）。

```typescript
interface Handlers {
  onExportCSV?: () => void;  // CSV出力ハンドラー
  onExportPDF?: () => void;  // PDF出力ハンドラー
}
```

## 月次データ構造 (MonthlyPL)

```typescript
interface MonthlyPL {
  month: Month;            // 年月 (YYYY-MM形式)
  sales: number;           // 売上高
  cogs: number;            // 売上原価
  sga: number;             // 販売費および一般管理費
  nonOperating?: number;   // 営業外損益（オプション）
  extraordinary?: number;  // 特別損益（オプション）
  taxes?: number;          // 法人税等（オプション）
  isActual: boolean;       // 実績フラグ（true: 実績, false: 計画）
}
```

## 計算ロジック

### 利益計算
- **売上総利益** = 売上高 - 売上原価
- **営業利益** = 売上総利益 - 販管費
- **当期純利益** = 営業利益 + 営業外損益 + 特別損益 - 法人税等

### 利益率計算
- **売上総利益率** = 売上総利益 ÷ 売上高
- **営業利益率** = 営業利益 ÷ 売上高
- 売上高が0の場合は null を返す

## カスタマイズ

### カラーパレット

グラフの色は以下のように設定されています：

- **棒グラフ**
  - 売上高: `#1e3a8a` (濃紺)
  - 売上総利益: `#94a3b8` (グレー)
  - 営業利益: `#14b8a6` (ティール)
  - 当期純利益: `#e2e8f0` (ライトグレー)

- **折れ線グラフ**
  - 売上総利益率: `#fb923c` (オレンジ)
  - 営業利益率: `#ef4444` (赤)

### レスポンシブブレークポイント

- モバイル: < 640px (2列表示)
- タブレット: 640px - 1024px (3列表示)
- デスクトップ: > 1024px (6列表示)

## テスト

```bash
# ユニットテストの実行
npm test finance.test.ts

# Storybookの起動
npm run storybook
```

## 注意事項

- 負の売上高（返金等）に対応
- ゼロ除算の場合、利益率は「–」と表示
- 実績と計画の混在表示に対応
- 通貨フォーマットは`Intl.NumberFormat`を使用

## ライセンス

MIT