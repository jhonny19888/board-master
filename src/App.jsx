import React, { useState, useEffect, useMemo } from 'react';

const STORAGE_KEY = 'boardmaster_records_v23';
const INIT_FLAG_KEY = 'boardmaster_initialized_v23';
const CAPITAL_STORAGE_KEY = 'boardmaster_total_capital_v23';

const BOARD_LADDER_LEVELS = [
  '首板',
  '2板',
  '3板',
  '4板',
  '5板',
  '6进7板+',
];

// 打板模式选项（已加入“连板分歧水下低吸”）
const STRATEGY_MODES = [
  '半路（板前卡位博弈）',
  '排板（确定性封单）',
  '扫板（点火瞬间抢筹）',
  '连板分歧水下低吸',
  '龙头首阴反包',
];

// 封板结果选项（已加入“冲板未封”）
const SEAL_STATUS_OPTIONS = [
  {
    value: 'success',
    label: '打板成功',
    badgeClass: 'bg-rose-500/20 text-rose-400 border border-rose-500/30',
  },
  {
    value: 'broken',
    label: '发生炸板',
    badgeClass: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  },
  {
    value: 'unsealed',
    label: '冲板未封',
    badgeClass: 'bg-purple-500/20 text-purple-300 border border-purple-500/30',
  },
];

const INITIAL_SAMPLE_RECORDS = [
  {
    id: 'sample-1',
    date: '2026-11-19',
    code: '300059',
    name: '东方财富',
    sector: '大金融',
    entryPrice: 24.6,
    positionPct: 15,
    amount: 15000,
    mode: '半路（板前卡位博弈）',
    boardHeight: '首板',
    emotionPhase: '分歧博弈',
    discipline: '严守纪律',
    nextDayPremium: -2.8,
    sealStatus: 'broken',
    notes: '午后冲板回落炸板，承接力度减弱，次日冲高乏力按纪律止损离场，未恋战。',
    screenshot: '',
  },
  {
    id: 'sample-2',
    date: '2026-11-20',
    code: '600118',
    name: '中国卫星',
    sector: '商业航天',
    entryPrice: 31.45,
    positionPct: 30,
    amount: 30000,
    mode: '排板（确定性封单）',
    boardHeight: '4板',
    emotionPhase: '主升发酵',
    discipline: '严守纪律',
    nextDayPremium: 8.9,
    sealStatus: 'success',
    notes: '商业航天核心梯队领涨，回封后封单稳固排板成交，次日连板溢价表现突出。',
    screenshot: '',
  },
];

// 自动压缩上传的分时 / K线截图，防止撑爆 localStorage 导致保存失败
function compressImageFile(file, maxWidth = 800, quality = 0.65) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = event.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function normalizeBoardHeight(height) {
  if (!height) return '首板';
  if (height.includes('5板以上') || height.includes('5板及以上')) {
    return '6进7板+';
  }
  return BOARD_LADDER_LEVELS.includes(height) ? height : '首板';
}

export default function App() {
  const [totalCapital, setTotalCapital] = useState(() => {
    try {
      const saved = localStorage.getItem(CAPITAL_STORAGE_KEY);
      const parsed = saved ? parseFloat(saved) : 100000;
      return !isNaN(parsed) && parsed > 0 ? parsed : 100000;
    } catch {
      return 100000;
    }
  });

  const [capitalInput, setCapitalInput] = useState(() => String(totalCapital));
  const [activeTab, setActiveTab] = useState('stats');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // 初始化读取 localStorage（删空记录后重开不会自动回填示例数据）
  const [records, setRecords] = useState(() => {
    try {
      const initialized = localStorage.getItem(INIT_FLAG_KEY);
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!initialized) {
        localStorage.setItem(INIT_FLAG_KEY, 'true');
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(INITIAL_SAMPLE_RECORDS)
        );
        return INITIAL_SAMPLE_RECORDS;
      }
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    } catch (err) {
      console.error('保存失败:', err);
      alert(
        '本地存储空间已满，当前记录可能未保存成功！建议先删除部分带截图的旧记录。'
      );
    }
  }, [records]);

  useEffect(() => {
    try {
      localStorage.setItem(CAPITAL_STORAGE_KEY, String(totalCapital));
    } catch {
      // 忽略存储异常
    }
  }, [totalCapital]);

  const emptyForm = {
    date: new Date().toISOString().slice(0, 10),
    code: '',
    name: '',
    sector: '',
    entryPrice: '',
    positionPct: '',
    amount: '',
    mode: '半路（板前卡位博弈）',
    boardHeight: '首板',
    emotionPhase: '启动试盘',
    discipline: '严守纪律',
    nextDayPremium: '',
    sealStatus: 'success',
    notes: '',
    screenshot: '',
  };

  const [form, setForm] = useState(emptyForm);

  const handleUpdateCapital = () => {
    const val = parseFloat(capitalInput);
    if (!isNaN(val) && val > 0) {
      setTotalCapital(val);
    } else {
      alert('请输入大于 0 的总资金数字');
    }
  };

  const handlePositionChange = (val) => {
    const pct = parseFloat(val);
    const autoAmount =
      !isNaN(pct) && pct > 0 ? Math.round((totalCapital * pct) / 100) : '';
    setForm((prev) => ({
      ...prev,
      positionPct: val,
      amount: autoAmount !== '' ? String(autoAmount) : prev.amount,
    }));
  };

  const toggleSealStatus = (statusValue) => {
    setForm((prev) => ({
      ...prev,
      sealStatus: prev.sealStatus === statusValue ? '' : statusValue,
    }));
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressedDataUrl = await compressImageFile(file);
      setForm((prev) => ({ ...prev, screenshot: compressedDataUrl }));
    } catch {
      alert('图片处理失败，请重试或换一张截图');
    }
  };

  const openCreateModal = () => {
    setEditingId(null);
    setForm(emptyForm);
    setIsModalOpen(true);
  };

  const openEditModal = (record) => {
    setEditingId(record.id);
    setForm({
      ...record,
      entryPrice: String(record.entryPrice ?? ''),
      positionPct: String(record.positionPct ?? ''),
      amount: String(record.amount ?? ''),
      nextDayPremium: String(record.nextDayPremium ?? ''),
      sealStatus: record.sealStatus ?? '',
    });
    setIsModalOpen(true);
  };

  const handleSaveRecord = (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      alert('请填写股票名称');
      return;
    }

    const payload = {
      id: editingId || `rec-${Date.now()}`,
      date: form.date,
      code: form.code.trim(),
      name: form.name.trim(),
      sector: form.sector.trim() || '未分类',
      entryPrice: parseFloat(form.entryPrice) || 0,
      positionPct: parseFloat(form.positionPct) || 0,
      amount: parseFloat(form.amount) || 0,
      mode: form.mode,
      boardHeight: form.boardHeight,
      emotionPhase: form.emotionPhase,
      discipline: form.discipline,
      nextDayPremium: parseFloat(form.nextDayPremium) || 0,
      sealStatus: form.sealStatus,
      notes: form.notes.trim(),
      screenshot: form.screenshot,
    };

    if (editingId) {
      setRecords((prev) =>
        prev.map((item) => (item.id === editingId ? payload : item))
      );
    } else {
      setRecords((prev) => [payload, ...prev]);
    }
    setIsModalOpen(false);
  };

  const handleDeleteRecord = (id) => {
    setRecords((prev) => prev.filter((item) => item.id !== id));
  };

  const stats = useMemo(() => {
    const count = records.length;
    const totalAmount = records.reduce(
      (sum, r) => sum + (Number(r.amount) || 0),
      0
    );
    const usedPct =
      totalCapital > 0 ? ((totalAmount / totalCapital) * 100).toFixed(1) : '0.0';

    const sealAttempts = records.filter((r) => Boolean(r.sealStatus));
    const successCount = records.filter((r) => r.sealStatus === 'success').length;
    const brokenCount = records.filter((r) => r.sealStatus === 'broken').length;

    const successRate =
      sealAttempts.length > 0
        ? ((successCount / sealAttempts.length) * 100).toFixed(1)
        : '0.0';
    const brokenRate =
      sealAttempts.length > 0
        ? ((brokenCount / sealAttempts.length) * 100).toFixed(1)
        : '0.0';

    const disciplinedCount = records.filter(
      (r) => r.discipline === '严守纪律'
    ).length;
    const disciplineRate =
      count > 0 ? ((disciplinedCount / count) * 100).toFixed(0) : '0';

    const avgPremium =
      count > 0
        ? (
            records.reduce(
              (sum, r) => sum + (Number(r.nextDayPremium) || 0),
              0
            ) / count
          ).toFixed(2)
        : '0.00';

    const estimatedProfit = Math.round(
      records.reduce(
        (sum, r) =>
          sum +
          ((Number(r.amount) || 0) * (Number(r.nextDayPremium) || 0)) / 100,
        0
      )
    );

    const wins = records.filter((r) => (Number(r.nextDayPremium) || 0) > 0);
    const losses = records.filter((r) => (Number(r.nextDayPremium) || 0) < 0);
    const avgWin =
      wins.length > 0
        ? `+${(
            wins.reduce((s, r) => s + Number(r.nextDayPremium), 0) / wins.length
          ).toFixed(1)}%`
        : '+0.0%';
    const avgLoss =
      losses.length > 0
        ? `${(
            losses.reduce((s, r) => s + Number(r.nextDayPremium), 0) / losses.length
          ).toFixed(1)}%`
        : '0.0%';

    const ladderStats = BOARD_LADDER_LEVELS.map((level) => {
      const items = records.filter(
        (r) => normalizeBoardHeight(r.boardHeight) === level
      );
      const levelAttempts = items.filter((r) => Boolean(r.sealStatus));
      const levelSuccess = items.filter((r) => r.sealStatus === 'success').length;
      const rate =
        levelAttempts.length > 0
          ? Math.round((levelSuccess / levelAttempts.length) * 100)
          : 0;
      const avgPrem =
        items.length > 0
          ? (
              items.reduce(
                (s, r) => s + (Number(r.nextDayPremium) || 0),
                0
              ) / items.length
            ).toFixed(2)
          : '0.00';
      return {
        level,
        count: items.length,
        rate,
        avgPrem: `${Number(avgPrem) >= 0 ? '+' : ''}${avgPrem}%`,
      };
    });

    return {
      count,
      totalAmount,
      usedPct,
      successRate,
      brokenRate,
      disciplineRate,
      avgPremium: `${Number(avgPremium) >= 0 ? '+' : ''}${avgPremium}%`,
      estimatedProfit,
      avgWin,
      avgLoss,
      ladderStats,
    };
  }, [records, totalCapital]);

  return (
    <div className="min-h-screen bg-[#0B0E17] text-slate-100 pb-24 font-sans">
      {/* 顶部资金与操作栏 */}
      <header className="sticky top-0 z-20 bg-[#0B0E17]/95 backdrop-blur border-b border-slate-800/80 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center shadow-lg shadow-rose-500/20 text-lg font-bold">
            🔥
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-base tracking-tight">BoardMaster</h1>
              <span className="text-[11px] px-2 py-0.5 rounded bg-rose-500/15 text-rose-400 border border-rose-500/30">
                专业复盘终端 v2.3
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              总资金 {totalCapital.toLocaleString()} · 累计仓位{' '}
              {stats.totalAmount.toLocaleString()} ({stats.usedPct}%)
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="bg-rose-600 hover:bg-rose-500 active:scale-95 transition text-white text-sm font-medium px-3.5 py-2 rounded-xl flex items-center gap-1 shadow-lg shadow-rose-600/25"
        >
          <span>+ 记一笔</span>
        </button>
      </header>

      {/* 主内容区域 */}
      <main className="max-w-xl mx-auto px-4 pt-4 space-y-4">
        {activeTab === 'stats' && (
          <>
            {/* 账户总资金设定 */}
            <section className="bg-[#131826] border border-slate-800/90 rounded-2xl p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0 text-sm">
                  💼
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">账户总资金设定</h2>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                    输入总资金后，记录中的仓位占比、投入金额与次日盈亏金额自动联动
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="flex-1 flex items-center bg-[#0D111C] border border-slate-700 rounded-xl px-3 py-2">
                  <span className="text-slate-400 text-sm mr-2">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={capitalInput}
                    onChange={(e) => setCapitalInput(e.target.value)}
                    className="w-full bg-transparent text-sm text-white outline-none font-mono"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleUpdateCapital}
                  className="bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shrink-0"
                >
                  更新总资金
                </button>
              </div>
            </section>

            {/* 四宫格核心指标 */}
            <section className="grid grid-cols-2 gap-3">
              <div className="bg-[#131826] border border-slate-800/90 rounded-2xl p-4">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>打板成功率</span>
                  <span className="text-emerald-400">●</span>
                </div>
                <div className="text-2xl font-bold font-mono text-emerald-400 mt-2">
                  {stats.successRate}%
                </div>
                <div className="text-xs text-slate-400 mt-1.5">
                  纪律率 {stats.disciplineRate}% · {stats.count} 笔
                </div>
              </div>

              <div className="bg-[#131826] border border-slate-800/90 rounded-2xl p-4">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>仓位与金额</span>
                  <span className="text-amber-400">!</span>
                </div>
                <div className="text-2xl font-bold font-mono text-white mt-2">
                  {stats.usedPct}%
                </div>
                <div className="text-xs text-slate-400 mt-1.5">
                  累计 {stats.totalAmount.toLocaleString()} · 炸板{' '}
                  {stats.brokenRate}%
                </div>
              </div>

              <div className="bg-[#131826] border border-slate-800/90 rounded-2xl p-4">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>次日均溢价 / 盈亏</span>
                  <span className="text-rose-400">↗</span>
                </div>
                <div
                  className={`text-2xl font-bold font-mono mt-2 ${
                    parseFloat(stats.avgPremium) >= 0
                      ? 'text-rose-400'
                      : 'text-emerald-400'
                  }`}
                >
                  {stats.avgPremium}
                </div>
                <div className="text-xs text-slate-400 mt-1.5">
                  测算盈亏{' '}
                  <span className="font-mono text-slate-200">
                    {stats.estimatedProfit >= 0
                      ? `+${stats.estimatedProfit.toLocaleString()}`
                      : stats.estimatedProfit.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="bg-[#131826] border border-slate-800/90 rounded-2xl p-4">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>账户总资金</span>
                  <span className="text-sky-400">▤</span>
                </div>
                <div className="text-xl font-bold font-mono text-sky-400 mt-2 truncate">
                  {totalCapital.toLocaleString()}
                </div>
                <div className="text-xs text-slate-400 mt-1.5">
                  赢 {stats.avgWin} / 亏 {stats.avgLoss}
                </div>
              </div>
            </section>

            {/* 连板高度梯队分析 */}
            <section className="bg-[#131826] border border-slate-800/90 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-amber-400">≡</span>
                  <h2 className="text-sm font-bold text-white">
                    连板高度梯队分析
                  </h2>
                </div>
                <span className="text-xs text-slate-400">首板 → 6进7板+</span>
              </div>

              <div className="space-y-2.5">
                {stats.ladderStats.map((item) => (
                  <div
                    key={item.level}
                    className="bg-[#0D111C] border border-slate-800/80 rounded-xl p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="font-semibold text-slate-200">
                        {item.level}{' '}
                        <span className="text-slate-400 font-normal">
                          ({item.count} 笔)
                        </span>
                      </div>
                      <div className="flex items-center gap-3 font-mono">
                        <span className="text-emerald-400">
                          成功率 {item.rate}%
                        </span>
                        <span
                          className={
                            parseFloat(item.avgPrem) >= 0
                              ? 'text-rose-400'
                              : 'text-emerald-400'
                          }
                        >
                          溢价 {item.avgPrem}
                        </span>
                      </div>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-500 to-rose-500 transition-all"
                        style={{ width: `${Math.min(100, item.rate)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {activeTab === 'records' && (
          <>
            {records.length === 0 ? (
              <div className="text-center py-16 bg-[#131826] rounded-2xl border border-slate-800/80">
                <p className="text-slate-400 text-sm">暂无复盘记录</p>
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="mt-3 text-rose-400 text-sm underline"
                >
                  点击右上角“记一笔”开始记录
                </button>
              </div>
            ) : (
              records.map((rec) => {
                const profitAmount = Math.round(
                  ((Number(rec.amount) || 0) *
                    (Number(rec.nextDayPremium) || 0)) /
                    100
                );
                const isPositive = rec.nextDayPremium >= 0;
                const sealMeta = SEAL_STATUS_OPTIONS.find(
                  (opt) => opt.value === rec.sealStatus
                );
                const shortModeLabel = rec.mode.includes('（')
                  ? rec.mode.split('（')[0]
                  : rec.mode;

                return (
                  <article
                    key={rec.id}
                    className="bg-[#131826] border border-slate-800/90 rounded-2xl p-4 shadow-md"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-lg font-bold text-white">
                            {rec.name}
                          </h2>
                          {rec.code && (
                            <span className="text-xs text-slate-400 font-mono">
                              {rec.code}
                            </span>
                          )}
                          <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                            {rec.sector}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
                          <span className="text-xs px-2 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30">
                            {shortModeLabel}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            {rec.boardHeight}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                            {rec.emotionPhase}
                          </span>
                          {sealMeta && (
                            <span
                              className={`text-xs px-2 py-0.5 rounded ${sealMeta.badgeClass}`}
                            >
                              {sealMeta.label}
                            </span>
                          )}
                        </div>

                        <div className="mt-2">
                          <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                            {rec.discipline}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="flex items-center justify-end gap-2">
                          <div>
                            <div className="text-[11px] text-slate-400">
                              次日溢价
                            </div>
                            <div
                              className={`text-lg font-bold font-mono ${
                                isPositive ? 'text-rose-400' : 'text-emerald-400'
                              }`}
                            >
                              {isPositive
                                ? `+${rec.nextDayPremium}%`
                                : `${rec.nextDayPremium}%`}
                            </div>
                            <div
                              className={`text-xs font-mono ${
                                isPositive
                                  ? 'text-rose-400/90'
                                  : 'text-emerald-400/90'
                              }`}
                            >
                              {isPositive
                                ? `+${profitAmount.toLocaleString()}`
                                : profitAmount.toLocaleString()}
                            </div>
                          </div>

                          <div className="flex flex-col gap-2 pl-2 border-l border-slate-800">
                            <button
                              type="button"
                              onClick={() => openEditModal(rec)}
                              className="px-2 py-1 text-xs text-slate-300 hover:text-white rounded-lg bg-slate-800/80 hover:bg-slate-800"
                              title="编辑记录"
                            >
                              编辑
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteRecord(rec.id)}
                              className="px-2 py-1 text-xs text-rose-400 hover:text-rose-300 rounded-lg bg-slate-800/80 hover:bg-slate-800"
                              title="删除记录"
                            >
                              删除
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-800/80 text-xs text-slate-300 space-y-1">
                      <div>日期：{rec.date}</div>
                      <div className="flex items-center gap-4">
                        <span>介入价：{rec.entryPrice}</span>
                        <span>仓位：{rec.positionPct}%</span>
                      </div>
                      <div>金额：{Number(rec.amount).toLocaleString()}</div>
                    </div>

                    {rec.notes && (
                      <div className="mt-3 p-3 rounded-xl bg-[#0D111C] border border-slate-800/80 text-xs text-slate-300 leading-relaxed">
                        {rec.notes}
                      </div>
                    )}

                    {rec.screenshot && (
                      <div className="mt-3">
                        <img
                          src={rec.screenshot}
                          alt={`${rec.name}复盘截图`}
                          className="w-full max-h-48 object-cover rounded-xl border border-slate-800"
                        />
                      </div>
                    )}
                  </article>
                );
              })
            )}
          </>
        )}

        {activeTab === 'playbook' && (
          <section className="bg-[#131826] border border-slate-800/90 rounded-2xl p-4 space-y-3">
            <h2 className="text-base font-bold text-white">
              短线打板与低吸执行手册
            </h2>
            <div className="space-y-2.5 text-xs text-slate-300 leading-relaxed">
              <div className="p-3 rounded-xl bg-[#0D111C] border border-slate-800">
                <div className="font-semibold text-sky-300 mb-1">
                  连板分歧水下低吸
                </div>
                连板后开盘大幅下杀时，重点看水下承接力度与板块梯队是否掉队；不盲目接飞刀，严格控制仓位与次日止损纪律。
              </div>
              <div className="p-3 rounded-xl bg-[#0D111C] border border-slate-800">
                <div className="font-semibold text-purple-300 mb-1">
                  半路冲板与冲板未封
                </div>
                半路介入后若始终未能封死涨停，次日重点观察承接与冲高回落节奏，不恋战、按纪律处理。
              </div>
            </div>
          </section>
        )}
      </main>

      {/* 底部导航栏 */}
      <nav className="fixed bottom-0 inset-x-0 bg-[#0B0E17]/95 backdrop-blur border-t border-slate-800/80 flex justify-around py-2.5 text-xs">
        <button
          type="button"
          onClick={() => setActiveTab('stats')}
          className={`flex flex-col items-center gap-1 ${
            activeTab === 'stats' ? 'text-rose-400 font-semibold' : 'text-slate-400'
          }`}
        >
          <span>📊</span>
          <span>统计看板</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('records')}
          className={`flex flex-col items-center gap-1 ${
            activeTab === 'records'
              ? 'text-rose-400 font-semibold'
              : 'text-slate-400'
          }`}
        >
          <span>✦</span>
          <span>复盘记录</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('playbook')}
          className={`flex flex-col items-center gap-1 ${
            activeTab === 'playbook'
              ? 'text-rose-400 font-semibold'
              : 'text-slate-400'
          }`}
        >
          <span>📖</span>
          <span>策略手册</span>
        </button>
      </nav>

      {/* 新增 / 编辑复盘弹窗 */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <form
            onSubmit={handleSaveRecord}
            className="w-full max-w-lg max-h-[92vh] overflow-y-auto bg-[#131826] border border-slate-800 rounded-t-3xl sm:rounded-2xl p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">
                {editingId ? '编辑复盘记录' : '新增复盘记录'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-2 py-1 text-sm text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="bg-[#0D111C] border border-slate-700 rounded-xl px-3 py-2.5 text-sm"
              />
              <input
                type="text"
                placeholder="股票代码 如 002996"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                className="bg-[#0D111C] border border-slate-700 rounded-xl px-3 py-2.5 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  股票名称 *
                </label>
                <input
                  type="text"
                  required
                  placeholder="如 百洋股份"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-[#0D111C] border border-slate-700 rounded-xl px-3 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  所属题材 / 板块
                </label>
                <input
                  type="text"
                  placeholder="如 农产品加工"
                  value={form.sector}
                  onChange={(e) => setForm({ ...form, sector: e.target.value })}
                  className="w-full bg-[#0D111C] border border-slate-700 rounded-xl px-3 py-2.5 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  介入价格
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="7.11"
                  value={form.entryPrice}
                  onChange={(e) =>
                    setForm({ ...form, entryPrice: e.target.value })
                  }
                  className="w-full bg-[#0D111C] border border-slate-700 rounded-xl px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  仓位占比 (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="如 25"
                  value={form.positionPct}
                  onChange={(e) => handlePositionChange(e.target.value)}
                  className="w-full bg-[#0D111C] border border-slate-700 rounded-xl px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  投入金额
                </label>
                <input
                  type="number"
                  placeholder="自动或手填"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className="w-full bg-[#0D111C] border border-slate-700 rounded-xl px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  打板模式
                </label>
                <select
                  value={form.mode}
                  onChange={(e) => setForm({ ...form, mode: e.target.value })}
                  className="w-full bg-[#0D111C] border border-slate-700 rounded-xl px-3 py-2.5 text-sm"
                >
                  {STRATEGY_MODES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  连板高度
                </label>
                <select
                  value={form.boardHeight}
                  onChange={(e) =>
                    setForm({ ...form, boardHeight: e.target.value })
                  }
                  className="w-full bg-[#0D111C] border border-slate-700 rounded-xl px-3 py-2.5 text-sm"
                >
                  {BOARD_LADDER_LEVELS.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  情绪周期阶段
                </label>
                <select
                  value={form.emotionPhase}
                  onChange={(e) =>
                    setForm({ ...form, emotionPhase: e.target.value })
                  }
                  className="w-full bg-[#0D111C] border border-slate-700 rounded-xl px-3 py-2.5 text-sm"
                >
                  {['启动试盘', '主升发酵', '分歧博弈', '高位退潮', '冰点反抽'].map(
                    (phase) => (
                      <option key={phase} value={phase}>
                        {phase}
                      </option>
                    )
                  )}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  执行纪律评价
                </label>
                <select
                  value={form.discipline}
                  onChange={(e) =>
                    setForm({ ...form, discipline: e.target.value })
                  }
                  className="w-full bg-[#0D111C] border border-slate-700 rounded-xl px-3 py-2.5 text-sm"
                >
                  {['严守纪律', '盘中微调', '冲动追高', '犹豫踏空'].map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">
                次日溢价率 (%)
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="如 5.02 或 -2.80"
                value={form.nextDayPremium}
                onChange={(e) =>
                  setForm({ ...form, nextDayPremium: e.target.value })
                }
                className="w-full bg-[#0D111C] border border-slate-700 rounded-xl px-3 py-2.5 text-sm"
              />
            </div>

            {/* 封板结果：打板成功 / 发生炸板 / 冲板未封 */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-slate-400">
                  封板结果（水下低吸未冲板可不勾选）
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                {SEAL_STATUS_OPTIONS.map((opt) => {
                  const checked = form.sealStatus === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => toggleSealStatus(opt.value)}
                      className="inline-flex items-center gap-2 text-sm text-slate-200 select-none"
                    >
                      <span
                        className={`w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold transition ${
                          checked
                            ? 'bg-emerald-500 text-white'
                            : 'bg-slate-200 text-transparent'
                        }`}
                      >
                        ✓
                      </span>
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">
                复盘要点与情绪逻辑
              </label>
              <textarea
                rows={3}
                placeholder="记录买点位置、板块梯队、承接力度与次日处理逻辑..."
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full bg-[#0D111C] border border-slate-700 rounded-xl p-3 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1.5">
                上传分时 / K线截图（可选，自动压缩防丢失）
              </label>
              <div className="flex items-center gap-3">
                <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-200">
                  <span>选取文件</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
                {form.screenshot && (
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, screenshot: '' })}
                    className="text-xs text-rose-400 hover:underline"
                  >
                    移除截图
                  </button>
                )}
              </div>
              {form.screenshot && (
                <img
                  src={form.screenshot}
                  alt="预览"
                  className="mt-2.5 w-full max-h-36 object-cover rounded-xl border border-slate-700"
                />
              )}
            </div>

            <div className="pt-2 flex gap-3">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-sm font-medium"
              >
                取消
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-medium"
              >
                保存记录
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
