import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Layers,
  LineChart,
  Activity,
  Server,
  LayoutGrid,
  ArrowRight,
  Cpu,
  HardDrive,
  Clock,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import { SystemOverview, MetricHistoryPoint, ServiceItem, ServerNode } from '../types';
import { StatusBanner } from './StatusBanner';
import { MetricsTrendChart } from './MetricsTrendChart';
import { LatencyTrendDashboard } from './LatencyTrendDashboard';
import { ServiceList } from './ServiceList';
import { NodeList } from './NodeList';

export type OverviewCardId = 'summary' | 'latency' | 'trends' | 'services' | 'nodes' | 'all';

interface OverviewCardDeckProps {
  overview: SystemOverview | null;
  metricsHistory: MetricHistoryPoint[];
  services: ServiceItem[];
  nodes: ServerNode[];
  isRefreshing: boolean;
  onRefreshData: () => void;
  onTriggerServiceAlert: (service: ServiceItem) => void;
  onSelectNode: (node: ServerNode) => void;
  onTriggerNodeAlert: (node: ServerNode) => void;
  onNavigateToTelegram: () => void;
}

export const OverviewCardDeck: React.FC<OverviewCardDeckProps> = ({
  overview,
  metricsHistory = [],
  services = [],
  nodes = [],
  isRefreshing,
  onRefreshData,
  onTriggerServiceAlert,
  onSelectNode,
  onTriggerNodeAlert,
  onNavigateToTelegram,
}) => {
  const safeMetrics = Array.isArray(metricsHistory) ? metricsHistory : [];
  const safeServices = Array.isArray(services) ? services : [];
  const safeNodes = Array.isArray(nodes) ? nodes : [];
  const [activeCard, setActiveCard] = useState<OverviewCardId>('summary');

  // Compute live averages
  const latestPoint = safeMetrics[safeMetrics.length - 1];
  const currentAvgCpu = latestPoint ? latestPoint.avgCpu : 38;
  const currentAvgRam = latestPoint ? latestPoint.avgRam : 62;
  const currentAvgLatency = latestPoint?.avgLatency ?? 32;

  const cardTabs = [
    {
      id: 'summary' as OverviewCardId,
      label: '综合大盘',
      sublabel: 'Summary',
      icon: Layers,
      badge: '聚合看板',
      badgeColor: 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300',
    },
    {
      id: 'latency' as OverviewCardId,
      label: '24h延迟仪表盘',
      sublabel: 'Latency Trends',
      icon: Activity,
      badge: `时延 ${currentAvgLatency}ms (极佳)`,
      badgeColor: 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300',
    },
    {
      id: 'trends' as OverviewCardId,
      label: '24h负载走势',
      sublabel: 'Metrics Trend',
      icon: LineChart,
      badge: `CPU ${currentAvgCpu}% / RAM ${currentAvgRam}%`,
      badgeColor: 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300',
    },
    {
      id: 'services' as OverviewCardId,
      label: '微服务健康',
      sublabel: 'Microservices',
      icon: Activity,
      badge: `${services.filter((s) => s.status === 'operational').length}/${services.length || 6} 正常`,
      badgeColor: 'bg-teal-100 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300',
    },
    {
      id: 'nodes' as OverviewCardId,
      label: '探针服务器集群',
      sublabel: 'Nodes Cluster',
      icon: Server,
      badge: `${nodes.filter((n) => n.status === 'online').length}/${nodes.length || 4} 台在线`,
      badgeColor: 'bg-sky-100 dark:bg-sky-950/80 text-sky-700 dark:text-sky-300',
    },
    {
      id: 'all' as OverviewCardId,
      label: '平铺模式',
      sublabel: 'Show All',
      icon: LayoutGrid,
      badge: '全部展示',
      badgeColor: 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300',
    },
  ];

  return (
    <div id="overview-card-deck-wrapper" className="space-y-6">
      {/* 1. Interactive Card Switcher Bar */}
      <div className="p-2 sm:p-2.5 rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2.5 sm:pb-2 border-b border-slate-100 dark:border-slate-800/80 px-2 pt-1">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                监控大盘卡片式导航
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                可自由切换聚合总览、24h负载走势、微服务链路或探针集群，告别冗长滚动
              </p>
            </div>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 self-end md:self-auto">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>实时探针同步中</span>
          </div>
        </div>

        {/* 6 Card-Style Selector Buttons (Spacious Grid: Mobile 2 cols, Tablet 3 cols, PC 6 cols) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-3.5 pt-3">
          {cardTabs.map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeCard === tab.id;
            return (
              <button
                key={tab.id}
                id={`overview-tab-${tab.id}`}
                onClick={() => setActiveCard(tab.id)}
                className={`relative flex flex-col justify-between p-4 rounded-2xl transition-all duration-200 text-left border min-h-[116px] group ${
                  isSelected
                    ? 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-500/60 shadow-xs ring-2 ring-emerald-500/25'
                    : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700/60 hover:shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-3">
                  <div
                    className={`p-2 rounded-xl shrink-0 transition-transform duration-200 group-hover:scale-105 ${
                      isSelected
                        ? 'bg-emerald-500 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full truncate max-w-[100px] ${tab.badgeColor}`}
                  >
                    {tab.badge}
                  </span>
                </div>

                <div className="w-full">
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={`text-sm font-bold tracking-tight truncate ${
                        isSelected
                          ? 'text-emerald-900 dark:text-emerald-100'
                          : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      {tab.label}
                    </span>
                    <ChevronRight
                      className={`w-3.5 h-3.5 shrink-0 transition-transform ${
                        isSelected
                          ? 'text-emerald-600 dark:text-emerald-400 translate-x-0.5'
                          : 'text-slate-400 opacity-60 group-hover:opacity-100'
                      }`}
                    />
                  </div>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 truncate block mt-0.5">
                    {tab.sublabel}
                  </span>
                </div>

                {isSelected && (
                  <motion.div
                    layoutId="active-card-indicator"
                    className="absolute inset-x-4 bottom-0 h-1 bg-emerald-500 rounded-t-full"
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Switchable Card Content Views */}
      <AnimatePresence mode="wait">
        {/* VIEW 1: Summary Cockpit (Compact & Elegant) */}
        {activeCard === 'summary' && (
          <motion.div
            key="view-summary"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="space-y-6"
          >
            {/* High Level Status Banner */}
            <StatusBanner
              overview={overview}
              onNavigateToTelegram={onNavigateToTelegram}
              onSelectCard={(c) => setActiveCard(c as OverviewCardId)}
            />

            {/* Recharts Visual Dashboard: 24h Response Latency Trend */}
            <LatencyTrendDashboard
              history={metricsHistory}
              nodes={nodes}
              services={services}
              onRefresh={onRefreshData}
              isRefreshing={isRefreshing}
            />

            {/* Bento Quick Cockpit (3 Actionable Cards) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Cockpit Card 1: Load Trends Preview */}
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                        <LineChart className="w-4 h-4" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        24小时负载走势
                      </h4>
                    </div>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-semibold">
                      过去24h
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
                    全集群节点均载动态平稳，过去 24 小时峰值平缓，无过载隐患。
                  </p>

                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                          <Cpu className="w-3.5 h-3.5 text-indigo-500" />
                          集群平均 CPU 负载
                        </span>
                        <span className="font-bold font-mono text-slate-900 dark:text-white">
                          {currentAvgCpu}%
                        </span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, Math.max(5, currentAvgCpu))}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                          <HardDrive className="w-3.5 h-3.5 text-sky-500" />
                          集群平均 RAM 占用
                        </span>
                        <span className="font-bold font-mono text-slate-900 dark:text-white">
                          {currentAvgRam}%
                        </span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-sky-500 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, Math.max(5, currentAvgRam))}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                          <Activity className="w-3.5 h-3.5 text-emerald-500" />
                          全链路平均延迟
                        </span>
                        <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400">
                          {currentAvgLatency} ms
                        </span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, Math.max(8, (currentAvgLatency / 150) * 100))}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-2">
                  <button
                    id="btn-switch-to-latency"
                    onClick={() => setActiveCard('latency')}
                    className="py-2 px-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/70 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 flex items-center justify-center gap-1 transition-colors"
                  >
                    <span>延迟波动时序</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                  <button
                    id="btn-switch-to-trends"
                    onClick={() => setActiveCard('trends')}
                    className="py-2 px-2.5 rounded-xl border border-indigo-200 dark:border-indigo-800/80 bg-indigo-50/70 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 flex items-center justify-center gap-1 transition-colors"
                  >
                    <span>节点硬件负载</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Cockpit Card 2: Microservices Preview */}
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400">
                        <Activity className="w-4 h-4" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        核心微服务健康
                      </h4>
                    </div>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-teal-50 dark:bg-teal-950 text-teal-600 dark:text-teal-400 font-semibold">
                      {safeServices.length || 6} 项服务
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 leading-relaxed">
                    网关、认证授权、API 中心及 PostgreSQL 数据库探活状态良好。
                  </p>

                  {/* Microservices Snapshot rows */}
                  <div className="space-y-1.5">
                    {safeServices.slice(0, 3).map((srv) => (
                      <div
                        key={srv.id}
                        className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-xs"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                          <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                            {srv.name}
                          </span>
                        </div>
                        <span className="text-slate-400 font-mono text-[11px] shrink-0">
                          {srv.latency}ms
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  id="btn-switch-to-services"
                  onClick={() => setActiveCard('services')}
                  className="w-full mt-2 py-2.5 px-3 rounded-xl border border-teal-200 dark:border-teal-800/80 bg-teal-50/70 dark:bg-teal-950/40 hover:bg-teal-100 dark:hover:bg-teal-900/60 text-xs font-semibold text-teal-700 dark:text-teal-300 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span>查看全部 6 个微服务监控</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Cockpit Card 3: Server Nodes Preview */}
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400">
                        <Server className="w-4 h-4" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        探针服务器集群
                      </h4>
                    </div>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-sky-50 dark:bg-sky-950 text-sky-600 dark:text-sky-400 font-semibold">
                      {safeNodes.length || 4} 台在线
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 leading-relaxed">
                    跨香港、新加坡、东京、硅谷四地多云节点，心跳探针周期为 20s。
                  </p>

                  <div className="space-y-1.5">
                    {safeNodes.slice(0, 3).map((node) => (
                      <div
                        key={node.id}
                        onClick={() => onSelectNode(node)}
                        className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs cursor-pointer transition-colors"
                        title="点击查看节点详情"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="text-sm">{node.flagEmoji || '🌐'}</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                            {node.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] font-mono shrink-0">
                          <span className="text-indigo-600 dark:text-indigo-400">
                            CPU {node.cpu}%
                          </span>
                          <ChevronRight className="w-3 h-3 text-slate-400" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  id="btn-switch-to-nodes"
                  onClick={() => setActiveCard('nodes')}
                  className="w-full mt-2 py-2.5 px-3 rounded-xl border border-sky-200 dark:border-sky-800/80 bg-sky-50/70 dark:bg-sky-950/40 hover:bg-sky-100 dark:hover:bg-sky-900/60 text-xs font-semibold text-sky-700 dark:text-sky-300 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span>进入集群拓扑与探针管理</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* VIEW 2: Dedicated 24h Latency Fluctuation Dashboard */}
        {activeCard === 'latency' && (
          <motion.div
            key="view-latency"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <button
                onClick={() => setActiveCard('summary')}
                className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                <span>← 返回综合大盘</span>
              </button>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                卡片模式：24小时响应延迟波动仪表盘
              </div>
            </div>
            <LatencyTrendDashboard
              history={metricsHistory}
              nodes={nodes}
              services={services}
              onRefresh={onRefreshData}
              isRefreshing={isRefreshing}
            />
          </motion.div>
        )}

        {/* VIEW 3: Dedicated 24h Metrics Trend Chart */}
        {activeCard === 'trends' && (
          <motion.div
            key="view-trends"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <button
                onClick={() => setActiveCard('summary')}
                className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                <span>← 返回综合大盘</span>
              </button>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                卡片模式：时序图表
              </div>
            </div>
            <MetricsTrendChart
              history={metricsHistory}
              nodes={nodes}
              onRefresh={onRefreshData}
              isRefreshing={isRefreshing}
            />
          </motion.div>
        )}

        {/* VIEW 4: Dedicated Microservices Health */}
        {activeCard === 'services' && (
          <motion.div
            key="view-services"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <button
                onClick={() => setActiveCard('summary')}
                className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                <span>← 返回综合大盘</span>
              </button>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                卡片模式：微服务状态
              </div>
            </div>
            <ServiceList
              services={services}
              onTriggerAlert={onTriggerServiceAlert}
              onRefreshData={onRefreshData}
            />
          </motion.div>
        )}

        {/* VIEW 5: Dedicated Server Nodes */}
        {activeCard === 'nodes' && (
          <motion.div
            key="view-nodes"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <button
                onClick={() => setActiveCard('summary')}
                className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                <span>← 返回综合大盘</span>
              </button>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                卡片模式：探针服务器集群
              </div>
            </div>
            <NodeList
              nodes={nodes}
              onSelectNode={onSelectNode}
              onTriggerNodeAlert={onTriggerNodeAlert}
              onRefreshData={onRefreshData}
            />
          </motion.div>
        )}

        {/* VIEW 6: Flat View (Show All) */}
        {activeCard === 'all' && (
          <motion.div
            key="view-all"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="space-y-6"
          >
            <StatusBanner
              overview={overview}
              onNavigateToTelegram={onNavigateToTelegram}
              onSelectCard={(c) => setActiveCard(c as OverviewCardId)}
            />
            <LatencyTrendDashboard
              history={metricsHistory}
              nodes={nodes}
              services={services}
              onRefresh={onRefreshData}
              isRefreshing={isRefreshing}
            />
            <MetricsTrendChart
              history={metricsHistory}
              nodes={nodes}
              onRefresh={onRefreshData}
              isRefreshing={isRefreshing}
            />
            <ServiceList
              services={services}
              onTriggerAlert={onTriggerServiceAlert}
              onRefreshData={onRefreshData}
            />
            <NodeList
              nodes={nodes}
              onSelectNode={onSelectNode}
              onTriggerNodeAlert={onTriggerNodeAlert}
              onRefreshData={onRefreshData}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
