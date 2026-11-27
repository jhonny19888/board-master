import React, { useState, useEffect, useMemo } from 'react';
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
  Wallet,
  ShieldCheck,
  TrendingUp,
  Layers,
} from 'lucide-react';

const STORAGE_KEY = 'boardmaster_records_v22';
const INIT_FLAG_KEY = 'boardmaster_initialized_v22';
const CAPITAL_STORAGE_KEY = 'boardmaster_total_capital_v22';

const BOARD_LADDER_LEVELS = [
  '首板',
  '2板',
  '3板',
  '4板',
  '5板',
  '6进7板+',
];

// 打板模式（含“连板分歧水下低吸”）
const STRATEGY_MODES = [
  '半路（板前卡位博弈）',
  '排板（确定性封单）',
  '扫板（点火瞬间抢筹）',
  '连板分歧水下低吸',
  '龙头首阴反包',
];

// 封板状态（含“冲板未封”）
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

// 自动压缩上传的截图，防止撑爆 localStorage 容量导致保存失败
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
  if (height.includes('5板以上') || height.includes('5板及以上')) return '6进7板+';
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

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    } catch (err) {
      console.error('保存失败:', err);
      alert('本地存储空间已满，当前记录可能未保存成功！建议先删除部分带截图的旧记录。');
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
      sealStatus: prev
