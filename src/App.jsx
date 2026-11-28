import React, { useState, useEffect, useMemo, useRef } from 'react';

// 固定统一存储键名，避免后续更新版本时因换 Key 导致记录看不见
const STORAGE_KEY = 'boardmaster_records_main';
const INIT_FLAG_KEY = 'boardmaster_initialized_main';
const CAPITAL_STORAGE_KEY = 'boardmaster_total_capital_main';

const LEGACY_RECORD_KEYS = [
  'boardmaster_records_v24',
  'boardmaster_records_v23',
  'boardmaster_records_v22',
  'boardmaster_records_v2',
  'boardmaster_records',
];

const LEGACY_CAPITAL_KEYS = [
  'boardmaster_total_capital_v24',
  'boardmaster_total_capital_v23',
  'boardmaster_total_capital_v22',
  'boardmaster_total_capital',
];

// 三大交易类型（核心统计维度）
const TRADE_CATEGORIES = [
  {
    value: '打板交易',
    badgeClass: 'bg-rose-500/15 text-rose-300 border border-rose-500/30',
    desc: '排板 / 扫板 / 半路 / 水下低吸 / 冲板',
  },
  {
    value: '高位回调',
    badgeClass: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
    desc: '高位回踩承接或分歧回落低吸',
  },
  {
    value: '模式外交易',
    badgeClass: 'bg-purple-500/15 text-purple-300 border border-purple-500/30',
    desc: '盘中临时起意、计划外或情绪单',
  },
];

const BOARD_LADDER_LEVELS = [
  '首板',
  '2板',
  '3板',
  '4板',
  '5板',
  '6进7板+',
];

const STRATEGY_MODES = [
  '排板（确定性封单）',
  '扫板（点火瞬间抢筹）',
  '半路（板前卡位博弈）',
  '连板分歧水下低吸',
  '高位回踩承接低吸',
  '模式外随手单',
];

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
    category: '打板交易',
    mode: '半路（板前卡位博弈）',
    boardHeight: '首板',
    emotionPhase: '分歧博弈',
    discipline: '严守纪律',
    nextDayPremium: -2.8,
    sealStatus: 'broken',
    notes: '午后冲板回落炸板，次日冲高乏力按纪律止损离场。',
    screenshot: '',
  },
  {
    id: 'sample-2',
    date: '2026-11-20',
    code: '600118',
    name: '中国卫星',
    sector: '商业航天',
    category: '打板交易',
    mode: '排板（确定性封单）',
    boardHeight: '4板',
    emotionPhase: '主升发酵',
    discipline: '严守纪律',
    nextDayPremium: 8.9,
    sealStatus: 'success',
    notes: '板块核心梯队领涨，封单稳固成交，次日连板溢价明显。',
    screenshot: '',
  },
];

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

function inferCategoryFromRecord(rec) {
  if (
    rec.category === '打板交易' ||
    rec.category === '高位回调' ||
    rec.category === '模式外交易'
  ) {
    return rec.category;
  }
  if (rec.discipline === '冲动追高' || String(rec.mode || '').includes('模式外')) {
    return '模式外交易';
  }
  if (String(rec.mode || '').includes('回调') || String(rec.mode || '').includes('回踩')) {
    return '高位回调';
  }
  return '打板交易';
}

function loadInitialCapital() {
  try {
    const saved = localStorage.getItem(CAPITAL_STORAGE_KEY);
    if (saved) {
      const parsed = parseFloat(saved);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    for (const key of LEGACY_CAPITAL_KEYS) {
      const oldVal = localStorage.getItem(key);
      if (oldVal) {
        const parsed = parseFloat(oldVal);
        if (!isNaN(parsed) && parsed > 0) return parsed;
      }
    }
    return 100000;
  } catch {
    return 100000;
  }
}

function loadInitialRecords() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((r) => ({
          ...r,
          category: inferCategoryFromRecord(r),
        }));
      }
    }

    for (const key of LEGACY_RECORD_KEYS) {
      const oldRaw = localStorage.getItem(key);
      if (oldRaw) {
        const parsed = JSON.parse(oldRaw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((r) => ({
            ...r,
            category: inferCategoryFromRecord(r),
          }));
        }
      }
    }

    const initialized = localStorage.getItem(INIT_FLAG_KEY);
    if (!initialized) {
      localStorage.setItem(INIT_FLAG_KEY, 'true');
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(INITIAL_SAMPLE_RECORDS)
      );
      return INITIAL_SAMPLE_RECORDS;
    }

    return [];
  } catch {
    return [];
  }
}

export default function App() {
  const [totalCapital, setTotalCapital] = useState(loadInitialCapital);
  const [capitalInput, setCapitalInput] = useState(() => String(totalCapital));
  const [activeTab, setActiveTab] = useState('stats');
  const [categoryFilter, setCategoryFilter] = useState('全部');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [records, setRecords] = useState(loadInitialRecords);

  // 备份与导入弹窗状态
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [backupText, setBackupText] = useState('');
  const [importText, setImportText] = useState('');
  const [importMode, setImportMode] = useState('merge');
  const [lastBackupTime, setLastBackupTime] = useState(() => {
    try {
      return localStorage.getItem('boardmaster_last_backup_time') || '';
    } catch {
      return '';
    }
  });

  const fileInputRef = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem(INIT_FLAG_KEY, 'true');
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    } catch (err) {
      console.error('保存失败:', err);
      alert(
        '本地存储空间已满，当前记录可能未保存成功！建议先导出备份，再删除部分带截图的旧记录。'
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
    category: '打板交易',
    mode: '排板（确定性封单）',
    boardHeight: '首板',
    emotionPhase: '启动试盘',
    discipline: '严守纪律',
    nextDayPremium: '',
    sealStatus: 'success',
    notes: '',
    screenshot: '',
  };

  const [form, setForm] = useState(emptyForm);

  const handleCategorySelectInForm = (catValue) => {
    setForm((prev) => {
      let nextMode = prev.mode;
      if (catValue === '高位回调' && !prev.mode.includes('回调') && !prev.mode.includes('回踩')) {
        nextMode = '高位回踩承接低吸';
      } else if (catValue === '模式外交易' && !prev.mode.includes('模式外')) {
        nextMode = '模式外随手单';
      } else if (
        catValue === '打板交易' &&
        (prev.mode.includes('回调') ||
          prev.mode.includes('回踩') ||
          prev.mode.includes('模式外'))
      ) {
        nextMode = '排板（确定性封单）';
      }
      return {
        ...prev,
        category: catValue,
        mode: nextMode,
      };
    });
  };

  const buildBackupPayload = () => ({
    app: 'BoardMaster',
    version: 'v2.6',
    exportedAt: new Date().toISOString(),
    totalCapital,
    recordsCount: records.length,
    records,
  });

  const triggerDownloadJson = (payload) => {
    const jsonStr = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    link.href = url;
    link.download = `boardmaster-backup-${stamp}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return jsonStr;
  };

  const handleOneClickBackup = async () => {
    try {
      const payload = buildBackupPayload();
      const jsonStr = triggerDownloadJson(payload);
      setBackupText(jsonStr);

      const nowStr = new Date().toLocaleString();
      setLastBackupTime(nowStr);
      try {
        localStorage.setItem('boardmaster_last_backup_time', nowStr);
      } catch {
        // 忽略存储异常
      }

      let copied = false;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
          await navigator.clipboard.writeText(jsonStr);
          copied = true;
        } catch {
          copied = false;
        }
      }

      alert(
        `备份完成（共 ${records.length} 条记录）！\n` +
          `• 已下载 .json 备份文件\n` +
          (copied
            ? '• 已复制备份内容到剪贴板，可直接粘贴到「备忘录」保存'
            : '• 如需文本备份，可在“备份 / 导入”窗口中手动复制')
      );
    } catch (err) {
      alert(`备份失败：${err.message}`);
    }
  };

  const openBackupModal = () => {
    const payload = buildBackupPayload();
    setBackupText(JSON.stringify(payload, null, 2));
    setIsBackupModalOpen(true);
  };

  const handleExportFileOnly = () => {
    try {
      const payload = buildBackupPayload();
      const jsonStr = triggerDownloadJson(payload);
      setBackupText(jsonStr);
      const nowStr = new Date().toLocaleString();
      setLastBackupTime(nowStr);
      localStorage.setItem('boardmaster_last_backup_time', nowStr);
      alert(`已导出 ${records.length} 条记录的 JSON 文件`);
    } catch (err) {
      alert(`导出失败：${err.message}`);
    }
  };

  const handleCopyBackupText = async () => {
    try {
      const textToCopy =
        backupText || JSON.stringify(buildBackupPayload(), null, 2);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(textToCopy);
        alert('已复制备份 JSON 到剪贴板，可粘贴到手机备忘录保存');
      } else {
        alert('当前浏览器不支持自动复制，请长按文本框内容手动全选复制');
      }
    } catch {
      alert('复制失败，请长按文本框手动全选复制');
    }
  };

  const applyImportedData = (rawString) => {
    const trimmed = (rawString || '').trim();
    if (!trimmed) {
      alert('请先选择备份文件或粘贴备份 JSON 内容');
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      alert('JSON 格式无效，请确认粘贴或选择的备份内容完整无缺');
      return;
    }

    let incomingRecords = [];
    let incomingCapital = null;

    if (Array.isArray(parsed)) {
      incomingRecords = parsed;
    } else if (parsed && Array.isArray(parsed.records)) {
      incomingRecords = parsed.records;
      if (typeof parsed.totalCapital === 'number' && parsed.totalCapital > 0) {
        incomingCapital = parsed.totalCapital;
      }
    } else {
      alert('未识别到有效的复盘记录数组');
      return;
    }

    const cleanedRecords = incomingRecords
      .filter((item) => item && typeof item === 'object' && item.name)
      .map((item, idx) => ({
        id: item.id || `imported-${Date.now()}-${idx}`,
        date: item.date || new Date().toISOString().slice(0, 10),
        code: String(item.code || '').trim(),
        name: String(item.name || '').trim(),
        sector: String(item.sector || '未分类').trim() || '未分类',
        category: inferCategoryFromRecord(item),
        mode: item.mode || '排板（确定性封单）',
        boardHeight: normalizeBoardHeight(item.boardHeight),
        emotionPhase: item.emotionPhase || '启动试盘',
        discipline: item.discipline || '严守纪律',
        nextDayPremium: Number(item.nextDayPremium) || 0,
        sealStatus:
          item.sealStatus === 'success' ||
          item.sealStatus === 'broken' ||
          item.sealStatus === 'unsealed'
            ? item.sealStatus
            : '',
        notes: String(item.notes || ''),
        screenshot: typeof item.screenshot === 'string' ? item.screenshot : '',
      }));

    if (cleanedRecords.length === 0) {
      alert('备份中没有找到可导入的有效记录');
      return;
    }

    if (importMode === 'replace') {
      setRecords(cleanedRecords);
    } else {
      setRecords((prev) => {
        const existingIds = new Set(prev.map((r) => r.id));
        const existingSignatures = new Set(
          prev.map(
            (r) =>
              `${r.date}|${r.code}|${r.name}|${r.category}|${r.mode}|${r.nextDayPremium}`
          )
        );
        const toAdd = cleanedRecords.filter((item) => {
          const sig = `${item.date}|${item.code}|${item.name}|${item.category}|${item.mode}|${item.nextDayPremium}`;
          if (existingIds.has(item.id) || existingSignatures.has(sig)) {
            return false;
          }
          existingIds.add(item.id);
          existingSignatures.add(sig);
          return true;
        });
        return [...toAdd, ...prev];
      });
    }

    if (incomingCapital !== null) {
      setTotalCapital(incomingCapital);
      setCapitalInput(String(incomingCapital));
    }

    setImportText('');
    setIsBackupModalOpen(false);
    alert(
      `导入成功！本次读取到 ${cleanedRecords.length} 条记录（模式：${
        importMode === 'replace' ? '覆盖当前' : '合并去重'
      }）`
    );
  };

  const handleImportFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = String(event.target?.result || '');
      setImportText(content);
      applyImportedData(content);
    };
    reader.onerror = () => {
      alert('读取备份文件失败，请重试');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleUpdateCapital = () => {
    const val = parseFloat(capitalInput);
    if (!isNaN(val) && val > 0) {
      setTotalCapital(val);
    } else {
      alert('请输入大于 0 的总资金数字');
    }
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
      category: inferCategoryFromRecord(record),
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
      category: form.category,
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

  const filteredRecords = useMemo(() => {
    if (categoryFilter === '全部') return records;
    return records.filter((r) => inferCategoryFromRecord(r) === categoryFilter);
  }, [records, categoryFilter]);

  const stats = useMemo(() => {
    const calcGroupMetrics = (list) => {
      const count = list.length;
      const winItems = list.filter((r) => (Number(r.nextDayPremium) || 0) > 0);
      const lossItems = list.filter((r) => (Number(r.nextDayPremium) || 0) < 0);

      // 交易胜率：次日溢价 > 0 的单子占比
      const winRate =
        count > 0 ? ((winItems.length / count) * 100).toFixed(1) : '0.0';

      // 打板封板成功率：有封板结果标签的单子中“打板成功”占比
      const sealAttempts = list.filter((r) => Boolean(r.sealStatus));
      const sealSuccess = list.filter((r) => r.sealStatus === 'success').length;
      const sealRate =
        sealAttempts.length > 0
          ? ((sealSuccess / sealAttempts.length) * 100).toFixed(1)
          : null;

      // 平均次日溢价 / 盈亏表现
      const avgPremNum =
        count > 0
          ? list.reduce((s, r) => s + (Number(r.nextDayPremium) || 0), 0) /
            count
          : 0;
      const sumPremNum = list.reduce(
        (s, r) => s + (Number(r.nextDayPremium) || 0),
        0
      );

      const avgWinNum =
        winItems.length > 0
          ? winItems.reduce((s, r) => s + Number(r.nextDayPremium), 0) /
            winItems.length
          : 0;
      const avgLossNum =
        lossItems.length > 0
          ? lossItems.reduce((s, r) => s + Number(r.nextDayPremium), 0) /
            lossItems.length
          : 0;

      return {
        count,
        winCount: winItems.length,
        lossCount: lossItems.length,
        winRate,
        sealRate,
        avgPremNum,
        sumPremNum,
        avgPremText: `${avgPremNum >= 0 ? '+' : ''}${avgPremNum.toFixed(2)}%`,
        sumPremText: `${sumPremNum >= 0 ? '+' : ''}${sumPremNum.toFixed(2)}%`,
        avgWinText: `+${avgWinNum.toFixed(1)}%`,
        avgLossText: `${avgLossNum.toFixed(1)}%`,
      };
    };

    const overall = calcGroupMetrics(records);

    // 三大交易类型独立统计
    const byCategory = TRADE_CATEGORIES.map((cat) => {
      const items = records.filter(
        (r) => inferCategoryFromRecord(r) === cat.value
      );
      return {
        ...cat,
        metrics: calcGroupMetrics(items),
      };
    });

    const ladderStats = BOARD_LADDER_LEVELS.map((level) => {
      const items = records.filter(
        (r) => normalizeBoardHeight(r.boardHeight) === level
      );
      const m = calcGroupMetrics(items);
      return {
        level,
        count: m.count,
        winRate: m.winRate,
        avgPremText: m.avgPremText,
        avgPremNum: m.avgPremNum,
      };
    });

    return {
      overall,
      byCategory,
      ladderStats,
    };
  }, [records]);

  return (
    <div className="min-h-screen bg-[#0B0E17] text-slate-100 pb-24 font-sans">
      {/* 顶部栏 */}
      <header className="sticky top-0 z-20 bg-[#0B0E17]/95 backdrop-blur border-b border-slate-800/80 px-4 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center shadow-lg shadow-rose-500/20 text-lg font-bold shrink-0">
            🔥
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h1 className="font-bold text-base tracking-tight truncate">
                BoardMaster
              </h1>
              <span className="text-[11px] px-2 py-0.5 rounded bg-rose-500/15 text-rose-400 border border-rose-500/30 shrink-0">
                v2.6
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 truncate">
              总资金 {totalCapital.toLocaleString()} · 共 {stats.overall.count} 笔
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={openBackupModal}
            className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sky-300 text-xs font-medium px-2.5 py-2 rounded-xl"
          >
            备份/导入
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            className="bg-rose-600 hover:bg-rose-500 active:scale-95 transition text-white text-xs sm:text-sm font-medium px-3 py-2 rounded-xl flex items-center gap-1 shadow-lg shadow-rose-600/25"
          >
            <span>+ 记一笔</span>
          </button>
        </div>
      </header>

      {/* 主内容区域 */}
      <main className="max-w-xl mx-auto px-4 pt-4 space-y-4">
        {/* 快捷备份条 */}
        <section className="bg-[#131826] border border-slate-800/90 rounded-2xl p-3 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-xs font-bold text-white">数据备份与恢复</div>
            <div className="text-[11px] text-slate-400 truncate mt-0.5">
              {lastBackupTime ? `上次备份：${lastBackupTime}` : '建议定期备份到本地或备忘录'}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleOneClickBackup}
              className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
            >
              一键备份
            </button>
            <button
              type="button"
              onClick={handleExportFileOnly}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs"
            >
              导出
            </button>
            <button
              type="button"
              onClick={openBackupModal}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sky-300 text-xs"
            >
              导入
            </button>
          </div>
        </section>

        {activeTab === 'stats' && (
          <>
            {/* 三大交易类型拆账统计（打板 / 高位回调 / 模式外交易） */}
            <section className="bg-[#131826] border border-slate-800/90 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-white">
                    按交易类型统计成功率与盈亏
                  </h2>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    对比打板、高位回调与模式外交易的胜率、均溢价与累计溢价
                  </p>
                </div>
                <span className="text-xs text-slate-400 font-mono">
                  总胜率 {stats.overall.winRate}%
                </span>
              </div>

              <div className="space-y-2.5">
                {stats.byCategory.map((item) => {
                  const m = item.metrics;
                  const isAvgPos = m.avgPremNum >= 0;
                  const isSumPos = m.sumPremNum >= 0;

                  return (
                    <div
                      key={item.value}
                      className="bg-[#0D111C] border border-slate-800/90 rounded-xl p-3.5 space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-xs font-semibold px-2.5 py-0.5 rounded-lg ${item.badgeClass}`}
                          >
                            {item.value}
                          </span>
                          <span className="text-xs text-slate-300 font-mono">
                            {m.count} 笔（赢 {m.winCount} / 亏 {m.lossCount}）
                          </span>
                        </div>
                        <span className="text-xs font-mono font-bold text-emerald-400">
                          胜率 {m.winRate}%
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-800/70 text-xs">
                        <div>
                          <div className="text-[11px] text-slate-400">
                            次日均溢价
                          </div>
                          <div
                            className={`font-mono font-semibold mt-0.5 ${
                              isAvgPos ? 'text-rose-400' : 'text-emerald-400'
                            }`}
                          >
                            {m.avgPremText}
                          </div>
                        </div>

                        <div>
                          <div className="text-[11px] text-slate-400">
                            累计溢价和
                          </div>
                          <div
                            className={`font-mono font-semibold mt-0.5 ${
                              isSumPos ? 'text-rose-400' : 'text-emerald-400'
                            }`}
                          >
                            {m.sumPremText}
                          </div>
                        </div>

                        <div>
                          <div className="text-[11px] text-slate-400">
                            赢亏均值
                          </div>
                          <div className="font-mono text-slate-200 mt-0.5">
                            <span className="text-rose-400">{m.avgWinText}</span>
                            {' / '}
                            <span className="text-emerald-400">
                              {m.avgLossText}
                            </span>
                          </div>
                        </div>
                      </div>

                      {m.sealRate !== null && (
                        <div className="text-[11px] text-slate-400">
                          封板成功率：
                          <span className="text-slate-200 font-mono">
                            {m.sealRate}%
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* 连板高度梯队统计 */}
            <section className="bg-[#131826] border border-slate-800/90 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-white">连板高度统计</h2>
                <span className="text-xs text-slate-400">首板 → 6进7板+</span>
              </div>

              <div className="space-y-2">
                {stats.ladderStats.map((item) => (
                  <div
                    key={item.level}
                    className="bg-[#0D111C] border border-slate-800/80 rounded-xl p-3 space-y-1.5"
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
                          胜率 {item.winRate}%
                        </span>
                        <span
                          className={
                            item.avgPremNum >= 0
                              ? 'text-rose-400'
                              : 'text-emerald-400'
                          }
                        >
                          均溢价 {item.avgPremText}
                        </span>
                      </div>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-500 to-rose-500 transition-all"
                        style={{
                          width: `${Math.min(100, parseFloat(item.winRate) || 0)}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* 账户总资金设定 */}
            <section className="bg-[#131826] border border-slate-800/90 rounded-2xl p-4 space-y-2.5">
              <h2 className="text-sm font-bold text-white">账户总资金设定</h2>
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
          </>
        )}

        {activeTab === 'records' && (
          <>
            {/* 按交易类型筛选记录 */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {['全部', '打板交易', '高位回调', '模式外交易'].map((tabName) => {
                const active = categoryFilter === tabName;
                return (
                  <button
                    key={tabName}
                    type="button"
                    onClick={() => setCategoryFilter(tabName)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium shrink-0 border transition ${
                      active
                        ? 'bg-rose-600 text-white border-rose-500'
                        : 'bg-[#131826] text-slate-300 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {tabName}
                  </button>
                );
              })}
            </div>

            {filteredRecords.length === 0 ? (
              <div className="text-center py-16 bg-[#131826] rounded-2xl border border-slate-800/80 space-y-3">
                <p className="text-slate-400 text-sm">当前筛选下暂无记录</p>
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="text-rose-400 text-sm underline"
                >
                  点击“记一笔”添加记录
                </button>
              </div>
            ) : (
              filteredRecords.map((rec) => {
                const isPositive = rec.nextDayPremium >= 0;
                const catValue = inferCategoryFromRecord(rec);
                const catMeta = TRADE_CATEGORIES.find(
                  (c) => c.value === catValue
                );
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
                          <span
                            className={`text-xs px-2 py-0.5 rounded ${
                              catMeta?.badgeClass ||
                              'bg-slate-800 text-slate-300 border border-slate-700'
                            }`}
                          >
                            {catValue}
                          </span>
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
                          </div>

                          <div className="flex flex-col gap-2 pl-2 border-l border-slate-800">
                            <button
                              type="button"
                              onClick={() => openEditModal(rec)}
                              className="px-2 py-1 text-xs text-slate-300 hover:text-white rounded-lg bg-slate-800/80 hover:bg-slate-800"
                            >
                              编辑
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteRecord(rec.id)}
                              className="px-2 py-1 text-xs text-rose-400 hover:text-rose-300 rounded-lg bg-slate-800/80 hover:bg-slate-800"
                            >
                              删除
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-800/80 text-xs text-slate-300">
                      <div>日期：{rec.date}</div>
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
          <span>类型盈亏统计</span>
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
          <span>复盘明细</span>
        </button>
      </nav>

      {/* 备份 / 导出 / 导入弹窗 */}
      {isBackupModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto bg-[#131826] border border-slate-800 rounded-t-3xl sm:rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">
                备份 / 导出 / 导入数据
              </h3>
              <button
                type="button"
                onClick={() => setIsBackupModalOpen(false)}
                className="px-2 py-1 text-sm text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="bg-[#0D111C] border border-slate-800 rounded-2xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400">
                  1. 备份与导出当前数据（{records.length} 条）
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleExportFileOnly}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200"
                  >
                    下载 JSON
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyBackupText}
                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs text-white font-semibold"
                  >
                    复制备份文本
                  </button>
                </div>
              </div>
              <textarea
                rows={4}
                readOnly
                value={backupText}
                className="w-full bg-[#080B12] border border-slate-800 rounded-xl p-2.5 text-[11px] font-mono text-slate-300"
              />
            </div>

            <div className="bg-[#0D111C] border border-slate-800 rounded-2xl p-3.5 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-bold text-sky-400">
                  2. 导入恢复备份数据
                </span>
                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setImportMode('merge')}
                    className={`px-2.5 py-1 rounded-lg border ${
                      importMode === 'merge'
                        ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    合并去重
                  </button>
                  <button
                    type="button"
                    onClick={() => setImportMode('replace')}
                    className={`px-2.5 py-1 rounded-lg border ${
                      importMode === 'replace'
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    覆盖当前
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200"
                >
                  选择 .json 备份文件
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json,text/plain"
                  onChange={handleImportFileChange}
                  className="hidden"
                />
                <span className="text-[11px] text-slate-400">
                  或在下方粘贴备份 JSON
                </span>
              </div>

              <textarea
                rows={4}
                placeholder="粘贴之前保存的备份 JSON 文本..."
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                className="w-full bg-[#080B12] border border-slate-800 rounded-xl p-2.5 text-[11px] font-mono text-slate-200"
              />

              <button
                type="button"
                onClick={() => applyImportedData(importText)}
                className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold"
              >
                确认导入数据
              </button>
            </div>
          </div>
        </div>
      )}

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

            {/* 交易大类选择 */}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">
                交易类型（用于独立统计成功率与盈亏）
              </label>
              <div className="grid grid-cols-3 gap-2">
                {TRADE_CATEGORIES.map((cat) => {
                  const selected = form.category === cat.value;
                  return (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => handleCategorySelectInForm(cat.value)}
                      className={`py-2 px-2.5 rounded-xl text-xs font-semibold border transition ${
                        selected
                          ? 'bg-rose-600 text-white border-rose-500'
                          : 'bg-[#0D111C] text-slate-300 border-slate-700 hover:border-slate-500'
                      }`}
                    >
                      {cat.value}
                    </button>
                  );
                })}
              </div>
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

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  具体打法 / 买入场景
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

            {/* 封板结果 */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-slate-400">
                  封板结果（非冲板单可不勾选）
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
