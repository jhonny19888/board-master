import React, { useState, useEffect } from 'react';
import {
  Flame,
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  Upload,
  BarChart3,
  BookOpen,
  ClipboardList,
} from 'lucide-react';

const STORAGE_KEY = 'boardmaster_records_v2';
const INIT_FLAG_KEY = 'boardmaster_initialized_v2';

// 1. 打板模式选项（已加入“连板分歧水下低吸”）
const STRATEGY_MODES = [
  '半路（板前卡位博弈）',
  '排板（确定性封单）',
  '扫板（点火瞬间抢筹）',
  '连板分歧水下低吸',
  '龙头首阴反包',
];

// 2. 封板结果状态（已加入“冲板未封”）
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
    sealStatus: 'broken', // 'success' | 'broken' | 'unsealed' | ''
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

// 图片压缩工具：避免原图撑爆 localStorage 5MB 上限导致保存失败
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

export default function BoardMasterApp() {
  const [totalCapital] = useState(100000);
  const [activeTab, setActiveTab] = useState('records');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // 初始化读取 localStorage（区分首次使用与用户主动删空）
  const [records, setRecords] = useState(() => {
    try {
      const initialized = localStorage.getItem(INIT_FLAG_KEY);
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!initialized) {
        localStorage.setItem(INIT_FLAG_KEY, 'true');
        localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_SAMPLE_RECORDS));
        return INITIAL_SAMPLE_RECORDS;
      }
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // 每次 records 变动时安全写入 localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    } catch (err) {
      console.error('保存失败:', err);
      alert('本地存储空间已满，当前记录可能未保存成功！建议先删除部分带截图的旧记录。');
    }
  }, [records]);

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

  // 自动根据仓位占比计算投入金额（仍允许手动改写）
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

  // 封板状态三选一（再次点击当前选中项可取消，适合水下低吸未冲板）
  const toggleSealStatus = (statusValue) => {
    setForm((prev) => ({
      ...prev,
      sealStatus: prev.sealStatus === statusValue ? '' : statusValue,
    }));
  };

  // 上传并压缩分时/K线图
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

  const totalUsedAmount = records.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  const usedPct = ((totalUsedAmount / totalCapital) * 100).toFixed(1);

  return (
    <div className="min-h-screen bg-[#0B0E17] text-slate-100 pb-24 font-sans">
      {/* 顶部资金与操作栏 */}
      <header className="sticky top-0 z-20 bg-[#0B0E17]/95 backdrop-blur border-b border-slate-800/80 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center shadow-lg shadow-rose-500/20">
            <Flame className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-base tracking-tight">BoardMaster</h1>
              <span className="text-[11px] px-2 py-0.5 rounded bg-rose-500/15 text-rose-400 border border-rose-500/30">
                专业复盘终端
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              总资金 {totalCapital.toLocaleString()} · 累计仓位{' '}
              {totalUsedAmount.toLocaleString()} ({usedPct}%)
            </p>
          </div>
        </div>

        <button
          onClick={openCreateModal}
          className="bg-rose-600 hover:bg-rose-500 active:scale-95 transition text-white text-sm font-medium px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-lg shadow-rose-600/25"
        >
          <Plus className="w-4 h-4" />
          <span>记一笔</span>
        </button>
      </header>

      {/* 复盘记录卡片列表 */}
      <main className="max-w-xl mx-auto px-4 pt-4 space-y-4">
        {records.length === 0 ? (
          <div className="text-center py-16 bg-[#131826] rounded-2xl border border-slate-800/80">
            <p className="text-slate-400 text-sm">暂无复盘记录</p>
            <button
              onClick={openCreateModal}
              className="mt-3 text-rose-400 text-sm underline"
            >
              点击右上角“记一笔”开始记录
            </button>
          </div>
        ) : (
          records.map((rec) => {
            const profitAmount = Math.round(
              ((Number(rec.amount) || 0) * (Number(rec.nextDayPremium) || 0)) / 100
            );
            const isPositive = rec.nextDayPremium >= 0;
            const sealMeta = SEAL_STATUS_OPTIONS.find(
              (opt) => opt.value === rec.sealStatus
            );
            // 简化模式短标签展示
            const shortModeLabel = rec.mode.includes('（')
              ? rec.mode.split('（')[0]
              : rec.mode;

            return (
              <article
                key={rec.id}
                className="bg-[#131826] border border-slate-800/90 rounded-2xl p-4 shadow-md"
              >
                {/* 第一行：股票名、代码、题材 + 次日溢价与操作按钮 */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-lg font-bold text-white">{rec.name}</h2>
                      {rec.code && (
                        <span className="text-xs text-slate-400 font-mono">
                          {rec.code}
                        </span>
                      )}
                      <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {rec.sector}
                      </span>
                    </div>

                    {/* 标签行：模式（含连板分歧水下低吸）、连板高度、情绪、封板结果（含冲板未封） */}
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

                  {/* 右上角：次日溢价 + 编辑/删除 */}
                  <div className="text-right shrink-0">
                    <div className="flex items-center justify-end gap-2">
                      <div>
                        <div className="text-[11px] text-slate-400">次日溢价</div>
                        <div
                          className={`text-lg font-bold font-mono ${
                            isPositive ? 'text-rose-400' : 'text-emerald-400'
                          }`}
                        >
                          {isPositive ? `+${rec.nextDayPremium}%` : `${rec.nextDayPremium}%`}
                        </div>
                        <div
                          className={`text-xs font-mono ${
                            isPositive ? 'text-rose-400/90' : 'text-emerald-400/90'
                          }`}
                        >
                          {isPositive ? `+${profitAmount.toLocaleString()}` : profitAmount.toLocaleString()}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 pl-2 border-l border-slate-800">
                        <button
                          onClick={() => openEditModal(rec)}
                          className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                          title="编辑记录"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteRecord(rec.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800"
                          title="删除记录"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 成交明细 */}
                <div className="mt-3 pt-3 border-t border-slate-800/80 text-xs text-slate-300 space-y-1">
                  <div>日期：{rec.date}</div>
                  <div className="flex items-center gap-4">
                    <span>介入价：{rec.entryPrice}</span>
                    <span>仓位：{rec.positionPct}%</span>
                  </div>
                  <div>金额：{Number(rec.amount).toLocaleString()}</div>
                </div>

                {/* 复盘备注 */}
                {rec.notes && (
                  <div className="mt-3 p-3 rounded-xl bg-[#0D111C] border border-slate-800/80 text-xs text-slate-300 leading-relaxed">
                    {rec.notes}
                  </div>
                )}

                {/* 分时/K线截图预览 */}
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
      </main>

      {/* 底部导航栏 */}
      <nav className="fixed bottom-0 inset-x-0 bg-[#0B0E17]/95 backdrop-blur border-t border-slate-800/80 flex justify-around py-2 text-xs">
        <button
          onClick={() => setActiveTab('stats')}
          className={`flex flex-col items-center gap-1 ${
            activeTab === 'stats' ? 'text-rose-400' : 'text-slate-400'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>统计看板</span>
        </button>
        <button
          onClick={() => setActiveTab('records')}
          className={`flex flex-col items-center gap-1 ${
            activeTab === 'records' ? 'text-rose-400' : 'text-slate-400'
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          <span>复盘记录</span>
        </button>
        <button
          onClick={() => setActiveTab('playbook')}
          className={`flex flex-col items-center gap-1 ${
            activeTab === 'playbook' ? 'text-rose-400' : 'text-slate-400'
          }`}
        >
          <BookOpen className="w-4 h-4" />
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
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 日期与股票代码 */}
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

            {/* 股票名称与题材 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">股票名称 *</label>
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
                <label className="block text-xs text-slate-400 mb-1">所属题材 / 板块</label>
                <input
                  type="text"
                  placeholder="如 农产品加工"
                  value={form.sector}
                  onChange={(e) => setForm({ ...form, sector: e.target.value })}
                  className="w-full bg-[#0D111C] border border-slate-700 rounded-xl px-3 py-2.5 text-sm"
                />
              </div>
            </div>

            {/* 价格、仓位、投入金额 */}
            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="block text-xs text-slate-400 mb-1">介入价格</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="7.11"
                  value={form.entryPrice}
                  onChange={(e) => setForm({ ...form, entryPrice: e.target.value })}
                  className="w-full bg-[#0D111C] border border-slate-700 rounded-xl px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">仓位占比 (%)</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="如 25"
                  value={form.positionPct}
                  onChange={(e) => handlePositionChange(e.target.value)}
                  className="w-full bg-[#0D111C] border border-slate-700 rounded-xl px-3 py-2 text-sm"
                />
