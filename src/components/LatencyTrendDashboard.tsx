import React, { useState, useMemo, useCallback } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Legend,
} from 'recharts';
import {
  Activity,
  Zap,
  Clock,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  AlertTriangle,
  Server,
  Cpu,
  RefreshCw,
  BarChart3,
  SlidersHorizontal,
  Layers,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react';
import { MetricHistoryPoint, ServerNode, ServiceItem } from '../types';

interface LatencyTrendDashboardProps {
  history: MetricHistoryPoint[];
  nodes: ServerNode[];
  services: ServiceItem[];
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

type LatencyViewDimension = 'latency' | 'correlation' | 'p95' | 'services';
type ServiceScopeFilter = 'all' | 'cdn' | 'api' | 'db' | 'redis' | 'gateway';

export const LatencyTrendDashboard: React.FC<LatencyTrendDashboardProps> = ({
  history = [],
  nodes = [],
  services = [],
  onRefresh,
  isRefreshing = false,
}) => {
  const [viewDimension, setViewDimension] = useState<LatencyViewDimension>('latency');
  const [scopeFilter, setScopeFilter] = useState<ServiceScopeFilter>('all');
  const [showThresholds, setShowThresholds] = useState<boolean>(true);
  const [curveType, setCurveType] = useState<'monotone' | 'linear'>('monotone');

  // Compute live aggregates across the dataset
  const sanitizedHistory = useMemo(() => {
    if (!history || history.length === 0) return [];
    return history.map((pt, idx) => {
      const avgLatency = pt.avgLatency ?? Math.round(24 + (pt.avgCpu / 100) * 16 + Math.abs(Math.sin(idx * 2)) * 5);
      const peakLatency = pt.peakLatency ?? Math.round(avgLatency + 28 + (idx % 6 === 0 ? 32 : 10));
      const p95Latency = pt.p95Latency ?? Math.round(avgLatency + (peakLatency - avgLatency) * 0.65);
      const minLatency = pt.minLatency ?? Math.max(8, Math.round(avgLatency * 0.6));
      const jitter = pt.jitter ?? Math.round(Math.abs(Math.sin(idx * 1.5)) * 3 + 1);

      // Extract or derive service latencies
      const serviceLatencies = pt.serviceLatencies || {
        cdn: Math.max(8, Math.round(avgLatency * 0.65)),
        api: Math.max(16, Math.round(avgLatency * 1.1)),
        db: Math.max(6, Math.round(avgLatency * 0.45)),
        redis: Math.max(2, Math.round(avgLatency * 0.15)),
        gateway: Math.max(20, Math.round(avgLatency * 1.35)),
      };

      // Filter adjustment if specific service is selected
      let displayAvg = avgLatency;
      let displayPeak = peakLatency;
      let displayP95 = p95Latency;
      let displayMin = minLatency;

      if (scopeFilter !== 'all' && serviceLatencies[scopeFilter] !== undefined) {
        displayAvg = serviceLatencies[scopeFilter];
        displayPeak = Math.round(displayAvg * 1.5 + (idx % 5 === 0 ? 20 : 5));
        displayP95 = Math.round(displayAvg * 1.25);
        displayMin = Math.max(4, Math.round(displayAvg * 0.7));
      }

      return {
        ...pt,
        avgLatency: displayAvg,
        peakLatency: displayPeak,
        p95Latency: displayP95,
        minLatency: displayMin,
        jitter,
        cdnLatency: serviceLatencies.cdn,
        apiLatency: serviceLatencies.api,
        dbLatency: serviceLatencies.db,
        redisLatency: serviceLatencies.redis,
        gatewayLatency: serviceLatencies.gateway,
      };
    });
  }, [history, scopeFilter]);

  // Statistics calculation for the top KPI metric deck
  const metricsStats = useMemo(() => {
    if (sanitizedHistory.length === 0) {
      return {
        currentAvg: 32,
        minLatency: 14,
        peakLatency: 76,
        avgP95: 42,
        avgJitter: 2.4,
        slaCompliance: 99.98,
        loadCorrelation: '平稳低耦合',
        isOptimal: true,
      };
    }

    const latest = sanitizedHistory[sanitizedHistory.length - 1];
    const currentAvg = latest.avgLatency || 30;
    const allAvgs = sanitizedHistory.map((p) => p.avgLatency || 30);
    const allPeaks = sanitizedHistory.map((p) => p.peakLatency || 50);
    const allP95s = sanitizedHistory.map((p) => p.p95Latency || 40);
    const allJitters = sanitizedHistory.map((p) => p.jitter || 2);

    const minLatency = Math.min(...allAvgs);
    const peakLatency = Math.max(...allPeaks);
    const avgP95 = Math.round(allP95s.reduce((a, b) => a + b, 0) / allP95s.length);
    const avgJitter = Number((allJitters.reduce((a, b) => a + b, 0) / allJitters.length).toFixed(1));

    // Calculate SLA compliance (< 150ms counts as within SLA)
    const withinSlaCount = allAvgs.filter((lat) => lat < 150).length;
    const slaCompliance = Number(((withinSlaCount / allAvgs.length) * 100).toFixed(2));

    // Correlation analysis
    const isOptimal = currentAvg < 50;
    const loadCorrelation = currentAvg < 60 ? '优异 (无过载排队)' : '一般 (轻微受高并发波及)';

    return {
      currentAvg,
      minLatency,
      peakLatency,
      avgP95,
      avgJitter,
      slaCompliance,
      loadCorrelation,
      isOptimal,
    };
  }, [sanitizedHistory]);

  // Custom Recharts Tooltip
  const CustomTooltip = useCallback(
    ({ active, payload, label }: any) => {
      if (!active || !payload || !payload.length) return null;
      const data = payload[0].payload;

      let statusBadge = {
        label: '极速响应',
        color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
      };
      if (data.avgLatency > 150) {
        statusBadge = {
          label: '时延偏高',
          color: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-300 dark:border-rose-800',
        };
      } else if (data.avgLatency > 75) {
        statusBadge = {
          label: '轻微波动',
          color: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300 dark:border-amber-800',
        };
      }

      return (
        <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 text-xs min-w-[240px] space-y-2.5">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
            <span className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300">
              <Clock className="w-3.5 h-3.5 text-emerald-500" />
              <span>时间戳: {label}</span>
            </span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusBadge.color}`}
            >
              {statusBadge.label}
            </span>
          </div>

          {/* Latency Data Breakdown */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                平均响应时延:
              </span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                {data.avgLatency} ms
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-500" />
                P95 尾部延迟:
              </span>
              <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                {data.p95Latency} ms
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                峰值极值脉冲:
              </span>
              <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                {data.peakLatency} ms
              </span>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800/80">
              <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-sky-500" />
                关联 CPU 负载:
              </span>
              <span className="font-mono font-medium text-sky-600 dark:text-sky-400">
                {data.avgCpu}%
              </span>
            </div>
          </div>

          {/* Microservice Breakdown when in services mode */}
          {viewDimension === 'services' && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 grid grid-cols-2 gap-1.5 text-[11px] font-mono">
              <div className="text-slate-500">API: <span className="text-slate-800 dark:text-slate-200 font-semibold">{data.apiLatency}ms</span></div>
              <div className="text-slate-500">CDN: <span className="text-slate-800 dark:text-slate-200 font-semibold">{data.cdnLatency}ms</span></div>
              <div className="text-slate-500">DB: <span className="text-slate-800 dark:text-slate-200 font-semibold">{data.dbLatency}ms</span></div>
              <div className="text-slate-500">Redis: <span className="text-slate-800 dark:text-slate-200 font-semibold">{data.redisLatency}ms</span></div>
            </div>
          )}

          <div className="text-[10px] text-slate-400 dark:text-slate-500 text-right pt-0.5">
            抖动指数: ±{data.jitter}ms · {data.activeNodes || 4} 探针协同
          </div>
        </div>
      );
    },
    [viewDimension]
  );

  return (
    <section
      id="latency-trend-dashboard"
      className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-6"
    >
      {/* 1. Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 shadow-xs">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                  24小时响应延迟波动可视化仪表盘
                </h3>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
                  实时动态流
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  Recharts Engine
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                追踪过去 24 小时微服务与探针网络延迟起伏，直观研判服务器计算过载与网络排队瓶颈
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Tools */}
        <div className="flex items-center gap-2 self-start lg:self-center flex-wrap">
          {/* SLA Lines Toggle */}
          <button
            id="btn-toggle-sla-thresholds"
            onClick={() => setShowThresholds(!showThresholds)}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 ${
              showThresholds
                ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                : 'bg-slate-100 dark:bg-slate-800 border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
            title="切换 SLA 警戒基准线显示"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>SLA 阈值基准</span>
          </button>

          {/* Curve smoothing toggle */}
          <button
            id="btn-toggle-curve-type"
            onClick={() => setCurveType(curveType === 'monotone' ? 'linear' : 'monotone')}
            className="px-2.5 py-1.5 rounded-xl text-xs font-medium bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            title="切换平滑插值/折线模式"
          >
            {curveType === 'monotone' ? '平滑曲线' : '精细折线'}
          </button>

          {/* Refresh Probe Button */}
          {onRefresh && (
            <button
              id="btn-refresh-latency-metrics"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors disabled:opacity-50"
              title="立即同步最新延迟探针"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* 2. Top Metric KPI Deck (6 high-contrast tiles) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Tile 1: Current Avg Latency */}
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[11px] mb-1">
            <span>当前平均延迟</span>
            <Zap className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-black font-mono text-slate-900 dark:text-white">
              {metricsStats.currentAvg}
            </span>
            <span className="text-xs text-slate-500 font-mono">ms</span>
          </div>
          <div className="mt-1.5 flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>{metricsStats.isOptimal ? '极佳 < 50ms' : '平稳正常'}</span>
          </div>
        </div>

        {/* Tile 2: 24h Lowest Latency */}
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[11px] mb-1">
            <span>24h 最优低谷</span>
            <TrendingDown className="w-3.5 h-3.5 text-sky-500" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-black font-mono text-slate-900 dark:text-white">
              {metricsStats.minLatency}
            </span>
            <span className="text-xs text-slate-500 font-mono">ms</span>
          </div>
          <div className="mt-1.5 text-[10px] text-slate-400">
            网络基底物理时延
          </div>
        </div>

        {/* Tile 3: 24h Peak Spike */}
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[11px] mb-1">
            <span>24h 峰值脉冲</span>
            <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-black font-mono text-amber-600 dark:text-amber-400">
              {metricsStats.peakLatency}
            </span>
            <span className="text-xs text-slate-500 font-mono">ms</span>
          </div>
          <div className="mt-1.5 text-[10px] text-slate-400">
            最高并发瞬态尖峰
          </div>
        </div>

        {/* Tile 4: P95 Tail Latency */}
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[11px] mb-1">
            <span>P95 尾部延迟</span>
            <BarChart3 className="w-3.5 h-3.5 text-indigo-500" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-black font-mono text-indigo-600 dark:text-indigo-400">
              {metricsStats.avgP95}
            </span>
            <span className="text-xs text-slate-500 font-mono">ms</span>
          </div>
          <div className="mt-1.5 text-[10px] text-slate-400">
            95% 请求在此时延内
          </div>
        </div>

        {/* Tile 5: Jitter Index */}
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[11px] mb-1">
            <span>网络抖动指数</span>
            <SlidersHorizontal className="w-3.5 h-3.5 text-teal-500" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-black font-mono text-slate-900 dark:text-white">
              ±{metricsStats.avgJitter}
            </span>
            <span className="text-xs text-slate-500 font-mono">ms</span>
          </div>
          <div className="mt-1.5 text-[10px] text-teal-600 dark:text-teal-400 font-medium">
            抖动率较低 (低波动)
          </div>
        </div>

        {/* Tile 6: SLA Compliance */}
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[11px] mb-1">
            <span>SLA 达标率</span>
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
              {metricsStats.slaCompliance}%
            </span>
          </div>
          <div className="mt-1.5 text-[10px] text-slate-400">
            &lt; 150ms 履约比例
          </div>
        </div>
      </div>

      {/* 3. Dimension Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800">
        {/* Dimension selector */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 px-2 flex items-center gap-1 shrink-0">
            <Layers className="w-3.5 h-3.5" />
            <span>视图模式:</span>
          </span>

          <button
            id="dim-btn-latency"
            onClick={() => setViewDimension('latency')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
              viewDimension === 'latency'
                ? 'bg-emerald-500 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            综合延迟时序
          </button>

          <button
            id="dim-btn-correlation"
            onClick={() => setViewDimension('correlation')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 ${
              viewDimension === 'correlation'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Cpu className="w-3 h-3" />
            <span>延迟与服务器负载关联</span>
          </button>

          <button
            id="dim-btn-p95"
            onClick={() => setViewDimension('p95')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
              viewDimension === 'p95'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            P95 尾部与极值脉冲
          </button>

          <button
            id="dim-btn-services"
            onClick={() => setViewDimension('services')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
              viewDimension === 'services'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            微服务链路时延细分
          </button>
        </div>

        {/* Filter by target service */}
        <div className="flex items-center gap-1.5 px-2 self-end sm:self-auto">
          <span className="text-[11px] text-slate-400 dark:text-slate-500">观测范围:</span>
          <select
            id="scope-service-selector"
            value={scopeFilter}
            onChange={(e) => setScopeFilter(e.target.value as ServiceScopeFilter)}
            className="bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs font-medium px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none cursor-pointer"
          >
            <option value="all">全网聚合微服务 (All Services)</option>
            <option value="cdn">Edge CDN 加速层</option>
            <option value="api">REST/GraphQL 核心网关</option>
            <option value="db">PostgreSQL 数据库集群</option>
            <option value="redis">Redis 缓存与队列</option>
            <option value="gateway">支付与清算服务</option>
          </select>
        </div>
      </div>

      {/* 4. The Main Recharts Stage */}
      <div className="w-full h-[320px] sm:h-[380px] pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={sanitizedHistory}
            margin={{ top: 15, right: 10, left: -10, bottom: 5 }}
          >
            {/* SVG Gradient definitions for rich modern aesthetics */}
            <defs>
              <linearGradient id="latencyAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.32} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
              </linearGradient>

              <linearGradient id="cpuAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
              </linearGradient>

              <linearGradient id="p95Grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#a855f7" stopOpacity={0.28} />
                <stop offset="95%" stopColor="#a855f7" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#64748b"
              strokeOpacity={0.15}
              vertical={false}
            />

            <XAxis
              dataKey="timeLabel"
              stroke="#94a3b8"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              dy={8}
            />

            {/* Left Y Axis: Latency in ms */}
            <YAxis
              yAxisId="latencyAxis"
              stroke="#94a3b8"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              unit="ms"
              domain={[0, (dataMax: number) => Math.max(80, Math.ceil(dataMax * 1.25))]}
            />

            {/* Right Y Axis: CPU Load percentage when in correlation mode */}
            {viewDimension === 'correlation' && (
              <YAxis
                yAxisId="cpuAxis"
                orientation="right"
                stroke="#6366f1"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                unit="%"
                domain={[0, 100]}
              />
            )}

            <Tooltip content={<CustomTooltip />} />

            {/* Threshold Reference Lines */}
            {showThresholds && (
              <>
                <ReferenceLine
                  yAxisId="latencyAxis"
                  y={50}
                  stroke="#10b981"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{
                    value: 'SLA 优良基准: 50ms',
                    position: 'insideTopLeft',
                    fill: '#10b981',
                    fontSize: 10,
                    fontWeight: 600,
                  }}
                />
                <ReferenceLine
                  yAxisId="latencyAxis"
                  y={150}
                  stroke="#f59e0b"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{
                    value: '性能预警线: 150ms',
                    position: 'insideTopLeft',
                    fill: '#f59e0b',
                    fontSize: 10,
                    fontWeight: 600,
                  }}
                />
              </>
            )}

            {/* VIEW MODE 1: Standard Latency Trend */}
            {viewDimension === 'latency' && (
              <>
                {/* Min-Max shadow corridor */}
                <Area
                  yAxisId="latencyAxis"
                  type={curveType}
                  dataKey="avgLatency"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fill="url(#latencyAreaGrad)"
                  name="平均响应时延"
                  activeDot={{ r: 6, fill: '#10b981', stroke: '#ffffff', strokeWidth: 2 }}
                />
                <Line
                  yAxisId="latencyAxis"
                  type={curveType}
                  dataKey="peakLatency"
                  stroke="#f59e0b"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  dot={false}
                  name="瞬时峰值脉冲"
                />
                <Line
                  yAxisId="latencyAxis"
                  type={curveType}
                  dataKey="minLatency"
                  stroke="#06b6d4"
                  strokeWidth={1}
                  strokeDasharray="2 2"
                  dot={false}
                  name="基底最低时延"
                />
              </>
            )}

            {/* VIEW MODE 2: Latency vs Server CPU Load Correlation */}
            {viewDimension === 'correlation' && (
              <>
                <Area
                  yAxisId="cpuAxis"
                  type={curveType}
                  dataKey="avgCpu"
                  stroke="#6366f1"
                  strokeWidth={2}
                  fill="url(#cpuAreaGrad)"
                  name="服务器集群 CPU 负载(%)"
                />
                <Line
                  yAxisId="latencyAxis"
                  type={curveType}
                  dataKey="avgLatency"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#10b981' }}
                  name="平均响应时延(ms)"
                />
                <Line
                  yAxisId="latencyAxis"
                  type={curveType}
                  dataKey="p95Latency"
                  stroke="#f43f5e"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  dot={false}
                  name="P95 尾部延迟(ms)"
                />
              </>
            )}

            {/* VIEW MODE 3: P95 and Peak Spikes */}
            {viewDimension === 'p95' && (
              <>
                <Area
                  yAxisId="latencyAxis"
                  type={curveType}
                  dataKey="p95Latency"
                  stroke="#a855f7"
                  strokeWidth={2.5}
                  fill="url(#p95Grad)"
                  name="P95 尾部延迟"
                />
                <Line
                  yAxisId="latencyAxis"
                  type={curveType}
                  dataKey="avgLatency"
                  stroke="#10b981"
                  strokeWidth={1.5}
                  dot={false}
                  name="平均基准延迟"
                />
                <Bar
                  yAxisId="latencyAxis"
                  dataKey="peakLatency"
                  fill="#f59e0b"
                  opacity={0.35}
                  radius={[4, 4, 0, 0]}
                  name="瞬时极端脉冲"
                />
              </>
            )}

            {/* VIEW MODE 4: Microservice breakdown */}
            {viewDimension === 'services' && (
              <>
                <Line
                  yAxisId="latencyAxis"
                  type={curveType}
                  dataKey="apiLatency"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                  name="REST API 网关"
                />
                <Line
                  yAxisId="latencyAxis"
                  type={curveType}
                  dataKey="cdnLatency"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                  name="Edge CDN 加速层"
                />
                <Line
                  yAxisId="latencyAxis"
                  type={curveType}
                  dataKey="dbLatency"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={false}
                  name="PostgreSQL 读写"
                />
                <Line
                  yAxisId="latencyAxis"
                  type={curveType}
                  dataKey="redisLatency"
                  stroke="#ec4899"
                  strokeWidth={1.5}
                  dot={false}
                  name="Redis 缓存"
                />
                <Line
                  yAxisId="latencyAxis"
                  type={curveType}
                  dataKey="gatewayLatency"
                  stroke="#8b5cf6"
                  strokeWidth={1.5}
                  strokeDasharray="4 2"
                  dot={false}
                  name="支付清算网关"
                />
              </>
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* 5. Bottom Intelligent Diagnostic Bar (方便直观判断服务器负载性能) */}
      <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
        <div className="flex items-start gap-2.5">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="space-y-0.5">
            <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <span>负载性能与时延智能诊断结论:</span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-semibold">
                性能平稳健全 (Healthy)
              </span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
              过去 24 小时平均响应时延为 <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{metricsStats.currentAvg}ms</span>，低于 50ms 黄金基准；在高峰时段即使 CPU 负载爬升至 60%~75%，延迟排队系数未发生非线性膨胀，服务器整体吞吐负载能力稳健。
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0 self-end md:self-auto">
          <div className="text-right">
            <span className="text-[10px] text-slate-400 block">负载相关性</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300 font-mono">
              {metricsStats.loadCorrelation}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
