import React, { useState, useEffect, useCallback } from 'react';
import {
  Globe,
  Megaphone,
  Shield,
  Save,
  CheckCircle2,
  Eye,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { PublicStatusConfig } from '../types';
import { fetchPublicStatus, updatePublicStatus } from '../api';

interface PublicStatusManagerProps {
  onShowToast: (type: 'success' | 'warning' | 'error' | 'info', title: string, desc?: string) => void;
}

export const PublicStatusManager: React.FC<PublicStatusManagerProps> = ({ onShowToast }) => {
  const [config, setConfig] = useState<PublicStatusConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const loadConfig = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchPublicStatus();
      setConfig(data);
    } catch (err: any) {
      console.error('Failed to fetch public status config:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;
    setIsSaving(true);
    try {
      const updated = await updatePublicStatus(config);
      setConfig(updated);
      onShowToast('success', '公开状态页配置已保存', '前台访客视图已即时生效');
    } catch (err: any) {
      onShowToast('error', '保存失败', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (!config) {
    return (
      <div className="p-12 text-center text-slate-400">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
        加载公开状态页配置中...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                公开状态页与维护公告管理
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                  Public Status & Announcements
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                自定义客户可见的状态页标题、公司品牌、隐藏内部探针 IP 以及发布置顶维护公告
              </p>
            </div>
          </div>
        </div>

        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/40 dark:hover:bg-sky-900/60 text-sky-700 dark:text-sky-300 text-xs font-semibold transition-colors self-start sm:self-auto"
        >
          <Eye className="w-4 h-4" />
          <span>预览前台状态页</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* 2. Settings Form */}
      <form onSubmit={handleSave} className="space-y-6">
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-5">
          <h4 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3">
            状态页基本设置
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1.5">
              <label className="font-medium text-slate-700 dark:text-slate-300">企业或组织名称</label>
              <input
                type="text"
                value={config.companyName}
                onChange={(e) => setConfig({ ...config, companyName: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-medium text-slate-700 dark:text-slate-300">状态页主标题</label>
              <input
                type="text"
                value={config.customTitle}
                onChange={(e) => setConfig({ ...config, customTitle: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <label className="font-medium text-slate-700 dark:text-slate-300">副标题 / 描述说明</label>
              <input
                type="text"
                value={config.customSubtitle}
                onChange={(e) => setConfig({ ...config, customSubtitle: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-medium text-slate-700 dark:text-slate-300">技术支持与工单链接 URL</label>
              <input
                type="url"
                value={config.supportContactUrl || ''}
                onChange={(e) => setConfig({ ...config, supportContactUrl: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-6 pt-2">
            <label className="flex items-center gap-3 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={config.isPublicEnabled}
                onChange={(e) => setConfig({ ...config, isPublicEnabled: e.target.checked })}
                className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500"
              />
              <span>启用公开状态页访问</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={config.hideInternalIps}
                onChange={(e) => setConfig({ ...config, hideInternalIps: e.target.checked })}
                className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500"
              />
              <span>在前台自动脱敏隐藏探针节点内网 IP 地址</span>
            </label>
          </div>
        </div>

        {/* 3. Announcement Banner Config */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-amber-500" />
              顶置维护与应急公告横幅 (Announcement Banner)
            </h4>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.announcement.enabled}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    announcement: { ...config.announcement, enabled: e.target.checked },
                  })
                }
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-amber-600" />
              <span className="ml-2 text-xs font-medium text-slate-700 dark:text-slate-300">
                {config.announcement.enabled ? '横幅已在前台显示' : '已隐藏'}
              </span>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1.5">
              <label className="font-medium text-slate-700 dark:text-slate-300">公告通知类型</label>
              <select
                value={config.announcement.type}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    announcement: {
                      ...config.announcement,
                      type: e.target.value as PublicStatusConfig['announcement']['type'],
                    },
                  })
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50"
              >
                <option value="info">常规通知 (Info)</option>
                <option value="warning">严重警告 (Warning)</option>
                <option value="maintenance">计划维护 (Maintenance)</option>
                <option value="success">故障已恢复 (Success)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-medium text-slate-700 dark:text-slate-300">公告标题</label>
              <input
                type="text"
                value={config.announcement.title}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    announcement: { ...config.announcement, title: e.target.value },
                  })
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <label className="font-medium text-slate-700 dark:text-slate-300">公告详细正文说明</label>
              <textarea
                rows={3}
                value={config.announcement.message}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    announcement: { ...config.announcement, message: e.target.value },
                  })
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold shadow-md transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? '保存中...' : '保存公开状态页设置'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
