import React from 'react';
import { X, Shield, Globe, Activity, CheckCircle2, Server, ArrowRight, Eye } from 'lucide-react';
import { SystemOverview, ServerNode, ServiceItem, Incident } from '../types';

interface DemoModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  overview: SystemOverview | null;
  nodes: ServerNode[];
  services: ServiceItem[];
  incidents: Incident[];
  onOpenAdmin: () => void;
}

export const DemoModeModal: React.FC<DemoModeModalProps> = ({
  isOpen,
  onClose,
  overview,
  nodes,
  services,
  incidents,
  onOpenAdmin,
}) => {
  if (!isOpen) return null;

  const operationalServices = services.filter((s) => s.status === 'operational');
  const activeIncidents = incidents.filter((i) => i.status !== 'resolved');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  CloudPulse 公开状态快照 (Demo Mode)
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  Live Snapshot
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                当前为免登录访客预览视图，展示集群公开运行指标与服务状态快照
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Overview Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <span className="text-[11px] text-slate-500 font-medium">总体运行状态</span>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                {overview?.overallStatus === 'all_good' ? '全部正常运行' : '部分服务异常'}
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <span className="text-[11px] text-slate-500 font-medium">30天平均 SLA</span>
            <div className="text-sm font-bold text-slate-900 dark:text-white mt-1 font-mono">
              {overview?.uptime30d !== undefined ? `${overview.uptime30d}%` : '99.98%'}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <span className="text-[11px] text-slate-500 font-medium">在线探针节点</span>
            <div className="text-sm font-bold text-slate-900 dark:text-white mt-1 font-mono">
              {nodes.filter(n => n.status === 'online').length} / {nodes.length}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <span className="text-[11px] text-slate-500 font-medium">活动故障事件</span>
            <div className={`text-sm font-bold mt-1 font-mono ${activeIncidents.length > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {activeIncidents.length} 起
            </div>
          </div>
        </div>

        {/* Public Services Preview */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              核心服务监控状态 ({operationalServices.length}/{services.length} 正常)
            </h4>
            <span className="text-[11px] text-slate-400">公开只读</span>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {services.slice(0, 5).map((service) => (
              <div
                key={service.id}
                className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-800/30 text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <span className={`w-2 h-2 rounded-full ${service.status === 'operational' ? 'bg-emerald-500' : service.status === 'degraded' ? 'bg-amber-500' : 'bg-red-500'}`} />
                  <span className="font-semibold text-slate-900 dark:text-white">{service.name}</span>
                </div>
                <div className="flex items-center gap-3 text-slate-500">
                  <span className="font-mono">{service.latency}ms</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono">
                    {service.uptime30d}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Global Probes Snapshot */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            全球代表性节点快照
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {nodes.slice(0, 4).map((node) => (
              <div key={node.id} className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-base">{node.flagEmoji || '🌐'}</span>
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white">{node.name}</div>
                    <div className="text-[10px] text-slate-500">{node.region}</div>
                  </div>
                </div>
                <div className="text-right font-mono text-[11px]">
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{node.ping}ms</span>
                  <div className="text-[10px] text-slate-400">CPU {node.cpu}%</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="text-xs text-slate-500">
            想管理探针节点、配置 Telegram 机器人或查看完整审计日志？
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              关闭预览
            </button>
            <button
              onClick={() => {
                onClose();
                onOpenAdmin();
              }}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-purple-600 hover:bg-purple-700 text-white shadow-sm transition-colors"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>管理员登录后台</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
