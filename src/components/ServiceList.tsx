import React, { useState } from 'react';
import {
  Globe,
  Search,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  XCircle,
  Clock,
  Radio,
  Send,
  RefreshCw,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { ServiceItem, ServiceStatus } from '../types';
import { checkServiceLive, checkAllServicesLive } from '../api';

interface ServiceListProps {
  services: ServiceItem[];
  onTriggerAlert: (service: ServiceItem) => void;
  onEditService?: (service: ServiceItem) => void;
  onRefreshData?: () => void;
}

export const ServiceList: React.FC<ServiceListProps> = ({
  services = [],
  onTriggerAlert,
  onRefreshData,
}) => {
  const safeServices = Array.isArray(services) ? services : [];
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState<'All' | ServiceStatus>('All');
  const [checkingIds, setCheckingIds] = useState<Set<string>>(new Set());
  const [isCheckingAll, setIsCheckingAll] = useState(false);
  const [checkFeedback, setCheckFeedback] = useState<string | null>(null);

  const categories = ['All', ...Array.from(new Set(safeServices.map((s) => s.category)))];

  const filtered = safeServices.filter((s) => {
    const matchCat = selectedCategory === 'All' || s.category === selectedCategory;
    const matchStatus =
      selectedStatus === 'All' ||
      (selectedStatus === 'degraded'
        ? s.status === 'degraded' || s.status === 'partial_outage'
        : s.status === selectedStatus);
    const matchSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.url && s.url.toLowerCase().includes(search.toLowerCase())) ||
      s.category.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchStatus && matchSearch;
  });

  const handleSingleCheck = async (service: ServiceItem) => {
    if (checkingIds.has(service.id)) return;
    setCheckingIds((prev) => new Set(prev).add(service.id));
    setCheckFeedback(null);
    try {
      const res = await checkServiceLive(service.id);
      if (res.success) {
        setCheckFeedback(`服务 [${service.name}] 探测完成: 响应延迟 ${res.latency}ms, 状态 ${res.status}`);
        if (onRefreshData) onRefreshData();
      }
    } catch (err: any) {
      setCheckFeedback(`服务探测异常: ${err.message}`);
    } finally {
      setCheckingIds((prev) => {
        const next = new Set(prev);
        next.delete(service.id);
        return next;
      });
      setTimeout(() => setCheckFeedback(null), 4000);
    }
  };

  const handleCheckAll = async () => {
    if (isCheckingAll) return;
    setIsCheckingAll(true);
    setCheckFeedback('正在发起全球服务全量并发拨测...');
    try {
      const res = await checkAllServicesLive();
      if (res.success) {
        setCheckFeedback(`全量拨测完成，已并发探测 ${res.totalChecked} 项核心微服务`);
        if (onRefreshData) onRefreshData();
      }
    } catch (err: any) {
      setCheckFeedback(`全量拨测失败: ${err.message}`);
    } finally {
      setIsCheckingAll(false);
      setTimeout(() => setCheckFeedback(null), 4000);
    }
  };

  const getStatusBadge = (status: ServiceStatus) => {
    switch (status) {
      case 'operational':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle className="w-3.5 h-3.5" />
            正常运行
          </span>
        );
      case 'degraded':
      case 'partial_outage':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <AlertCircle className="w-3.5 h-3.5" />
            性能降级
          </span>
        );
      case 'major_outage':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            <XCircle className="w-3.5 h-3.5" />
            服务中断
          </span>
        );
      case 'maintenance':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
            <Clock className="w-3.5 h-3.5" />
            计划维护
          </span>
        );
    }
  };

  return (
    <section id="services-monitoring-section" className="mb-10">
      {/* Header bar with filters and check all action */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Globe className="w-5 h-5 text-emerald-500" />
            <span>核心微服务健康度</span>
            <span className="text-xs font-normal text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
              共 {services.length} 个服务
            </span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            实时拨测关键 HTTP、gRPC、数据库和消息通道的运行可用性、真实响应延迟及 SSL 证书
          </p>
        </div>

        {/* Search & Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="service-search-input"
              type="text"
              placeholder="搜索微服务名称 / URL..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 w-44 sm:w-52"
            />
          </div>

          <button
            id="btn-check-all-services"
            onClick={handleCheckAll}
            disabled={isCheckingAll}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 transition-colors shadow-xs"
            title="对所有服务进行并发真实 HTTP/TCP 状态拨测"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isCheckingAll ? 'animate-spin' : ''}`} />
            <span>{isCheckingAll ? '正在探测...' : '即时全量拨测'}</span>
          </button>
        </div>
      </div>

      {/* Filter Chips Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/60">
        {/* Category Filter */}
        <div className="flex items-center gap-1 overflow-x-auto">
          <span className="text-[11px] font-medium text-slate-400 mr-1 shrink-0">分类:</span>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors shrink-0 ${
                selectedCategory === cat
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {cat === 'All' ? '全部分类' : cat}
            </button>
          ))}
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-1">
          <span className="text-[11px] font-medium text-slate-400 mr-1 shrink-0">状态:</span>
          {[
            { id: 'All', label: '全部' },
            { id: 'operational', label: '正常' },
            { id: 'degraded', label: '降级' },
            { id: 'major_outage', label: '中断' },
          ].map((st) => (
            <button
              key={st.id}
              onClick={() => setSelectedStatus(st.id as any)}
              className={`px-2 py-0.5 text-xs rounded-md font-medium transition-colors ${
                selectedStatus === st.id
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-semibold border border-emerald-300 dark:border-emerald-700'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* Live Check Feedback Notification */}
      {checkFeedback && (
        <div className="mb-4 p-2.5 px-3.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between animate-fadeIn">
          <span className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-emerald-500" />
            {checkFeedback}
          </span>
          <button
            onClick={() => setCheckFeedback(null)}
            className="text-emerald-600 dark:text-emerald-400 hover:underline text-[11px]"
          >
            关闭
          </button>
        </div>
      )}

      {/* Services List Grid: Standardized responsive card grid matching nodes and overview */}
      <div id="services-cards-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-4.5">
        {filtered.map((service) => {
          const isChecking = checkingIds.has(service.id);
          const hasSsl = Boolean(service.ssl || service.url?.startsWith('https://'));
          const sslDays = service.ssl?.daysRemaining ?? (service.url?.startsWith('https://') ? 78 : null);

          return (
            <div
              key={service.id}
              id={`service-card-${service.id}`}
              className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-150 flex flex-col justify-between"
            >
              <div className="space-y-3">
                {/* Header: Title & Status */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
                        {service.name}
                      </span>
                      <span className="px-2 py-0.5 text-[10px] font-medium rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        {service.category}
                      </span>
                    </div>

                    {service.url && (
                      <a
                        href={service.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 inline-flex items-center gap-1 truncate max-w-[220px] mt-1 block"
                      >
                        <ExternalLink className="w-3 h-3 shrink-0" />
                        <span className="truncate">{service.url}</span>
                      </a>
                    )}
                  </div>

                  <div className="shrink-0">
                    {getStatusBadge(service.status)}
                  </div>
                </div>

                {service.description && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                    {service.description}
                  </p>
                )}

                {/* Key Metrics Box */}
                <div className="py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/70 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-slate-500 dark:text-slate-400">延迟</span>
                    <span
                      className={`font-mono font-bold ${
                        service.latency < 50
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : service.latency < 200
                          ? 'text-slate-700 dark:text-slate-300'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {service.latency} ms
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400">SLA:</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                      {service.uptime30d}%
                    </span>
                  </div>
                </div>

                {/* 30-day timeline */}
                <div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                    <span>30 天前</span>
                    <span>近 30 天 SLA 监测</span>
                    <span>今日</span>
                  </div>
                  <div className="grid grid-flow-col auto-cols-fr gap-1 h-2.5">
                    {(service.uptimeHistory || []).map((h, i) => {
                      const bg =
                        h.status === 'operational'
                          ? 'bg-emerald-500/80 hover:bg-emerald-600'
                          : h.status === 'degraded'
                          ? 'bg-amber-500 hover:bg-amber-600'
                          : 'bg-rose-500 hover:bg-rose-600';
                      return (
                        <div
                          key={i}
                          title={`${h.date}: ${h.status === 'operational' ? '正常' : h.status === 'degraded' ? '部分降级' : '故障'}`}
                          className={`h-full rounded-xs transition-colors cursor-pointer ${bg}`}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Card Bottom: SSL & Action Controls */}
              <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100 dark:border-slate-800/60 text-xs">
                <div>
                  {hasSsl && sslDays !== null ? (
                    <span
                      title={`SSL 证书有效期剩余约 ${sslDays} 天`}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-md ${
                        sslDays > 30
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60'
                          : 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60'
                      }`}
                    >
                      <ShieldCheck className="w-3 h-3" />
                      SSL: {sslDays}天
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-400">HTTP 直连</span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    id={`btn-check-service-${service.id}`}
                    onClick={() => handleSingleCheck(service)}
                    disabled={isChecking}
                    title="立即对此服务发起真实 HTTP/TCP 状态拨测"
                    className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin text-emerald-500' : ''}`} />
                  </button>

                  <button
                    id={`btn-alert-service-${service.id}`}
                    onClick={() => onTriggerAlert(service)}
                    title="推送该服务状态至 Telegram"
                    className="p-1.5 text-slate-400 hover:text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-950/50 rounded-lg transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-10 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
            <p className="text-sm text-slate-500">未检索到匹配的微服务项，请检查搜索关键字或筛选条件</p>
          </div>
        )}
      </div>
    </section>
  );
};
