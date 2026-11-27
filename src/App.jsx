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
                  <h2 className
