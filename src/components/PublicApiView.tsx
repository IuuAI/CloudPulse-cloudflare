import React, { useState } from 'react';
import {
  Code,
  Terminal,
  Copy,
  Check,
  Play,
  CheckCircle2,
  ExternalLink,
  Shield,
  Layers,
  Sparkles,
  RefreshCw,
  Globe,
  Radio,
} from 'lucide-react';
import { SystemOverview } from '../types';

interface PublicApiViewProps {
  overview?: SystemOverview | null;
  onShowToast: (type: 'success' | 'warning' | 'error' | 'info', title: string, desc?: string) => void;
}

export const PublicApiView: React.FC<PublicApiViewProps> = ({ overview, onShowToast }) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeEndpoint, setActiveEndpoint] = useState<string>('/api/health');
  const [apiResponse, setApiResponse] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://cloudpulse.example.com';

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    onShowToast('success', '已复制到剪贴板');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRunEndpoint = async (path: string) => {
    setActiveEndpoint(path);
    setIsRunning(true);
    try {
      const res = await fetch(path);
      const data = await res.json();
      setApiResponse(JSON.stringify(data, null, 2));
    } catch (err: any) {
      setApiResponse(JSON.stringify({ error: err.message }, null, 2));
    } finally {
      setIsRunning(false);
    }
  };

  const badges = [
    {
      id: 'status-shield',
      title: '系统整体运行状态',
      previewText: overview?.overallStatus === 'all_good' ? 'status: operational' : 'status: degraded',
      badgeColor: overview?.overallStatus === 'all_good' ? 'bg-emerald-500' : 'bg-amber-500',
      markdown: `![System Status](${origin}/api/health)`,
      html: `<a href="${origin}"><img src="${origin}/api/health" alt="System Status" /></a>`,
    },
    {
      id: 'sla-shield',
      title: '30 天 SLA 可用率',
      previewText: `uptime: ${overview?.uptime30d || 99.98}%`,
      badgeColor: 'bg-emerald-500',
      markdown: `![Uptime 30d](${origin}/api/overview)`,
      html: `<a href="${origin}"><img src="${origin}/api/overview" alt="Uptime SLA" /></a>`,
    },
    {
      id: 'nodes-shield',
      title: '全球在线探针节点',
      previewText: `nodes: ${overview?.onlineNodes || 6}/${overview?.totalNodes || 6} online`,
      badgeColor: 'bg-sky-500',
      markdown: `![Edge Nodes](${origin}/api/nodes)`,
      html: `<a href="${origin}"><img src="${origin}/api/nodes" alt="Edge Nodes" /></a>`,
    },
  ];

  const endpoints = [
    {
      method: 'GET',
      path: '/api/health',
      desc: '系统健康检查与边缘 Worker 运行时状态探测',
      sampleParams: '无鉴权限制',
    },
    {
      method: 'GET',
      path: '/api/overview',
      desc: '聚合监控指标（可用率、在线服务数、探针集群概况）',
      sampleParams: '公开只读',
    },
    {
      method: 'GET',
      path: '/api/services',
      desc: '获取全部核心微服务与拨测链路的即时健康状态与延迟',
      sampleParams: '包含 SLA 与响应时延',
    },
    {
      method: 'GET',
      path: '/api/nodes',
      desc: '获取全球多云探针服务器节点列表及实时 CPU/内存使用率',
      sampleParams: '包含多区域坐标与探针数据',
    },
    {
      method: 'GET',
      path: '/api/incidents',
      desc: '获取近期故障事件、维护通告与事件演进时序记录',
      sampleParams: '支持公共订阅',
    },
  ];

  return (
    <div className="space-y-6">
      {/* 1. Header Hero Banner */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
            <Radio className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              开放接口与动态监控徽标 (Public API &amp; Badges)
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                免登录访问
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              为开源项目、GitHub README 与第三方企业系统提供高可用免鉴权的只读状态查询接口与即时 SVG/JSON 状态徽标
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleRunEndpoint('/api/health')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold shadow-xs transition-colors"
          >
            <Play className="w-3.5 h-3.5" />
            <span>立即发起接口测试</span>
          </button>
        </div>
      </div>

      {/* 2. Status Badges Embed Generator */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-500" />
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              嵌入式状态徽标 (Status Badges)
            </h4>
          </div>
          <span className="text-xs text-slate-500">一键复制代码嵌入 GitHub / 文档站</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {badges.map((badge) => (
            <div
              key={badge.id}
              className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850/50 border border-slate-200/60 dark:border-slate-800 flex flex-col justify-between gap-3"
            >
              <div>
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  {badge.title}
                </div>
                {/* Visual badge mock */}
                <div className="inline-flex items-center rounded-md overflow-hidden text-[11px] font-mono shadow-xs border border-slate-300 dark:border-slate-700">
                  <span className="bg-slate-700 text-white px-2 py-0.5 font-medium">CloudPulse</span>
                  <span className={`${badge.badgeColor} text-white px-2 py-0.5 font-semibold`}>
                    {badge.previewText}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-800/80">
                <button
                  onClick={() => handleCopy(badge.markdown, `${badge.id}-md`)}
                  className="flex-1 py-1.5 px-2 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-1"
                >
                  {copiedId === `${badge.id}-md` ? (
                    <Check className="w-3 h-3 text-emerald-500" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                  <span>复制 Markdown</span>
                </button>
                <button
                  onClick={() => handleCopy(badge.html, `${badge.id}-html`)}
                  className="py-1.5 px-2 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-1"
                >
                  {copiedId === `${badge.id}-html` ? (
                    <Check className="w-3 h-3 text-emerald-500" />
                  ) : (
                    <Code className="w-3 h-3" />
                  )}
                  <span>HTML</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. REST API Documentation & Live Runner */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Endpoints List */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Code className="w-4 h-4 text-sky-500" />
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                公共只读 REST API 列表
              </h4>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">CORS 全开</span>
          </div>

          <div className="space-y-2.5">
            {endpoints.map((ep) => (
              <div
                key={ep.path}
                onClick={() => handleRunEndpoint(ep.path)}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  activeEndpoint === ep.path
                    ? 'border-sky-500 bg-sky-50/50 dark:bg-sky-950/20'
                    : 'border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-850/30'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                      {ep.method}
                    </span>
                    <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {ep.path}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopy(`curl -X GET "${origin}${ep.path}"`, ep.path);
                    }}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                    title="复制 cURL"
                  >
                    {copiedId === ep.path ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {ep.desc}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live Runner & Response Console */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-500" />
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                在线响应调试控制台
              </h4>
            </div>
            <button
              onClick={() => handleRunEndpoint(activeEndpoint)}
              disabled={isRunning}
              className="flex items-center gap-1 text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline"
            >
              <RefreshCw className={`w-3 h-3 ${isRunning ? 'animate-spin' : ''}`} />
              <span>重新请求</span>
            </button>
          </div>

          <div className="text-xs font-mono text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-950 p-2.5 rounded-xl flex items-center justify-between">
            <span className="truncate">GET {origin}{activeEndpoint}</span>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold px-1.5 py-0.5 rounded bg-emerald-500/10">
              200 OK
            </span>
          </div>

          <div className="flex-1 bg-slate-950 text-slate-200 p-4 rounded-xl font-mono text-xs overflow-auto max-h-[360px] border border-slate-800">
            {isRunning ? (
              <div className="text-slate-500 flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>正在向边缘节点请求数据...</span>
              </div>
            ) : apiResponse ? (
              <pre className="whitespace-pre-wrap">{apiResponse}</pre>
            ) : (
              <div className="text-slate-500">点击左侧任意接口查看实时 JSON 返回</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
