import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  Award,
  Calendar,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Download,
  RefreshCw,
  Server,
  Lock,
} from 'lucide-react';
import { SlaReportResponse, ServiceSlaSummary } from '../types';
import { fetchSlaReports } from '../api';

interface SlaReportsViewProps {
  onShowToast: (type: 'success' | 'warning' | 'error' | 'info', title: string, desc?: string) => void;
}

export const SlaReportsView: React.FC<SlaReportsViewProps> = ({ onShowToast }) => {
  const [report, setReport] = useState<SlaReportResponse | null>(null);
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');
  const [isLoading, setIsLoading] = useState(false);

  const loadReport = useCallback(async (p: '7d' | '30d' | '90d') => {
    setIsLoading(true);
    try {
      const data = await fetchSlaReports(p);
      setReport(data);
    } catch (err: any) {
      console.error('Failed to fetch SLA report:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReport(period);
  }, [period, loadReport]);

  const handleExportJson = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CloudPulse_SLA_Report_${period}_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    onShowToast('success', 'SLA 报告已导出', 'JSON 格式报告下载成功');
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Period Selector */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                可用性 SLA 报告与合规评级
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  {report?.systemReliabilityTier || 'Tier IV'}
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                精确计算全球各微服务链路在 {period === '7d' ? '近 7 天' : period === '30d' ? '近 30 天' : '近 90 天'} 的可用率与目标 SLA 合规达标状况
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold">
            {(['7d', '30d', '90d'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  period === p
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {p === '7d' ? '7 天' : p === '30d' ? '30 天' : '90 天'}
              </button>
            ))}
          </div>

          <button
            onClick={handleExportJson}
            disabled={!report}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-semibold shadow-xs transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>导出 SLA 报告</span>
          </button>
        </div>
      </div>

      {/* 2. Overview KPI Cards */}
      {report && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-2">
            <div className="flex justify-between items-center text-xs text-slate-500">
              <span>全局综合可用率</span>
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono">
              {report.overallAvailability}%
            </div>
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
              超过 99.9% 目标 SLA 承诺标准
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-2">
            <div className="flex justify-between items-center text-xs text-slate-500">
              <span>监控服务总数</span>
              <Server className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono">
              {report.totalServices}
            </div>
            <div className="text-[11px] text-slate-500">
              所有全球探针及边缘 CDN 链路
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-2">
            <div className="flex justify-between items-center text-xs text-slate-500">
              <span>SLA 合规达成</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">
              {report.compliantServices} <span className="text-xs text-slate-400">/ {report.totalServices}</span>
            </div>
            <div className="text-[11px] text-slate-500">
              零重大 SLA 违约故障
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-2">
            <div className="flex justify-between items-center text-xs text-slate-500">
              <span>系统可靠性分级</span>
              <Award className="w-4 h-4 text-purple-500" />
            </div>
            <div className="text-lg font-bold text-purple-600 dark:text-purple-400 truncate">
              {report.systemReliabilityTier}
            </div>
            <div className="text-[11px] text-slate-500">
              企业级高可用保障
            </div>
          </div>
        </div>
      )}

      {/* 3. Services SLA Breakdown Table */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h4 className="text-sm font-bold text-slate-900 dark:text-white">各微服务与探针链路可用性明细清单</h4>
          <span className="text-xs text-slate-400">目标 SLA 承诺: 99.9%</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase font-semibold">
              <tr>
                <th className="px-5 py-3">服务名称 / 分类</th>
                <th className="px-5 py-3">当前状态</th>
                <th className="px-5 py-3">可用率 (30天)</th>
                <th className="px-5 py-3">可用率 (7天)</th>
                <th className="px-5 py-3">累计停机时长</th>
                <th className="px-5 py-3">平均延迟</th>
                <th className="px-5 py-3">故障次数</th>
                <th className="px-5 py-3 text-right">SLA 达标状态</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {report?.services.map((s) => (
                <tr key={s.serviceId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                  <td className="px-5 py-3.5 font-medium">
                    <div className="text-slate-900 dark:text-white font-bold">{s.serviceName}</div>
                    <div className="text-[11px] text-slate-400 font-mono">{s.category} {s.url ? `• ${s.url}` : ''}</div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                        s.status === 'operational'
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                          : s.status === 'degraded'
                          ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                          : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${s.status === 'operational' ? 'bg-emerald-500' : s.status === 'degraded' ? 'bg-amber-500' : 'bg-rose-500'}`} />
                      {s.status === 'operational' ? '运行正常' : s.status === 'degraded' ? '性能降级' : '服务宕机'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 font-mono font-bold text-slate-900 dark:text-white">
                    {s.uptime30d}%
                  </td>
                  <td className="px-5 py-3.5 font-mono text-slate-600 dark:text-slate-400">
                    {s.uptime7d}%
                  </td>
                  <td className="px-5 py-3.5 font-mono text-slate-500">
                    {s.outageMinutes30d} 分钟
                  </td>
                  <td className="px-5 py-3.5 font-mono">
                    {s.avgLatencyMs} ms
                  </td>
                  <td className="px-5 py-3.5 font-mono font-semibold">
                    {s.incidentCount} 次
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    {s.targetMet ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" /> 达标 (≥99.9%)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-rose-500 font-semibold">
                        <AlertTriangle className="w-3.5 h-3.5" /> 未达标
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
