// 验证并扫描当前域名下所有 localStorage 数据，同时复制 + 下载备份
const handleVerifyLocalStorage = () => {
  try {
    const allItems = {};
    const summary = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      const rawVal = localStorage.getItem(key) ?? '';
      allItems[key] = rawVal;

      let recordCountInfo = `${rawVal.length} 字符`;
      try {
        const parsed = JSON.parse(rawVal);
        if (Array.isArray(parsed)) {
          recordCountInfo = `数组 · ${parsed.length} 条记录`;
        } else if (parsed && typeof parsed === 'object') {
          recordCountInfo = `对象 · ${Object.keys(parsed).length} 个字段`;
        }
      } catch {
        // 普通字符串值保持字符数统计
      }

      summary.push(`• ${key} (${recordCountInfo})`);
    }

    const exportText = JSON.stringify(allItems, null, 2);

    // 尝试复制到剪贴板
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(exportText).catch(() => {});
    }

    // 触发下载 .json 备份文件
    const blob = new Blob([exportText], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `boardmaster-verify-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);

    if (summary.length === 0) {
      alert('当前域名 localStorage 为空（0 项）。请确认当前打开的是否为平时记账的网址。');
    } else {
      alert(
        `共扫描到 ${summary.length} 项（已尝试复制并下载 JSON 备份）：\n\n` +
          summary.join('\n')
      );
    }
  } catch (err) {
    alert(`验证出错：${err.message}`);
  }
};
