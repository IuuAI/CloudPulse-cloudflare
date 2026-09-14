import React, { useState, useEffect, useCallback } from 'react';
import { WifiOff, AlertTriangle } from 'lucide-react';
import {
  ServiceItem,
  ServerNode,
  Incident,
  TelegramConfig,
  TelegramLogItem,
  SystemOverview,
  IncidentStatus,
  AdminAuthState,
  MetricHistoryPoint,
  MainAppTab,
} from './types';
import {
  fetchOverview,
  fetchServices,
  fetchNodes,
  fetchIncidents,
  fetchMetricsHistory,
  fetchTelegramConfig,
  fetchTelegramLogs,
  fetchHealth,
  createIncident,
  addIncidentUpdate,
  resolveIncident,
  sendTelegramPush,
  verifyAdminAuth,
} from './api';

import { Header } from './components/Header';
import { OverviewCardDeck } from './components/OverviewCardDeck';
import { IncidentSection } from './components/IncidentSection';
import { TelegramBotHub } from './components/TelegramBotHub';
import { AdminDashboard } from './components/AdminDashboard';
import { NodeDetailModal } from './components/NodeDetailModal';
import { QuickPushModal } from './components/QuickPushModal';
import { ToastContainer, ToastMessage } from './components/Toast';
import { Footer } from './components/Footer';
import { TabSkeleton, TopLoadingBar } from './components/SkeletonScreen';
import { GlobalNodesView } from './components/GlobalNodesView';
import { SlaReportsView } from './components/SlaReportsView';
import { PublicApiView } from './components/PublicApiView';
import { DemoModeModal } from './components/DemoModeModal';
import {
  fallbackOverview,
  fallbackServices,
  fallbackNodes,
  fallbackMetricsHistory,
} from './data/fallbackData';

export default function App() {
  const [activeTab, setActiveTab] = useState<MainAppTab>('overview');

  // Admin Auth State
  const [adminAuth, setAdminAuth] = useState<AdminAuthState>({
    isAuthenticated: false,
  });

  // Data states with immediate fallback data for instant rendering
  const [overview, setOverview] = useState<SystemOverview | null>(fallbackOverview);
  const [services, setServices] = useState<ServiceItem[]>(fallbackServices);
  const [nodes, setNodes] = useState<ServerNode[]>(fallbackNodes);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [metricsHistory, setMetricsHistory] = useState<MetricHistoryPoint[]>(fallbackMetricsHistory);
  const [telegramConfig, setTelegramConfig] = useState<
    (TelegramConfig & { hasBotToken: boolean; botTokenPreview: string }) | null
  >(null);
  const [telegramLogs, setTelegramLogs] = useState<TelegramLogItem[]>([]);
  const [bindingStatus, setBindingStatus] = useState<{
    checked: boolean;
    d1Bound: boolean;
    kvBound: boolean;
  }>({
    checked: false,
    d1Bound: true,
    kvBound: true,
  });

  // UI Modals & Loading States
  const [selectedNode, setSelectedNode] = useState<ServerNode | null>(null);
  const [isQuickPushOpen, setIsQuickPushOpen] = useState(false);
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isTabSwitching, setIsTabSwitching] = useState(false);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback(
    (type: ToastMessage['type'], title: string, description?: string) => {
      const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
      setToasts((prev) => [...prev, { id, type, title, description }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 5000);
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handleTabChange = useCallback(
    (nextTab: MainAppTab) => {
      if (nextTab === 'telegram' && !adminAuth.isAuthenticated) {
        showToast('warning', '管理员专属功能', 'Telegram 消息推送需管理员密码登入后台后使用');
        setActiveTab('admin');
        return;
      }
      if (nextTab === activeTab) return;
      setIsTabSwitching(true);
      setActiveTab(nextTab);
      // Subtle 260ms skeleton screen display before revealing new tab
      setTimeout(() => {
        setIsTabSwitching(false);
      }, 260);
    },
    [activeTab, adminAuth.isAuthenticated, showToast]
  );

  const handleOpenQuickPush = () => {
    if (!adminAuth.isAuthenticated) {
      showToast('warning', '管理员专属功能', 'Telegram 消息推送需管理员密码登入后台后使用');
      handleTabChange('admin');
      return;
    }
    setIsQuickPushOpen(true);
  };

  const loadData = useCallback(async (quiet = false) => {
    if (!quiet) {
      setIsRefreshing(true);
      setIsManualRefreshing(true);
    }
    try {
      const [ovRes, srvRes, nodeRes, incRes, historyRes, tgConfigRes, tgLogsRes, healthRes] =
        await Promise.all([
          fetchOverview().catch(() => null),
          fetchServices().catch(() => []),
          fetchNodes().catch(() => []),
          fetchIncidents().catch(() => []),
          fetchMetricsHistory().catch(() => []),
          fetchTelegramConfig().catch(() => null),
          fetchTelegramLogs().catch(() => []),
          fetchHealth().catch(() => null),
        ]);

      if (healthRes && healthRes.bindings) {
        const d1Ok = healthRes.bindings.d1Database?.includes('Bound');
        const kvOk = healthRes.bindings.kvNamespace?.includes('Bound');
        setBindingStatus({
          checked: true,
          d1Bound: d1Ok,
          kvBound: kvOk,
        });
      }

      if (ovRes && typeof ovRes === 'object' && !('error' in ovRes)) {
        setOverview(ovRes);
      } else {
        setOverview((prev) => prev || fallbackOverview);
      }

      if (Array.isArray(srvRes) && srvRes.length > 0) {
        setServices(srvRes);
      } else {
        setServices((prev) => (prev.length > 0 ? prev : fallbackServices));
      }

      if (Array.isArray(nodeRes) && nodeRes.length > 0) {
        setNodes(nodeRes);
      } else {
        setNodes((prev) => (prev.length > 0 ? prev : fallbackNodes));
      }

      if (Array.isArray(incRes)) setIncidents(incRes);

      if (Array.isArray(historyRes) && historyRes.length > 0) {
        setMetricsHistory(historyRes);
      } else {
        setMetricsHistory((prev) => (prev.length > 0 ? prev : fallbackMetricsHistory));
      }

      if (tgConfigRes && typeof tgConfigRes === 'object' && !('error' in tgConfigRes)) setTelegramConfig(tgConfigRes);
      if (Array.isArray(tgLogsRes)) setTelegramLogs(tgLogsRes);
    } catch (err: any) {
      console.error('Failed to load system status:', err);
    } finally {
      if (!quiet) {
        setIsRefreshing(false);
        setTimeout(() => {
          setIsManualRefreshing(false);
          setIsInitialLoading(false);
        }, 260);
      } else {
        setIsInitialLoading(false);
      }
    }
  }, []);

  // Check initial admin auth and load data
  useEffect(() => {
    loadData();
    verifyAdminAuth().then((authed) => {
      if (authed) {
        setAdminAuth({
          isAuthenticated: true,
          username: 'admin',
          token: localStorage.getItem('cloudpulse_admin_token') || undefined,
        });
      }
    });

    // Auto-refresh for live probe updates (smart poll respecting page visibility and online status)
    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      loadData(true);
    }, 25000);

    const handleVisibilityChange = () => {
      if (!document.hidden && (!navigator || navigator.onLine)) {
        loadData(true);
      }
    };
    const handleOnline = () => {
      setIsOnline(true);
      showToast('success', '网络已恢复连接', '已自动同步最新基础设施状态');
      loadData(true);
    };
    const handleOffline = () => {
      setIsOnline(false);
      showToast('warning', '网络已断开', '当前处于离线模式，已暂停自动轮询');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [loadData, showToast]);

  // Fast Telegram alert trigger for a service (Admin Protected)
  const handleTriggerServiceAlert = async (service: ServiceItem) => {
    if (!adminAuth.isAuthenticated) {
      showToast('warning', '权限受限', 'Telegram 消息推送功能仅限管理员密码登入后台后使用');
      handleTabChange('admin');
      return;
    }

    const text =
`⚠️ <b>【服务波动通知】</b>
<b>服务:</b> ${service.name} (${service.category})
<b>状态:</b> ${service.status.toUpperCase()}
<b>响应延迟:</b> ${service.latency}ms
<b>检查时间:</b> ${new Date().toLocaleTimeString()}

<i>消息由管理员手动触发推送验证。</i>`;

    try {
      const res = await sendTelegramPush({ text, parseMode: 'HTML' });
      if (res.status === 'sent') {
        showToast('success', '已发送服务告警至 Telegram！');
      } else {
        showToast('info', '已记录服务告警通知 (模拟推送)');
      }
      loadData(true);
    } catch (err: any) {
      showToast('error', '告警推送失败', err.message);
    }
  };

  // Fast Telegram alert trigger for a node (Admin Protected)
  const handleTriggerNodeAlert = async (node: ServerNode) => {
    if (!adminAuth.isAuthenticated) {
      showToast('warning', '权限受限', 'Telegram 消息推送功能仅限管理员密码登入后台后使用');
      handleTabChange('admin');
      return;
    }

    const text =
`🖥 <b>【服务器节点健康报表】</b>
<b>节点:</b> ${node.name} (${node.region})
<b>公网IP:</b> ${node.ip}
<b>当前状态:</b> ${node.status.toUpperCase()}
<b>CPU:</b> ${node.cpu}% | <b>RAM:</b> ${node.ram}% | <b>磁盘:</b> ${node.disk}%
<b>Ping:</b> ${node.ping}ms | <b>入网:</b> ${node.networkIn}

<i>CloudPulse 基础设施探针监控中心自动同步</i>`;

    try {
      const res = await sendTelegramPush({ text, parseMode: 'HTML' });
      if (res.status === 'sent') {
        showToast('success', `已向 Telegram 推送节点 ${node.name} 状态！`);
      } else {
        showToast('info', `已记录节点 ${node.name} 状态报告 (模拟模式)`);
      }
      loadData(true);
    } catch (err: any) {
      showToast('error', '推送失败', err.message);
    }
  };

  // Incident handlers
  const handleCreateIncident = async (incident: Partial<Incident>) => {
    try {
      await createIncident(incident);
      showToast('success', '故障事件已创建并自动广播至 Telegram！');
      loadData(true);
    } catch (err: any) {
      showToast('error', '创建故障事件失败', err.message);
      throw err;
    }
  };

  const handleAddIncidentUpdate = async (
    id: string,
    status: IncidentStatus,
    message: string
  ) => {
    try {
      await addIncidentUpdate(id, status, message);
      showToast('success', '进展已更新并同步推送至 Telegram！');
      loadData(true);
    } catch (err: any) {
      showToast('error', '更新失败', err.message);
      throw err;
    }
  };

  const handleResolveIncident = async (id: string, message: string) => {
    try {
      await resolveIncident(id, message);
      showToast('success', '故障事件已标记解除，恢复通知已广播！');
      loadData(true);
    } catch (err: any) {
      showToast('error', '恢复失败', err.message);
      throw err;
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-sans">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <TopLoadingBar isVisible={isRefreshing || isTabSwitching || isManualRefreshing} />

      <Header
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        overview={overview}
        onRefresh={() => loadData(false)}
        isRefreshing={isRefreshing}
        onOpenQuickPush={handleOpenQuickPush}
        onOpenDemoModal={() => setIsDemoModalOpen(true)}
        authState={adminAuth}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Offline Warning Banner */}
        {!isOnline && (
          <div className="mb-4 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <WifiOff className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>当前网络处于离线状态，已暂停自动请求以节省流量并避免报错。恢复网络后将自动同步。</span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 uppercase font-semibold">
              离线中
            </span>
          </div>
        )}

        {/* Cloudflare D1 & KV Binding Check Warning Banner */}
        {bindingStatus.checked && (!bindingStatus.d1Bound || !bindingStatus.kvBound) && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-900 dark:text-rose-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-rose-500 text-white shrink-0 mt-0.5">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold flex items-center gap-2">
                  <span>Cloudflare Workers 后端资源未完全绑定</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-rose-200 dark:bg-rose-900/80 text-rose-800 dark:text-rose-200 font-mono">
                    ⚠️ 部署配置缺失
                  </span>
                </h4>
                <p className="text-xs text-rose-800/90 dark:text-rose-200/90 leading-relaxed">
                  检测到当前 Worker 运行环境未正确关联持久化后端。
                  {!bindingStatus.d1Bound && <strong>【D1 数据库 (DB)】</strong>}
                  {!bindingStatus.d1Bound && !bindingStatus.kvBound && ' 与 '}
                  {!bindingStatus.kvBound && <strong>【KV 缓存 (CACHE)]</strong>}
                  当前处于未绑定状态。数据将在重启或重新部署后重置。
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              <button
                onClick={() => handleTabChange('admin')}
                className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition-colors"
              >
                前往后台查看详情
              </button>
            </div>
          </div>
        )}

        {/* Subtle Skeleton Screen during initial load, tab transition, or manual data refresh */}
        {isInitialLoading || isTabSwitching || isManualRefreshing ? (
          <TabSkeleton tab={activeTab} />
        ) : (
          <>
            {/* Tab 1: Card-Deck Overview & Services & Nodes */}
            {activeTab === 'overview' && (
              <OverviewCardDeck
                overview={overview}
                metricsHistory={metricsHistory}
                services={services}
                nodes={nodes}
                isRefreshing={isRefreshing}
                onRefreshData={() => loadData(false)}
                onTriggerServiceAlert={handleTriggerServiceAlert}
                onSelectNode={(node) => setSelectedNode(node)}
                onTriggerNodeAlert={handleTriggerNodeAlert}
                onNavigateToTelegram={() => handleTabChange('telegram')}
              />
            )}

            {/* Tab: Global Nodes View */}
            {activeTab === 'nodes' && (
              <GlobalNodesView
                nodes={nodes}
                onSelectNode={(node) => setSelectedNode(node)}
                onTriggerNodeAlert={handleTriggerNodeAlert}
                onRefreshData={() => loadData(false)}
                isRefreshing={isRefreshing}
              />
            )}

            {/* Tab: SLA Reports */}
            {activeTab === 'sla' && (
              <SlaReportsView
                onShowToast={showToast}
              />
            )}

            {/* Tab: Public API */}
            {activeTab === 'api-status' && (
              <PublicApiView
                overview={overview}
                onShowToast={showToast}
              />
            )}

            {/* Tab 2: Telegram Push & Alerts Center (Push Only - Admin Protected) */}
            {activeTab === 'telegram' && (
              adminAuth.isAuthenticated ? (
                <TelegramBotHub
                  config={telegramConfig}
                  logs={telegramLogs}
                  onRefreshData={() => loadData(true)}
                  onShowToast={showToast}
                />
              ) : (
                <AdminDashboard
                  authState={adminAuth}
                  services={services}
                  nodes={nodes}
                  incidents={incidents}
                  telegramConfig={telegramConfig}
                  telegramLogs={telegramLogs}
                  onAuthChange={setAdminAuth}
                  onRefreshData={() => loadData(true)}
                  onShowToast={showToast}
                />
              )
            )}

            {/* Tab 3: Incidents & Maintenance */}
            {activeTab === 'incidents' && (
              <IncidentSection
                incidents={incidents}
                onCreateIncident={handleCreateIncident}
                onAddUpdate={handleAddIncidentUpdate}
                onResolveIncident={handleResolveIncident}
              />
            )}

            {/* Tab 4: Web Admin Operations Dashboard */}
            {activeTab === 'admin' && (
              <AdminDashboard
                authState={adminAuth}
                services={services}
                nodes={nodes}
                incidents={incidents}
                telegramConfig={telegramConfig}
                telegramLogs={telegramLogs}
                onAuthChange={setAdminAuth}
                onRefreshData={() => loadData(true)}
                onShowToast={showToast}
              />
            )}
          </>
        )}
      </main>

      {/* Node Detail Modal */}
      <NodeDetailModal
        node={selectedNode}
        onClose={() => setSelectedNode(null)}
        onSendAlert={handleTriggerNodeAlert}
      />

      {/* Quick Push Modal */}
      <QuickPushModal
        isOpen={isQuickPushOpen}
        onClose={() => setIsQuickPushOpen(false)}
        defaultChatId={telegramConfig?.chatId}
        onSuccess={(status, desc) => {
          if (status === 'sent') {
            showToast('success', 'Telegram 广播推送已成功送达！', desc);
          } else if (status === 'error') {
            showToast('error', '推送发送失败', desc);
          } else {
            showToast('info', '已记录推送广播 (模拟模式)', desc);
          }
          loadData(true);
        }}
      />

      {/* Demo Mode Snapshot Modal */}
      <DemoModeModal
        isOpen={isDemoModalOpen}
        onClose={() => setIsDemoModalOpen(false)}
        overview={overview}
        nodes={nodes}
        services={services}
        incidents={incidents}
        onOpenAdmin={() => handleTabChange('admin')}
      />

      <Footer onOpenTelegram={() => handleTabChange('telegram')} />
    </div>
  );
}
