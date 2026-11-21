import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Award,
  BarChart3,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock,
  DollarSign,
  Download,
  Edit3,
  FileJson,
  Flame,
  Image as ImageIcon,
  Layers,
  Plus,
  Search,
  ShieldAlert,
  Sparkles,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  Upload,
  Wallet,
  X,
} from 'lucide-react';

const STORAGE_KEY = 'boardmaster_v1_records';
const CAPITAL_KEY = 'boardmaster_v1_capital';

const MODES = [
  {
    id: 'sweep',
    label: '扫板',
    tag: '直接扫单封死',
    desc: '盘中放量突破关键位，直接吃掉上方卖盘封死涨停，适合主升龙头与强分歧转一致。',
    risk: '注意成交额与封单比，防止缩量假突破或跟风杂毛被砸。',
  },
  {
    id: 'queue',
    label: '排板',
    tag: '涨停价排队',
    desc: '涨停板封单充足或回封稳固时挂涨停价排队成交，侧重封单质量与板块共振。',
    risk: '若封单快速衰减或炸板放巨量，需严格执行撤单或次日竞价/冲高风控。',
  },
  {
    id: 'limit',
    label: '打板',
    tag: '标准涨停确认',
    desc: '确认涨停板承接与情绪强度后介入，兼顾确定性与连板溢价空间。',
    risk: '忌情绪退潮期盲目接力高位连板，单笔仓位与止损线必须提前设定。',
  },
  {
    id: 'half',
    label: '半路',
    tag: '板前卡位博弈',
    desc: '在接近涨停（通常涨幅 6%～9.5% 区间）分时承接强、回踩均线不破时提前卡位。',
    risk: '封板失败概率高于纯打板，冲高无力或跌破分时均线需果断处理。',
  },
];

const BOARD_TIERS = [
  { id: '1B', label: '首板', height: 1 },
  { id: '2B', label: '2板', height: 2 },
  { id: '3B', label: '3板', height: 3 },
  { id: '4B', label: '4板', height: 4 },
  { id: '5B', label: '5板', height: 5 },
  { id: '6B', label: '6板', height: 6 },
  { id: '7B+', label: '6进7板+', height: 7 },
];

const PHASES = [
  { id: 'launch', label: '启动试盘' },
  { id: 'ferment', label: '主升发酵' },
  { id: 'divergence', label: '分歧博弈' },
  { id: 'ebb', label: '退潮兑现' },
];

const DISCIPLINE_OPTIONS = [
  { id: 'strict', label: '严守纪律' },
  { id: 'adjusted', label: '盘中微调' },
  { id: 'impulsive', label: '情绪化动作' },
];

const STRATEGY_PLAYBOOKS = [
  {
    tier: '首板 · 1B',
    focus: '题材辨识度 + 涨停时间 + 封单强度',
    rules: [
      '优先选择当日最强主线或新催化首板，尽量避开尾盘无逻辑偷袭板。',
      '关注是否具备卡位地位或板块首阴反包属性，区分真启动与一日游。',
      '次日重点看竞价量能与开盘承接，冲高不及预期及时落袋。',
    ],
  },
  {
    tier: '2板～3板 · 晋级分水岭',
    focus: '换手充分 + 分歧转一致 + 板块梯队',
    rules: [
      '2进3往往是情绪淘汰赛，前排核心若带量换手封板，溢价通常更稳。',
      '观察后排跟风是否掉队，核心股抗跌且分时承接强才是优质买点。',
      '若次日高开低走跌破均价线且无法回拉，警惕断板回撤。',
    ],
  },
  {
    tier: '4板～6进7板 · 高标空间博弈',
    focus: '市场总龙头地位 + 情绪周期 + 严控回撤',
    rules: [
      '高标连板依赖全市场风险偏好与资金抱团，非主线核心尽量不恋战。',
      '连板高度越高，炸板与核按钮波动越大，仓位与条件单风控必须前置。',
      '一旦出现高标集体断板或亏钱效应扩散，果断降仓或管住手。',
    ],
  },
];

const EXECUTION_CHECKLIST = [
  '买前确认：是否属于当日最强主线或核心卡位？买点是否符合预设模式？',
  '仓位边界：单票仓位与投入金额是否匹配连板高度和情绪周期，避免盲目重仓？',
  '盘中风控：炸板放巨量、封单快速消失或冲高不及预期时，止损/离场条件是否已挂好？',
  '盘后复盘：次日实际溢价、盈亏金额、情绪阶段与执行纪律是否如实记录？',
];

const SEED_RECORDS = [
  {
    id: 'seed-1',
    date: '2026-11-18',
    code: '002265',
    name: '海翔药业',
    sector: '医药化学',
    positionPct: 25,
    positionAmount: 25000,
    phase: 'ferment',
    discipline: 'strict',
    mode: 'sweep',
    boardTier: '2B',
    entryPrice: 7.82,
    nextDayReturn: 6.4,
    isSuccess: true,
    isBurst: false,
    notes: '早盘板块共振，分时回踩均线后放量扫板封死，次日高开冲高兑现溢价，执行顺畅。',
    chartImage: '',
  },
  {
    id: 'seed-2',
    date: '2026-11-19',
    code: '300059',
    name: '东方财富',
    sector: '大金融',
    positionPct: 15,
    positionAmount: 15000,
    phase: 'divergence',
    discipline: 'strict',
    mode: 'half',
    boardTier: '1B',
    entryPrice: 24.6,
    nextDayReturn: -2.8,
    isSuccess: false,
    isBurst: true,
    notes: '午后冲板回落炸板，承接力度减弱，次日冲高乏力按纪律止损离场，未恋战。',
    chartImage: '',
  },
  {
    id: 'seed-3',
    date: '2026-11-20',
    code: '600118',
    name: '中国卫星',
    sector: '商业航天',
    positionPct: 30,
    positionAmount: 30000,
    phase: 'ferment',
    discipline: 'strict',
    mode: 'queue',
    boardTier: '4B',
    entryPrice: 31.45,
    nextDayReturn: 8.9,
    isSuccess: true,
    isBurst: false,
    notes: '商业航天核心梯队领涨，回封后封单稳固排板成交，次日连板溢价表现突出。',
    chartImage: '',
  },
];

const EMPTY_FORM = {
  date: new Date().toISOString().slice(0, 10),
  code: '',
  name: '',
  sector: '',
  positionPct: '',
  positionAmount: '',
  phase: 'ferment',
  discipline: 'strict',
  mode: 'limit',
  boardTier: '1B',
  entryPrice: '',
  nextDayReturn: '',
  isSuccess: true,
  isBurst: false,
  notes: '',
  chartImage: '',
};

function formatPct(val) {
  const num = Number(val) || 0;
  return `${num > 0 ? '+' : ''}${num.toFixed(2)}%`;
}

function formatMoney(val) {
  const num = Number(val) || 0;
  const sign = num > 0 ? '+' : '';
  return `${sign}${num.toLocaleString('zh-CN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function formatPlainMoney(val) {
  const num = Number(val) || 0;
  return num.toLocaleString('zh-CN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function getModeMeta(modeId) {
  return MODES.find((m) => m.id === modeId) || MODES[2];
}

function getTierLabel(tierId) {
  return BOARD_TIERS.find((t) => t.id === tierId)?.label || tierId;
}

function getPhaseLabel(phaseId) {
  return PHASES.find((p) => p.id === phaseId)?.label || '主升发酵';
}

function getDisciplineMeta(discId) {
  switch (discId) {
    case 'impulsive':
      return { label: '情绪化动作', cls: 'bg-rose-500/20 text-rose-300' };
    case 'adjusted':
      return { label: '盘中微调', cls: 'bg-sky-500/15 text-sky-300' };
    default:
      return { label: '严守纪律', cls: 'bg-emerald-500/15 text-emerald-300' };
  }
}

export default function App() {
  const [totalCapital, setTotalCapital] = useState(() => {
    try {
      const saved = localStorage.getItem(CAPITAL_KEY);
      const num = Number(saved);
      return saved && !Number.isNaN(num) && num > 0 ? num : 100000;
    } catch {
      return 100000;
    }
  });

  const [capitalInput, setCapitalInput] = useState(() => String(totalCapital));

  const [records, setRecords] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return SEED_RECORDS;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : SEED_RECORDS;
    } catch {
      return SEED_RECORDS;
    }
  });

  const [activeTab, setActiveTab] = useState('dashboard');
  const [modeFilter, setModeFilter] = useState('all');
  const [tierFilter, setTierFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [previewImage, setPreviewImage] = useState('');
  const [statusToast, setStatusToast] = useState('');

  const [form, setForm] = useState(EMPTY_FORM);
  const importInputRef = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    } catch {
      // 存储配额受限时忽略
    }
  }, [records]);

  useEffect(() => {
    try {
      localStorage.setItem(CAPITAL_KEY, String(totalCapital));
    } catch {
      // 存储配额受限时忽略
    }
  }, [totalCapital]);

  function notify(msg) {
    setStatusToast(msg);
    window.clearTimeout(notify._timer);
    notify._timer = window.setTimeout(() => setStatusToast(''), 2400);
  }

  function applyCapitalUpdate() {
    const num = Number(capitalInput);
    if (Number.isNaN(num) || num <= 0) {
      notify('请输入大于 0 的总资金数字');
      return;
    }
    setTotalCapital(num);
    notify(`总资金已更新为 ${formatPlainMoney(num)}`);
  }

  function getTradePositionValues(rec) {
    const cap = Number(totalCapital) || 0;
    const rawPct =
      rec.positionPct === '' || rec.positionPct === undefined ? NaN : Number(rec.positionPct);
    const rawAmt =
      rec.positionAmount === '' || rec.positionAmount === undefined
        ? NaN
        : Number(rec.positionAmount);

    let amount = !Number.isNaN(rawAmt) && rawAmt > 0 ? rawAmt : 0;
    let pct = !Number.isNaN(rawPct) && rawPct > 0 ? rawPct : 0;

    if (!amount && pct > 0 && cap > 0) {
      amount = (cap * pct) / 100;
    } else if (!pct && amount > 0 && cap > 0) {
      pct = (amount / cap) * 100;
    }

    const nextPct = Number(rec.nextDayReturn) || 0;
    const estPnlAmount = (amount * nextPct) / 100;

    return {
      amount,
      pct,
      estPnlAmount,
    };
  }

  const stats = useMemo(() => {
    const total = records.length;
    if (total === 0) {
      return {
        total: 0,
        successRate: 0,
        burstRate: 0,
        avgPremium: 0,
        avgWin: 0,
        avgLoss: 0,
        strictRate: 0,
        totalPositionAmount: 0,
        totalPositionPct: 0,
        totalEstPnlAmount: 0,
        modeStats: MODES.map((m) => ({
          ...m,
          count: 0,
          successRate: 0,
          burstRate: 0,
          avgPremium: 0,
          amountSum: 0,
        })),
        tierStats: BOARD_TIERS.map((t) => ({
          ...t,
          count: 0,
          successRate: 0,
          avgPremium: 0,
          amountSum: 0,
        })),
        phaseStats: PHASES.map((p) => ({
          ...p,
          count: 0,
          winRate: 0,
          avgPremium: 0,
        })),
      };
    }

    const successCount = records.filter((r) => r.isSuccess).length;
    const burstCount = records.filter((r) => r.isBurst).length;
    const strictCount = records.filter((r) => (r.discipline || 'strict') === 'strict').length;
    const sumPremium = records.reduce((acc, r) => acc + (Number(r.nextDayReturn) || 0), 0);

    let totalPositionAmount = 0;
    let totalEstPnlAmount = 0;
    records.forEach((r) => {
      const v = getTradePositionValues(r);
      totalPositionAmount += v.amount;
      totalEstPnlAmount += v.estPnlAmount;
    });

    const totalPositionPct =
      totalCapital > 0 ? (totalPositionAmount / Number(totalCapital)) * 100 : 0;

    const gains = records.map((r) => Number(r.nextDayReturn) || 0).filter((n) => n > 0);
    const losses = records.map((r) => Number(r.nextDayReturn) || 0).filter((n) => n < 0);
    const avgWin = gains.length > 0 ? gains.reduce((a, b) => a + b, 0) / gains.length : 0;
    const avgLoss =
      losses.length > 0 ? Math.abs(losses.reduce((a, b) => a + b, 0) / losses.length) : 0;

    const tierStats = BOARD_TIERS.map((t) => {
      const list = records.filter((r) => r.boardTier === t.id);
      const count = list.length;
      const ok = list.filter((r) => r.isSuccess).length;
      const prem =
        count > 0
          ? list.reduce((acc, r) => acc + (Number(r.nextDayReturn) || 0), 0) / count
          : 0;
      const amountSum = list.reduce((acc, r) => acc + getTradePositionValues(r).amount, 0);
      return {
        ...t,
        count,
        successRate: count > 0 ? (ok / count) * 100 : 0,
        avgPremium: prem,
        amountSum,
      };
    });

    const modeStats = MODES.map((m) => {
      const list = records.filter((r) => r.mode === m.id);
      const count = list.length;
      const ok = list.filter((r) => r.isSuccess).length;
      const burst = list.filter((r) => r.isBurst).length;
      const prem =
        count > 0
          ? list.reduce((acc, r) => acc + (Number(r.nextDayReturn) || 0), 0) / count
          : 0;
      const amountSum = list.reduce((acc, r) => acc + getTradePositionValues(r).amount, 0);
      return {
        ...m,
        count,
        successRate: count > 0 ? (ok / count) * 100 : 0,
        burstRate: count > 0 ? (burst / count) * 100 : 0,
        avgPremium: prem,
        amountSum,
      };
    });

    const phaseStats = PHASES.map((p) => {
      const list = records.filter((r) => (r.phase || 'ferment') === p.id);
      const count = list.length;
      const positive = list.filter((r) => (Number(r.nextDayReturn) || 0) > 0).length;
      const prem =
        count > 0
          ? list.reduce((acc, r) => acc + (Number(r.nextDayReturn) || 0), 0) / count
          : 0;
      return {
        ...p,
        count,
        winRate: count > 0 ? (positive / count) * 100 : 0,
        avgPremium: prem,
      };
    });

    return {
      total,
      successRate: (successCount / total) * 100,
      burstRate: (burstCount / total) * 100,
      avgPremium: sumPremium / total,
      avgWin,
      avgLoss,
      strictRate: (strictCount / total) * 100,
      totalPositionAmount,
      totalPositionPct,
      totalEstPnlAmount,
      modeStats,
      tierStats,
      phaseStats,
    };
  }, [records, totalCapital]);

  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return records.filter((r) => {
      const matchMode = modeFilter === 'all' || r.mode === modeFilter;
      const matchTier = tierFilter === 'all' || r.boardTier === tierFilter;
      const matchQuery =
        !q ||
        (r.name || '').toLowerCase().includes(q) ||
        (r.code || '').toLowerCase().includes(q) ||
        (r.sector || '').toLowerCase().includes(q) ||
        (r.notes || '').toLowerCase().includes(q);
      return matchMode && matchTier && matchQuery;
    });
  }, [records, modeFilter, tierFilter, searchQuery]);

  function openCreateModal() {
    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      date: new Date().toISOString().slice(0, 10),
    });
    setShowModal(true);
  }

  function openEditModal(rec) {
    const computed = getTradePositionValues(rec);
    setEditingId(rec.id);
    setForm({
      date: rec.date || new Date().toISOString().slice(0, 10),
      code: rec.code || '',
      name: rec.name || '',
      sector: rec.sector || '',
      positionPct:
        rec.positionPct !== '' && rec.positionPct !== undefined
          ? rec.positionPct
          : computed.pct > 0
          ? computed.pct.toFixed(1)
          : '',
      positionAmount:
        rec.positionAmount !== '' && rec.positionAmount !== undefined
          ? rec.positionAmount
          : computed.amount > 0
          ? String(Math.round(computed.amount))
          : '',
      phase: rec.phase || 'ferment',
      discipline: rec.discipline || 'strict',
      mode: rec.mode || 'limit',
      boardTier: rec.boardTier || '1B',
      entryPrice: rec.entryPrice ?? '',
      nextDayReturn: rec.nextDayReturn ?? '',
      isSuccess: Boolean(rec.isSuccess),
      isBurst: Boolean(rec.isBurst),
      notes: rec.notes || '',
      chartImage: rec.chartImage || '',
    });
    setShowModal(true);
  }

  function handleFormPctChange(val) {
    const pctNum = Number(val);
    const cap = Number(totalCapital) || 0;
    const autoAmt =
      val !== '' && !Number.isNaN(pctNum) && cap > 0
        ? String(Math.round((cap * pctNum) / 100))
        : form.positionAmount;
    setForm((prev) => ({
      ...prev,
      positionPct: val,
      positionAmount: autoAmt,
    }));
  }

  function handleFormAmountChange(val) {
    const amtNum = Number(val);
    const cap = Number(totalCapital) || 0;
    const autoPct =
      val !== '' && !Number.isNaN(amtNum) && cap > 0
        ? ((amtNum / cap) * 100).toFixed(1)
        : form.positionPct;
    setForm((prev) => ({
      ...prev,
      positionAmount: val,
      positionPct: autoPct,
    }));
  }

  function handleImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setForm((prev) => ({ ...prev, chartImage: reader.result }));
      }
    };
    reader.readAsDataURL(file);
  }

  function handleSaveRecord(e) {
    e.preventDefault();
    if (!form.name.trim() && !form.code.trim()) return;

    const payload = {
      date: form.date || new Date().toISOString().slice(0, 10),
      code: form.code.trim().toUpperCase(),
      name: form.name.trim() || '未命名标的',
      sector: form.sector.trim(),
      positionPct: form.positionPct === '' ? '' : Number(form.positionPct),
      positionAmount: form.positionAmount === '' ? '' : Number(form.positionAmount),
      phase: form.phase,
      discipline: form.discipline,
      mode: form.mode,
      boardTier: form.boardTier,
      entryPrice: form.entryPrice,
      nextDayReturn: Number(form.nextDayReturn) || 0,
      isSuccess: Boolean(form.isSuccess),
      isBurst: Boolean(form.isBurst),
      notes: form.notes.trim(),
      chartImage: form.chartImage,
    };

    if (editingId) {
      setRecords((prev) =>
        prev.map((item) => (item.id === editingId ? { ...item, ...payload } : item))
      );
      notify('已更新复盘记录');
    } else {
      setRecords((prev) => [{ id: `rec-${Date.now()}`, ...payload }, ...prev]);
      notify('已新增打板复盘');
    }

    setShowModal(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setActiveTab('logs');
  }

  function handleDeleteRecord(id) {
    setRecords((prev) => prev.filter((item) => item.id !== id));
    notify('已删除记录');
  }

  function handleExportJson() {
    const payload = {
      capital: totalCapital,
      records,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `boardmaster-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify('已导出 JSON 备份');
  }

  function handleImportJson(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || '{}'));
        if (Array.isArray(parsed)) {
          setRecords(parsed);
          notify(`已恢复 ${parsed.length} 条记录`);
          return;
        }
        if (parsed && Array.isArray(parsed.records)) {
          if (typeof parsed.capital === 'number' && parsed.capital > 0) {
            setTotalCapital(parsed.capital);
            setCapitalInput(String(parsed.capital));
          }
          setRecords(parsed.records);
          notify(`已恢复 ${parsed.records.length} 条记录与总资金`);
          return;
        }
        notify('备份文件格式不正确');
      } catch {
        notify('无法解析 JSON 文件');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  return (
    <div className="min-h-screen bg-[#0B0D12] text-slate-100 pb-24">
      {statusToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-3.5 py-1.5 rounded-full bg-slate-800/95 border border-slate-700 text-xs text-white shadow-lg">
          {statusToast}
        </div>
      )}

      <header className="sticky top-0 z-30 backdrop-blur-md bg-[#0B0D12]/90 border-b border-slate-800/80 px-4 pt-3 pb-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500 to-amber-500 flex items-center justify-center shadow-lg shadow-rose-500/20">
              <Flame className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-tight text-white">BoardMaster</h1>
                <span className="text-[11px] px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30 font-medium">
                  专业复盘终端
                </span>
              </div>
              <p className="text-xs text-slate-400">
                总资金 {formatPlainMoney(totalCapital)} · 累计仓位{' '}
                {formatPlainMoney(stats.totalPositionAmount)}（{stats.totalPositionPct.toFixed(1)}
                %）
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-[0.99] text-white text-sm font-semibold shadow-md shadow-rose-600/25 transition"
          >
            <Plus className="w-4 h-4" />
            记一笔
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 pt-4 space-y-5">
        <section className="rounded-2xl bg-[#131722] border border-slate-800/90 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
              <Wallet className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <div className="text-xs font-bold text-white">账户总资金设定</div>
              <div className="text-[11px] text-slate-400">
                输入总资金后，记录中的仓位占比、投入金额与次日盈亏金额自动联动
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-44">
              <DollarSign className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="number"
                min="1"
                step="100"
                value={capitalInput}
                onChange={(e) => setCapitalInput(e.target.value)}
                className="w-full rounded-xl bg-[#0D1017] border border-slate-700 pl-7 pr-2.5 py-1.5 text-sm text-white font-mono"
              />
            </div>
            <button
              type="button"
              onClick={applyCapitalUpdate}
              className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shrink-0 transition"
            >
              更新总资金
            </button>
          </div>
        </section>

        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-2xl bg-[#131722] border border-slate-800/90 p-3.5">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>打板成功率</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-xl font-bold text-emerald-400">
              {stats.successRate.toFixed(1)}%
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              纪律率 {stats.strictRate.toFixed(0)}% · {stats.total} 笔
            </div>
          </div>

          <div className="rounded-2xl bg-[#131722] border border-slate-800/90 p-3.5">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>仓位与金额</span>
              <ShieldAlert className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-xl font-bold text-amber-400">
              {stats.totalPositionPct.toFixed(1)}%
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              累计 {formatPlainMoney(stats.totalPositionAmount)} · 炸板{' '}
              {stats.burstRate.toFixed(0)}%
            </div>
          </div>

          <div className="rounded-2xl bg-[#131722] border border-slate-800/90 p-3.5">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>次日均溢价 / 盈亏</span>
              {stats.avgPremium >= 0 ? (
                <TrendingUp className="w-4 h-4 text-rose-400" />
              ) : (
                <TrendingDown className="w-4 h-4 text-teal-400" />
              )}
            </div>
            <div
              className={`text-xl font-bold ${
                stats.avgPremium >= 0 ? 'text-rose-400' : 'text-teal-400'
              }`}
            >
              {formatPct(stats.avgPremium)}
            </div>
            <div
              className={`text-[11px] mt-0.5 font-medium ${
                stats.totalEstPnlAmount >= 0 ? 'text-rose-300/90' : 'text-teal-300/90'
              }`}
            >
              测算盈亏 {formatMoney(stats.totalEstPnlAmount)}
            </div>
          </div>

          <div className="rounded-2xl bg-[#131722] border border-slate-800/90 p-3.5">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>账户总资金</span>
              <ImageIcon className="w-4 h-4 text-sky-400" />
            </div>
            <div className="text-xl font-bold text-sky-400">
              {formatPlainMoney(totalCapital)}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              赢 +{stats.avgWin.toFixed(1)}% / 亏 -{stats.avgLoss.toFixed(1)}%
            </div>
          </div>
        </section>

        {activeTab === 'dashboard' && (
          <div className="space-y-5">
            <section className="rounded-2xl bg-[#131722] border border-slate-800/90 p-4 space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-amber-400" />
                  <h2 className="text-sm font-bold text-white">连板高度梯队分析</h2>
                </div>
                <span className="text-xs text-slate-400">首板 → 6进7板+</span>
              </div>

              <div className="space-y-2.5">
                {stats.tierStats.map((tier) => {
                  const barWidth = Math.min(100, Math.max(6, tier.successRate));
                  return (
                    <div
                      key={tier.id}
                      className="rounded-xl bg-[#0D1017] border border-slate-800/80 p-3"
                    >
                      <div className="flex items-center justify-between text-xs mb-1.5 gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-white">{tier.label}</span>
                          <span className="text-slate-500">({tier.count} 笔)</span>
                          {tier.amountSum > 0 && (
                            <span className="text-amber-300/90 font-mono">
                              金额 {formatPlainMoney(tier.amountSum)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-emerald-400 font-medium">
                            成功率 {tier.successRate.toFixed(0)}%
                          </span>
                          <span
                            className={`font-semibold ${
                              tier.avgPremium >= 0 ? 'text-rose-400' : 'text-teal-400'
                            }`}
                          >
                            溢价 {formatPct(tier.avgPremium)}
                          </span>
                        </div>
                      </div>
                      <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-amber-500 to-rose-500 transition-all duration-300"
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-2xl bg-[#131722] border border-slate-800/90 p-4 space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-rose-400" />
                  <h2 className="text-sm font-bold text-white">四大模式表现拆解</h2>
                </div>
                <span className="text-xs text-slate-400">扫板 · 排板 · 打板 · 半路</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {stats.modeStats.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl bg-[#0D1017] border border-slate-800/80 p-3.5 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">{item.label}</span>
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                          {item.count} 笔
                        </span>
                      </div>
                      <span
                        className={`text-xs font-semibold ${
                          item.avgPremium >= 0 ? 'text-rose-400' : 'text-teal-400'
                        }`}
                      >
                        均溢价 {formatPct(item.avgPremium)}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg bg-[#131722] px-2.5 py-1.5 flex justify-between">
                        <span className="text-slate-400">成功率</span>
                        <span className="text-emerald-400 font-semibold">
                          {item.successRate.toFixed(0)}%
                        </span>
                      </div>
                      <div className="rounded-lg bg-[#131722] px-2.5 py-1.5 flex justify-between">
                        <span className="text-slate-400">投入金额</span>
                        <span className="text-amber-300 font-semibold font-mono">
                          {formatPlainMoney(item.amountSum)}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-400 leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl bg-[#131722] border border-slate-800/90 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-white">情绪周期阶段表现</h2>
                <span className="text-xs text-slate-400">按次日正溢价率统计</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {stats.phaseStats.map((ph) => (
                  <div
                    key={ph.id}
                    className="rounded-xl bg-[#0D1017] border border-slate-800/80 p-3 space-y-1"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-white">{ph.label}</span>
                      <span className="text-slate-500">{ph.count}笔</span>
                    </div>
                    <div
                      className={`text-sm font-bold ${
                        ph.avgPremium >= 0 ? 'text-rose-400' : 'text-teal-400'
                      }`}
                    >
                      {formatPct(ph.avgPremium)}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      正溢价 {ph.winRate.toFixed(0)}%
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl bg-[#131722] border border-slate-800/90 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-sky-400" />
                  <h2 className="text-sm font-bold text-white">最近交易记录</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('logs')}
                  className="inline-flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300 font-medium"
                >
                  查看全部
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-2.5">
                {records.slice(0, 3).map((rec) => {
                  const mode = getModeMeta(rec.mode);
                  const pos = getTradePositionValues(rec);
                  return (
                    <div
                      key={rec.id}
                      className="rounded-xl bg-[#0D1017] border border-slate-800/80 p-3 flex items-start justify-between gap-3"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-bold text-white">{rec.name}</span>
                          {rec.code && (
                            <span className="text-xs text-slate-400 font-mono">{rec.code}</span>
                          )}
                          {rec.sector && (
                            <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                              {rec.sector}
                            </span>
                          )}
                          <span className="text-[11px] px-2 py-0.5 rounded bg-rose-500/15 text-rose-300">
                            {mode.label}
                          </span>
                          <span className="text-[11px] px-2 py-0.5 rounded bg-amber-500/15 text-amber-300">
                            {getTierLabel(rec.boardTier)}
                          </span>
                          {pos.amount > 0 && (
                            <span className="text-[11px] px-2 py-0.5 rounded bg-sky-500/15 text-sky-300 font-mono">
                              仓位 {pos.pct.toFixed(1)}% · {formatPlainMoney(pos.amount)}
                            </span>
                          )}
                          {rec.isBurst && (
                            <span className="text-[11px] px-2 py-0.5 rounded bg-orange-500/20 text-orange-300">
                              炸板
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 line-clamp-2">
                          {rec.notes || '暂无复盘备注'}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <div
                          className={`text-sm font-bold ${
                            Number(rec.nextDayReturn) >= 0 ? 'text-rose-400' : 'text-teal-400'
                          }`}
                        >
                          {formatPct(rec.nextDayReturn)}
                        </div>
                        <div
                          className={`text-[11px] font-mono ${
                            pos.estPnlAmount >= 0 ? 'text-rose-300/80' : 'text-teal-300/80'
                          }`}
                        >
                          {pos.amount > 0 ? formatMoney(pos.estPnlAmount) : rec.date}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-[#131722] border border-slate-800/90 p-3.5 space-y-3">
              <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="搜索股票名称、代码、题材或复盘关键词..."
                    className="w-full rounded-xl bg-[#0D1017] border border-slate-800 pl-9 pr-3 py-2 text-xs sm:text-sm text-white placeholder:text-slate-500"
                  />
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleExportJson}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#0D1017] hover:bg-slate-800 border border-slate-700/80 text-xs text-slate-200 font-medium"
                  >
                    <Download className="w-3.5 h-3.5 text-sky-400" />
                    导出备份
                  </button>
                  <button
                    type="button"
                    onClick={() => importInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#0D1017] hover:bg-slate-800 border border-slate-700/80 text-xs text-slate-200 font-medium"
                  >
                    <Upload className="w-3.5 h-3.5 text-emerald-400" />
                    导入恢复
                  </button>
                  <input
                    ref={importInputRef}
                    type="file"
                    accept="application/json"
                    onChange={handleImportJson}
                    className="hidden"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setModeFilter('all')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                    modeFilter === 'all'
                      ? 'bg-rose-600 text-white'
                      : 'bg-[#0D1017] text-slate-400 hover:text-white'
                  }`}
                >
                  全部模式
                </button>
                {MODES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setModeFilter(m.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                      modeFilter === m.id
                        ? 'bg-rose-600 text-white'
                        : 'bg-[#0D1017] text-slate-400 hover:text-white'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setTierFilter('all')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                    tierFilter === 'all'
                      ? 'bg-amber-600 text-white'
                      : 'bg-[#0D1017] text-slate-400 hover:text-white'
                  }`}
                >
                  全部高度
                </button>
                {BOARD_TIERS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTierFilter(t.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                      tierFilter === t.id
                        ? 'bg-amber-600 text-white'
                        : 'bg-[#0D1017] text-slate-400 hover:text-white'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {filteredRecords.length === 0 ? (
              <div className="rounded-2xl bg-[#131722] border border-slate-800/90 p-8 text-center space-y-2">
                <p className="text-sm text-slate-300 font-medium">当前筛选条件下暂无记录</p>
                <p className="text-xs text-slate-500">可调整关键词/筛选，或点击右上角“记一笔”</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredRecords.map((rec) => {
                  const mode = getModeMeta(rec.mode);
                  const disc = getDisciplineMeta(rec.discipline);
                  const pos = getTradePositionValues(rec);
                  return (
                    <article
                      key={rec.id}
                      className="rounded-2xl bg-[#131722] border border-slate-800/90 p-4 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-bold text-white">{rec.name}</h3>
                            {rec.code && (
                              <span className="text-xs font-mono text-slate-400">{rec.code}</span>
                            )}
                            {rec.sector && (
                              <span className="text-xs px-2 py-0.5 rounded-md bg-slate-800 text-slate-200">
                                {rec.sector}
                              </span>
                            )}
                            <span className="text-xs px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-300 font-medium">
                              {mode.label}
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 font-medium">
                              {getTierLabel(rec.boardTier)}
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-300 font-medium">
                              {getPhaseLabel(rec.phase)}
                            </span>
                            <span
                              className={`text-xs px-2 py-0.5 rounded-md font-medium ${
                                rec.isSuccess
                                  ? 'bg-emerald-500/15 text-emerald-300'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {rec.isSuccess ? '打板成功' : '未封死/失败'}
                            </span>
                            {rec.isBurst && (
                              <span className="text-xs px-2 py-0.5 rounded-md bg-orange-500/20 text-orange-300 font-medium">
                                炸板
                              </span>
                            )}
                            <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${disc.cls}`}>
                              {disc.label}
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 mt-1 flex flex-wrap gap-3">
                            <span>日期：{rec.date}</span>
                            {rec.entryPrice && <span>介入价：{rec.entryPrice}</span>}
                            {pos.pct > 0 && <span>仓位：{pos.pct.toFixed(1)}%</span>}
                            {pos.amount > 0 && <span>金额：{formatPlainMoney(pos.amount)}</span>}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <div className="text-right mr-1">
                            <div className="text-[11px] text-slate-400">次日溢价</div>
                            <div
                              className={`text-base font-bold ${
                                Number(rec.nextDayReturn) >= 0
                                  ? 'text-rose-400'
                                  : 'text-teal-400'
                              }`}
                            >
                              {formatPct(rec.nextDayReturn)}
                            </div>
                            {pos.amount > 0 && (
                              <div
                                className={`text-[11px] font-mono ${
                                  pos.estPnlAmount >= 0 ? 'text-rose-300/90' : 'text-teal-300/90'
                                }`}
                              >
                                {formatMoney(pos.estPnlAmount)}
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => openEditModal(rec)}
                            aria-label="编辑记录"
                            className="p-2 rounded-lg text-slate-400 hover:text-sky-400 hover:bg-sky-500/10 transition"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteRecord(rec.id)}
                            aria-label="删除记录"
                            className="p-2 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {rec.notes && (
                        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed bg-[#0D1017] rounded-xl p-3 border border-slate-800/70">
                          {rec.notes}
                        </p>
                      )}

                      {rec.chartImage && (
                        <div>
                          <button
                            type="button"
                            onClick={() => setPreviewImage(rec.chartImage)}
                            className="group relative rounded-xl overflow-hidden border border-slate-800 block w-full max-h-56"
                          >
                            <img
                              src={rec.chartImage}
                              alt={`${rec.name} 复盘图表`}
                              className="w-full h-48 object-cover group-hover:scale-[1.01] transition"
                            />
                            <span className="absolute bottom-2 right-2 text-[11px] px-2 py-1 rounded-md bg-black/75 text-white">
                              点击放大看图
                            </span>
                          </button>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'playbook' && (
          <div className="space-y-4">
            <section className="rounded-2xl bg-[#131722] border border-slate-800/90 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-rose-400" />
                <h2 className="text-sm font-bold text-white">执行模式要点与风控边界</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {MODES.map((m) => (
                  <div
                    key={m.id}
                    className="rounded-xl bg-[#0D1017] border border-slate-800/80 p-3.5 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-white">{m.label}</span>
                      <span className="text-[11px] text-rose-300">{m.tag}</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">{m.desc}</p>
                    <p className="text-xs text-amber-300/90 leading-relaxed">风控：{m.risk}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl bg-[#131722] border border-slate-800/90 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm font-bold text-white">连板梯队进阶策略</h2>
              </div>
              <div className="space-y-3">
                {STRATEGY_PLAYBOOKS.map((block) => (
                  <div
                    key={block.tier}
                    className="rounded-xl bg-[#0D1017] border border-slate-800/80 p-3.5 space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-bold text-white">{block.tier}</span>
                      <span className="text-xs text-amber-300">{block.focus}</span>
                    </div>
                    <ul className="space-y-1.5 text-xs text-slate-300 list-disc pl-4">
                      {block.rules.map((rule, idx) => (
                        <li key={idx} className="leading-relaxed">
                          {rule}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl bg-[#131722] border border-slate-800/90 p-4 space-y-2.5">
              <div className="flex items-center gap-2">
                <FileJson className="w-4 h-4 text-sky-400" />
                <h2 className="text-sm font-bold text-white">盘前 / 盘后纪律自检表</h2>
              </div>
              <ul className="space-y-2 text-xs text-slate-300">
                {EXECUTION_CHECKLIST.map((item, idx) => (
                  <li
                    key={idx}
                    className="rounded-xl bg-[#0D1017] border border-slate-800/80 px-3.5 py-2.5 leading-relaxed"
                  >
                    {idx + 1}. {item}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-30 bg-[#0D1017]/95 backdrop-blur-md border-t border-slate-800/90">
        <div className="max-w-4xl mx-auto grid grid-cols-3 py-2 px-2">
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center gap-1 py-1 rounded-xl text-xs font-medium transition ${
              activeTab === 'dashboard' ? 'text-rose-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>统计看板</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('logs')}
            className={`flex flex-col items-center gap-1 py-1 rounded-xl text-xs font-medium transition ${
              activeTab === 'logs' ? 'text-rose-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>复盘记录</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('playbook')}
            className={`flex flex-col items-center gap-1 py-1 rounded-xl text-xs font-medium transition ${
              activeTab === 'playbook' ? 'text-rose-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>策略手册</span>
          </button>
        </div>
      </nav>

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-lg bg-[#131722] border border-slate-800 rounded-t-3xl sm:rounded-2xl max-h-[90vh] overflow-y-auto p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white">
                {editingId ? '编辑打板复盘记录' : '新增打板复盘记录'}
              </h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveRecord} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">交易日期</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="w-full rounded-xl bg-[#0D1017] border border-slate-700 px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">股票代码</label>
                  <input
                    type="text"
                    placeholder="如 002265"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    className="w-full rounded-xl bg-[#0D1017] border border-slate-700 px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">股票名称 *</label>
                  <input
                    type="text"
                    required
                    placeholder="如 海翔药业"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full rounded-xl bg-[#0D1017] border border-slate-700 px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">所属题材 / 板块</label>
                  <input
                    type="text"
                    placeholder="如 商业航天 / 光伏"
                    value={form.sector}
                    onChange={(e) => setForm({ ...form, sector: e.target.value })}
                    className="w-full rounded-xl bg-[#0D1017] border border-slate-700 px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">介入价格</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="如 7.82"
                    value={form.entryPrice}
                    onChange={(e) => setForm({ ...form, entryPrice: e.target.value })}
                    className="w-full rounded-xl bg-[#0D1017] border border-slate-700 px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">仓位占比（%）</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    placeholder="如 25"
                    value={form.positionPct}
                    onChange={(e) => handleFormPctChange(e.target.value)}
                    className="w-full rounded-xl bg-[#0D1017] border border-slate-700 px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">投入金额</label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    placeholder="自动或手填"
                    value={form.positionAmount}
                    onChange={(e) => handleFormAmountChange(e.target.value)}
                    className="w-full rounded-xl bg-[#0D1017] border border-slate-700 px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">打板模式</label>
                  <select
                    value={form.mode}
                    onChange={(e) => setForm({ ...form, mode: e.target.value })}
                    className="w-full rounded-xl bg-[#0D1017] border border-slate-700 px-3 py-2 text-sm text-white"
                  >
                    {MODES.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}（{m.tag}）
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">连板高度</label>
                  <select
                    value={form.boardTier}
                    onChange={(e) => setForm({ ...form, boardTier: e.target.value })}
                    className="w-full rounded-xl bg-[#0D1017] border border-slate-700 px-3 py-2 text-sm text-white"
                  >
                    {BOARD_TIERS.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">情绪周期阶段</label>
                  <select
                    value={form.phase}
                    onChange={(e) => setForm({ ...form, phase: e.target.value })}
                    className="w-full rounded-xl bg-[#0D1017] border border-slate-700 px-3 py-2 text-sm text-white"
                  >
                    {PHASES.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">执行纪律评价</label>
                  <select
                    value={form.discipline}
                    onChange={(e) => setForm({ ...form, discipline: e.target.value })}
                    className="w-full rounded-xl bg-[#0D1017] border border-slate-700 px-3 py-2 text-sm text-white"
                  >
                    {DISCIPLINE_OPTIONS.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">次日溢价率（%）</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="正数填如 6.4，负数填如 -2.8"
                  value={form.nextDayReturn}
                  onChange={(e) => setForm({ ...form, nextDayReturn: e.target.value })}
                  className="w-full rounded-xl bg-[#0D1017] border border-slate-700 px-3 py-2 text-sm text-white"
                />
              </div>

              <div className="flex items-center gap-5 pt-1">
                <label className="inline-flex items-center gap-2 text-sm text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isSuccess}
                    onChange={(e) => setForm({ ...form, isSuccess: e.target.checked })}
                    className="rounded accent-emerald-500 w-4 h-4"
                  />
                  <span>打板成功</span>
                </label>

                <label className="inline-flex items-center gap-2 text-sm text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isBurst}
                    onChange={(e) => setForm({ ...form, isBurst: e.target.checked })}
                    className="rounded accent-amber-500 w-4 h-4"
                  />
                  <span>发生炸板</span>
                </label>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">复盘要点与情绪逻辑</label>
                <textarea
                  rows={3}
                  placeholder="记录封单强度、板块带动性、分时承接与次日离场依据..."
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full rounded-xl bg-[#0D1017] border border-slate-700 px-3 py-2 text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">上传分时 / K线截图（可选）</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="block w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-white hover:file:bg-slate-700"
                />
                {form.chartImage && (
                  <div className="mt-2 relative rounded-xl overflow-hidden border border-slate-800 max-h-40">
                    <img
                      src={form.chartImage}
                      alt="预览截图"
                      className="w-full h-36 object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, chartImage: '' })}
                      className="absolute top-2 right-2 px-2 py-1 rounded bg-black/75 text-xs text-white"
                    >
                      移除
                    </button>
                  </div>
                )}
              </div>

              <div className="pt-2 flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-sm font-medium"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold"
                >
                  {editingId ? '保存修改' : '保存记录'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {previewImage && (
        <div
          onClick={() => setPreviewImage('')}
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
        >
          <button
            type="button"
            onClick={() => setPreviewImage('')}
            aria-label="关闭预览"
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={previewImage}
            alt="复盘图表放大"
            className="max-w-full max-h-[85vh] rounded-xl object-contain"
          />
        </div>
      )}
    </div>
  );
}
