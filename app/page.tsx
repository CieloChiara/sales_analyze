"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Save, Upload, FileDown, FileText, Settings, Building2, CalendarClock, RefreshCw, Plus, Trash2, Download, Database, Table2, Braces, BookOpenText, LineChart as LineChartIcon } from "lucide-react";
import Papa from "papaparse";
import dayjs from "dayjs";
import "dayjs/locale/ja";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import {
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// shadcn/ui imports
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

// -------------------- 型定義 --------------------

type CurrencyCode = "JPY" | "USD" | "EUR" | string;

type Business = {
  name: string;
  currency: CurrencyCode;
};

type FiscalPeriod = {
  startMonth: string; // YYYY-MM
  endMonth: string;   // YYYY-MM
};

type StatementType = "PL" | "BS";

type PLCat = "Revenue" | "Expense" | "Other";

type Account = {
  code: string;
  name: string;
  statement: StatementType;
  plCategory?: PLCat; // PLのみ
};

type TBRow = {
  month: string; // YYYY-MM
  accountCode: string;
  accountName: string;
  amount: number; // 借方正、貸方負 など、正負処理後
  statement: StatementType;
};

type AppState = {
  business: Business;
  fiscal: FiscalPeriod | null;
  accounts: Account[];
  actuals: Record<string, Record<string, number>>; // month -> accountCode -> amount
  plan: Record<string, Record<string, number>>;    // month -> accountCode -> amount
  notes?: string;
};

// -------------------- ユーティリティ --------------------

const CURRENCY_FORMATTER = (currency: CurrencyCode) =>
  new Intl.NumberFormat("ja-JP", { style: "currency", currency, maximumFractionDigits: 0 });

const monthRange = (startMonth: string, endMonth: string) => {
  const start = dayjs(startMonth + "-01");
  const end = dayjs(endMonth + "-01");
  const arr: string[] = [];
  let cur = start.startOf("month");
  while (cur.isBefore(end) || cur.isSame(end)) {
    arr.push(cur.format("YYYY-MM"));
    cur = cur.add(1, "month");
  }
  return arr;
};

const uniqBy = <T, K extends keyof any>(arr: T[], keyFn: (v: T) => K) => {
  const map = new Map<K, T>();
  for (const item of arr) {
    const k = keyFn(item);
    if (!map.has(k)) map.set(k, item);
  }
  return Array.from(map.values());
};

const guessPLCategory = (name: string): PLCat => {
  const n = name.toLowerCase();
  if (/(売上|sales|revenue|収益|interest income|operating income)/.test(n)) return "Revenue";
  if (/(費|原価|cost|expense|支払|減価償却|租税|外注|広告|地代|人件|給料|賃金|旅費|通信|水道|光熱)/.test(n)) return "Expense";
  return "Other";
};

const ensureObject = (o: any) => (o ? o : {});

const LS_KEY = "forecast-pl-app-v1";

// -------------------- メインコンポーネント --------------------

export default function App() {
  const [state, setState] = useState<AppState>(() => {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        try { return JSON.parse(raw) as AppState; } catch {}
      }
    }
    return {
      business: { name: "", currency: "JPY" },
      fiscal: null,
      accounts: [],
      actuals: {},
      plan: {},
      notes: "",
    } as AppState;
  });

  const [activeTab, setActiveTab] = useState<string>("settings");
  const [importHeaders, setImportHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<{ [k: string]: string }>({});
  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [hideOther, setHideOther] = useState<boolean>(true);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(LS_KEY, JSON.stringify(state));
    }
  }, [state]);

  // 便利関数
  const months = useMemo(() => {
    if (!state.fiscal) return [] as string[];
    return monthRange(state.fiscal.startMonth, state.fiscal.endMonth);
  }, [state.fiscal]);

  const plAccounts = useMemo(() => state.accounts.filter(a => a.statement === "PL"), [state.accounts]);

  const currency = state.business.currency || "JPY";
  const fmt = CURRENCY_FORMATTER(currency);

  // --------- 取り込み処理 ---------

  const handleCSVFile = (file: File) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data as any[];
        if (!rows.length) return;
        setPreviewRows(rows.slice(0, 20));
        const headers = Object.keys(rows[0]);
        setImportHeaders(headers);
        // 仮マッピング推測
        const lowerMap: Record<string, string> = {};
        headers.forEach(h => lowerMap[h.toLowerCase()] = h);
        const guess = (keys: string[]) => keys.find(k => lowerMap[k]);
        const m: any = {};
        m.month = guess(["month", "ym", "date", "期間", "月", "会計月", "会計期間", "年月"]) || headers[0];
        m.accountCode = guess(["account_code", "code", "科目コード", "勘定科目コード"]) || headers[1] || headers[0];
        m.accountName = guess(["account_name", "name", "科目名", "勘定科目", "勘定科目名"]) || headers[2] || headers[0];
        m.amount = guess(["amount", "金額", "balance", "残高", "合計", "debit", "credit"]) || headers[3] || headers[0];
        m.statement = guess(["statement", "種類", "区分", "財務諸表", "pl/bs"]) || headers[4] || headers[0];
        m.dc = guess(["dc", "借貸", "借方/貸方", "借方貸方", "side"]) || "";
        setMapping(m);
      },
      error: (err) => {
        alert("CSVの読み込みでエラー: " + err.message);
      },
    });
  };

  const normalizeMonth = (v: string): string => {
    if (!v) return "";
    const t = String(v).trim();
    // 例: 2025-01, 2025/01, 2025-01-31, 2025/01/31, 2025.1
    const m = dayjs(t, ["YYYY-MM", "YYYY/MM", "YYYY.MM", "YYYY-M", "YYYY/M", "YYYY-MM-DD", "YYYY/MM/DD"], true);
    if (m.isValid()) return m.format("YYYY-MM");
    // freee等の「2025年01月」形式の緩和
    const m2 = dayjs(t.replace("年", "-").replace("月", ""), ["YYYY-M", "YYYY-MM"], true);
    if (m2.isValid()) return m2.format("YYYY-MM");
    return t;
  };

  const toNumber = (v: any) => {
    if (typeof v === "number") return v;
    if (v == null) return 0;
    const s = String(v).replace(/[,\s]/g, "");
    const n = Number(s);
    return isFinite(n) ? n : 0;
  };

  const importRows = () => {
    if (!previewRows.length) return alert("先にCSVを選択してください。");
    const rows: TBRow[] = [];
    let minMonth: string | null = null;
    let maxMonth: string | null = null;

    for (const r of previewRows.concat((window as any).ALL_PARSED_ROWS || [])) {
      // 上でPapaparseはpreviewのみ設定。大量でも対応できるようwindowに一時退避する実装も可能だが、ここでは簡易化
      const month = normalizeMonth(r[mapping.month]);
      const accountCode = String(r[mapping.accountCode] ?? "").trim();
      const accountName = String(r[mapping.accountName] ?? "").trim();
      let amount = toNumber(r[mapping.amount]);
      const statementGuess = String(r[mapping.statement] ?? "").toUpperCase();
      const statement: StatementType = /BS/.test(statementGuess) ? "BS" : "PL";
      const dc = String(r[mapping.dc] ?? "").toUpperCase();
      // 借方/貸方の符号調整（一般的には費用は借方正/収益は貸方正 等だが、CSVの形に依る）
      if (dc === "C" || /貸/.test(dc)) amount = -Math.abs(amount);
      if (dc === "D" || /借/.test(dc)) amount = Math.abs(amount);

      if (!month || !accountCode) continue;
      rows.push({ month, accountCode, accountName, amount, statement });
      if (!minMonth || month < minMonth) minMonth = month;
      if (!maxMonth || month > maxMonth) maxMonth = month;
    }

    // 会計期間が未設定なら推定
    let fiscal = state.fiscal;
    if (!fiscal && minMonth && maxMonth) {
      fiscal = { startMonth: minMonth, endMonth: maxMonth };
    }

    // アカウント抽出
    const accounts: Account[] = uniqBy(
      rows.map((r) => ({
        code: r.accountCode,
        name: r.accountName || r.accountCode,
        statement: r.statement,
        plCategory: r.statement === "PL" ? guessPLCategory(r.accountName || r.accountCode) : undefined,
      })),
      (a) => a.code
    );

    // 実績集計
    const actuals: AppState["actuals"] = JSON.parse(JSON.stringify(state.actuals));
    for (const r of rows) {
      actuals[r.month] = ensureObject(actuals[r.month]);
      actuals[r.month][r.accountCode] = (actuals[r.month][r.accountCode] || 0) + r.amount;
    }

    setState((prev) => ({
      ...prev,
      fiscal: fiscal || prev.fiscal,
      accounts: uniqBy([...(prev.accounts || []), ...accounts], (a) => a.code),
      actuals,
    }));
    setActiveTab("plan");
  };

  const downloadTemplate = () => {
    const csv = Papa.unparse({
      fields: ["month", "account_code", "account_name", "amount", "statement", "dc"],
      data: [
        ["2025-01", "4000", "売上高", "1000000", "PL", "C"],
        ["2025-01", "5000", "売上原価", "300000", "PL", "D"],
        ["2025-02", "4000", "売上高", "1100000", "PL", "C"],
      ],
    });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "trial_balance_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // --------- 勘定科目設定の更新 ---------
  const updatePLCategory = (code: string, cat: PLCat) => {
    setState((prev) => ({
      ...prev,
      accounts: prev.accounts.map((a) => (a.code === code ? { ...a, plCategory: cat } : a)),
    }));
  };

  // --------- 計画入力 ---------
  const [selectedPlanAccounts, setSelectedPlanAccounts] = useState<string[]>([]);

  const togglePlanAccount = (code: string) => {
    setSelectedPlanAccounts((list) => (list.includes(code) ? list.filter((c) => c !== code) : [...list, code]));
  };

  const setPlanAmount = (month: string, code: string, amount: number) => {
    setState((prev) => {
      const plan = JSON.parse(JSON.stringify(prev.plan));
      plan[month] = ensureObject(plan[month]);
      plan[month][code] = amount;
      return { ...prev, plan };
    });
  };

  const clearPlanForAccount = (code: string) => {
    setState((prev) => {
      const plan = JSON.parse(JSON.stringify(prev.plan));
      for (const m of Object.keys(plan)) delete plan[m][code];
      return { ...prev, plan };
    });
  };

  // --------- 予測の計算 ---------

  const monthsWithData = months;

  const forecastByMonth = useMemo(() => {
    // 月次ごとの Revenue/Expense/Profit
    const rows = monthsWithData.map((m) => {
      let rev = 0, exp = 0;
      const actual = ensureObject(state.actuals[m]);
      const plan = ensureObject(state.plan[m]);

      // 全科目
      for (const acc of plAccounts) {
        const val = (actual[acc.code] ?? plan[acc.code] ?? 0) as number;
        if (acc.plCategory === "Revenue") rev += val;
        else if (acc.plCategory === "Expense") exp += val;
      }
      const profit = rev - exp;
      return { month: m, Revenue: rev, Expense: exp, Profit: profit };
    });
    return rows;
  }, [monthsWithData, state.actuals, state.plan, plAccounts]);

  const totalYear = useMemo(() => {
    let rev = 0, exp = 0;
    for (const r of forecastByMonth) { rev += r.Revenue; exp += r.Expense; }
    return { Revenue: rev, Expense: exp, Profit: rev - exp };
  }, [forecastByMonth]);

  const lastActualMonth = useMemo(() => {
    const ms = Object.keys(state.actuals || {}).sort();
    return ms.length ? ms[ms.length - 1] : "";
  }, [state.actuals]);

  const isActualMonth = (m: string) => !!(state.actuals[m] && Object.keys(state.actuals[m]).length);

  // --------- エクスポート ---------
  const exportCSV = () => {
    const data: any[] = [];
    for (const m of monthsWithData) {
      const actual = ensureObject(state.actuals[m]);
      const plan = ensureObject(state.plan[m]);
      const row: any = { month: m };
      for (const acc of plAccounts) {
        const v = (actual[acc.code] ?? plan[acc.code] ?? 0) as number;
        row[`${acc.code}:${acc.name}`] = v;
      }
      row["Revenue(total)"] = forecastByMonth.find((r) => r.month === m)?.Revenue || 0;
      row["Expense(total)"] = forecastByMonth.find((r) => r.month === m)?.Expense || 0;
      row["Profit(total)"] = forecastByMonth.find((r) => r.month === m)?.Profit || 0;
      data.push(row);
    }
    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "forecast_pl.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = async () => {
    if (!reportRef.current) return;
    const el = reportRef.current;
    const canvas = await html2canvas(el);
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth - 40;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let y = 20;
    pdf.setFontSize(14);
    pdf.text(`決算予測レポート - ${state.business.name || "(事業所未設定)"}`, 20, y);
    y += 10;
    pdf.text(`期間: ${state.fiscal ? `${state.fiscal.startMonth} 〜 ${state.fiscal.endMonth}` : "(未設定)"}`, 20, y+14);
    y += 20;
    pdf.addImage(imgData, "PNG", 20, y, imgWidth, Math.min(imgHeight, pageHeight - y - 20));
    pdf.save("forecast_report.pdf");
  };

  // --------- API連携プレースホルダー ---------
  const [apiConfig, setApiConfig] = useState({
    freeeToken: "",
    mfToken: "",
  });

  const fetchFromFreee = async () => {
    alert("freee会計APIとの連携はデモでは未実装です。サーバ側のOAuth 2.0とCORS設定が必要です。CSVインポートをご利用ください。");
  };
  const fetchFromMF = async () => {
    alert("Money Forward会計APIとの連携はデモでは未実装です。サーバ側のOAuth 2.0とCORS設定が必要です。CSVインポートをご利用ください。");
  };

  // -------------------- UI --------------------

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-900"> 
      <div className="max-w-7xl mx-auto px-4 py-6">
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <LineChartIcon className="w-6 h-6" />
            <h1 className="text-2xl font-bold">決算予測アプリ</h1>
            <Badge variant="secondary">β</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => { 
              if (typeof window !== 'undefined') {
                localStorage.removeItem(LS_KEY); 
                location.reload(); 
              }
            }}>
              <RefreshCw className="w-4 h-4 mr-2" /> リセット
            </Button>
            <Button onClick={exportCSV}><FileDown className="w-4 h-4 mr-2"/>CSV出力</Button>
            <Button onClick={exportPDF}><FileText className="w-4 h-4 mr-2"/>PDF出力</Button>
          </div>
        </header>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-6 gap-2">
            <TabsTrigger value="settings"><Settings className="w-4 h-4 mr-2"/>設定</TabsTrigger>
            <TabsTrigger value="import"><Upload className="w-4 h-4 mr-2"/>データインポート</TabsTrigger>
            <TabsTrigger value="plan"><Table2 className="w-4 h-4 mr-2"/>月次計画入力</TabsTrigger>
            <TabsTrigger value="report"><LineChartIcon className="w-4 h-4 mr-2"/>決算予測レポート</TabsTrigger>
            <TabsTrigger value="api"><Braces className="w-4 h-4 mr-2"/>API連携(β)</TabsTrigger>
            <TabsTrigger value="help"><BookOpenText className="w-4 h-4 mr-2"/>ヘルプ</TabsTrigger>
          </TabsList>

          {/* 設定 */}
          <TabsContent value="settings" className="mt-4 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Building2 className="w-5 h-5"/>事業所登録</CardTitle>
                  <CardDescription>基本情報を設定します。</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>事業所名</Label>
                    <Input value={state.business.name} onChange={(e) => setState({ ...state, business: { ...state.business, name: e.target.value } })} placeholder="例）AiHUB株式会社"/>
                  </div>
                  <div className="space-y-2">
                    <Label>通貨</Label>
                    <Select value={state.business.currency} onValueChange={(v) => setState({ ...state, business: { ...state.business, currency: v } })}>
                      <SelectTrigger><SelectValue placeholder="JPY"/></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="JPY">JPY</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
                <CardFooter className="justify-end">
                  <Button><Save className="w-4 h-4 mr-2"/>保存</Button>
                </CardFooter>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><CalendarClock className="w-5 h-5"/>会計期間</CardTitle>
                  <CardDescription>CSVインポートから自動推定します。必要に応じて上書き可能。</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>開始月 (YYYY-MM)</Label>
                    <Input value={state.fiscal?.startMonth || ""} onChange={(e) => setState({ ...state, fiscal: { ...(state.fiscal || { startMonth: "", endMonth: "" }), startMonth: e.target.value } })} placeholder="2025-01"/>
                  </div>
                  <div>
                    <Label>終了月 (YYYY-MM)</Label>
                    <Input value={state.fiscal?.endMonth || ""} onChange={(e) => setState({ ...state, fiscal: { ...(state.fiscal || { startMonth: "", endMonth: "" }), endMonth: e.target.value } })} placeholder="2025-12"/>
                  </div>
                  <div className="flex items-end"><Badge variant="outline">月数: {months.length}</Badge></div>
                </CardContent>
                <CardFooter className="justify-between">
                  <div className="text-sm text-slate-500">インポート済みの実績期間: {Object.keys(state.actuals).sort().join(", ") || "(未取込)"}</div>
                  <Button variant="outline" onClick={() => setActiveTab("import")}><Upload className="w-4 h-4 mr-2"/>CSVから推定</Button>
                </CardFooter>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>勘定科目設定（PLのみ）</CardTitle>
                <CardDescription>収益 / 費用 / その他 を確認・調整してください。</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Switch checked={hideOther} onCheckedChange={setHideOther} />
                    <span className="text-sm text-slate-600">"その他"を非表示</span>
                  </div>
                  <div className="text-sm text-slate-500">PL科目数: {plAccounts.length}</div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>コード</TableHead>
                      <TableHead>名称</TableHead>
                      <TableHead>区分</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {plAccounts
                      .filter(a => (hideOther ? a.plCategory !== "Other" : true))
                      .map((a) => (
                      <TableRow key={a.code}>
                        <TableCell className="font-mono text-xs">{a.code}</TableCell>
                        <TableCell>{a.name}</TableCell>
                        <TableCell>
                          <Select value={a.plCategory || "Other"} onValueChange={(v: PLCat) => updatePLCategory(a.code, v)}>
                            <SelectTrigger className="w-40"><SelectValue/></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Revenue">収益</SelectItem>
                              <SelectItem value="Expense">費用</SelectItem>
                              <SelectItem value="Other">その他</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* データインポート */}
          <TabsContent value="import" className="mt-4 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Upload className="w-5 h-5"/>CSVインポート（試算表 or 総勘定元帳）</CardTitle>
                <CardDescription>freee/Money ForwardからエクスポートしたCSVを読み込み、実績を取り込みます。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
                  <input type="file" accept=".csv" onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleCSVFile(f);
                  }} />
                  <Button variant="outline" onClick={downloadTemplate}><Download className="w-4 h-4 mr-2"/>テンプレCSV</Button>
                </div>
                {importHeaders.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label>月(YYYY-MM)</Label>
                      <Select value={mapping.month} onValueChange={(v) => setMapping({ ...mapping, month: v })}>
                        <SelectTrigger><SelectValue/></SelectTrigger>
                        <SelectContent>{importHeaders.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>勘定科目コード</Label>
                      <Select value={mapping.accountCode} onValueChange={(v) => setMapping({ ...mapping, accountCode: v })}>
                        <SelectTrigger><SelectValue/></SelectTrigger>
                        <SelectContent>{importHeaders.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>勘定科目名</Label>
                      <Select value={mapping.accountName} onValueChange={(v) => setMapping({ ...mapping, accountName: v })}>
                        <SelectTrigger><SelectValue/></SelectTrigger>
                        <SelectContent>{importHeaders.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>金額</Label>
                      <Select value={mapping.amount} onValueChange={(v) => setMapping({ ...mapping, amount: v })}>
                        <SelectTrigger><SelectValue/></SelectTrigger>
                        <SelectContent>{importHeaders.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>区分 (PL/BS)</Label>
                      <Select value={mapping.statement} onValueChange={(v) => setMapping({ ...mapping, statement: v })}>
                        <SelectTrigger><SelectValue/></SelectTrigger>
                        <SelectContent>{importHeaders.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>借方/貸方 (任意)</Label>
                      <Select value={mapping.dc || "none"} onValueChange={(v) => setMapping({ ...mapping, dc: v === "none" ? "" : v })}>
                        <SelectTrigger><SelectValue placeholder="未選択"/></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">(未使用)</SelectItem>
                          {importHeaders.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {previewRows.length > 0 && (
                  <div className="mt-4">
                    <Label className="mb-2 block">プレビュー（先頭20行）</Label>
                    <div className="border rounded-xl overflow-auto max-h-64">
                      <table className="min-w-full text-sm">
                        <thead className="bg-slate-50 sticky top-0">
                          <tr>
                            {Object.keys(previewRows[0]).map((h) => (
                              <th key={h} className="text-left p-2 font-medium border-b">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {previewRows.map((r, i) => (
                            <tr key={i} className="odd:bg-white even:bg-slate-50/60">
                              {Object.keys(previewRows[0]).map((h) => (
                                <td key={h} className="p-2 border-b whitespace-nowrap">{String(r[h])}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </CardContent>
              <CardFooter className="justify-end">
                <Button onClick={importRows}><Upload className="w-4 h-4 mr-2"/>インポート</Button>
              </CardFooter>
            </Card>
          </TabsContent>

          {/* 月次計画入力 */}
          <TabsContent value="plan" className="mt-4 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>計画対象の科目を選択</CardTitle>
                <CardDescription>PL科目のうち、将来月に計画を入力する科目を選びます。</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2 max-h-48 overflow-auto p-2 rounded-lg border">
                  {plAccounts
                    .filter(a => hideOther ? a.plCategory !== "Other" : true)
                    .map((a) => (
                    <Button key={a.code}
                      variant={selectedPlanAccounts.includes(a.code) ? "default" : "outline"}
                      size="sm"
                      onClick={() => togglePlanAccount(a.code)}
                      className="rounded-2xl">
                      {a.name} <span className="opacity-60 ml-1 text-xs">({a.code})</span>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {selectedPlanAccounts.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>月次計画入力</CardTitle>
                  <CardDescription>実績が存在しない月にも入力できます（実績優先で上書きされません）。</CardDescription>
                </CardHeader>
                <CardContent className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>科目/月</TableHead>
                        {months.map((m) => (
                          <TableHead key={m} className="text-center whitespace-nowrap">{m} {isActualMonth(m) && <Badge className="ml-2" variant="secondary">実績</Badge>}</TableHead>
                        ))}
                        <TableHead>操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedPlanAccounts.map((code) => {
                        const acc = plAccounts.find((x) => x.code === code)!;
                        return (
                          <TableRow key={code}>
                            <TableCell className="font-medium">{acc?.name || code}</TableCell>
                            {months.map((m) => {
                              const actual = state.actuals[m]?.[code];
                              const planned = state.plan[m]?.[code];
                              const disabled = actual != null; // 実績優先
                              return (
                                <TableCell key={m} className="min-w-[140px]">
                                  <div className="flex items-center gap-2">
                                    <Input
                                      type="number"
                                      value={disabled ? actual : (planned ?? "")}
                                      onChange={(e) => setPlanAmount(m, code, Number(e.target.value || 0))}
                                      disabled={disabled}
                                      className="text-right"
                                    />
                                    <span className="text-xs text-slate-400">{disabled ? "実績" : "計画"}</span>
                                  </div>
                                </TableCell>
                              );
                            })}
                            <TableCell>
                              <Button variant="ghost" size="icon" onClick={() => clearPlanForAccount(code)} title="計画クリア"><Trash2 className="w-4 h-4"/></Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* 決算予測レポート */}
          <TabsContent value="report" className="mt-4 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader><CardTitle>予測売上合計</CardTitle></CardHeader>
                <CardContent className="text-2xl font-bold">{fmt.format(totalYear.Revenue)}</CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>予測費用合計</CardTitle></CardHeader>
                <CardContent className="text-2xl font-bold">{fmt.format(totalYear.Expense)}</CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>予測利益</CardTitle></CardHeader>
                <CardContent className="text-2xl font-bold">{fmt.format(totalYear.Profit)}</CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>月次推移（収益・費用・利益）</CardTitle>
                <CardDescription>実績は自動採用、未実績は計画値を使用。</CardDescription>
              </CardHeader>
              <CardContent style={{ height: 340 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={forecastByMonth} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(v: any) => fmt.format(v as number)} />
                    <Legend />
                    <Area type="monotone" dataKey="Revenue" name="収益" strokeWidth={2} fillOpacity={0.2} />
                    <Area type="monotone" dataKey="Expense" name="費用" strokeWidth={2} fillOpacity={0.2} />
                    <Area type="monotone" dataKey="Profit" name="利益" strokeWidth={2} fillOpacity={0.2} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>予測損益計算書（簡易）</CardTitle>
                <CardDescription>PL科目の区分に基づき集計。詳細行は計画タブで編集できます。</CardDescription>
              </CardHeader>
              <CardContent ref={reportRef} className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="p-2 text-left">区分</th>
                      {months.map((m) => (<th key={m} className="p-2 text-right whitespace-nowrap">{m}</th>))}
                      <th className="p-2 text-right">合計</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* 収益 */}
                    <tr className="bg-white">
                      <td className="p-2 font-medium">収益</td>
                      {months.map((m) => <td key={m} className="p-2 text-right">{fmt.format(forecastByMonth.find(r => r.month === m)?.Revenue || 0)}</td>)}
                      <td className="p-2 text-right font-semibold">{fmt.format(totalYear.Revenue)}</td>
                    </tr>
                    {/* 費用 */}
                    <tr className="bg-slate-50/60">
                      <td className="p-2 font-medium">費用</td>
                      {months.map((m) => <td key={m} className="p-2 text-right">{fmt.format(forecastByMonth.find(r => r.month === m)?.Expense || 0)}</td>)}
                      <td className="p-2 text-right font-semibold">{fmt.format(totalYear.Expense)}</td>
                    </tr>
                    {/* 利益 */}
                    <tr className="bg-white">
                      <td className="p-2 font-medium">利益</td>
                      {months.map((m) => <td key={m} className="p-2 text-right">{fmt.format(forecastByMonth.find(r => r.month === m)?.Profit || 0)}</td>)}
                      <td className="p-2 text-right font-semibold">{fmt.format(totalYear.Profit)}</td>
                    </tr>
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* API連携(β) */}
          <TabsContent value="api" className="mt-4 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>freee & Money Forward 会計 API</CardTitle>
                <CardDescription>デモ環境では直接連携は無効化しています。サーバ側実装例・エンドポイント設計のガイドを記載します。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>freee Access Token</Label>
                    <Input value={apiConfig.freeeToken} onChange={(e) => setApiConfig({ ...apiConfig, freeeToken: e.target.value })} placeholder="Bearer xxxxxx"/>
                    <div className="mt-2 flex gap-2">
                      <Button variant="outline" onClick={fetchFromFreee}>freeeから取得（未実装）</Button>
                    </div>
                  </div>
                  <div>
                    <Label>Money Forward Access Token</Label>
                    <Input value={apiConfig.mfToken} onChange={(e) => setApiConfig({ ...apiConfig, mfToken: e.target.value })} placeholder="Bearer xxxxxx"/>
                    <div className="mt-2 flex gap-2">
                      <Button variant="outline" onClick={fetchFromMF}>MFから取得（未実装）</Button>
                    </div>
                  </div>
                </div>
                <Separator className="my-4" />
                <div className="prose prose-sm max-w-none">
                  <h3>想定エンドポイント（サーバ側）</h3>
                  <ul>
                    <li><code>POST /api/freee/trial-balance</code> : 事業所ID・期間を指定し、試算表CSVを取得して標準形式に正規化</li>
                    <li><code>POST /api/mf/trial-balance</code> : 同上</li>
                  </ul>
                  <p>※ CORS回避とSecret安全管理のため、フロント直叩きではなくBFF/サーバを推奨します。</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ヘルプ */}
          <TabsContent value="help" className="mt-4 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>使い方</CardTitle>
                <CardDescription>最短3ステップで予測レポートが出力できます。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <ol className="list-decimal ml-5 space-y-2">
                  <li><strong>データインポート</strong> タブからCSVを読み込み、マッピングを確認して「インポート」。</li>
                  <li><strong>設定</strong> タブで会計期間・勘定科目区分（収益/費用）を確認。</li>
                  <li><strong>月次計画入力</strong> で将来月の計画値を入力。</li>
                </ol>
                <p>あとは <strong>決算予測レポート</strong> タブでPDF / CSVとして出力できます。</p>
                <Separator/>
                <h3 className="font-semibold">CSV仕様（推奨）</h3>
                <pre className="bg-slate-950 text-slate-100 p-3 rounded-xl overflow-auto"><code>{`month,account_code,account_name,amount,statement,dc
2025-01,4000,売上高,1000000,PL,C
2025-01,5000,売上原価,300000,PL,D
`}</code></pre>
                <p>※ <code>dc</code> は任意。<code>C</code>(貸方)は負、<code>D</code>(借方)は正として取り込みます。</p>
                <h3 className="font-semibold">よくある質問</h3>
                <ul className="list-disc ml-5 space-y-1">
                  <li>勘定科目区分は自動推測しますが、<strong>設定→勘定科目設定</strong>で必ず確認してください。</li>
                  <li>実績値は計画値より優先されます。実績のある月は計画入力欄が自動でロックされます。</li>
                  <li>貸借対照表(BS)のデータも取り込めますが、現バージョンでは主にPL予測のみ集計対象です。</li>
                </ul>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <footer className="text-xs text-slate-500 mt-10">
          © {new Date().getFullYear()} 決算予測アプリ（デモ）。ローカルストレージに保存されます。
        </footer>
      </div>
    </div>
  );
}