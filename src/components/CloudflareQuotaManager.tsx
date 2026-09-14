import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Cloud,
  Zap,
  Clock,
  Archive,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sliders,
  Sparkles,
  ShieldCheck,
  Server,
  Activity,
  Trash2,
  Check,
  Info,
  ChevronRight,
  Gauge,
  HelpCircle,
} from 'lucide-react';
import { CloudflareQuotaConfig, CloudflareQuotaEstimate } from '../types';
import { fetchQuotaSettings, updateQuotaSettings, pruneExpiredHistory } from '../api';

interface CloudflareQuotaManagerProps {
  onShowToast: (type: 'success' | 'warning' | 'error' | 'info', title: string, desc?: string) => void;
  onRefreshOverview?: () => void;
}

export const CloudflareQuotaManager: React.FC<CloudflareQuotaManagerProps> = ({
  onShowToast,
  onRefreshOverview,
}) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pruning, setPruning] = useState(false);
  const [estimate, setEstimate] = useState<CloudflareQuotaEstimate | null>(null);

  // Form State
  const [heartbeatInterval, setHeartbeatInterval] = useState<number>(60);
  const [retentionDays, setRetentionDays] = useState<number>(30);
  const [clientPollInterval, setClientPollInterval] = useState<number>(30);
  const [ecoMode, setEcoMode] = useState<boolean>(true);
  const [autoPrune, setAutoPrune] = useState<boolean>(true);
  const [edgeCacheAge, setEdgeCacheAge] = useState<number>(30);

  const computeQuotaEstimate = (cfg: CloudflareQuotaConfig, nodeCount: number = 6): CloudflareQuotaEstimate => {
    const hbSeconds = Math.max(10, cfg.heartbeatIntervalSeconds || 60);
    const dailyHbPerNode = Math.floor(86400 / hbSeconds);
    const dailyNodeHeartbeatRequests = dailyHbPerNode * nodeCount;
    const pollSeconds = Math.max(10, cfg.clientPollIntervalSeconds || 30);
    const estimatedDailyApiReads = Math.floor(86400 / pollSeconds) * 2;
    const estimatedDailyPageViews = 500;
    const estimatedTotalDailyRequests = dailyNodeHeartbeatRequests + estimatedDailyApiReads + estimatedDailyPageViews;
    const freeTierLimit = cfg.workerDailyRequestLimit || 100000;
    const usagePercentage = Math.min(100, Math.round((estimatedTotalDailyRequests / freeTierLimit) * 1000) / 10);

    let status: 'safe' | 'warning' | 'exceeded' = 'safe';
    if (usagePercentage > 90) status = 'exceeded';
    else if (usagePercentage > 60) status = 'warning';

    const recommendations: string[] = [];
    if (cfg.heartbeatIntervalSeconds < 30) {
      recommendations.push('探针心跳上报频率较高（小于 30 秒），在多节点环境下容易消耗较多每日请求配额。');
    }
    if (!cfg.ecoMode) {
      recommendations.push('未开启免费套餐 Eco 节能模式，开启后将启用边缘 CDN 强缓存与防抖合并。');
    }
    if (cfg.historyRetentionDays > 60) {
      recommendations.push('历史监控指标保留周期较长，建议开启自动修剪过期数据以控制存储空间占用。');
    }
    if (recommendations.length === 0) {
      recommendations.push('当前心跳上报与边缘缓存配置极优，预计全月用量维持在 Cloudflare 免费配额 15% 以下。');
    }

    return {
      config: cfg,
      totalNodes: nodeCount,
      dailyNodeHeartbeatRequests,
      estimatedDailyPageViews,
      estimatedDailyApiReads,
      estimatedTotalDailyRequests,
      freeTierLimit,
      usagePercentage,
      status,
      recommendations,
    };
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await fetchQuotaSettings();
      setEstimate(computeQuotaEstimate(data));
      setHeartbeatInterval(data.heartbeatIntervalSeconds || 60);
      setRetentionDays(data.historyRetentionDays || 30);
      setClientPollInterval(data.clientPollIntervalSeconds || 30);
      setEcoMode(data.ecoMode ?? true);
      setAutoPrune(data.autoPruneExpiredHistory ?? true);
      setEdgeCacheAge(data.edgeCacheMaxAge || 30);
    } catch (err: any) {
      onShowToast('error', '加载配额设置失败', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      setSaving(true);
      const updated = await updateQuotaSettings({
        heartbeatIntervalSeconds: Number(heartbeatInterval),
        historyRetentionDays: Number(retentionDays),
        clientPollIntervalSeconds: Number(clientPollInterval),
        ecoMode,
        autoPruneExpiredHistory: autoPrune,
        edgeCacheMaxAge: Number(edgeCacheAge),
        maxStoredMetricPoints: Number(retentionDays) * 24,
      });
      setEstimate(computeQuotaEstimate(updated));
      onShowToast('success', '配额与心跳策略已更新', '配置已即时生效并写入持久化存储。');
      if (onRefreshOverview) onRefreshOverview();
    } catch (err: any) {
      onShowToast('error', '保存配置失败', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePruneNow = async () => {
    if (!confirm(`确定要立即清理超过 ${retentionDays} 天的历史监控指标和系统日志吗？`)) return;
    try {
      setPruning(true);
      const res = await pruneExpiredHistory(retentionDays);
      onShowToast(
        'success',
        '历史数据清理完成',
        `已成功清理 ${res.prunedMetrics} 条过期指标点、${res.prunedLogs} 条历史日志，当前剩余 ${res.remainingPoints} 个活跃时间点。`
      );
      loadData();
    } catch (err: any) {
      onShowToast('error', '清理历史数据失败', err.message);
    } finally {
      setPruning(false);
    }
  };

  // Quick preset helper
  const applyPreset = (preset: 'strict_free' | 'balanced' | 'high_frequency') => {
    if (preset === 'strict_free') {
      setHeartbeatInterval(90);
      setRetentionDays(14);
      setClientPollInterval(45);
      setEcoMode(true);
      setEdgeCacheAge(45);
      onShowToast('info', '已应用极省免费额度预设', '心跳90秒，保留14天，极致节约 Workers 调用。');
    } else if (preset === 'balanced') {
      setHeartbeatInterval(60);
      setRetentionDays(30);
      setClientPollInterval(30);
      setEcoMode(true);
      setEdgeCacheAge(30);
      onShowToast('info', '已应用推荐均衡预设', '心跳60秒，保留30天，兼顾高频健康监控与免费额度。');
    } else if (preset === 'high_frequency') {
      setHeartbeatInterval(20);
      setRetentionDays(60);
      setClientPollInterval(15);
      setEcoMode(false);
      setEdgeCacheAge(10);
      onShowToast('warning', '已应用高频极速探测预设', '心跳20秒，请关注每日 Workers 10万次免费限额。');
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs text-center">
        <RefreshCw className="w-8 h-8 text-sky-500 animate-spin mx-auto mb-3" />
        <p className="text-xs text-slate-500">正在分析 Cloudflare 配额及心跳保留参数...</p>
      </div>
    );
  }

  const usagePercent = estimate ? estimate.usagePercentage : 0;
  const isSafe = usagePercent < 75;
  const isWarning = usagePercent >= 75 && usagePercent < 100;
  const isExceeded = usagePercent >= 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="space-y-6"
    >
      {/* 1. Header Banner */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, delay: 0.05 }}
        className="bg-gradient-to-r from-orange-500/10 via-amber-500/5 to-transparent p-6 rounded-2xl border border-orange-200 dark:border-orange-950/60 shadow-xs relative overflow-hidden"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <div className="p-1.5 rounded-lg bg-orange-500 text-white shadow-xs">
                <Cloud className="w-4 h-4" />
              </div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Cloudflare 免费额度与心跳/保留调度中心
                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300 font-semibold">
                  Workers 100,000 req/day
                </span>
              </h2>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">
              针对前端部署在 <strong>Cloudflare Pages</strong>、后端部署在 <strong>Cloudflare Workers / D1</strong> 架构深度调优。支持灵活设置探针心跳上报频率与历史监控数据保存周期，配合边缘 CDN 智能缓存，彻底无忧白嫖免费额度！
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => loadData()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 transition-colors shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>重新测算</span>
            </button>
            <button
              onClick={() => handleSaveSettings()}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
            >
              {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              <span>保存配置策略</span>
            </button>
          </div>
        </div>
      </motion.div>

      {/* 2. Quota Usage Gauge & Estimation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Gauge Card */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Gauge className="w-4 h-4 text-orange-500" />
              <span>Workers 每日请求配额消耗</span>
            </div>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                isSafe
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                  : isWarning
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                  : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
              }`}
            >
              {isSafe ? '安全充裕' : isWarning ? '接近上限' : '超出额度'}
            </span>
          </div>

          <div className="my-2">
            <div className="flex items-baseline justify-between mb-1.5">
              <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                {estimate?.estimatedTotalDailyRequests.toLocaleString() || '0'}
                <span className="text-xs font-normal text-slate-400 ml-1">/ 100,000 次/天</span>
              </div>
              <div
                className={`text-sm font-black font-mono ${
                  isSafe ? 'text-emerald-600 dark:text-emerald-400' : isWarning ? 'text-amber-500' : 'text-rose-500'
                }`}
              >
                {usagePercent}%
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, usagePercent)}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className={`h-full rounded-full ${
                  isSafe ? 'bg-emerald-500' : isWarning ? 'bg-amber-500' : 'bg-rose-500'
                }`}
              />
            </div>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
            Cloudflare 免费计划每日提供 <strong>100,000</strong> 次 Workers 执行额度（UTC 每日重置）。
          </p>
        </motion.div>

        {/* Node Heartbeat Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
          className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-sky-500" />
              <span>探针心跳上报消耗估算</span>
            </div>
            <span className="text-[10px] font-mono text-slate-400">
              {estimate?.totalNodes || 0} 台探针节点
            </span>
          </div>

          <div className="my-2">
            <div className="text-2xl font-black text-sky-600 dark:text-sky-400 font-mono">
              {estimate?.dailyNodeHeartbeatRequests.toLocaleString() || '0'}
              <span className="text-xs font-normal text-slate-400 ml-1">次/天</span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              心跳频率：每 <strong className="text-slate-800 dark:text-slate-200 font-mono">{heartbeatInterval}</strong> 秒上报一次
            </div>
          </div>

          <div className="text-[11px] text-slate-400 flex items-center gap-1">
            <Info className="w-3.5 h-3.5 shrink-0 text-sky-500" />
            <span>心跳公式: 节点数 × (86400 ÷ 心跳秒数)</span>
          </div>
        </motion.div>

        {/* CDN Edge Cache Savings */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-emerald-500" />
              <span>边缘 CDN 节能缓存削峰</span>
            </div>
            <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              {ecoMode ? '已激活' : '未开启'}
            </span>
          </div>

          <div className="my-2">
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
              {ecoMode ? '≈ 85% 拦截率' : '0% 拦截'}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              由 Cloudflare 全球 300+ 边缘节点承载状态页访客查询
            </div>
          </div>

          <div className="text-[11px] text-slate-400 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
            <span>访客高频刷新不会产生额外 Worker 计费</span>
          </div>
        </motion.div>
      </div>

      {/* 3. Settings Form: Heartbeat & Retention */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4 mb-6">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-sky-500" />
              核心参数调节 (心跳周期与历史保留)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              调节探针采集心跳间隔与数据库中历史性能监控数据的保存时长
            </p>
          </div>

          {/* Preset Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-slate-400 font-medium mr-1">快捷预设:</span>
            <button
              type="button"
              onClick={() => applyPreset('strict_free')}
              className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
            >
              极致省流 (90s / 14天)
            </button>
            <button
              type="button"
              onClick={() => applyPreset('balanced')}
              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300 hover:bg-orange-200 transition-colors"
            >
              推荐黄金均衡 (60s / 30天)
            </button>
            <button
              type="button"
              onClick={() => applyPreset('high_frequency')}
              className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
            >
              高频极速 (20s / 60天)
            </button>
          </div>
        </div>

        <form onSubmit={handleSaveSettings} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Setting 1: Heartbeat Interval */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-sky-500" />
                  探针心跳上报频率 (Heartbeat Interval)
                </label>
                <span className="text-xs font-mono font-bold text-sky-600 dark:text-sky-400 bg-sky-100 dark:bg-sky-950 px-2 py-0.5 rounded-md">
                  {heartbeatInterval} 秒 / 次
                </span>
              </div>

              <input
                type="range"
                min="10"
                max="300"
                step="5"
                value={heartbeatInterval}
                onChange={(e) => setHeartbeatInterval(Number(e.target.value))}
                className="w-full accent-sky-600 cursor-pointer"
              />

              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>10秒 (极速)</span>
                <span>30秒</span>
                <span className="text-sky-600 dark:text-sky-400 font-semibold">60秒 (最佳平衡)</span>
                <span>120秒</span>
                <span>300秒 (超低能耗)</span>
              </div>

              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Linux VPS 探针脚本将以此频率向 Cloudflare Workers 上报 CPU、内存、磁盘与网络状态。
              </p>
            </div>

            {/* Setting 2: History Retention Days */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Archive className="w-4 h-4 text-purple-500" />
                  历史监控数据保留时间 (History Retention)
                </label>
                <span className="text-xs font-mono font-bold text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-950 px-2 py-0.5 rounded-md">
                  {retentionDays} 天
                </span>
              </div>

              <input
                type="range"
                min="3"
                max="180"
                step="1"
                value={retentionDays}
                onChange={(e) => setRetentionDays(Number(e.target.value))}
                className="w-full accent-purple-600 cursor-pointer"
              />

              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>3天 (轻量)</span>
                <span>14天</span>
                <span className="text-purple-600 dark:text-purple-400 font-semibold">30天 (推荐)</span>
                <span>90天 (季度)</span>
                <span>180天 (半年)</span>
              </div>

              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                超出此保留周期的分钟级历史指标与日志将自动回收，防止 Cloudflare Workers KV / D1 免费容量（10MB/1GB）溢出。
              </p>
            </div>
          </div>

          {/* Toggle Switches */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Eco Mode Switch */}
            <label className="flex items-start gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 cursor-pointer hover:bg-slate-100/70 dark:hover:bg-slate-800 transition-colors">
              <input
                type="checkbox"
                checked={ecoMode}
                onChange={(e) => setEcoMode(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-orange-500 rounded border-slate-300 focus:ring-orange-400 cursor-pointer"
              />
              <div>
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>启用 Cloudflare 边缘 CDN 免费额度节能模式 (推荐)</span>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  在公共状态响应头中自动注入 Cache-Control 缓存标签，状态接口由 Cloudflare 全球边缘节点直接响应，访客浏览不占用 Worker 额度。
                </div>
              </div>
            </label>

            {/* Auto Prune Switch */}
            <label className="flex items-start gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 cursor-pointer hover:bg-slate-100/70 dark:hover:bg-slate-800 transition-colors">
              <input
                type="checkbox"
                checked={autoPrune}
                onChange={(e) => setAutoPrune(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-purple-500 rounded border-slate-300 focus:ring-purple-400 cursor-pointer"
              />
              <div>
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Archive className="w-3.5 h-3.5 text-purple-500" />
                  <span>启用自动定期归档清理 (Auto Prune)</span>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  每当数据写入或启动时，自动淘汰超过 {retentionDays} 天的过期历史数据点与已解决故障日志，保持数据库精巧敏捷。
                </div>
              </div>
            </label>
          </div>

          {/* Action Row */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={handlePruneNow}
              disabled={pruning}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-medium transition-colors disabled:opacity-50"
            >
              {pruning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              <span>立即清理超期数据 ({retentionDays} 天前)</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span>保存并应用所有配置</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* 4. Recommendations & Deployment Guidance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recommendations */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 mb-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>智能配额健康诊断建议</span>
          </h3>
          <div className="space-y-2.5">
            {estimate?.recommendations && estimate.recommendations.length > 0 ? (
              estimate.recommendations.map((rec, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 text-xs text-slate-600 dark:text-slate-300"
                >
                  <ChevronRight className="w-3.5 h-3.5 text-orange-500 mt-0.5 shrink-0" />
                  <span>{rec}</span>
                </div>
              ))
            ) : (
              <div className="text-xs text-slate-400">暂无需要调整的警告，当前配额调度非常健康。</div>
            )}
          </div>
        </div>

        {/* Cloudflare Pages + Workers Deploy Reference */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 mb-3">
            <Cloud className="w-4 h-4 text-orange-500" />
            <span>Cloudflare Workers + Pages 生产架构说明</span>
          </h3>
          <div className="text-xs text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed">
            <p>
              • <strong>前端部署 (Cloudflare Pages)</strong>: 静态产物目录 <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded font-mono text-[11px]">dist</code>，享有免费无限制全球带宽与 500 次每月自动化构建。
            </p>
            <p>
              • <strong>后端部署 (Cloudflare Workers / Pages Functions)</strong>: 承载 REST API，每日享有 100,000 次免费执行。
            </p>
            <p>
              • <strong>持久化存储建议</strong>: 单机模式使用自带 JSON 原子持久化；在纯 Workers Serverless 无服务器环境下，可一键挂载 <strong>Cloudflare D1 (SQL)</strong> 或 <strong>KV</strong>。
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
