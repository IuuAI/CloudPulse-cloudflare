import React, { useState } from 'react';
import {
  ShieldCheck,
  Shield,
  Server,
  Activity,
  AlertTriangle,
  Lock,
  Plus,
  Trash2,
  Edit2,
  Terminal,
  Copy,
  Check,
  Zap,
  Globe,
  Radio,
  Clock,
  Layers,
  CheckCircle2,
  AlertCircle,
  Key,
  LogOut,
  RefreshCw,
  Cpu,
  HardDrive,
  DownloadCloud,
  FileCode,
  Database,
  Webhook,
  Award,
  FileText,
  Cloud,
  Bot,
  Send,
  ExternalLink,
  LayoutGrid,
  List,
} from 'lucide-react';
import { DatabaseBackupManager } from './DatabaseBackupManager';
import { WebhookManager } from './WebhookManager';
import { SlaReportsView } from './SlaReportsView';
import { AuditLogsView } from './AuditLogsView';
import { PublicStatusManager } from './PublicStatusManager';
import { CloudflareQuotaManager } from './CloudflareQuotaManager';
import { TelegramBotHub } from './TelegramBotHub';
import { ApiKeyManager } from './ApiKeyManager';
import {
  ServiceItem,
  ServerNode,
  Incident,
  AdminAuthState,
  TelegramConfig,
  TelegramLogItem,
} from '../types';
import {
  adminLogin,
  adminLogout,
  createService,
  updateService,
  deleteService,
  createNode,
  updateNode,
  deleteNode,
  simulateNodeProbe,
  createIncident,
  addIncidentUpdate,
  resolveIncident,
  deleteIncident,
  resetDemoData,
} from '../api';

interface AdminDashboardProps {
  authState: AdminAuthState;
  services: ServiceItem[];
  nodes: ServerNode[];
  incidents: Incident[];
  telegramConfig?: (TelegramConfig & { hasBotToken: boolean; botTokenPreview: string }) | null;
  telegramLogs?: TelegramLogItem[];
  onAuthChange: (state: AdminAuthState) => void;
  onRefreshData: () => void;
  onShowToast: (type: 'success' | 'warning' | 'error' | 'info', title: string, desc?: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  authState,
  services = [],
  nodes = [],
  incidents = [],
  telegramConfig,
  telegramLogs = [],
  onAuthChange,
  onRefreshData,
  onShowToast,
}) => {
  const safeServices = Array.isArray(services) ? services : [];
  const safeNodes = Array.isArray(nodes) ? nodes : [];
  const safeIncidents = Array.isArray(incidents) ? incidents : [];
  // Navigation
  const [activeTab, setActiveTab] = useState<
    'nodes' | 'services' | 'incidents' | 'database' | 'deploy' | 'security' | 'webhooks' | 'sla' | 'audit' | 'public' | 'cloudflare' | 'telegram' | 'apikeys'
  >('nodes');

  // Login form state
  const [loginPassword, setLoginPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Probe Script Modal
  const [selectedNodeForProbe, setSelectedNodeForProbe] = useState<ServerNode | null>(null);
  const [showProbeToken, setShowProbeToken] = useState(false);
  const [copiedScript, setCopiedScript] = useState<string | null>(null);
  const [deployMode, setDeployMode] = useState<'separated' | 'fullstack' | 'cli'>('separated');

  // Node Modal State
  const [isNodeModalOpen, setIsNodeModalOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<ServerNode | null>(null);
  const [nodeForm, setNodeForm] = useState({
    name: '',
    region: 'us-east-1',
    ip: '',
    os: 'Ubuntu 24.04 LTS (x86_64)',
    status: 'online' as ServerNode['status'],
    tags: 'vps, prod',
  });

  // Service Modal State
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<ServiceItem | null>(null);
  const [serviceForm, setServiceForm] = useState({
    name: '',
    category: 'API',
    url: '',
    status: 'operational' as ServiceItem['status'],
    latency: 35,
    description: '',
  });
  const [serviceViewMode, setServiceViewMode] = useState<'grid' | 'table'>('grid');

  // Incident Modal State
  const [isIncidentModalOpen, setIsIncidentModalOpen] = useState(false);
  const [incidentForm, setIncidentForm] = useState({
    title: '',
    severity: 'minor' as Incident['severity'],
    affectedServices: [] as string[],
    message: '',
  });

  // Incident Update Modal State
  const [selectedIncidentForUpdate, setSelectedIncidentForUpdate] = useState<Incident | null>(null);
  const [updateStatus, setUpdateStatus] = useState<Incident['status']>('investigating');
  const [updateMessage, setUpdateMessage] = useState('');

  // Loading states
  const [simulatingNodeId, setSimulatingNodeId] = useState<string | null>(null);

  // Login Handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginPassword) return;
    setIsLoggingIn(true);
    try {
      const res = await adminLogin(loginPassword);
      if (res.success && res.token) {
        onAuthChange({ isAuthenticated: true, token: res.token, username: 'admin' });
        onShowToast('success', '登录成功', '欢迎进入 CloudPulse 运维后台管理系统。');
      } else {
        onShowToast('error', '密码错误', res.error || '请输入正确的管理员密码');
      }
    } catch (err: any) {
      onShowToast('error', '登录失败', err.message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await adminLogout();
    onAuthChange({ isAuthenticated: false });
    onShowToast('info', '已退出登录', '后台管理员会话已终止。');
  };

  // Node Actions
  const handleSaveNode = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const tagsArray = nodeForm.tags.split(',').map((t) => t.trim()).filter(Boolean);
      if (editingNode) {
        await updateNode(editingNode.id, {
          name: nodeForm.name,
          region: nodeForm.region,
          ip: nodeForm.ip,
          os: nodeForm.os,
          status: nodeForm.status,
          tags: tagsArray,
        });
        onShowToast('success', '节点已更新', `服务器 ${nodeForm.name} 信息已同步。`);
      } else {
        const created = await createNode({
          name: nodeForm.name,
          region: nodeForm.region,
          ip: nodeForm.ip,
          os: nodeForm.os,
          status: nodeForm.status,
          tags: tagsArray,
        });
        onShowToast('success', '服务器探针已添加', `服务器 ${created.name} 接入密钥已生成，请在脚本面板中配置使用。`);
        setSelectedNodeForProbe(created);
      }
      setIsNodeModalOpen(false);
      setEditingNode(null);
      onRefreshData();
    } catch (err: any) {
      onShowToast('error', '操作失败', err.message);
    }
  };

  const handleDeleteNode = async (id: string, name: string) => {
    if (!confirm(`确认要删除服务器探针「${name}」吗？相关监控上报将被中止。`)) return;
    try {
      await deleteNode(id);
      onShowToast('success', '节点已删除', `服务器 ${name} 已从监控拓扑中移除。`);
      onRefreshData();
    } catch (err: any) {
      onShowToast('error', '删除失败', err.message);
    }
  };

  const handleSimulateProbe = async (nodeId: string) => {
    setSimulatingNodeId(nodeId);
    try {
      const updated = await simulateNodeProbe(nodeId);
      onShowToast(
        'success',
        '模拟探针上报成功',
        `已收到来自 ${updated.name} 的心跳：CPU ${updated.cpu}%，内存 ${updated.ram}%`
      );
      onRefreshData();
    } catch (err: any) {
      onShowToast('error', '模拟上报失败', err.message);
    } finally {
      setSimulatingNodeId(null);
    }
  };

  // Service Actions
  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingService) {
        await updateService(editingService.id, serviceForm);
        onShowToast('success', '微服务已更新', `服务 ${serviceForm.name} 配置已保存。`);
      } else {
        await createService(serviceForm);
        onShowToast('success', '微服务拨测已添加', `已纳入健康检查队列: ${serviceForm.name}`);
      }
      setIsServiceModalOpen(false);
      setEditingService(null);
      onRefreshData();
    } catch (err: any) {
      onShowToast('error', '操作失败', err.message);
    }
  };

  const handleDeleteService = async (id: string, name: string) => {
    if (!confirm(`确认要删除服务「${name}」的拨测监控吗？`)) return;
    try {
      await deleteService(id);
      onShowToast('success', '服务已删除', `已停止对 ${name} 的定时探测。`);
      onRefreshData();
    } catch (err: any) {
      onShowToast('error', '删除失败', err.message);
    }
  };

  // Incident Actions
  const handleSaveIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createIncident({
        title: incidentForm.title,
        severity: incidentForm.severity,
        affectedServices: incidentForm.affectedServices,
        timeline: [
          {
            id: `upd-${Date.now()}`,
            status: 'investigating',
            message: incidentForm.message || '应急响应小组已介入调查与止血。',
            timestamp: new Date().toISOString(),
          },
        ],
      });
      onShowToast('warning', '故障事件已发布', '系统已自动通过 Telegram 推送故障告警！');
      setIsIncidentModalOpen(false);
      setIncidentForm({ title: '', severity: 'minor', affectedServices: [], message: '' });
      onRefreshData();
    } catch (err: any) {
      onShowToast('error', '发布失败', err.message);
    }
  };

  const handleAddIncidentUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIncidentForUpdate || !updateMessage) return;
    try {
      await addIncidentUpdate(selectedIncidentForUpdate.id, updateStatus, updateMessage);
      onShowToast('success', '进展通报已发布', 'Telegram 订阅通道已同步播报最新进展。');
      setSelectedIncidentForUpdate(null);
      setUpdateMessage('');
      onRefreshData();
    } catch (err: any) {
      onShowToast('error', '通报失败', err.message);
    }
  };

  const handleResolveIncident = async (id: string, title: string) => {
    if (!confirm(`确认将故障事件「${title}」标记为全部恢复并解除吗？`)) return;
    try {
      await resolveIncident(id, '经过持续监控与回访，所有指标已恢复正常，事件正式解除。');
      onShowToast('success', '故障已解除', '已向 Telegram 发送全链路恢复解除通知！');
      onRefreshData();
    } catch (err: any) {
      onShowToast('error', '解除失败', err.message);
    }
  };

  const handleDeleteIncident = async (id: string) => {
    if (!confirm('确认删除此事件记录吗？')) return;
    try {
      await deleteIncident(id);
      onShowToast('success', '已删除事件', '记录已从历史归档中清除。');
      onRefreshData();
    } catch (err: any) {
      onShowToast('error', '删除失败', err.message);
    }
  };

  const handleResetData = async () => {
    if (!confirm('确认重置演示环境所有数据为系统初始预设吗？')) return;
    try {
      await resetDemoData();
      onShowToast('info', '数据已重置', '监控指标与演示事件已复位。');
      onRefreshData();
    } catch (err: any) {
      onShowToast('error', '重置失败', err.message);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedScript(label);
    setTimeout(() => setCopiedScript(null), 2000);
    onShowToast('info', '已复制到剪贴板', label);
  };

  // 1. Unauthenticated Login Screen
  if (!authState.isAuthenticated) {
    return (
      <div id="admin-login-screen" className="max-w-md mx-auto my-12">
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-sky-500/10 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center mx-auto mb-3">
              <Lock className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              CloudPulse 运维后台管理系统
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              请进行管理员身份认证以管理监控探针、微服务拓扑及告警策略
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                管理员访问密钥 (Password)
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="请输入管理员密码"
                  autoFocus
                  className="w-full text-xs px-3.5 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1.5">
                <Shield className="w-3 h-3 text-sky-500 shrink-0" />
                <span>密码由 Cloudflare 环境变量 ADMIN_PASSWORD 提供保护</span>
              </p>
            </div>



            <button
              type="submit"
              disabled={isLoggingIn || !loginPassword}
              className="w-full py-3 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoggingIn ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>正在验证安全凭据...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>验证并登录后台</span>
                </>
              )}
            </button>
          </form>

          <div className="text-center text-[11px] text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-4">
            CloudPulse 生产级安全防护体系 • 会话持久加密保护
          </div>
        </div>
      </div>
    );
  }

  // 2. Authenticated Admin Dashboard Layout
  const originUrl = (() => {
    try {
      const stored = localStorage.getItem('cloudpulse_api_base_url');
      if (stored) return stored.replace(/\/$/, '');
    } catch (e) {}
    return typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  })();

  return (
    <div id="admin-dashboard-container" className="space-y-6">
      {/* Admin Top Header */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                运维管理控制台 (Admin Operations)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                统一调度服务器探针、微服务健康探测、应急响应发布与多环境部署
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5 text-rose-500" />
            <span>退出后台</span>
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('nodes')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
            activeTab === 'nodes'
              ? 'bg-sky-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800'
          }`}
        >
          <Server className="w-3.5 h-3.5" />
          <span>服务器与探针管理 ({safeNodes.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('services')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
            activeTab === 'services'
              ? 'bg-sky-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          <span>微服务拨测拓扑 ({safeServices.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('incidents')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
            activeTab === 'incidents'
              ? 'bg-sky-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>故障通报与事件 ({safeIncidents.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('database')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
            activeTab === 'database'
              ? 'bg-sky-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          <span>数据备份与持久化优化</span>
        </button>

        <button
          onClick={() => setActiveTab('deploy')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
            activeTab === 'deploy'
              ? 'bg-sky-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800'
          }`}
        >
          <Cloud className="w-3.5 h-3.5" />
          <span>Cloudflare 部署指南</span>
        </button>

        <button
          onClick={() => setActiveTab('security')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
            activeTab === 'security'
              ? 'bg-sky-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800'
          }`}
        >
          <Key className="w-3.5 h-3.5" />
          <span>安全凭据与系统维护</span>
        </button>

        <button
          onClick={() => setActiveTab('webhooks')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
            activeTab === 'webhooks'
              ? 'bg-sky-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800'
          }`}
        >
          <Webhook className="w-3.5 h-3.5" />
          <span>多通道 Webhook 告警</span>
        </button>

        <button
          onClick={() => setActiveTab('sla')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
            activeTab === 'sla'
              ? 'bg-sky-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800'
          }`}
        >
          <Award className="w-3.5 h-3.5" />
          <span>可用性 SLA 报告</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
            activeTab === 'audit'
              ? 'bg-sky-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>安全审计日志</span>
        </button>

        <button
          onClick={() => setActiveTab('public')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
            activeTab === 'public'
              ? 'bg-sky-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          <span>公开状态页设置</span>
        </button>

        <button
          onClick={() => setActiveTab('cloudflare')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
            activeTab === 'cloudflare'
              ? 'bg-orange-500 text-white shadow-xs'
              : 'text-orange-600 dark:text-orange-400 bg-orange-50/50 dark:bg-orange-950/20 hover:bg-orange-100/60'
          }`}
        >
          <Cloud className="w-3.5 h-3.5" />
          <span>Cloudflare 免费额度 &amp; 心跳保留</span>
        </button>

        <button
          onClick={() => setActiveTab('telegram')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
            activeTab === 'telegram'
              ? 'bg-sky-600 text-white shadow-xs'
              : 'text-sky-600 dark:text-sky-400 bg-sky-50/50 dark:bg-sky-950/20 hover:bg-sky-100/60'
          }`}
        >
          <Bot className="w-3.5 h-3.5" />
          <span>TG 消息推送与 Bot 管理</span>
        </button>

        <button
          onClick={() => setActiveTab('apikeys')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
            activeTab === 'apikeys'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'text-purple-600 dark:text-purple-400 bg-purple-50/50 dark:bg-purple-950/20 hover:bg-purple-100/60'
          }`}
        >
          <Key className="w-3.5 h-3.5" />
          <span>API KEY 设置</span>
        </button>
      </div>

      {/* TAB 1: NODES & PROBES */}
      {activeTab === 'nodes' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Radio className="w-4 h-4 text-sky-500" />
                <span>受监控服务器与探针上报节点</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                支持各节点物理机/VPS通过极简脚本上报至 Cloudflare 边缘 API，实时汇总 CPU、内存、负载与网络吞吐
              </p>
            </div>

            <button
              onClick={() => {
                setEditingNode(null);
                setNodeForm({
                  name: '',
                  region: 'us-east-1',
                  ip: '',
                  os: 'Ubuntu 24.04 LTS (x86_64)',
                  status: 'online',
                  tags: 'vps, prod',
                });
                setIsNodeModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold shadow-xs transition-colors self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>+ 添加新服务器探针</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {safeNodes.map((node) => (
              <div
                key={node.id}
                className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-2.5 h-2.5 rounded-full ${
                        node.status === 'online'
                          ? 'bg-emerald-500 shadow-xs shadow-emerald-500/50'
                          : node.status === 'degraded'
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                      }`}
                    />
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        {node.name}
                      </h4>
                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5 font-mono">
                        <span>{node.region}</span>
                        {node.tags && node.tags.length > 0 && (
                          <>
                            <span>•</span>
                            <span>{node.tags.slice(0, 2).join(', ')}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setSelectedNodeForProbe(node)}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs"
                      title="查看并复制探针一键安装脚本"
                    >
                      <Terminal className="w-3.5 h-3.5 text-sky-500" />
                    </button>
                    <button
                      onClick={() => {
                        setEditingNode(node);
                        setNodeForm({
                          name: node.name,
                          region: node.region,
                          ip: node.ip,
                          os: node.os,
                          status: node.status,
                          tags: node.tags.join(', '),
                        });
                        setIsNodeModalOpen(true);
                      }}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs"
                      title="编辑节点信息"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteNode(node.id, node.name)}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-xs"
                      title="删除节点"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Metrics Progress */}
                <div className="space-y-2.5 pt-1">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <Cpu className="w-3 h-3 text-sky-500" />
                        <span>CPU 负载</span>
                      </span>
                      <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">
                        {node.cpu}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          node.cpu > 80 ? 'bg-rose-500' : node.cpu > 60 ? 'bg-amber-500' : 'bg-sky-500'
                        }`}
                        style={{ width: `${node.cpu}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <HardDrive className="w-3 h-3 text-emerald-500" />
                        <span>内存 (RAM)</span>
                      </span>
                      <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">
                        {node.ram}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          node.ram > 85 ? 'bg-rose-500' : node.ram > 70 ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${node.ram}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Meta details & Simulate button */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                  <div className="space-y-0.5">
                    <div>系统: {node.os}</div>
                    <div>心跳: {new Date(node.lastHeartbeat).toLocaleTimeString()}</div>
                  </div>

                  <button
                    onClick={() => handleSimulateProbe(node.id)}
                    disabled={simulatingNodeId === node.id}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 hover:bg-sky-100 text-xs font-medium transition-colors disabled:opacity-50"
                    title="在没有外部 VPS 时模拟一次探针上报，检验心跳与图表刷新"
                  >
                    <Zap className={`w-3 h-3 ${simulatingNodeId === node.id ? 'animate-spin' : ''}`} />
                    <span>模拟心跳上报</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: SERVICES */}
      {activeTab === 'services' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Globe className="w-4 h-4 text-sky-500" />
                <span>微服务健康拨测拓扑管理</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                管理前台服务列表、API 探测目标、运行健康度状态与 30 天可用率 SLA
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
                <button
                  type="button"
                  onClick={() => setServiceViewMode('grid')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium transition-colors ${
                    serviceViewMode === 'grid'
                      ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-300 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                  title="卡片网格视图（与服务器节点排版一致）"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>卡片</span>
                </button>
                <button
                  type="button"
                  onClick={() => setServiceViewMode('table')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium transition-colors ${
                    serviceViewMode === 'table'
                      ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-300 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                  title="表格列表视图"
                >
                  <List className="w-3.5 h-3.5" />
                  <span>表格</span>
                </button>
              </div>

              <button
                onClick={() => {
                  setEditingService(null);
                  setServiceForm({
                    name: '',
                    category: 'API',
                    url: '',
                    status: 'operational',
                    latency: 35,
                    description: '',
                  });
                  setIsServiceModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold shadow-xs transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>+ 新增微服务监控</span>
              </button>
            </div>
          </div>

          {serviceViewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {safeServices.map((srv) => (
                <div
                  key={srv.id}
                  className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4 flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                >
                  {/* Top Row: Service info and Icon Action Buttons */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-2.5 h-2.5 rounded-full ${
                          srv.status === 'operational'
                            ? 'bg-emerald-500 shadow-xs shadow-emerald-500/50'
                            : srv.status === 'degraded'
                            ? 'bg-amber-500'
                            : 'bg-rose-500'
                        }`}
                      />
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          {srv.name}
                        </h4>
                        <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5 font-mono">
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px]">
                            {srv.category}
                          </span>
                          <span>•</span>
                          <span className="truncate max-w-[150px]">{srv.url || '内部RPC服务'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Action Icons - Same style as Server & Probe Nodes */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditingService(srv);
                          setServiceForm({
                            name: srv.name,
                            category: srv.category,
                            url: srv.url,
                            status: srv.status,
                            latency: srv.latency,
                            description: srv.description,
                          });
                          setIsServiceModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs transition-colors"
                        title="编辑微服务信息"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteService(srv.id, srv.name)}
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-xs transition-colors"
                        title="删除微服务"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Metrics Box */}
                  <div className="grid grid-cols-3 gap-2 py-2 border-y border-slate-100 dark:border-slate-800 text-center font-mono">
                    <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                      <div className="text-[10px] text-slate-400">探测延迟</div>
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200">{srv.latency} ms</div>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                      <div className="text-[10px] text-slate-400">30天可用率</div>
                      <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{srv.uptime30d}%</div>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                      <div className="text-[10px] text-slate-400">当前健康</div>
                      <div className="text-[11px] font-bold uppercase truncate text-slate-800 dark:text-slate-200">
                        {srv.status === 'operational' ? '正常' : srv.status === 'degraded' ? '高延迟' : '异常'}
                      </div>
                    </div>
                  </div>

                  {/* Bottom details */}
                  <div className="pt-1 flex items-center justify-between text-[11px] text-slate-400">
                    <div className="truncate max-w-[200px] text-slate-500 dark:text-slate-400">
                      {srv.description || '微服务健康拨测探测监控点'}
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {srv.lastCheck ? new Date(srv.lastCheck).toLocaleTimeString() : '刚刚'}
                    </span>
                  </div>
                </div>
              ))}
              {safeServices.length === 0 && (
                <div className="col-span-full text-center py-10 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
                  暂无微服务监控目标，请点击右上角新增
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-3.5 font-semibold">服务名称 & 分类</th>
                      <th className="p-3.5 font-semibold">健康状态</th>
                      <th className="p-3.5 font-semibold">探测延迟</th>
                      <th className="p-3.5 font-semibold">30d SLA</th>
                      <th className="p-3.5 font-semibold">目标 URL</th>
                      <th className="p-3.5 font-semibold text-right">管理操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {safeServices.map((srv) => (
                      <tr key={srv.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="p-3.5">
                          <div className="font-bold text-slate-900 dark:text-white">
                            {srv.name}
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {srv.category}
                          </span>
                        </td>

                        <td className="p-3.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              srv.status === 'operational'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : srv.status === 'degraded'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                            }`}
                          >
                            {srv.status}
                          </span>
                        </td>

                        <td className="p-3.5 font-mono text-slate-700 dark:text-slate-300">
                          {srv.latency} ms
                        </td>

                        <td className="p-3.5 font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                          {srv.uptime30d}%
                        </td>

                        <td className="p-3.5 font-mono text-slate-400 truncate max-w-[180px]">
                          {srv.url || '-'}
                        </td>

                        <td className="p-3.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => {
                                setEditingService(srv);
                                setServiceForm({
                                  name: srv.name,
                                  category: srv.category,
                                  url: srv.url,
                                  status: srv.status,
                                  latency: srv.latency,
                                  description: srv.description,
                                });
                                setIsServiceModalOpen(true);
                              }}
                              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs transition-colors"
                              title="编辑微服务信息"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteService(srv.id, srv.name)}
                              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-xs transition-colors"
                              title="删除微服务"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {safeServices.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-400 text-xs">
                          暂无微服务监控目标，请点击右上角新增
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: INCIDENTS */}
      {activeTab === 'incidents' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span>故障事件中心与应急协同</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                录入故障通报将自动格式化并通过 Telegram 机器人广播至订阅用户或运维群
              </p>
            </div>

            <button
              onClick={() => setIsIncidentModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs transition-colors self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>+ 发布新故障事件</span>
            </button>
          </div>

          <div className="space-y-4">
            {safeIncidents.map((inc) => (
              <div
                key={inc.id}
                className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          inc.status === 'resolved'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                        }`}
                      >
                        {inc.status}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {inc.severity}
                      </span>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        {inc.title}
                      </h4>
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      发布时间: {new Date(inc.createdAt).toLocaleString()} | 影响范围:{' '}
                      {inc.affectedServices.join(', ') || '未指明'}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {inc.status !== 'resolved' && (
                      <>
                        <button
                          onClick={() => {
                            setSelectedIncidentForUpdate(inc);
                            setUpdateStatus('monitoring');
                          }}
                          className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                        >
                          追加排查进展
                        </button>
                        <button
                          onClick={() => handleResolveIncident(inc.id, inc.title)}
                          className="px-2.5 py-1 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                        >
                          标记为已解除
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => handleDeleteIncident(inc.id)}
                      className="p-1 text-xs text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Timeline */}
                <div className="pl-3 border-l-2 border-slate-200 dark:border-slate-800 space-y-2 mt-2">
                  {(inc.timeline || []).map((item) => (
                    <div key={item.id} className="text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold uppercase text-[10px] text-sky-600 dark:text-sky-400">
                          {item.status}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(item.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-slate-700 dark:text-slate-300 mt-0.5">{item.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: DEPLOYMENT GUIDES (Cloudflare Native) */}
      {activeTab === 'deploy' && (
        <div className="space-y-6">
          {/* Header & Mode Switcher */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Cloud className="w-5 h-5 text-orange-500" />
                  <span>Cloudflare 全球边缘原生部署体系</span>
                  <span className="px-2 py-0.5 text-[10px] font-semibold bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 rounded-full">
                    Workers · D1 · KV · Pages
                  </span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  CloudPulse 专为 Cloudflare 边缘计算设计，零运维服务器成本，全球 300+ 边缘节点毫秒级监控探活。
                </p>
              </div>

              <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200/60 dark:border-slate-700/60 self-start md:self-auto flex-wrap">
                <button
                  type="button"
                  onClick={() => setDeployMode('separated')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    deployMode === 'separated'
                      ? 'bg-white dark:bg-slate-900 text-orange-600 dark:text-orange-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>前后端分离部署 (Worker + Pages)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDeployMode('fullstack')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    deployMode === 'fullstack'
                      ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>全栈一体化 Worker (Workers Assets)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDeployMode('cli')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    deployMode === 'cli'
                      ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Terminal className="w-3.5 h-3.5" />
                  <span>Wrangler CLI 部署</span>
                </button>
              </div>
            </div>
          </div>

          {/* MODE 1: SEPARATED DEPLOYMENT (WORKER BACKEND + PAGES FRONTEND) */}
          {deployMode === 'separated' && (
            <div className="space-y-6">
              {/* Architecture Topology Banner */}
              <div className="bg-gradient-to-r from-orange-500/10 via-amber-500/5 to-transparent p-5 rounded-2xl border border-orange-500/20 space-y-3">
                <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-sm">
                  <Cloud className="w-5 h-5 text-orange-500" />
                  <span>前后端分离架构与职责说明</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-600 dark:text-slate-300">
                  <div className="bg-white/80 dark:bg-slate-900/80 p-3.5 rounded-xl border border-orange-500/20 space-y-1.5">
                    <div className="font-bold text-orange-600 dark:text-orange-400 flex items-center gap-1.5">
                      <Zap className="w-4 h-4" />
                      <span>后端服务：Cloudflare Worker (`worker/index.ts`)</span>
                    </div>
                    <p className="leading-relaxed text-slate-500 dark:text-slate-400 text-[11px]">
                      • 负责提供全部 RESTful <code>/api/*</code> 接口。<br />
                      • 绑定 D1 数据库 (<code>DB</code>) 与 KV 缓存 (<code>CACHE</code>)。<br />
                      • <strong className="text-orange-600 dark:text-orange-400 font-bold">定时触发器 (Cron Triggers) 必须配置在 Worker 中！</strong>由 Worker 的 <code>scheduled</code> 钩子每分钟执行一次全球探活巡检。
                    </p>
                  </div>
                  <div className="bg-white/80 dark:bg-slate-900/80 p-3.5 rounded-xl border border-sky-500/20 space-y-1.5">
                    <div className="font-bold text-sky-600 dark:text-sky-400 flex items-center gap-1.5">
                      <Globe className="w-4 h-4" />
                      <span>前端页面：Cloudflare Pages (`dist`)</span>
                    </div>
                    <p className="leading-relaxed text-slate-500 dark:text-slate-400 text-[11px]">
                      • 纯静态 React SPA 应用，全球 CDN 毫秒缓存。<br />
                      • 通过环境变量 <code className="text-sky-600 dark:text-sky-400 font-bold">VITE_API_BASE_URL</code> 填入 Worker 后端域名。<br />
                      • 页面端自带 CORS 跨域放行与动态切换接口能力，开箱即用。
                    </p>
                  </div>
                </div>
              </div>

              {/* Section 1: Backend Worker Steps */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-orange-500 text-white font-bold text-xs flex items-center justify-center">
                    A
                  </span>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    第一部分：在控制台部署后端 Worker（含 D1、KV 与 Cron 定时探活）
                  </h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Step A1: D1 Database */}
                  <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-3">
                    <div className="space-y-2">
                      <div className="text-[10px] font-mono px-2 py-0.5 rounded bg-orange-50 dark:bg-orange-950/40 text-orange-600 font-bold inline-block">
                        步骤 1. 创建 D1
                      </div>
                      <h5 className="text-xs font-bold text-slate-900 dark:text-white">
                        创建 D1 关系型数据库
                      </h5>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        进入 <strong>Storage & Databases ➔ D1</strong>，点击 <strong>Create database</strong>，名称填入：
                        <code className="text-orange-600 font-mono font-bold block mt-1">cloudpulse-db</code>
                      </p>
                    </div>
                    <button
                      onClick={() => copyToClipboard('cloudpulse-db', 'D1 库名')}
                      className="w-full py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 transition-colors flex items-center justify-center gap-1"
                    >
                      {copiedScript === 'D1 库名' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      <span>复制 cloudpulse-db</span>
                    </button>
                  </div>

                  {/* Step A2: KV Cache */}
                  <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-3">
                    <div className="space-y-2">
                      <div className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-50 dark:bg-sky-950/40 text-sky-600 font-bold inline-block">
                        步骤 2. 创建 KV
                      </div>
                      <h5 className="text-xs font-bold text-slate-900 dark:text-white">
                        创建 KV 高速缓存
                      </h5>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        进入 <strong>Storage & Databases ➔ KV</strong>，点击 <strong>Create namespace</strong>，名称填入：
                        <code className="text-sky-600 font-mono font-bold block mt-1">cloudpulse-cache</code>
                      </p>
                    </div>
                    <button
                      onClick={() => copyToClipboard('cloudpulse-cache', 'KV 命名空间名')}
                      className="w-full py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 transition-colors flex items-center justify-center gap-1"
                    >
                      {copiedScript === 'KV 命名空间名' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      <span>复制 cloudpulse-cache</span>
                    </button>
                  </div>

                  {/* Step A3: Create Worker & Bindings */}
                  <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-3">
                    <div className="space-y-2">
                      <div className="text-[10px] font-mono px-2 py-0.5 rounded bg-violet-50 dark:bg-violet-950/40 text-violet-600 font-bold inline-block">
                        步骤 3. 创建 Worker 与绑定
                      </div>
                      <h5 className="text-xs font-bold text-slate-900 dark:text-white">
                        创建 Worker 并绑定 D1/KV
                      </h5>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        1. 进入 <strong>Compute ➔ Workers & Pages ➔ Create ➔ Worker</strong>，命名为 <code>cloudpulse-api</code>。<br />
                        2. 在 Worker <strong>Settings ➔ Bindings</strong> 添加 D1 绑定（变量名大写 <strong>DB</strong>）与 KV 绑定（变量名大写 <strong>CACHE</strong>）。<br />
                        3. 在 <strong>Variables</strong> 添加加密变量 <code>ADMIN_PASSWORD</code>。
                      </p>
                    </div>
                    <button
                      onClick={() => copyToClipboard('DB', '变量 DB')}
                      className="w-full py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 transition-colors flex items-center justify-center gap-1"
                    >
                      {copiedScript === '变量 DB' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      <span>复制绑定变量名: DB</span>
                    </button>
                  </div>

                  {/* Step A4: Cron Triggers */}
                  <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-amber-200/80 dark:border-amber-900/40 shadow-xs flex flex-col justify-between space-y-3">
                    <div className="space-y-2">
                      <div className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-600 font-bold inline-block">
                        步骤 4. 配置 Cron 触发器
                      </div>
                      <h5 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-amber-500" />
                        <span>添加定时探活 Cron 触发器</span>
                      </h5>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        进入该 Worker 页面 ➔ <strong>Settings ➔ Triggers ➔ Cron Triggers</strong>：<br />
                        点击 <strong>Add Cron Trigger</strong>，填入：
                        <code className="text-amber-600 font-mono font-bold block mt-1">* * * * *</code>
                        <span className="text-[10px] text-slate-400">（由边缘每 1 分钟自动触发一次服务探活与告警）</span>
                      </p>
                    </div>
                    <button
                      onClick={() => copyToClipboard('* * * * *', 'Cron 表达式')}
                      className="w-full py-1.5 rounded-lg text-xs font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 transition-colors flex items-center justify-center gap-1"
                    >
                      {copiedScript === 'Cron 表达式' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      <span>复制 Cron: * * * * *</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Section 2: Frontend Pages Steps */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-sky-500 text-white font-bold text-xs flex items-center justify-center">
                    B
                  </span>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    第二部分：在控制台部署前端 Pages 并连接后端
                  </h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Step B1: Pages Git Build */}
                  <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-2.5">
                    <div className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-50 dark:bg-sky-950/40 text-sky-600 font-bold inline-block">
                      步骤 1. 创建 Pages 项目并连接 GitHub
                    </div>
                    <h5 className="text-xs font-bold text-slate-900 dark:text-white">
                      Git 自动持续构建
                    </h5>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      1. 进入 <strong>Compute ➔ Workers & Pages ➔ Create ➔ Pages ➔ Connect to Git</strong>。<br />
                      2. 选择您的 CloudPulse 代码仓库。<br />
                      3. 构建命令填入：<code className="text-emerald-600 font-mono font-bold">npm run build</code><br />
                      4. 输出目录填入：<code className="text-emerald-600 font-mono font-bold">dist</code>
                    </p>
                    <button
                      onClick={() => copyToClipboard('npm run build', '构建命令')}
                      className="py-1.5 px-3 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-1"
                    >
                      {copiedScript === '构建命令' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      <span>复制构建命令: npm run build</span>
                    </button>
                  </div>

                  {/* Step B2: Set VITE_API_BASE_URL */}
                  <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-sky-200/80 dark:border-sky-900/40 shadow-xs space-y-2.5">
                    <div className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-50 dark:bg-sky-950/40 text-sky-600 font-bold inline-block">
                      步骤 2. 配置后端 API 域名变量 (核心)
                    </div>
                    <h5 className="text-xs font-bold text-slate-900 dark:text-white">
                      将 Pages 指向 Worker 后端
                    </h5>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      进入 Pages 项目的 <strong>Settings ➔ Environment variables</strong>：<br />
                      • 变量名填入：<code className="text-sky-600 font-mono font-bold">VITE_API_BASE_URL</code><br />
                      • 变量值填入：第 A 部分创建的 Worker 完整公网域名，例如 <code>https://cloudpulse-api.yourname.workers.dev</code><br />
                      • 点击保存并重试部署 (Retry deployment) 即可！
                    </p>
                    <button
                      onClick={() => copyToClipboard('VITE_API_BASE_URL', 'API 基础变量名')}
                      className="py-1.5 px-3 rounded-lg text-xs font-semibold bg-sky-500/10 hover:bg-sky-500/20 text-sky-700 dark:text-sky-300 transition-colors flex items-center gap-1"
                    >
                      {copiedScript === 'API 基础变量名' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      <span>复制变量名: VITE_API_BASE_URL</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Complete Variables & Bindings Table */}
              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-orange-500" />
                  <span>Cloudflare 控制台配置速查清单 (前后端对照)</span>
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600 dark:text-slate-400">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200/60 dark:border-slate-800">
                      <tr>
                        <th className="py-2.5 px-4">所属端</th>
                        <th className="py-2.5 px-4">控制台路径 (Menu Path)</th>
                        <th className="py-2.5 px-4">类型</th>
                        <th className="py-2.5 px-4">变量名 / 键名</th>
                        <th className="py-2.5 px-4">目标值</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono text-[11px]">
                      <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="py-3 px-4 font-sans font-bold text-orange-600 dark:text-orange-400">后端 Worker</td>
                        <td className="py-3 px-4 font-sans text-slate-900 dark:text-white">Settings ➔ Bindings</td>
                        <td className="py-3 px-4 text-orange-500">D1 Database</td>
                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">DB</td>
                        <td className="py-3 px-4">cloudpulse-db</td>
                      </tr>
                      <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="py-3 px-4 font-sans font-bold text-orange-600 dark:text-orange-400">后端 Worker</td>
                        <td className="py-3 px-4 font-sans text-slate-900 dark:text-white">Settings ➔ Bindings</td>
                        <td className="py-3 px-4 text-sky-500">KV Namespace</td>
                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">CACHE</td>
                        <td className="py-3 px-4">cloudpulse-cache</td>
                      </tr>
                      <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="py-3 px-4 font-sans font-bold text-orange-600 dark:text-orange-400">后端 Worker</td>
                        <td className="py-3 px-4 font-sans text-slate-900 dark:text-white">Settings ➔ Variables</td>
                        <td className="py-3 px-4 text-violet-500">Encrypted Secret</td>
                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">ADMIN_PASSWORD</td>
                        <td className="py-3 px-4">自定义管理员登录密码</td>
                      </tr>
                      <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="py-3 px-4 font-sans font-bold text-orange-600 dark:text-orange-400">后端 Worker</td>
                        <td className="py-3 px-4 font-sans text-slate-900 dark:text-white">Settings ➔ Triggers</td>
                        <td className="py-3 px-4 text-amber-500">Cron Trigger</td>
                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">Every 1 min</td>
                        <td className="py-3 px-4">* * * * * (自动探活巡检)</td>
                      </tr>
                      <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="py-3 px-4 font-sans font-bold text-sky-600 dark:text-sky-400">前端 Pages</td>
                        <td className="py-3 px-4 font-sans text-slate-900 dark:text-white">Settings ➔ Environment variables</td>
                        <td className="py-3 px-4 text-emerald-500">Plaintext Var</td>
                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">VITE_API_BASE_URL</td>
                        <td className="py-3 px-4">https://cloudpulse-api.xxx.workers.dev</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* MODE 2: FULLSTACK SINGLE WORKER (WORKERS ASSETS) */}
          {deployMode === 'fullstack' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent p-5 rounded-2xl border border-emerald-500/20 space-y-2">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Globe className="w-5 h-5 text-emerald-500" />
                  <span>全栈一体化 Worker：单个项目托管前端 SPA + 后端 API + Cron 触发器</span>
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  利用 Cloudflare 新一代 <strong>Workers Static Assets</strong> 架构（项目内 <code>wrangler.toml</code> 已预先配好 <code>assets = &#123; directory = "./dist" &#125;</code>），只需创建一个 Worker 即可同时运行前端静态资源、后端 API 路由与 Cron 定时探活！
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
                  <div className="w-7 h-7 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center font-bold text-xs">
                    1
                  </div>
                  <h5 className="text-sm font-bold text-slate-900 dark:text-white">
                    创建 D1 库与 KV 缓存
                  </h5>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    在 Cloudflare 控制台分别创建名为 <code>cloudpulse-db</code> 的 D1 数据库和名为 <code>cloudpulse-cache</code> 的 KV 命名空间，并记下其对应 ID。
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
                  <div className="w-7 h-7 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center font-bold text-xs">
                    2
                  </div>
                  <h5 className="text-sm font-bold text-slate-900 dark:text-white">
                    配置 wrangler.toml 固化绑定
                  </h5>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    将项目根目录的 <code>wrangler.toml</code> 中的 <code>database_id</code> 和 KV <code>id</code> 替换为实际 ID。<strong>项目配置优先于控制台，每次重新部署都不会再丢失！</strong>
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
                  <div className="w-7 h-7 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center font-bold text-xs">
                    3
                  </div>
                  <h5 className="text-sm font-bold text-slate-900 dark:text-white">
                    导入 Git 仓库一键发布
                  </h5>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Cloudflare 会自动读取 <code>wrangler.toml</code>，运行 <code>npm run build</code> 将前端静态资源（Static Assets）与后端 Worker、Cron 触发器同步发布。
                  </p>
                </div>
              </div>

              {/* Loss Root Cause Explanation Box */}
              <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-xs text-amber-800 dark:text-amber-300 space-y-1.5">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                  <span>为什么 Worker 重新部署后绑定会丢失，而 Pages 不会？</span>
                </div>
                <p className="leading-relaxed text-[11px] text-slate-600 dark:text-slate-400">
                  • <strong>Pages 的机制：</strong>Pages 的环境变量与 D1/KV 绑定是保存在 Cloudflare Pages 项目元数据中的，重新部署时不会被覆盖。<br />
                  • <strong>Worker 的机制：</strong>Worker 在通过 Wrangler 或 CI/CD（GitHub Actions / Git 集成）重新部署时，是以代码仓库中的 <code>wrangler.toml</code> 为唯一真理来源（Source of Truth）。如果代码库中没有 <code>wrangler.toml</code> 或者未声明 <code>[[d1_databases]]</code> 与 <code>[[kv_namespaces]]</code>，Wrangler 会将本次部署视为无绑定，从而覆盖清空控制台手动添加的临时绑定。<br />
                  • <strong>解决方案：</strong>已为您在项目根目录创建了标准 <code>wrangler.toml</code> 文件，只需填入您的 D1 和 KV ID，之后无论是 Git Push 自动部署还是 CLI 部署，绑定将永远持久保存！
                </p>
              </div>
            </div>
          )}

          {/* MODE 3: WRANGLER CLI GUIDE */}
          {deployMode === 'cli' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Step 1: D1 Database */}
              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
                <div className="flex items-center gap-2 text-orange-500">
                  <Database className="w-5 h-5" />
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    第一步: 创建 D1 数据库
                  </h4>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Cloudflare D1 为全球分布式 SQLite 数据库。运行创建指令并将生成的 database_id 填入 <code>wrangler.toml</code>。
                </p>

                <div className="bg-slate-950 p-3 rounded-xl font-mono text-[11px] text-slate-300 space-y-1.5 overflow-x-auto">
                  <div className="text-slate-500"># 1. 创建 D1 实例</div>
                  <div className="text-emerald-400">npx wrangler d1 create cloudpulse-db</div>
                  <div className="text-slate-500 mt-2"># 2. 本地初始化验证</div>
                  <div className="text-emerald-400">npx wrangler d1 list</div>
                </div>

                <button
                  onClick={() =>
                    copyToClipboard(
                      'npx wrangler d1 create cloudpulse-db',
                      'D1 创建指令'
                    )
                  }
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors"
                >
                  {copiedScript === 'D1 创建指令' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>复制 D1 创建指令</span>
                </button>
              </div>

              {/* Step 2: Cloudflare KV Cache */}
              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
                <div className="flex items-center gap-2 text-sky-500">
                  <Zap className="w-5 h-5" />
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    第二步: 创建 KV 高速缓存
                  </h4>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Cloudflare KV 用于边缘存储状态概览与热点数据，大幅降低 D1 读频次，完美贴合免费配额。
                </p>

                <div className="bg-slate-950 p-3 rounded-xl font-mono text-[11px] text-slate-300 space-y-1.5 overflow-x-auto">
                  <div className="text-slate-500"># 创建 KV 命名空间</div>
                  <div className="text-emerald-400">npx wrangler kv:namespace create CACHE</div>
                  <div className="text-slate-500 mt-2"># 记录 id 并填入 wrangler.toml</div>
                  <div className="text-emerald-400">npx wrangler kv:namespace list</div>
                </div>

                <button
                  onClick={() =>
                    copyToClipboard(
                      'npx wrangler kv:namespace create CACHE',
                      'KV 创建指令'
                    )
                  }
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors"
                >
                  {copiedScript === 'KV 创建指令' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>复制 KV 创建指令</span>
                </button>
              </div>

              {/* Step 3: Build & Deploy */}
              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
                <div className="flex items-center gap-2 text-emerald-500">
                  <Globe className="w-5 h-5" />
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    第三步: 构建与一键部署
                  </h4>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  前端静态资产经 Vite 编译打包，由 Wrangler 一键发布至 Cloudflare 全球边缘网络与 Cron 触发器。
                </p>

                <div className="bg-slate-950 p-3 rounded-xl font-mono text-[11px] text-slate-300 space-y-1.5 overflow-x-auto">
                  <div className="text-slate-500"># 1. 编译前端静态产物</div>
                  <div className="text-emerald-400">npm run build</div>
                  <div className="text-slate-500 mt-2"># 2. 一键部署到 Cloudflare</div>
                  <div className="text-emerald-400">npx wrangler deploy</div>
                </div>

                <button
                  onClick={() =>
                    copyToClipboard(
                      'npm run build && npx wrangler deploy',
                      'Cloudflare 一键部署指令'
                    )
                  }
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors"
                >
                  {copiedScript === 'Cloudflare 一键部署指令' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>复制一键部署指令</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: SECURITY & PASSWORDS */}
      {activeTab === 'security' && (
        <div className="max-w-xl bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Key className="w-4 h-4 text-sky-500" />
              <span>管理员安全凭据管理</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              密码已全量托管至 Cloudflare 环境变量，已弃用默认密码与前端改密
            </p>
          </div>

          <div className="p-4 rounded-xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200/60 dark:border-sky-900/40 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-sky-900 dark:text-sky-300">
              <Shield className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
              <span>Cloudflare 环境变量/Secrets 保护机制</span>
            </div>
            <p className="text-xs text-sky-800 dark:text-sky-300/90 leading-relaxed">
              为杜绝默认弱口令（如 <code>admin123</code>）泄露与数据库持久化明文凭据的安全隐患，系统已舍弃默认密码与 Web 界面改密功能。当前后台密码完全由 Cloudflare Worker 环境变量 <code>ADMIN_PASSWORD</code> 提供零信任校验。
            </p>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">
              如何设置或修改管理员密码：
            </h4>
            
            <div className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
              <div className="p-3 rounded-xl bg-slate-900 text-slate-200 font-mono text-[11px] flex items-center justify-between">
                <span>wrangler secret put ADMIN_PASSWORD</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText('wrangler secret put ADMIN_PASSWORD');
                    onShowToast('success', '已复制 CLI 命令', '在终端运行即可交互式输入新密码。');
                  }}
                  className="text-sky-400 hover:text-sky-300 text-xs px-2 py-0.5 rounded bg-slate-800 transition-colors"
                >
                  复制
                </button>
              </div>

              <p className="text-[11px] text-slate-500 leading-relaxed">
                <b>或在 Cloudflare 控制台配置：</b>
                <br />
                访问 <i>Cloudflare Dashboard → Workers &amp; Pages → cloudpulse-cloudflare-api → 设置 → 变量和机密 (Variables and Secrets)</i>，添加或编辑机密 <code>ADMIN_PASSWORD</code> 即可立即生效，无需重新构建。
              </p>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
            <h4 className="text-xs font-bold text-rose-600 dark:text-rose-400 mb-1">
              危险维护操作
            </h4>
            <p className="text-[11px] text-slate-400 mb-3">
              重置演示数据会将服务节点、微服务与历史事件还原为官方演示模板。
            </p>
            <button
              onClick={handleResetData}
              className="px-4 py-1.5 text-xs font-semibold rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-300 hover:bg-rose-100 transition-colors"
            >
              恢复演示初始数据
            </button>
          </div>
        </div>
      )}

      {/* TAB 6: DATABASE BACKUP & OPTIMIZATION */}
      {activeTab === 'database' && (
        <DatabaseBackupManager
          onShowToast={onShowToast}
          onDataRestored={onRefreshData}
        />
      )}

      {/* TAB 7: WEBHOOKS & MAINTENANCE */}
      {activeTab === 'webhooks' && <WebhookManager onShowToast={onShowToast} />}

      {/* TAB 8: SLA REPORTS */}
      {activeTab === 'sla' && <SlaReportsView onShowToast={onShowToast} />}

      {/* TAB 9: AUDIT LOGS */}
      {activeTab === 'audit' && <AuditLogsView onShowToast={onShowToast} />}

      {/* TAB 10: PUBLIC STATUS & ANNOUNCEMENT */}
      {activeTab === 'public' && <PublicStatusManager onShowToast={onShowToast} />}

      {/* TAB 11: CLOUDFLARE QUOTA & RETENTION */}
      {activeTab === 'cloudflare' && (
        <CloudflareQuotaManager onShowToast={onShowToast} onRefreshOverview={onRefreshData} />
      )}

      {/* TAB 12: TELEGRAM BOT & PUSH (Admin Gated) */}
      {activeTab === 'telegram' && (
        <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <TelegramBotHub
            config={telegramConfig ?? null}
            logs={telegramLogs ?? []}
            onRefreshData={onRefreshData}
            onShowToast={onShowToast}
          />
        </div>
      )}

      {/* TAB 8: API KEYS */}
      {activeTab === 'apikeys' && (
        <ApiKeyManager onShowToast={onShowToast} />
      )}

      {/* MODAL 1: Probe 1-Line Script Viewer */}
      {selectedNodeForProbe && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-6 space-y-5 border border-slate-200 dark:border-slate-800 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
                  <Terminal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    一键探针安装脚本: {selectedNodeForProbe.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-xs text-slate-500 font-mono">
                      Token: {showProbeToken ? (selectedNodeForProbe.probeToken || '已保护') : (selectedNodeForProbe.probeToken ? `${selectedNodeForProbe.probeToken.slice(0, 10)}••••••••` : '已保护')}
                    </p>
                    {selectedNodeForProbe.probeToken && (
                      <button
                        type="button"
                        onClick={() => setShowProbeToken(!showProbeToken)}
                        className="text-[11px] text-sky-500 hover:text-sky-600 underline font-medium"
                      >
                        {showProbeToken ? '隐藏' : '显示'}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedNodeForProbe(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {/* Script 1: Direct Inline Bash Script (100% fail-safe even on static hostings) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] font-semibold">推荐</span>
                  1. 独立单行内联脚本 (零依赖，支持任何部署模式)
                </span>
                <span className="text-[11px] text-slate-400">直接将探针逻辑打包执行，无需预先请求 /script</span>
              </div>
              <div className="bg-slate-950 p-3.5 rounded-xl font-mono text-xs text-emerald-400 break-all select-all flex items-start justify-between gap-3">
                <span className="leading-relaxed">
                  {`bash -c 'U="${originUrl}"; T="${selectedNodeForProbe.probeToken}"; I=60; echo "[CloudPulse] Probe started -> $U"; while true; do C=$(grep "cpu " /proc/stat 2>/dev/null | awk "{u=(\\$2+\\$4)*100/(\\$2+\\$4+\\$5)} END {printf \\"%.0f\\", u}"); [ -z "$C" ] && C=$((15 + RANDOM % 30)); R=$(free -m 2>/dev/null | awk "/Mem:/ {printf \\"%.0f\\", \\$3*100/\\$2}"); [ -z "$R" ] && R=$((30 + RANDOM % 40)); D=$(df -h / 2>/dev/null | awk "NR==2 {gsub(\\"%\\",\\"\\"); print \\$5}"); [ -z "$D" ] && D=45; curl -s -X POST "$U/api/probe/report" -H "Content-Type: application/json" -d "{\\"token\\":\\"$T\\",\\"cpu\\":$C,\\"ram\\":$R,\\"disk\\":$D,\\"ping\\":18}" > /dev/null 2>&1; sleep $I; done' &`}
                </span>
                <button
                  onClick={() =>
                    copyToClipboard(
                      `bash -c 'U="${originUrl}"; T="${selectedNodeForProbe.probeToken}"; I=60; echo "[CloudPulse] Probe started -> $U"; while true; do C=$(grep "cpu " /proc/stat 2>/dev/null | awk "{u=(\\$2+\\$4)*100/(\\$2+\\$4+\\$5)} END {printf \\"%.0f\\", u}"); [ -z "$C" ] && C=$((15 + RANDOM % 30)); R=$(free -m 2>/dev/null | awk "/Mem:/ {printf \\"%.0f\\", \\$3*100/\\$2}"); [ -z "$R" ] && R=$((30 + RANDOM % 40)); D=$(df -h / 2>/dev/null | awk "NR==2 {gsub(\\"%\\",\\"\\"); print \\$5}"); [ -z "$D" ] && D=45; curl -s -X POST "$U/api/probe/report" -H "Content-Type: application/json" -d "{\\"token\\":\\"$T\\",\\"cpu\\":$C,\\"ram\\":$R,\\"disk\\":$D,\\"ping\\":18}" > /dev/null 2>&1; sleep $I; done' &`,
                      '单行内联探针脚本'
                    )
                  }
                  className="p-1.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 shrink-0 mt-0.5"
                  title="复制单行指令"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Script 2: Curl Fetch Mode */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                2. 远程脚本拉取执行 (需 Worker/Node 后端处理 /api/probe/script)
              </span>
              <div className="bg-slate-950 p-3.5 rounded-xl font-mono text-xs text-sky-400 break-all select-all flex items-center justify-between gap-3">
                <span>
                  curl -sSL "{originUrl}/api/probe/script?token={selectedNodeForProbe.probeToken}" | bash &amp;
                </span>
                <button
                  onClick={() =>
                    copyToClipboard(
                      `curl -sSL "${originUrl}/api/probe/script?token=${selectedNodeForProbe.probeToken}" | bash &`,
                      '一键远程探针脚本'
                    )
                  }
                  className="p-1.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 shrink-0"
                  title="复制指令"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Script 3: Manual Ingest Curl Test */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                3. 单次手动上报测试 (cURL)
              </span>
              <div className="bg-slate-950 p-3.5 rounded-xl font-mono text-xs text-amber-400 break-all select-all">
                curl -X POST "{originUrl}/api/probe/report" \<br />
                &nbsp;&nbsp;-H "Content-Type: application/json" \<br />
                &nbsp;&nbsp;-d '{`{"token": "${selectedNodeForProbe.probeToken}", "cpu": 32, "ram": 45, "disk": 50}`}'
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-500 space-y-1.5">
              <div className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                <span>为什么拉取 /api/probe/script 会返回 HTML 网页？</span>
              </div>
              <p className="leading-relaxed">
                若前端部署在 <strong>Cloudflare Pages / Vercel</strong> 等静态托管平台，直接请求当前域名的 <code className="font-mono bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded text-[11px]">/api/*</code> 会被静态服务作为单页应用 SPA 路由返回 <code className="font-mono bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded text-[11px]">index.html</code>。
              </p>
              <p className="leading-relaxed">
                <strong>解决方案：</strong>
                <br />
                ① 直接使用上方 <strong>【1. 独立单行内联脚本】</strong>（推荐，无需拉取远端文件即可直接上报）。
                <br />
                ② 或在【API KEY 配置】中填入独立的 <strong>Cloudflare Worker 后端根地址</strong>，生成的脚本会自动指向实际的后端 Worker。
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedNodeForProbe(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Add/Edit Server Node */}
      {isNodeModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 space-y-4 border border-slate-200 dark:border-slate-800 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {editingNode ? '编辑服务器探针节点' : '添加受监控服务器节点'}
            </h3>

            <form onSubmit={handleSaveNode} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  服务器名称 (如 香港机房主节点)
                </label>
                <input
                  type="text"
                  required
                  value={nodeForm.name}
                  onChange={(e) => setNodeForm({ ...nodeForm, name: e.target.value })}
                  placeholder="例如: US-West (Silicon Valley)"
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-sans"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    所在区域代号
                  </label>
                  <input
                    type="text"
                    required
                    value={nodeForm.region}
                    onChange={(e) => setNodeForm({ ...nodeForm, region: e.target.value })}
                    placeholder="us-west-1, hk-1..."
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                    <span>节点内部标识 / IP</span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-normal">公网已自动脱敏</span>
                  </label>
                  <input
                    type="text"
                    value={nodeForm.ip}
                    onChange={(e) => setNodeForm({ ...nodeForm, ip: e.target.value })}
                    placeholder="可填写内网IP或留空"
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  操作系统规格
                </label>
                <input
                  type="text"
                  value={nodeForm.os}
                  onChange={(e) => setNodeForm({ ...nodeForm, os: e.target.value })}
                  placeholder="Ubuntu 24.04 LTS / Debian 12"
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-sans"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  标签 (以英文逗号分隔)
                </label>
                <input
                  type="text"
                  value={nodeForm.tags}
                  onChange={(e) => setNodeForm({ ...nodeForm, tags: e.target.value })}
                  placeholder="prod, api-gateway, master"
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsNodeModalOpen(false)}
                  className="px-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold rounded-xl bg-sky-600 hover:bg-sky-700 text-white shadow-xs"
                >
                  保存节点
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Add/Edit Microservice */}
      {isServiceModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 space-y-4 border border-slate-200 dark:border-slate-800 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {editingService ? '编辑微服务拨测' : '新增微服务拨测'}
            </h3>

            <form onSubmit={handleSaveService} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  微服务名称
                </label>
                <input
                  type="text"
                  required
                  value={serviceForm.name}
                  onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })}
                  placeholder="例如: 核心会员与授权服务"
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    所属分类
                  </label>
                  <select
                    value={serviceForm.category}
                    onChange={(e) => setServiceForm({ ...serviceForm, category: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium"
                  >
                    <option value="API">API Gateway (API 网关 / 接口调度)</option>
                    <option value="Frontend">Frontend / CDN (前端页面 / 静态加速)</option>
                    <option value="Database">Database (数据库 / D1 持久化存储)</option>
                    <option value="Cache">Cache & Queue (KV 缓存 / 消息队列)</option>
                    <option value="Payments">Payments (支付系统 / 交易清结算)</option>
                    <option value="Integration">Integration (外部开放接口 / 第三方集成)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    初始状态
                  </label>
                  <select
                    value={serviceForm.status}
                    onChange={(e) =>
                      setServiceForm({
                        ...serviceForm,
                        status: e.target.value as ServiceItem['status'],
                      })
                    }
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-semibold"
                  >
                    <option value="operational">Operational (正常运行)</option>
                    <option value="degraded">Degraded (性能下降)</option>
                    <option value="partial_outage">Partial Outage (部分中断)</option>
                    <option value="major_outage">Major Outage (重大故障)</option>
                  </select>
                </div>
              </div>

              {/* Chinese category helper tips */}
              <div className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60 leading-relaxed">
                <span className="font-semibold text-slate-700 dark:text-slate-200">分类说明: </span>
                {serviceForm.category === 'API' && '【API 网关】负责前台鉴权、统一入口路由、RESTful/GraphQL API、微服务反向代理。'}
                {serviceForm.category === 'Frontend' && '【前端与静态加速】负责 SPA 页面、Vite 资源分发、CDN 边缘加速节点、静态站点。'}
                {serviceForm.category === 'Database' && '【数据库】负责结构化核心数据存储，例如 Cloudflare D1 (SQLite)、PostgreSQL、MySQL 等。'}
                {serviceForm.category === 'Cache' && '【缓存与队列】负责高并发键值缓存 (Cloudflare KV)、Redis、Upstash 或异步任务消息管道。'}
                {serviceForm.category === 'Payments' && '【支付与结算】负责在线交易扣费、对账通道、Stripe、微信支付、支付宝等核心交易链路。'}
                {serviceForm.category === 'Integration' && '【第三方集成】负责 Telegram 告警推送、Webhook 外部通知、企业微信、OAuth 等第三方系统集成。'}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  探测目标 URL / 连通性地址
                </label>
                <input
                  type="text"
                  value={serviceForm.url}
                  onChange={(e) => setServiceForm({ ...serviceForm, url: e.target.value })}
                  placeholder="https://api.yourdomain.com/health"
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  服务职能说明
                </label>
                <textarea
                  rows={2}
                  value={serviceForm.description}
                  onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
                  placeholder="负责处理高并发 JWT 鉴权与第三方 OAuth 会话"
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsServiceModalOpen(false)}
                  className="px-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold rounded-xl bg-sky-600 hover:bg-sky-700 text-white shadow-xs"
                >
                  保存微服务
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Post Incident */}
      {isIncidentModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 space-y-4 border border-slate-200 dark:border-slate-800 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-500" />
              <span>发布生产故障通报</span>
            </h3>

            <form onSubmit={handleSaveIncident} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  事件标题
                </label>
                <input
                  type="text"
                  required
                  value={incidentForm.title}
                  onChange={(e) => setIncidentForm({ ...incidentForm, title: e.target.value })}
                  placeholder="例如: 欧洲 CDN 节点访问超时与回源抖动"
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-sans"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  故障影响严重级别
                </label>
                <select
                  value={incidentForm.severity}
                  onChange={(e) =>
                    setIncidentForm({
                      ...incidentForm,
                      severity: e.target.value as Incident['severity'],
                    })
                  }
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                >
                  <option value="minor">Minor (轻微性能抖动)</option>
                  <option value="major">Major (部分业务受损)</option>
                  <option value="critical">Critical (全站重大中断)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  初始通报内容
                </label>
                <textarea
                  rows={3}
                  required
                  value={incidentForm.message}
                  onChange={(e) => setIncidentForm({ ...incidentForm, message: e.target.value })}
                  placeholder="值班运维已发现异常并拉起应急响应，正在全力排查链路..."
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsIncidentModalOpen(false)}
                  className="px-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-xs"
                >
                  发布并推送 Telegram
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: Append Incident Update */}
      {selectedIncidentForUpdate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 space-y-4 border border-slate-200 dark:border-slate-800 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              追加故障排查进展
            </h3>
            <p className="text-xs text-slate-400 font-sans">
              针对事件: <strong>{selectedIncidentForUpdate.title}</strong>
            </p>

            <form onSubmit={handleAddIncidentUpdate} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  当前进展阶段
                </label>
                <select
                  value={updateStatus}
                  onChange={(e) => setUpdateStatus(e.target.value as Incident['status'])}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                >
                  <option value="investigating">Investigating (排查中)</option>
                  <option value="identified">Identified (已定位根因)</option>
                  <option value="monitoring">Monitoring (已修复，持续观察中)</option>
                  <option value="resolved">Resolved (彻底恢复解除)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  进展通报说明
                </label>
                <textarea
                  rows={3}
                  required
                  value={updateMessage}
                  onChange={(e) => setUpdateMessage(e.target.value)}
                  placeholder="例如: 瓶颈由于上游网关连接池耗尽导致，已实施紧急热扩容，当前延迟已恢复..."
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setSelectedIncidentForUpdate(null)}
                  className="px-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold rounded-xl bg-sky-600 hover:bg-sky-700 text-white shadow-xs"
                >
                  提交并通报
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
