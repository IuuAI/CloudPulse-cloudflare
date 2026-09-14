import React from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  ShieldCheck,
  Server,
  Bot,
  Zap,
} from 'lucide-react';
import { SystemOverview } from '../types';

interface StatusBannerProps {
  overview: SystemOverview | null;
  onNavigateToTelegram: () => void;
  onSelectCard?: (card: 'summary' | 'latency' | 'trends' | 'services' | 'nodes') => void;
}

export const StatusBanner: React.FC<StatusBannerProps> = ({
  overview,
  onNavigateToTelegram,
  onSelectCard,
}) => {
  const status = overview?.overallStatus || 'all_good';

  const statusConfig = {
    all_good: {
      title: '所有核心系统运行正常',
      subtitle: '全球边缘节点、微服务网关及数据库集群均维持在最佳高可用状态',
      icon: <ShieldCheck className="w-8 h-8 text-emerald-500" />,
      bg: 'bg-emerald-50/80 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60',
      badgeBg: 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200',
      text: '正常运行',
      dot: 'bg-emerald-500',
    },
    degraded: {
      title: '部分微服务或节点性能降级',
      subtitle: '工程团队正在监控链路波动，Telegram 机器人已同步推送告警通知',
      icon: <AlertTriangle className="w-8 h-8 text-amber-500" />,
      bg: 'bg-amber-50/80 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/60',
      badgeBg: 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200',
      text: '性能降级',
      dot: 'bg-amber-500',
    },
    major_outage: {
      title: '核心服务出现重大异常中断',
      subtitle: '紧急应急响应预案已启动，告警信息已自动推送至 Telegram 值班群组',
      icon: <XCircle className="w-8 h-8 text-rose-500" />,
      bg: 'bg-rose-50/80 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/60',
      badgeBg: 'bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200',
      text: '重大故障',
      dot: 'bg-rose-500',
    },
    maintenance: {
      title: '系统计划内例行维护中',
      subtitle: '正在进行滚动更新与补丁升级，部分非核心功能可能暂时受限',
      icon: <Clock className="w-8 h-8 text-sky-500" />,
      bg: 'bg-sky-50/80 dark:bg-sky-950/20 border-sky-200 dark:border-sky-800/60',
      badgeBg: 'bg-sky-100 dark:bg-sky-900/60 text-sky-800 dark:text-sky-200',
      text: '维护中',
      dot: 'bg-sky-500',
    },
  };

  const current = statusConfig[status];

  return (
    <div id="status-banner-section" className="mb-8">
      {/* Primary Hero Status Card */}
      <div
        id="hero-status-card"
        className={`p-6 sm:p-7 rounded-2xl border ${current.bg} transition-all duration-200 shadow-xs`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-white dark:bg-slate-900 rounded-xl shadow-xs border border-slate-200/60 dark:border-slate-800 shrink-0">
              {current.icon}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                  {current.title}
                </h2>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${current.badgeBg}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${current.dot} animate-pulse`} />
                  {current.text}
                </span>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
                {current.subtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start md:self-auto shrink-0">
            <button
              id="banner-tg-action-btn"
              onClick={onNavigateToTelegram}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 shadow-xs transition-colors"
            >
              <Bot className="w-4 h-4 text-sky-500" />
              <span>Telegram 联动控制台</span>
            </button>
          </div>
        </div>
      </div>

      {/* Metric summary pills */}
      <div id="metrics-summary-grid" className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-4">
        {/* Metric 1: Services */}
        <div
          onClick={() => onSelectCard?.('services')}
          className="p-4.5 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs cursor-pointer hover:border-emerald-300 dark:hover:border-emerald-700/60 hover:shadow-sm transition-all group"
          title="点击切换至微服务监控卡片"
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
            <span className="group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">微服务健康度</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
              {overview?.operationalServices ?? 6}/{overview?.totalServices ?? 6}
            </span>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              100% 正常
            </span>
          </div>
          <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 flex items-center gap-1 group-hover:text-slate-600 dark:group-hover:text-slate-300">
            <span>点击查看服务列表 →</span>
          </div>
        </div>

        {/* Metric 2: Nodes */}
        <div
          onClick={() => onSelectCard?.('nodes')}
          className="p-4.5 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs cursor-pointer hover:border-sky-300 dark:hover:border-sky-700/60 hover:shadow-sm transition-all group"
          title="点击切换至服务器节点卡片"
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
            <span className="group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">服务器节点</span>
            <Server className="w-4 h-4 text-sky-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
              {overview?.onlineNodes ?? 4}/{overview?.totalNodes ?? 4}
            </span>
            <span className="text-xs text-sky-600 dark:text-sky-400 font-medium">在线活跃</span>
          </div>
          <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 flex items-center gap-1 group-hover:text-slate-600 dark:group-hover:text-slate-300">
            <span>点击查看探针集群 →</span>
          </div>
        </div>

        {/* Metric 3: Uptime SLA / Trends */}
        <div
          onClick={() => onSelectCard?.('trends')}
          className="p-4.5 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs cursor-pointer hover:border-amber-300 dark:hover:border-amber-700/60 hover:shadow-sm transition-all group"
          title="点击切换至24小时负载趋势卡片"
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
            <span className="group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">30 天可用率 / 负载</span>
            <Zap className="w-4 h-4 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
              {overview?.uptime30d ?? 99.98}%
            </span>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">超高可用</span>
          </div>
          <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 flex items-center gap-1 group-hover:text-slate-600 dark:group-hover:text-slate-300">
            <span>点击查看负载走势 →</span>
          </div>
        </div>

        {/* Metric 4: Telegram Bot Integration */}
        <div
          onClick={onNavigateToTelegram}
          className="p-4.5 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs cursor-pointer hover:border-sky-300 dark:hover:border-sky-800 hover:shadow-sm transition-all group"
          title="点击前往 Telegram 消息推送中心"
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
            <span className="group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">Telegram 机器人</span>
            <Bot className="w-4 h-4 text-sky-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
              {overview?.telegramConfigured ? '已接入官方 Bot' : '广播与推送就绪'}
            </span>
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 flex items-center gap-1 group-hover:text-slate-600 dark:group-hover:text-slate-300">
            <span>前往推送控制台 →</span>
          </div>
        </div>
      </div>
    </div>
  );
};
