import React, { useState, useMemo, useCallback } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Area,
  ComposedChart,
} from 'recharts';
import {
  Activity,
  Cpu,
  HardDrive,
  Clock,
  TrendingUp,
  Server,
  Zap,
  Layers,
  ArrowUpRight,
  ShieldAlert,
} from 'lucide-react';
import { MetricHistoryPoint, ServerNode } from '../types';

interface MetricsTrendChartProps {
  history: MetricHistoryPoint[];
  nodes: ServerNode[];
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

type MetricFilter = 'both' | 'cpu' | 'ram' | 'latency';

export const MetricsTrendChart: React.FC<MetricsTrendChartProps> = ({
  history = [],
  nodes = [],
  onRefresh,
  isRefreshing = false,
}) => {
  const safeHistory = useMemo(() => (Array.isArray(history) ? history : []), [history]);
  const safeNodes = useMemo(() => (Array.isArray(nodes) ? nodes : []), [nodes]);
  const [metricFilter, setMetricFilter] = useState<MetricFilter>('both');
  const [selectedNodeId, setSelectedNodeId] = useState<string>('all');

  // Compute live averages and peaks
  const activeNodes = useMemo(() => safeNodes.filter((n) => n.status !== 'offline'), [safeNodes]);
  const currentAvgCpu = useMemo(() => {
    if (activeNodes.length === 0) return 0;
    return Math.round(activeNodes.reduce((acc, n) => acc + n.cpu, 0) / activeNodes.length);
  }, [activeNodes]);

  const currentAvgRam = useMemo(() => {
    if (activeNodes.length === 0) return 0;
    return Math.round(activeNodes.reduce((acc, n) => acc + n.ram, 0) / activeNodes.length);
  }, [activeNodes]);

  const peak24hCpu = useMemo(() => {
    if (!safeHistory || safeHistory.length === 0) return currentAvgCpu;
    return Math.max(...safeHistory.map((h) => h.peakCpu || h.avgCpu));
  }, [safeHistory, currentAvgCpu]);

  const peak24hRam = useMemo(() => {
    if (!safeHistory || safeHistory.length === 0) return currentAvgRam;
    return Math.max(...safeHistory.map((h) => h.peakRam || h.avgRam));
  }, [safeHistory, currentAvgRam]);

  // If a specific node is selected, synthesize data aligned to its current metrics
  const chartData = useMemo(() => {
    if (!safeHistory || safeHistory.length === 0) return [];

    if (selectedNodeId === 'all') {
      return safeHistory;
    }

    const targetNode = safeNodes.find((n) => n.id === selectedNodeId);
    if (!targetNode) return safeHistory;

    // Node-specific trend: scaled smoothly to match the specific node's current readings
    return safeHistory.map((pt, idx) => {
      const isLatest = idx === history.length - 1;
      if (isLatest) {
        return {
          ...pt,
          avgCpu: targetNode.cpu,
          avgRam: targetNode.ram,
          peakCpu: targetNode.cpu,
          peakRam: targetNode.ram,
        };
      }
      // Proportional offset for past hours
      const cpuDelta = (targetNode.cpu - currentAvgCpu);
      const ramDelta = (targetNode.ram - currentAvgRam);
      return {
        ...pt,
        avgCpu: Math.max(5, Math.min(100, Math.round(pt.avgCpu + cpuDelta * 0.8))),
        avgRam: Math.max(10, Math.min(100, Math.round(pt.avgRam + ramDelta * 0.8))),
        peakCpu: Math.max(10, Math.min(100, Math.round(pt.peakCpu + cpuDelta * 0.6))),
        peakRam: Math.max(15, Math.min(100, Math.round(pt.peakRam + ramDelta * 0.6))),
      };
    });
  }, [history, selectedNodeId, nodes, currentAvgCpu, currentAvgRam]);

  // Memoized custom Tooltip renderer to avoid DOM remounts and flickering
  const renderCustomTooltip = useCallback(
    ({ active, payload, label }: any) => {
      if (active && payload && payload.length) {
        const data: MetricHistoryPoint = payload[0].payload;
        return (
          <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-3.5 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 text-xs min-w-[210px] space-y-2">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5 font-medium text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-sky-500" />
                <span>时间: {label}</span>
              </span>
              <span className="font-mono text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300">
                {data.activeNodes || activeNodes.length} 台在线
              </span>
            </div>

            {/* CPU Metric */}
            {(metricFilter === 'both' || metricFilter === 'cpu') && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-sky-600 dark:text-sky-400 font-semibold">
                    <span className="w-2 h-2 rounded-full bg-sky-500" />
                    CPU 负载:
                  </span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {data.avgCpu}%
                    <span className="text-[10px] font-normal text-slate-400 ml-1">
                      (峰值 {data.peakCpu}%)
                    </span>
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-sky-500 transition-all duration-200"
                    style={{ width: `${Math.min(100, data.avgCpu)}%` }}
                  />
                </div>
              </div>
            )}

            {/* RAM Metric */}
            {(metricFilter === 'both' || metricFilter === 'ram') && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400 font-semibold">
                    <span className="w-2 h-2 rounded-full bg-purple-500" />
                    内存利用率:
                  </span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {data.avgRam}%
                    <span className="text-[10px] font-normal text-slate-400 ml-1">
                      (峰值 {data.peakRam}%)
                    </span>
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-purple-500 transition-all duration-200"
                    style={{ width: `${Math.min(100, data.avgRam)}%` }}
                  />
                </div>
              </div>
            )}

            {/* Latency Metric in Tooltip */}
            {(metricFilter === 'both' || metricFilter === 'latency') && typeof data.avgLatency === 'number' && (
              <div className="space-y-1 pt-1 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    平均响应延迟:
                  </span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {data.avgLatency} ms
                    {data.p95Latency && (
                      <span className="text-[10px] font-normal text-slate-400 ml-1">
                        (P95 {data.p95Latency}ms)
                      </span>
                    )}
                  </span>
                </div>
              </div>
            )}

            <div className="pt-1 text-[10px] text-slate-400 dark:text-slate-500 text-right">
              探针实时聚合数据点
            </div>
          </div>
        );
      }
      return null;
    },
    [metricFilter, activeNodes.length]
  );

  return (
    <section
      id="metrics-trend-section"
      className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-6"
    >
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                <span>过去 24 小时集群负载趋势监控</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse" />
                  实时探针流
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                全节点 CPU 及 RAM 资源消耗时序走势，直观把控业务高峰与基础设施压力
              </p>
            </div>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Node Scope Selector */}
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 px-2 py-1 rounded-xl text-xs">
            <Server className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              id="trend-node-selector"
              value={selectedNodeId}
              onChange={(e) => setSelectedNodeId(e.target.value)}
              className="bg-transparent text-slate-700 dark:text-slate-200 text-xs font-medium focus:outline-none cursor-pointer pr-1"
            >
              <option value="all">全部节点平均 (Cluster Avg)</option>
              {nodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name} ({n.region})
                </option>
              ))}
            </select>
          </div>

          {/* Metric View Toggle */}
          <div className="inline-flex p-0.5 bg-slate-100 dark:bg-slate-800/80 rounded-xl text-xs">
            <button
              onClick={() => setMetricFilter('both')}
              className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                metricFilter === 'both'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              综合走势
            </button>
            <button
              onClick={() => setMetricFilter('cpu')}
              className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                metricFilter === 'cpu'
                  ? 'bg-sky-500 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              CPU
            </button>
            <button
              onClick={() => setMetricFilter('ram')}
              className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                metricFilter === 'ram'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              内存 (RAM)
            </button>
            <button
              onClick={() => setMetricFilter('latency')}
              className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                metricFilter === 'latency'
                  ? 'bg-emerald-500 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              响应时延 (ms)
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Current Avg CPU */}
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800/80">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span className="flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-sky-500" />
              当前平均 CPU
            </span>
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                currentAvgCpu > 80
                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                  : currentAvgCpu > 60
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                  : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
              }`}
            >
              {currentAvgCpu > 80 ? '高压' : currentAvgCpu > 60 ? '注意' : '健康'}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-bold font-mono text-slate-900 dark:text-white">
              {currentAvgCpu}%
            </span>
            <span className="text-[11px] text-slate-400">实时计算</span>
          </div>
        </div>

        {/* Card 2: Current Avg RAM */}
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800/80">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-purple-500" />
              当前平均 内存
            </span>
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                currentAvgRam > 85
                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                  : currentAvgRam > 70
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                  : 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300'
              }`}
            >
              {currentAvgRam > 85 ? '紧俏' : currentAvgRam > 70 ? '适中' : '充裕'}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-bold font-mono text-slate-900 dark:text-white">
              {currentAvgRam}%
            </span>
            <span className="text-[11px] text-slate-400">集群占位</span>
          </div>
        </div>

        {/* Card 3: 24h Peak CPU */}
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800/80">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              24小时 CPU 峰值
            </span>
            <ArrowUpRight className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-bold font-mono text-amber-600 dark:text-amber-400">
              {peak24hCpu}%
            </span>
            <span className="text-[11px] text-slate-400">瞬间极值</span>
          </div>
        </div>

        {/* Card 4: 24h Peak RAM */}
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800/80">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span className="flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-rose-500" />
              24小时 内存峰值
            </span>
            <ArrowUpRight className="w-3.5 h-3.5 text-rose-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-bold font-mono text-rose-600 dark:text-rose-400">
              {peak24hRam}%
            </span>
            <span className="text-[11px] text-slate-400">历史高位</span>
          </div>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="w-full h-72 sm:h-80 -ml-2 sm:ml-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 10, right: 15, left: -20, bottom: 0 }}
          >
            <defs>
              <linearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="ramGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#a855f7" stopOpacity={0.22} />
                <stop offset="95%" stopColor="#a855f7" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.28} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="#94a3b8"
              strokeOpacity={0.18}
            />

            <XAxis
              dataKey="timeLabel"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: '#64748b' }}
              interval={2}
            />

            <YAxis
              domain={metricFilter === 'latency' ? [0, (dataMax: number) => Math.max(80, Math.ceil(dataMax * 1.3))] : [0, 100]}
              tickLine={false}
              axisLine={false}
              ticks={metricFilter === 'latency' ? undefined : [0, 25, 50, 75, 100]}
              tickFormatter={(v) => (metricFilter === 'latency' ? `${v}ms` : `${v}%`)}
              tick={{ fontSize: 11, fill: '#64748b' }}
            />

            {/* Warning Reference Line */}
            <ReferenceLine
              y={metricFilter === 'latency' ? 150 : 80}
              stroke="#f43f5e"
              strokeDasharray="4 4"
              strokeOpacity={0.65}
              label={{
                value: metricFilter === 'latency' ? '警戒时延 150ms' : '告警阈值 80%',
                position: 'top',
                fill: '#f43f5e',
                fontSize: 10,
                opacity: 0.8,
              }}
            />

            <Tooltip content={renderCustomTooltip} />

            {/* CPU Area / Line */}
            {(metricFilter === 'both' || metricFilter === 'cpu') && (
              <Area
                type="monotone"
                dataKey="avgCpu"
                stroke="#0ea5e9"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#cpuGradient)"
                name="平均 CPU 负载"
                activeDot={{ r: 5, strokeWidth: 2, fill: '#0ea5e9', stroke: '#ffffff' }}
              />
            )}

            {/* RAM Area / Line */}
            {(metricFilter === 'both' || metricFilter === 'ram') && (
              <Area
                type="monotone"
                dataKey="avgRam"
                stroke="#a855f7"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#ramGradient)"
                name="平均 内存利用率"
                activeDot={{ r: 5, strokeWidth: 2, fill: '#a855f7', stroke: '#ffffff' }}
              />
            )}

            {/* Latency Area / Line */}
            {metricFilter === 'latency' && (
              <Area
                type="monotone"
                dataKey="avgLatency"
                stroke="#10b981"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#latencyGradient)"
                name="响应时延"
                activeDot={{ r: 5, strokeWidth: 2, fill: '#10b981', stroke: '#ffffff' }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Footer Legend & Indicator */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-4">
          {(metricFilter === 'both' || metricFilter === 'cpu') && (
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-1 rounded-full bg-sky-500" />
              <span className="font-medium text-slate-700 dark:text-slate-300">平均 CPU 负载 (%)</span>
            </div>
          )}
          {(metricFilter === 'both' || metricFilter === 'ram') && (
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-1 rounded-full bg-purple-500" />
              <span className="font-medium text-slate-700 dark:text-slate-300">平均 内存利用率 (%)</span>
            </div>
          )}
          {metricFilter === 'latency' && (
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-1 rounded-full bg-emerald-500" />
              <span className="font-medium text-slate-700 dark:text-slate-300">响应时延 (ms)</span>
            </div>
          )}
          <div className="hidden sm:flex items-center gap-1.5 text-slate-400">
            <span className="w-3 h-0 border-t border-dashed border-rose-500" />
            <span>80% 自动告警水位线</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400">采样频率: 每小时聚合 • 探针上报实时刷新</span>
        </div>
      </div>
    </section>
  );
};
