import React from 'react';
import {
  X,
  Server,
  Cpu,
  Activity,
  HardDrive,
  Wifi,
  Radio,
  Send,
  CheckCircle2,
  Terminal,
} from 'lucide-react';
import { ServerNode } from '../types';

interface NodeDetailModalProps {
  node: ServerNode | null;
  onClose: () => void;
  onSendAlert: (node: ServerNode) => void;
  onOpenAdminProbe?: (node: ServerNode) => void;
}

export const NodeDetailModal: React.FC<NodeDetailModalProps> = ({
  node,
  onClose,
  onSendAlert,
  onOpenAdminProbe,
}) => {
  if (!node) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 max-w-xl w-full shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-sky-100 dark:bg-sky-950/80 text-sky-600 dark:text-sky-400 rounded-2xl">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {node.name}
                </h3>
                <span className="px-2 py-0.5 text-xs font-mono uppercase rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  {node.region}
                </span>
                {node.probeInstalled ? (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    探针已接入
                  </span>
                ) : (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                    未装探针
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                上次心跳: {new Date(node.lastHeartbeat).toLocaleTimeString()}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Specs Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
            <div className="text-[11px] text-slate-500 mb-1 flex items-center gap-1">
              <Cpu className="w-3 h-3 text-slate-400" />
              <span>CPU 占用</span>
            </div>
            <div className="text-lg font-bold font-mono text-slate-900 dark:text-white">
              {node.cpu}%
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
            <div className="text-[11px] text-slate-500 mb-1 flex items-center gap-1">
              <Activity className="w-3 h-3 text-slate-400" />
              <span>内存 RAM</span>
            </div>
            <div className="text-lg font-bold font-mono text-slate-900 dark:text-white">
              {node.ram}%
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
            <div className="text-[11px] text-slate-500 mb-1 flex items-center gap-1">
              <HardDrive className="w-3 h-3 text-slate-400" />
              <span>磁盘空间</span>
            </div>
            <div className="text-lg font-bold font-mono text-slate-900 dark:text-white">
              {node.disk}%
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
            <div className="text-[11px] text-slate-500 mb-1 flex items-center gap-1">
              <Wifi className="w-3 h-3 text-slate-400" />
              <span>网络延迟</span>
            </div>
            <div className="text-lg font-bold font-mono text-slate-900 dark:text-white">
              {node.ping}ms
            </div>
          </div>
        </div>

        {/* Detailed Info */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
          <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-700">
            <span className="text-slate-500">操作系统 (OS):</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">{node.os}</span>
          </div>
          {node.loadAvg && (
            <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-700">
              <span className="text-slate-500">平均负载 (Load Average):</span>
              <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                {node.loadAvg}
              </span>
            </div>
          )}
          <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-700">
            <span className="text-slate-500">入网吞吐 / 出网吞吐:</span>
            <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
              {node.networkIn} / {node.networkOut}
            </span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-700">
            <span className="text-slate-500">正常可用时间 (Uptime):</span>
            <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
              {node.uptime}
            </span>
          </div>
          <div className="flex justify-between py-1 items-center">
            <span className="text-slate-500">节点标签 (Tags):</span>
            <div className="flex gap-1">
              {node.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-[10px] text-slate-600 dark:text-slate-300 font-mono"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Action */}
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={() => {
              onSendAlert(node);
              onClose();
            }}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300 border border-sky-200 dark:border-sky-800 hover:bg-sky-100 transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
            <span>推送该节点健康报表至 Telegram</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};
