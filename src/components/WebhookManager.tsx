import React, { useState, useEffect, useCallback } from 'react';
import {
  Webhook,
  Send,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Shield,
  RefreshCw,
  Sliders,
  Bell,
  Check,
  Settings,
  MessageSquare,
} from 'lucide-react';
import { WebhookChannelConfig, MaintenanceWindowConfig, WebhookChannelType } from '../types';
import {
  fetchWebhooks,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  testWebhook,
  fetchMaintenanceWindow,
  updateMaintenanceWindow,
} from '../api';

interface WebhookManagerProps {
  onShowToast: (type: 'success' | 'warning' | 'error' | 'info', title: string, desc?: string) => void;
}

export const WebhookManager: React.FC<WebhookManagerProps> = ({ onShowToast }) => {
  const [webhooks, setWebhooks] = useState<WebhookChannelConfig[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceWindowConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  // New modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<WebhookChannelType>('wecom');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [events, setEvents] = useState({
    serviceOutage: true,
    serviceRecovered: true,
    nodeOffline: true,
    highLoad: true,
    sslExpiring: true,
    backupCompleted: false,
  });
  const [isSaving, setIsSaving] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [whRes, mwRes] = await Promise.all([
        fetchWebhooks().catch(() => []),
        fetchMaintenanceWindow().catch(() => null),
      ]);
      setWebhooks(Array.isArray(whRes) ? whRes : []);
      if (mwRes && typeof mwRes === 'object' && !('error' in mwRes)) setMaintenance(mwRes);
    } catch (err: any) {
      console.error('Failed to load webhook data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleTest = async (id: string, channelName: string) => {
    setTestingId(id);
    try {
      const res = await testWebhook(id);
      if (res.success) {
        onShowToast('success', '测试推送成功', `已向「${channelName}」发送模拟告警通知`);
        await loadData();
      }
    } catch (err: any) {
      onShowToast('error', '测试推送失败', err.message);
    } finally {
      setTestingId(null);
    }
  };

  const handleDelete = async (id: string, channelName: string) => {
    if (!confirm(`确认要删除 Webhook 通道「${channelName}」吗？`)) return;
    try {
      await deleteWebhook(id);
      onShowToast('info', 'Webhook 通道已删除', channelName);
      await loadData();
    } catch (err: any) {
      onShowToast('error', '删除失败', err.message);
    }
  };

  const handleToggleEnable = async (wh: WebhookChannelConfig) => {
    try {
      await updateWebhook(wh.id, { enabled: !wh.enabled });
      onShowToast('success', '通道状态已更新', `「${wh.name}」已${!wh.enabled ? '启用' : '禁用'}`);
      await loadData();
    } catch (err: any) {
      onShowToast('error', '更新失败', err.message);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !webhookUrl.trim()) {
      onShowToast('error', '创建失败', '通道名称和 Webhook URL 不可为空');
      return;
    }
    setIsSaving(true);
    try {
      await createWebhook({
        name: name.trim(),
        type,
        webhookUrl: webhookUrl.trim(),
        secret: secret.trim(),
        enabled: true,
        events,
      });
      onShowToast('success', 'Webhook 通道添加成功', name);
      setIsModalOpen(false);
      setName('');
      setWebhookUrl('');
      setSecret('');
      await loadData();
    } catch (err: any) {
      onShowToast('error', '创建失败', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveMaintenance = async () => {
    if (!maintenance) return;
    try {
      await updateMaintenanceWindow(maintenance);
      onShowToast('success', '系统维护时间窗已更新', '告警静默规则已生效');
    } catch (err: any) {
      onShowToast('error', '更新失败', err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Add Button */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Webhook className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                多通道群机器人与 Webhook 告警中心
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                  企业微信 / 钉钉 / 飞书 / Discord
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                支持事件触发多路分发、签名校验、手动测试推送及系统维护时段静默
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => loadData()}
            disabled={isLoading}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
            title="刷新通道"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>添加告警通道</span>
          </button>
        </div>
      </div>

      {/* 2. Maintenance Window Card */}
      {maintenance && (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                系统维护窗口与告警静默 (Maintenance Window)
              </h4>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={maintenance.enabled}
                onChange={(e) => setMaintenance({ ...maintenance, enabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-amber-600" />
              <span className="ml-2 text-xs font-medium text-slate-700 dark:text-slate-300">
                {maintenance.enabled ? '已开启维护静默' : '已关闭'}
              </span>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-slate-500">静默开始小时 (0-23)</label>
              <input
                type="number"
                min={0}
                max={23}
                value={maintenance.startHour}
                onChange={(e) => setMaintenance({ ...maintenance, startHour: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-500">静默结束小时 (0-23)</label>
              <input
                type="number"
                min={0}
                max={23}
                value={maintenance.endHour}
                onChange={(e) => setMaintenance({ ...maintenance, endHour: parseInt(e.target.value) || 6 })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-xs"
              />
            </div>
            <div className="space-y-1 flex flex-col justify-end">
              <button
                onClick={handleSaveMaintenance}
                className="w-full px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-xs font-semibold transition-colors"
              >
                保存维护静默规则
              </button>
            </div>
          </div>
          <div className="text-[11px] text-slate-400">
            在维护时段内，非核心紧急故障的 Webhook 告警将被自动抑制或静默，防止夜间频繁告警轰炸。
          </div>
        </div>
      )}

      {/* 3. Webhook Channels Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {webhooks.map((wh) => (
          <div
            key={wh.id}
            className={`p-5 rounded-2xl bg-white dark:bg-slate-900 border ${
              wh.enabled
                ? 'border-slate-200/80 dark:border-slate-800'
                : 'border-slate-200/40 dark:border-slate-800/50 opacity-60'
            } shadow-xs space-y-4`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`p-2.5 rounded-xl ${
                    wh.type === 'wecom'
                      ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                      : wh.type === 'dingtalk'
                      ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400'
                      : wh.type === 'feishu'
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                  }`}
                >
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    {wh.name}
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      {wh.type}
                    </span>
                  </h4>
                  <div className="text-xs font-mono text-slate-400 truncate max-w-[240px] sm:max-w-[320px] mt-0.5">
                    {wh.webhookUrl}
                  </div>
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={wh.enabled}
                  onChange={() => handleToggleEnable(wh)}
                  className="sr-only peer"
                />
                <div className="w-8 h-4 bg-slate-200 peer-focus:outline-hidden rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all dark:border-slate-600 peer-checked:bg-purple-600" />
              </label>
            </div>

            {/* Event triggers pill list */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {wh.events.serviceOutage && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                  服务宕机
                </span>
              )}
              {wh.events.serviceRecovered && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                  服务恢复
                </span>
              )}
              {wh.events.nodeOffline && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                  探针离线
                </span>
              )}
              {wh.events.highLoad && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300">
                  高负载告警
                </span>
              )}
              {wh.events.sslExpiring && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                  SSL 证书到期
                </span>
              )}
              {wh.events.backupCompleted && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                  备份归档
                </span>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
              <span className="text-[11px] text-slate-400">
                最后测试: {wh.lastTestedAt ? new Date(wh.lastTestedAt).toLocaleTimeString() : '从未'}
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleTest(wh.id, wh.name)}
                  disabled={testingId === wh.id}
                  className="px-3 py-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 font-semibold transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Send className={`w-3 h-3 ${testingId === wh.id ? 'animate-bounce' : ''}`} />
                  <span>{testingId === wh.id ? '测试中...' : '测试推送'}</span>
                </button>

                <button
                  onClick={() => handleDelete(wh.id, wh.name)}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-500 transition-colors"
                  title="删除通道"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Webhook Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Webhook className="w-5 h-5 text-purple-500" />
                添加群机器人或 Webhook 告警通道
              </h4>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-medium text-slate-700 dark:text-slate-300">通道名称</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例如：核心运维技术钉钉群"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-medium text-slate-700 dark:text-slate-300">通道平台类型</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as WebhookChannelType)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50"
                >
                  <option value="wecom">企业微信机器人 (WeCom)</option>
                  <option value="dingtalk">钉钉机器人 (DingTalk)</option>
                  <option value="feishu">飞书机器人 (Feishu)</option>
                  <option value="discord">Discord Webhook</option>
                  <option value="slack">Slack Webhook</option>
                  <option value="webhook">自定义通用 Webhook</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-medium text-slate-700 dark:text-slate-300">Webhook 接口 URL</label>
                <input
                  type="url"
                  required
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 font-mono"
                />
              </div>

              {(type === 'dingtalk' || type === 'feishu') && (
                <div className="space-y-1.5">
                  <label className="font-medium text-slate-700 dark:text-slate-300">安全密钥 / 签名秘钥 (Secret)</label>
                  <input
                    type="text"
                    value={secret}
                    onChange={(e) => setSecret(e.target.value)}
                    placeholder="SEC..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 font-mono"
                  />
                </div>
              )}

              <div className="space-y-2 pt-2">
                <label className="font-medium text-slate-700 dark:text-slate-300">订阅触发事件</label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={events.serviceOutage}
                      onChange={(e) => setEvents({ ...events, serviceOutage: e.target.checked })}
                    />
                    <span>服务故障下线 (Outage)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={events.serviceRecovered}
                      onChange={(e) => setEvents({ ...events, serviceRecovered: e.target.checked })}
                    />
                    <span>服务恢复正常 (Recovered)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={events.nodeOffline}
                      onChange={(e) => setEvents({ ...events, nodeOffline: e.target.checked })}
                    />
                    <span>探针服务器离线</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={events.highLoad}
                      onChange={(e) => setEvents({ ...events, highLoad: e.target.checked })}
                    />
                    <span>CPU/内存高负载</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={events.sslExpiring}
                      onChange={(e) => setEvents({ ...events, sslExpiring: e.target.checked })}
                    />
                    <span>SSL 证书即将到期</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={events.backupCompleted}
                      onChange={(e) => setEvents({ ...events, backupCompleted: e.target.checked })}
                    />
                    <span>定时备份完成</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold disabled:opacity-50"
                >
                  {isSaving ? '保存中...' : '确认添加'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
