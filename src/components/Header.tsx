import React from 'react';
import {
  Activity,
  Bot,
  AlertTriangle,
  ShieldCheck,
  Send,
  RefreshCw,
  Server,
  Lock,
  Globe,
  Code,
  Eye,
  UserCheck,
  UserX,
} from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { SystemOverview, AdminAuthState, MainAppTab } from '../types';

interface HeaderProps {
  activeTab: MainAppTab;
  setActiveTab: (tab: MainAppTab) => void;
  overview: SystemOverview | null;
  onRefresh: () => void;
  isRefreshing: boolean;
  onOpenQuickPush: () => void;
  onOpenDemoModal: () => void;
  authState?: AdminAuthState;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  overview,
  onRefresh,
  isRefreshing,
  onOpenQuickPush,
  onOpenDemoModal,
  authState,
}) => {
  const isAllGood = overview?.overallStatus === 'all_good';
  const hasActiveIncidents = (overview?.activeIncidentsCount || 0) > 0;
  const isAuthenticated = authState?.isAuthenticated;

  return (
    <header id="app-header" className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo & Status indicator */}
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-slate-900 dark:bg-slate-800 text-white shadow-sm">
              <Activity className="w-5 h-5 text-emerald-400" />
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isAllGood ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                <span className={`relative inline-flex rounded-full h-3 w-3 ${isAllGood ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white font-sans">
                  CloudPulse
                </h1>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  v2.5 Live
                </span>
              </div>
              <p className="hidden md:block text-xs text-slate-500 dark:text-slate-400">
                集群探针监控 • Telegram 告警推送 • 后台运维管理
              </p>
            </div>
          </div>

          {/* Center Navigation Tabs */}
          <nav id="header-nav-tabs" className="hidden md:flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/60 rounded-xl border border-slate-200/60 dark:border-slate-800 overflow-x-auto scrollbar-none">
            <button
              id="tab-btn-overview"
              onClick={() => setActiveTab('overview')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 whitespace-nowrap ${
                activeTab === 'overview'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Server className="w-4 h-4 text-emerald-500" />
              <span>监控大盘</span>
            </button>

            <button
              id="tab-btn-nodes"
              onClick={() => setActiveTab('nodes')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 whitespace-nowrap ${
                activeTab === 'nodes'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Globe className="w-4 h-4 text-sky-500" />
              <span>全球探针</span>
            </button>

            <button
              id="tab-btn-sla"
              onClick={() => setActiveTab('sla')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 whitespace-nowrap ${
                activeTab === 'sla'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Activity className="w-4 h-4 text-indigo-500" />
              <span>SLA 报告</span>
            </button>

            <button
              id="tab-btn-incidents"
              onClick={() => setActiveTab('incidents')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 whitespace-nowrap ${
                activeTab === 'incidents'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <AlertTriangle className={`w-4 h-4 ${hasActiveIncidents ? 'text-amber-500' : 'text-slate-400'}`} />
              <span>故障事件</span>
              {hasActiveIncidents && (
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              )}
            </button>

            <button
              id="tab-btn-api"
              onClick={() => setActiveTab('api-status')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 whitespace-nowrap ${
                activeTab === 'api-status'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Code className="w-4 h-4 text-slate-500" />
              <span>公共 API</span>
            </button>



            <button
              id="tab-btn-admin"
              onClick={() => setActiveTab('admin')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 whitespace-nowrap ${
                activeTab === 'admin'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {authState?.isAuthenticated ? (
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
              ) : (
                <Lock className="w-4 h-4 text-purple-500" />
              )}
              <span>后台管理</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                authState?.isAuthenticated
                  ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                  : 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300'
              }`}>
                {authState?.isAuthenticated ? '已认证' : 'Admin'}
              </span>
            </button>
          </nav>

          {/* Right Action buttons */}
          <div className="flex items-center gap-2">
            {/* Login Status Indicator */}
            <div className={`hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${
              isAuthenticated
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
            }`}>
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isAuthenticated ? 'bg-emerald-400' : 'bg-slate-400'}`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${isAuthenticated ? 'bg-emerald-500' : 'bg-slate-500'}`}></span>
              </span>
              <span>{isAuthenticated ? '管理员已在线' : '访客模式'}</span>
            </div>

            {/* View Demo Mode Button for Unauthenticated Users */}
            {!isAuthenticated && (
              <button
                id="view-demo-modal-btn"
                onClick={onOpenDemoModal}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800 transition-colors"
                title="查看系统公开部分快照预览"
              >
                <Eye className="w-3.5 h-3.5 text-emerald-500" />
                <span className="hidden sm:inline">演示模式</span>
              </button>
            )}

            {/* Quick Telegram Push button: Only show when authenticated or trigger admin prompt */}
            {authState?.isAuthenticated ? (
              <button
                id="quick-push-btn"
                onClick={onOpenQuickPush}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-sky-500 hover:bg-sky-600 text-white shadow-xs transition-colors"
                title="发送即时 Telegram 广播或告警 (管理员特权)"
              >
                <Send className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">TG 推送</span>
              </button>
            ) : (
              <button
                id="quick-push-btn-login"
                onClick={() => setActiveTab('admin')}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                title="登录管理员后台开启 Telegram 消息推送"
              >
                <Lock className="w-3 h-3 text-slate-400" />
                <span>管理员登录</span>
              </button>
            )}

            {/* Refresh Button */}
            <button
              id="header-refresh-btn"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
              title="刷新数据"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-emerald-500' : ''}`} />
            </button>

            {/* 4-Theme Mode Selector */}
            <ThemeToggle />
          </div>
        </div>

        {/* Mobile Navigation Bar */}
        <div className="flex md:hidden overflow-x-auto py-2 border-t border-slate-100 dark:border-slate-800 gap-2 scrollbar-none">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${
              activeTab === 'overview'
                ? 'bg-emerald-600 text-white font-semibold'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            📊 监控大盘
          </button>
          <button
            onClick={() => setActiveTab('nodes')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${
              activeTab === 'nodes'
                ? 'bg-sky-600 text-white font-semibold'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            🌐 全球探针
          </button>
          <button
            onClick={() => setActiveTab('sla')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${
              activeTab === 'sla'
                ? 'bg-indigo-600 text-white font-semibold'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            📈 SLA 报告
          </button>
          <button
            onClick={() => setActiveTab('incidents')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${
              activeTab === 'incidents'
                ? 'bg-amber-600 text-white font-semibold'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            ⚠️ 故障事件
          </button>
          <button
            onClick={() => setActiveTab('api-status')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${
              activeTab === 'api-status'
                ? 'bg-slate-700 text-white font-semibold'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            🔌 公共 API
          </button>
          {authState?.isAuthenticated && (
            <button
              onClick={() => setActiveTab('telegram')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${
                activeTab === 'telegram'
                  ? 'bg-sky-600 text-white font-semibold'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              🤖 TG 消息
            </button>
          )}
          <button
            onClick={() => setActiveTab('admin')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${
              activeTab === 'admin'
                ? 'bg-purple-600 text-white font-semibold'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            🛡 后台管理
          </button>
        </div>
      </div>
    </header>
  );
};
