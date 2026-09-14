import React, { useState } from 'react';
import {
  Server,
  Cpu,
  HardDrive,
  Activity,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Send,
  Sliders,
  Search,
  RefreshCw,
  Tag,
  Wifi,
} from 'lucide-react';
import { ServerNode } from '../types';
import { simulateNodeProbe } from '../api';

interface NodeListProps {
  nodes: ServerNode[];
  onSelectNode: (node: ServerNode) => void;
  onTriggerNodeAlert: (node: ServerNode) => void;
  onRefreshData?: () => void;
}

export const NodeList: React.FC<NodeListProps> = ({
  nodes = [],
  onSelectNode,
  onTriggerNodeAlert,
  onRefreshData,
}) => {
  const safeNodes = Array.isArray(nodes) ? nodes : [];
  const [search, setSearch] = useState('');
  const [filterRegion, setFilterRegion] = useState('All');
  const [filterStatus, setFilterStatus] = useState<'All' | 'online' | 'degraded' | 'offline'>('All');
  const [probingIds, setProbingIds] = useState<Set<string>>(new Set());

  const regions = ['All', ...Array.from(new Set(safeNodes.map((n) => n.region)))];

  const filtered = safeNodes.filter((n) => {
    const matchRegion = filterRegion === 'All' || n.region === filterRegion;
    const matchStatus = filterStatus === 'All' || n.status === filterStatus;
    const q = search.toLowerCase();
    const matchSearch =
      n.name.toLowerCase().includes(q) ||
      n.region.toLowerCase().includes(q) ||
      n.ip.toLowerCase().includes(q) ||
      (n.tags && n.tags.some((t) => t.toLowerCase().includes(q)));
    return matchRegion && matchStatus && matchSearch;
  });

  const handleSimulateProbe = async (node: ServerNode, e: React.MouseEvent) => {
    e.stopPropagation();
    if (probingIds.has(node.id)) return;
    setProbingIds((prev) => new Set(prev).add(node.id));
    try {
      await simulateNodeProbe(node.id);
      if (onRefreshData) onRefreshData();
    } catch (err) {
      console.warn('Probe simulation request error:', err);
    } finally {
      setTimeout(() => {
        setProbingIds((prev) => {
          const next = new Set(prev);
          next.delete(node.id);
          return next;
        });
      }, 600);
    }
  };

  const getStatusBadge = (status: ServerNode['status']) => {
    switch (status) {
      case 'online':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle className="w-3 h-3" />
            在线
          </span>
        );
      case 'degraded':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <AlertTriangle className="w-3 h-3" />
            高负载
          </span>
        );
      case 'offline':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            <XCircle className="w-3 h-3" />
            离线
          </span>
        );
    }
  };

  return (
    <section id="nodes-monitoring-section" className="mb-10">
      {/* Header bar with title and search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Server className="w-5 h-5 text-sky-500" />
            <span>基础设施节点集群</span>
            <span className="text-xs font-normal text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
              共 {nodes.length} 个节点
            </span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            实时监控全球部署的物理机及云节点 CPU、内存、磁盘利用率、网络吞吐量及探针心跳
          </p>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="node-search-input"
              type="text"
              placeholder="搜索节点名称 / 区域 / 标签..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-sky-500 w-44 sm:w-56"
            />
          </div>
        </div>
      </div>

      {/* Filter Chips Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/60">
        {/* Region Filter */}
        <div className="flex items-center gap-1 overflow-x-auto">
          <span className="text-[11px] font-medium text-slate-400 mr-1 shrink-0">区域:</span>
          {regions.map((reg) => (
            <button
              key={reg}
              onClick={() => setFilterRegion(reg)}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors shrink-0 ${
                filterRegion === reg
                  ? 'bg-sky-600 text-white font-semibold shadow-xs'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {reg === 'All' ? '全部区域' : reg}
            </button>
          ))}
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-1">
          <span className="text-[11px] font-medium text-slate-400 mr-1 shrink-0">状态:</span>
          {[
            { id: 'All', label: '全部' },
            { id: 'online', label: '在线' },
            { id: 'degraded', label: '高负载' },
            { id: 'offline', label: '离线' },
          ].map((st) => (
            <button
              key={st.id}
              onClick={() => setFilterStatus(st.id as any)}
              className={`px-2 py-0.5 text-xs rounded-md font-medium transition-colors ${
                filterStatus === st.id
                  ? 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 font-semibold border border-sky-300 dark:border-sky-700'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* Nodes Grid: Standardized responsive card grid matching services and overview */}
      <div id="nodes-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-4.5">
        {filtered.map((node) => {
          const isProbing = probingIds.has(node.id);
          const cpuColor = node.cpu > 80 ? 'bg-rose-500' : node.cpu > 60 ? 'bg-amber-500' : 'bg-emerald-500';
          const ramColor = node.ram > 85 ? 'bg-rose-500' : node.ram > 70 ? 'bg-amber-500' : 'bg-sky-500';

          return (
            <div
              key={node.id}
              id={`node-card-${node.id}`}
              className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-150 flex flex-col justify-between"
            >
              {/* Top Header */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-slate-900 dark:text-white">
                      {node.name}
                    </span>
                    <span className="px-2 py-0.5 text-[10px] font-mono uppercase rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      {node.region}
                    </span>
                  </div>

                  {/* Node Tags */}
                  {node.tags && node.tags.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      {node.tags.map((t, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400"
                        >
                          <Tag className="w-2.5 h-2.5 text-slate-400" />
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {getStatusBadge(node.status)}

                  {/* Simulate Probe Refresh Button */}
                  <button
                    onClick={(e) => handleSimulateProbe(node, e)}
                    disabled={isProbing}
                    title="立即触发心跳上报与指标模拟"
                    className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/50 rounded-lg transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isProbing ? 'animate-spin text-sky-500' : ''}`} />
                  </button>

                  {/* Trigger Telegram Alert button */}
                  <button
                    onClick={() => onTriggerNodeAlert(node)}
                    title="推送该节点状态至 Telegram"
                    className="p-1.5 text-slate-400 hover:text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-950/50 rounded-lg transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Resource Metrics Bar */}
              <div className="space-y-3 my-4">
                {/* CPU */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <Cpu className="w-3.5 h-3.5 text-slate-400" />
                      处理器 (CPU)
                    </span>
                    <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                      {node.cpu}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${cpuColor}`}
                      style={{ width: `${node.cpu}%` }}
                    />
                  </div>
                </div>

                {/* RAM */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-slate-400" />
                      内存 (RAM)
                    </span>
                    <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                      {node.ram}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${ramColor}`}
                      style={{ width: `${node.ram}%` }}
                    />
                  </div>
                </div>

                {/* Disk */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <HardDrive className="w-3.5 h-3.5 text-slate-400" />
                      磁盘空间
                    </span>
                    <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                      {node.disk}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-slate-400 dark:bg-slate-600 transition-all duration-300"
                      style={{ width: `${node.disk}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Bottom stats and action */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1">
                    <Wifi className="w-3 h-3 text-slate-400" />
                    Ping: <strong className="font-mono text-slate-700 dark:text-slate-300">{node.ping}ms</strong>
                  </span>
                  <span>
                    入网: <strong className="font-mono text-slate-700 dark:text-slate-300">{node.networkIn}</strong>
                  </span>
                </div>

                <button
                  id={`view-node-${node.id}`}
                  onClick={() => onSelectNode(node)}
                  className="flex items-center gap-1 text-sky-600 dark:text-sky-400 font-medium hover:underline text-xs"
                >
                  <Sliders className="w-3 h-3" />
                  <span>详细指标与脚本</span>
                </button>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="col-span-full text-center py-10 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
            <p className="text-sm text-slate-500">未检索到匹配的基础设施节点，请调整搜索条件</p>
          </div>
        )}
      </div>
    </section>
  );
};
