import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Award,
  BarChart3,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock,
  Flame,
  Image as ImageIcon,
  Layers,
  Plus,
  ShieldAlert,
  Sparkles,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';

const STORAGE_KEY = 'boardmaster_v1_records';

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

const SEED_RECORDS = [
  {
    id: 'seed-1',
    date: '2026-11-18',
    code: '002265',
    name: '海翔药业',
    mode: 'sweep',
    boardTier: '2B',
    entryPrice: 7.82,
    nextDayReturn: 6.4,
    isSuccess: true,
    isBurst: false,
    notes: '早盘化工与医药分支共振，分时回踩均线后放量扫板封死，次日高开冲高兑现溢价。',
    chartImage: '',
  },
  {
    id: 'seed-2',
    date: '2026-11-19',
    code: '300059',
    name: '东方财富',
    mode: 'half',
    boardTier: '1B',
    entryPrice: 24.6,
    nextDayReturn: -2.8,
    isSuccess: false,
    isBurst: true,
    notes: '午后冲板回落炸板，承接力度减弱，次日冲高乏力按纪律止损离场。',
    chartImage: '',
  },
  {
    id: 'seed-3',
    date: '2026-11-20',
    code: '600118',
    name: '中国卫星',
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

function formatPct(val) {
  const num = Number(val) || 0;
  return `${num > 0 ? '+' : ''}${num.toFixed(2)}%`;
}

function getModeMeta(modeId) {
  return MODES.find((m) => m.id === modeId) || MODES[2];
}

function getTierLabel(tierId) {
  return BOARD_TIERS.find((t) => t.id === tierId)?.label || tierId;
}

export default function App() {
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

  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'logs' | 'playbook'
  const [modeFilter, setModeFilter] = useState('all');
  const [tierFilter, setTierFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [previewImage, setPreviewImage] = useState('');

  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    code: '',
    name: '',
    mode: 'limit',
    boardTier: '1B',
    entryPrice: '',
    nextDayReturn: '',
    isSuccess: true,
    isBurst: false,
    notes: '',
    chartImage: '',
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    } catch {
      // 忽略存储配额异常
    }
  }, [records]);

  const stats = useMemo(() => {
    const total = records.length;
    if (total === 0) {
      return {
        total: 0,
        successRate: 0,
        burstRate: 0,
        avgPremium: 0,
        modeStats: MODES.map((m) => ({
          ...m,
          count: 0,
          successRate: 0,
          burstRate: 0,
          avgPremium: 0,
        })),
        tierStats: BOARD_TIERS.map((t) => ({
          ...t,
          count: 0,
          successRate: 0,
          avgPremium: 0,
        })),
      };
    }

    const successCount = records.filter((r) => r.isSuccess).length;
    const burstCount = records.filter((r) => r.isBurst).length;
    const sumPremium = records.reduce((acc, r) => acc + (Number(r.nextDayReturn) || 0), 0);

    const modeStats = MODES.map((m) => {
      const list = records.filter((r) => r.mode === m.id);
      const count = list.length;
      const ok = list.filter((r) => r.isSuccess).length;
      const burst = list.filter((r) => r.isBurst).length;
      const prem =
        count > 0
          ? list.reduce((acc, r) => acc + (Number(r.nextDayReturn) || 0), 0) / count
          : 0;
      return {
        ...m,
        count,
        successRate: count > 0 ? (ok / count) * 100 : 0,
        burstRate: count > 0 ? (burst / count) * 100 : 0,
        avgPremium: prem,
      };
    });

    const tierStats = BOARD_TIERS.map((t) => {
      const list = records.filter((r) => r.boardTier === t.id);
      const count = list.length;
      const ok = list.filter((r) => r.isSuccess).length;
      const prem =
        count > 0
          ? list.reduce((acc, r) => acc + (Number(r.nextDayReturn) || 0), 0) / count
          : 0;
      return {
        ...t,
        count,
        successRate: count > 0 ? (ok / count) * 100 : 0,
        avgPremium: prem,
      };
    });

    return {
      total,
      successRate: (successCount / total) * 100,
      burstRate: (burstCount / total) * 100,
      avgPremium: sumPremium / total,
      modeStats,
      tierStats,
    };
  }, [records]);

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const matchMode = modeFilter === 'all' || r.mode === modeFilter;
      const matchTier = tierFilter === 'all' || r.boardTier === tierFilter;
      return matchMode && matchTier;
    });
  }, [records, modeFilter, tierFilter]);

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

  function handleCreateRecord(e) {
    e.preventDefault();
    if (!form.name.trim() && !form.code.trim()) return;

    const newItem = {
      id: `rec-${Date.now()}`,
      date: form.date || new Date().toISOString().slice(0, 10),
      code: form.code.trim().toUpperCase(),
      name: form.name.trim() || '未命名标的',
      mode: form.mode,
      boardTier: form.boardTier,
      entryPrice: form.entryPrice,
      nextDayReturn: Number(form.nextDayReturn) || 0,
      isSuccess: Boolean(form.isSuccess),
      isBurst: Boolean(form.isBurst),
      notes: form.notes.trim(),
      chartImage: form.chartImage,
    };

    setRecords((prev) => [newItem, ...prev]);
    setShowAddModal(false);
    setForm({
      date: new Date().toISOString().slice(0, 10),
      code: '',
      name: '',
      mode: 'limit',
      boardTier: '1B',
      entryPrice: '',
      nextDayReturn: '',
      isSuccess: true,
      isBurst: false,
      notes: '',
      chartImage: '',
    });
    setActiveTab('logs');
  }

  function handleDeleteRecord(id) {
    setRecords((prev) => prev.filter((item) => item.id !== id));
  }

  return (
    <div className="min-h-screen bg-[#0B0D12] text-slate-100 pb-24">
      {/* 顶部栏 */}
      <header className="sticky top-0 z-30 backdrop-blur-md bg-[#0B0D12]/90 border-b border-slate-800/80 px-4 pt-3 pb-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500 to-amber-500 flex items-center justify-center shadow-lg shadow-rose-500/20">
              <Flame className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-tight text-white">BoardMaster</h1>
                <span className="text-[11px] px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30 font-medium">
                  打板复盘
                </span>
              </div>
              <p className="text-xs text-slate-400">扫板·排板·打板·半路｜连板高度与次日溢价</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-[0.99] text-white text-sm font-semibold shadow-md shadow-rose-600/25 transition"
          >
            <Plus className="w-4 h-4" />
            记一笔
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 pt-4 space-y-5">
        {/* 核心 KPI 卡片 */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-2xl bg-[#131722] border border-slate-800/90 p-3.5">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>打板成功率</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-xl font-bold text-emerald-400">
              {stats.successRate.toFixed(1)}%
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">累计 {stats.total} 笔样本</div>
          </div>

          <div className="rounded-2xl bg-[#131722] border border-slate-800/90 p-3.5">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>炸板率</span>
              <ShieldAlert className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-xl font-bold text-amber-400">
              {stats.burstRate.toFixed(1)}%
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">封板承接与回落监测</div>
          </div>

          <div className="rounded-2xl bg-[#131722] border border-slate-800/90 p-3.5">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>次日均溢价</span>
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
            <div className="text-[11px] text-slate-500 mt-0.5">隔日表现均值</div>
          </div>

          <div className="rounded-2xl bg-[#131722] border border-slate-800/90 p-3.5">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>图表复盘数</span>
              <ImageIcon className="w-4 h-4 text-sky-400" />
            </div>
            <div className="text-xl font-bold text-sky-400">
              {records.filter((r) => Boolean(r.chartImage)).length}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">分时 / K线留存</div>
          </div>
        </section>

        {/* 总览统计视图 */}
        {activeTab === 'dashboard' && (
          <div className="space-y-5">
            {/* 四大模式对比 */}
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
                        <span className="text-slate-400">炸板率</span>
                        <span className="text-amber-400 font-semibold">
                          {item.burstRate.toFixed(0)}%
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-400 leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* 连板高度（首板 ~ 6进7板+）分析 */}
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
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{tier.label}</span>
                          <span className="text-slate-500">({tier.count} 笔)</span>
                        </div>
                        <div className="flex items-center gap-3">
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

            {/* 最近复盘快捷预览 */}
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
                          <span className="text-[11px] px-2 py-0.5 rounded bg-rose-500/15 text-rose-300">
                            {mode.label}
                          </span>
                          <span className="text-[11px] px-2 py-0.5 rounded bg-amber-500/15 text-amber-300">
                            {getTierLabel(rec.boardTier)}
                          </span>
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
                        <div className="text-[11px] text-slate-500">{rec.date}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}

        {/* 复盘流水与图表日志 */}
        {activeTab === 'logs' && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-[#131722] border border-slate-800/90 p-3.5 space-y-3">
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
                <p className="text-xs text-slate-500">点击右上角“记一笔”添加新的打板复盘</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredRecords.map((rec) => {
                  const mode = getModeMeta(rec.mode);
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
                            <span className="text-xs px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-300 font-medium">
                              {mode.label}
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 font-medium">
                              {getTierLabel(rec.boardTier)}
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
                          </div>
                          <div className="text-xs text-slate-400 mt-1 flex flex-wrap gap-3">
                            <span>日期：{rec.date}</span>
                            {rec.entryPrice && <span>介入价：{rec.entryPrice}</span>}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="text-right">
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
                          </div>
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

        {/* 打板策略手册 */}
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
                      <span className="text-sm font-bold text-
