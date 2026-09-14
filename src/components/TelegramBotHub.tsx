import React, { useState, useEffect } from 'react';
import {
  Bot,
  Send,
  Settings,
  ListFilter,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  RefreshCw,
  Bell,
  Zap,
  Shield,
  Radio,
  FileText,
} from 'lucide-react';
import {
  TelegramConfig,
  TelegramLogItem,
} from '../types';
import {
  sendTelegramPush,
  saveTelegramConfig,
  pollTelegramUpdates,
} from '../api';

interface TelegramBotHubProps {
  config: (TelegramConfig & { hasBotToken: boolean; botTokenPreview: string }) | null;
  logs: TelegramLogItem[];
  onRefreshData: () => void;
  onShowToast: (type: 'success' | 'warning' | 'error' | 'info', title: string, desc?: string) => void;
}

export const TelegramBotHub: React.FC<TelegramBotHubProps> = ({
  config,
  logs = [],
  onRefreshData,
  onShowToast,
}) => {
  const safeLogs = Array.isArray(logs) ? logs : [];
  const [subTab, setSubTab] = useState<'push' | 'autoalerts' | 'config' | 'logs'>('push');

  // Push Tab State
  const [pushText, setPushText] = useState(
`🚨 <b>【CloudPulse 监控告警】</b>

<b>事件:</b> 核心 API 网关响应延迟突增超过阈值
<b>指标:</b> 当前延迟 340ms (正常 < 50ms)
<b>影响范围:</b> 欧洲与亚太边缘接入层
<b>时间:</b> ${new Date().toLocaleTimeString()}

<i>运维团队正在全力介入排查，请关注实时看板。</i>`
  );
  const [customChatId, setCustomChatId] = useState('');
  const [isSendingPush, setIsSendingPush] = useState(false);

  // Config Tab State
  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState(config?.chatId || '');
  const [botUsername, setBotUsername] = useState(config?.botUsername || 'CloudPulseBot');
  const [autoAlerts, setAutoAlerts] = useState({
    serviceStatusChanged: config?.autoAlerts?.serviceStatusChanged ?? true,
    incidentCreated: config?.autoAlerts?.incidentCreated ?? true,
    incidentResolved: config?.autoAlerts?.incidentResolved ?? true,
    nodeOffline: config?.autoAlerts?.nodeOffline ?? true,
    cpuThresholdAlert: config?.autoAlerts?.cpuThresholdAlert ?? true,
  });
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [isPolling, setIsPolling] = useState(false);

  // Synchronize form values when configuration arrives asynchronously
  useEffect(() => {
    if (config) {
      if (config.chatId && !chatId) setChatId(config.chatId);
      if (config.botUsername) setBotUsername(config.botUsername);
      if (config.autoAlerts) {
        setAutoAlerts({
          serviceStatusChanged: config.autoAlerts.serviceStatusChanged ?? true,
          incidentCreated: config.autoAlerts.incidentCreated ?? true,
          incidentResolved: config.autoAlerts.incidentResolved ?? true,
          nodeOffline: config.autoAlerts.nodeOffline ?? true,
          cpuThresholdAlert: config.autoAlerts.cpuThresholdAlert ?? true,
        });
      }
    }
  }, [config]);

  // Quick push templates
  const applyTemplate = (type: string) => {
    const time = new Date().toLocaleTimeString();
    if (type === 'incident') {
      setPushText(
`🚨 <b>【紧急生产故障通报】</b>

<b>故障组件:</b> 数据库只读从库同步延迟
<b>故障级别:</b> MAJOR
<b>通报时间:</b> ${time}
<b>当前状态:</b> 运维小组正在同步追平数据 Binlog

<i>实时大盘与探针状态请查看 CloudPulse 监控看板。</i>`
      );
    } else if (type === 'recovery') {
      setPushText(
`🎉 <b>【全链路故障恢复通知】</b>

<b>恢复组件:</b> 核心支付微服务网关
<b>恢复时间:</b> ${time}
<b>验证结论:</b> 已完成 10 分钟压力探测，全链路延迟与吞吐均恢复至 SLA 正常标准。

<i>系统运行平稳，感谢大家的耐心等待。</i>`
      );
    } else if (type === 'maintenance') {
      setPushText(
`🛠 <b>【计划性例行维护公告】</b>

<b>维护窗口:</b> 今晚 23:00 - 23:30 (UTC+8)
<b>维护项目:</b> Redis 缓存集群规格平滑在线扩容
<b>预期影响:</b> 双机热备不停机，偶发约 3 秒轻微抖动。`
      );
    } else if (type === 'daily') {
      setPushText(
`📊 <b>【CloudPulse 每日运维健康简报】</b>

• 全站可用率 SLA: <b>99.98%</b>
• 探针在线节点: <b>4/4 台正常在线</b>
• 核心微服务运行数: <b>6/6 正常运行</b>
• 活跃故障事件: <b>0 起</b>

<i>基础设施运转良好，祝工作顺利！</i>`
      );
    }
  };

  const handleSendPush = async () => {
    if (!pushText.trim()) return;
    setIsSendingPush(true);
    try {
      const res = await sendTelegramPush({
        text: pushText,
        chatId: customChatId || undefined,
        parseMode: 'HTML',
      });
      if (res.status === 'sent') {
        onShowToast('success', 'Telegram 推送已送达！', '消息已成功发送至您的 Telegram 频道/群组。');
      } else if (res.status === 'simulated') {
        onShowToast(
          'info',
          '已记录推送通知 (模拟分发模式)',
          res.error || '未配置实时 Token 或网络访问受限，已在系统推送日志中留存。'
        );
      } else {
        onShowToast('warning', '推送未完全送达', res.error || 'Telegram 返回了错误状态码');
      }
      onRefreshData();
    } catch (err: any) {
      onShowToast('error', '推送发送失败', err.message);
    } finally {
      setIsSendingPush(false);
    }
  };

  const handleSendTestPush = async () => {
    setIsSendingPush(true);
    try {
      const res = await sendTelegramPush({
        text: `🏓 <b>【CloudPulse 告警推送通道测试】</b>\n\n• 状态: 通道正常连接\n• 时间: ${new Date().toLocaleTimeString()}\n• Bot: @${config?.botUsername || 'CloudPulseBot'}\n\n<i>此消息为测试探针与通知管道的连通性。</i>`,
        parseMode: 'HTML',
      });
      if (res.status === 'sent') {
        onShowToast('success', '测试推送成功送达！', 'Telegram Bot 凭证有效，可正常接收告警。');
      } else {
        onShowToast('info', '已记录测试推送 (模拟模式)', res.error || 'Token 尚未配置或容器网络无法直连 Telegram。');
      }
      onRefreshData();
    } catch (err: any) {
      onShowToast('error', '测试推送异常', err.message);
    } finally {
      setIsSendingPush(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingConfig(true);
    try {
      await saveTelegramConfig({
        botToken: botToken || undefined,
        chatId,
        botUsername,
        autoAlerts,
      });
      onShowToast('success', 'Telegram Bot 配置已保存！', '机器人凭证与自动告警规则已生效。');
      onRefreshData();
    } catch (err: any) {
      onShowToast('error', '保存失败', err.message);
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleManualPoll = async () => {
    setIsPolling(true);
    try {
      const res = await pollTelegramUpdates();
      if (res.success) {
        onShowToast('success', 'Telegram 轮询拉取完成', `已同步 ${res.processedCount || 0} 条状态。`);
        onRefreshData();
      } else {
        onShowToast('warning', '未能拉取新消息', res.error || '可能是网络受限或暂无未读消息。');
      }
    } catch (err: any) {
      onShowToast('error', '轮询异常', err.message);
    } finally {
      setIsPolling(false);
    }
  };

  const webhookUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/tg/webhook` : 'https://YOUR_DOMAIN/api/tg/webhook';

  const copyWebhookCommand = () => {
    const cmd = `curl -F "url=${webhookUrl}" https://api.telegram.org/bot${botToken || config?.botToken || '<YOUR_BOT_TOKEN>'}/setWebhook`;
    navigator.clipboard.writeText(cmd);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
    onShowToast('info', '已复制 Webhook 配置脚本', '在终端中运行即可将 Telegram 官方消息直接推向当前服务。');
  };

  return (
    <div id="telegram-bot-hub-container" className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-sky-500/10 via-sky-500/5 to-transparent dark:from-sky-950/40 dark:via-slate-900 dark:to-slate-900 p-6 rounded-2xl border border-sky-200 dark:border-sky-900/60 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-3 bg-sky-500 text-white rounded-xl shadow-xs shrink-0">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  Telegram 消息与告警推送中心
                </h2>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-sky-100 text-sky-800 dark:bg-sky-900/80 dark:text-sky-200">
                  纯粹推送通道 • 安全解耦
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 max-w-2xl leading-relaxed">
                专职负责向 Telegram 运维群组、频道或个人会话分发<strong>紧急故障告警、微服务抖动通报与服务器探针负载预警</strong>。系统数据录入与探针管理统一在 Web 运维后台进行安全管控。
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
            <button
              onClick={handleSendTestPush}
              disabled={isSendingPush}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl bg-sky-600 hover:bg-sky-700 text-white shadow-xs transition-colors disabled:opacity-50"
              title="向配置的 Chat ID 发送一条测试连通性消息"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>发送测试消息</span>
            </button>

            <button
              onClick={handleManualPoll}
              disabled={isPolling}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 shadow-xs transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isPolling ? 'animate-spin text-sky-500' : ''}`} />
              <span>拉取更新</span>
            </button>
          </div>
        </div>

        {/* Sub Navigation */}
        <div className="flex items-center gap-2 mt-6 pt-4 border-t border-sky-100 dark:border-slate-800/80 overflow-x-auto">
          <button
            id="subtab-push"
            onClick={() => setSubTab('push')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
              subTab === 'push'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-800'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>即时广播推送</span>
          </button>

          <button
            id="subtab-autoalerts"
            onClick={() => setSubTab('autoalerts')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
              subTab === 'autoalerts'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-800'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>自动告警规则</span>
          </button>

          <button
            id="subtab-config"
            onClick={() => setSubTab('config')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
              subTab === 'config'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-800'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Bot 凭证设置</span>
          </button>

          <button
            id="subtab-logs"
            onClick={() => setSubTab('logs')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
              subTab === 'logs'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-800'
            }`}
          >
            <ListFilter className="w-3.5 h-3.5" />
            <span>推送历史审计 ({safeLogs.length})</span>
          </button>
        </div>
      </div>

      {/* SubTab 1: Broadcast Push */}
      {subTab === 'push' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Send className="w-4 h-4 text-sky-500" />
                <span>运维消息推送编辑器</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                支持 HTML 格式（&lt;b&gt;加粗&lt;/b&gt;、&lt;code&gt;代码&lt;/code&gt;、&lt;i&gt;斜体&lt;/i&gt;），一键推送至频道或运维值班群
              </p>
            </div>

            {/* Quick Template Chips */}
            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                快速套用预设模板
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => applyTemplate('incident')}
                  className="px-2.5 py-1 text-xs rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 transition-colors"
                >
                  🚨 故障告警模板
                </button>
                <button
                  type="button"
                  onClick={() => applyTemplate('recovery')}
                  className="px-2.5 py-1 text-xs rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition-colors"
                >
                  ✅ 恢复通报模板
                </button>
                <button
                  type="button"
                  onClick={() => applyTemplate('maintenance')}
                  className="px-2.5 py-1 text-xs rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 transition-colors"
                >
                  🛠 例行维护模板
                </button>
                <button
                  type="button"
                  onClick={() => applyTemplate('daily')}
                  className="px-2.5 py-1 text-xs rounded-lg bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 hover:bg-sky-100 transition-colors"
                >
                  📊 运行早报模板
                </button>
              </div>
            </div>

            {/* Target Chat ID */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                指定目标 Chat ID 或 @频道名 (留空则默认使用全局 Chat ID: {config?.chatId || '未配置'})
              </label>
              <input
                type="text"
                value={customChatId}
                onChange={(e) => setCustomChatId(e.target.value)}
                placeholder={config?.chatId || '@your_channel_or_chat_id'}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono"
              />
            </div>

            {/* Message Body */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                推送正文 (HTML 格式)
              </label>
              <textarea
                rows={7}
                value={pushText}
                onChange={(e) => setPushText(e.target.value)}
                className="w-full text-xs p-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-400">
                当前 Bot: <strong className="text-slate-600 dark:text-slate-300">@{config?.botUsername || 'CloudPulseBot'}</strong>
              </span>

              <button
                id="btn-send-telegram-push"
                onClick={handleSendPush}
                disabled={isSendingPush || !pushText.trim()}
                className="flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded-xl bg-sky-600 hover:bg-sky-700 text-white shadow-xs transition-colors disabled:opacity-50"
              >
                <Send className={`w-3.5 h-3.5 ${isSendingPush ? 'animate-bounce' : ''}`} />
                <span>{isSendingPush ? '正在分发推送...' : '立即发送推送至 Telegram'}</span>
              </button>
            </div>
          </div>

          {/* Right Live Preview */}
          <div className="bg-slate-100/70 dark:bg-slate-900/60 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Bot className="w-4 h-4 text-sky-500" />
                  <span>Telegram 客户端渲染实时预览</span>
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 font-mono">
                  Live View
                </span>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-full bg-sky-500 text-white flex items-center justify-center text-[10px] font-bold">
                    CP
                  </div>
                  <div>
                    <span className="text-xs font-bold text-sky-600 dark:text-sky-400">
                      {config?.botUsername || 'CloudPulseBot'}
                    </span>
                    <span className="text-[10px] text-slate-400 ml-1.5">bot</span>
                  </div>
                </div>

                <div
                  className="text-xs text-slate-800 dark:text-slate-100 whitespace-pre-wrap leading-relaxed font-sans"
                  dangerouslySetInnerHTML={{ __html: pushText }}
                />

                <div className="text-right mt-2 text-[10px] text-slate-400">
                  {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 space-y-1">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>自动留存与故障降级机制已激活</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-normal">
                在无外网直连或开发模拟环境下，系统自动把消息留存至日志流并标记为模拟模式，保障运维链路零中断。
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SubTab 2: Auto Alerts */}
      {subTab === 'autoalerts' && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Bell className="w-4 h-4 text-sky-500" />
              <span>全链路自动化告警触发规则配置</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              当系统、微服务或服务器探针触发异常状态时，全自动格式化并通过 Telegram 推送至值班群
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex items-start justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  微服务状态波动告警
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  当监控的 API / 前端 / 数据库服务由正常变为降级或重大故障时，立即推送告警。
                </p>
              </div>
              <input
                type="checkbox"
                checked={autoAlerts.serviceStatusChanged}
                onChange={(e) =>
                  setAutoAlerts({ ...autoAlerts, serviceStatusChanged: e.target.checked })
                }
                className="mt-1 rounded text-sky-600 focus:ring-sky-500 w-4 h-4"
              />
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex items-start justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  新增生产故障事件广播
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  在应急响应中心录入新的 Minor / Major / Critical 故障事件时，全自动格式化广播。
                </p>
              </div>
              <input
                type="checkbox"
                checked={autoAlerts.incidentCreated}
                onChange={(e) =>
                  setAutoAlerts({ ...autoAlerts, incidentCreated: e.target.checked })
                }
                className="mt-1 rounded text-sky-600 focus:ring-sky-500 w-4 h-4"
              />
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex items-start justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  故障解除与恢复通报
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  故障排查完毕并标记为 Resolved 时，自动在 Telegram 播报解除通告与排查总结。
                </p>
              </div>
              <input
                type="checkbox"
                checked={autoAlerts.incidentResolved}
                onChange={(e) =>
                  setAutoAlerts({ ...autoAlerts, incidentResolved: e.target.checked })
                }
                className="mt-1 rounded text-sky-600 focus:ring-sky-500 w-4 h-4"
              />
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex items-start justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  服务器探针心跳失联预警
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  已安装探针的物理/虚拟机超过 120 秒未上报监控心跳时，自动告警通知。
                </p>
              </div>
              <input
                type="checkbox"
                checked={autoAlerts.nodeOffline}
                onChange={(e) =>
                  setAutoAlerts({ ...autoAlerts, nodeOffline: e.target.checked })
                }
                className="mt-1 rounded text-sky-600 focus:ring-sky-500 w-4 h-4"
              />
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex items-start justify-between gap-3 md:col-span-2">
              <div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  服务器高负载阈值告警 (CPU &gt; 85% 或 内存 &gt; 90%)
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  当探针采集到的服务器 CPU 占用突破 85% 或物理内存占用突破 90% 时触发预警。
                </p>
              </div>
              <input
                type="checkbox"
                checked={autoAlerts.cpuThresholdAlert}
                onChange={(e) =>
                  setAutoAlerts({ ...autoAlerts, cpuThresholdAlert: e.target.checked })
                }
                className="mt-1 rounded text-sky-600 focus:ring-sky-500 w-4 h-4"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={handleSaveConfig}
              disabled={isSavingConfig}
              className="px-5 py-2 text-xs font-semibold rounded-xl bg-sky-600 hover:bg-sky-700 text-white shadow-xs transition-colors"
            >
              {isSavingConfig ? '保存中...' : '保存告警规则'}
            </button>
          </div>
        </div>
      )}

      {/* SubTab 3: Bot Config & Webhook */}
      {subTab === 'config' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-6">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Settings className="w-4 h-4 text-sky-500" />
                <span>Telegram Bot 凭证与会话绑定</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                配置由 Telegram 官方 BotFather 分发的 API Token 与通知目标 Chat ID
              </p>
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Telegram Bot Token
                </label>
                <input
                  type="password"
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  placeholder={
                    config?.hasBotToken
                      ? `已配置 Token (${config.botTokenPreview})`
                      : '由 @BotFather 生成的 Token，例如: 123456789:ABCdefGhIJKlmNo...'
                  }
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  前往 Telegram 搜索 <strong>@BotFather</strong> 发送 <code>/newbot</code> 获取 Token。若留空则保持现有配置。
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    目标 Chat ID 或 @公开频道名
                  </label>
                  <input
                    type="text"
                    value={chatId}
                    onChange={(e) => setChatId(e.target.value)}
                    placeholder="如 -100123456789 或 @my_ops_channel"
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    群组或频道 ID，可通过 <strong>@userinfobot</strong> 转发消息查询。
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Bot 用户名
                  </label>
                  <input
                    type="text"
                    value={botUsername}
                    onChange={(e) => setBotUsername(e.target.value)}
                    placeholder="如 CloudPulseBot"
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isSavingConfig}
                  className="px-5 py-2 text-xs font-semibold rounded-xl bg-sky-600 hover:bg-sky-700 text-white shadow-xs transition-colors"
                >
                  {isSavingConfig ? '保存中...' : '保存凭证配置'}
                </button>
              </div>
            </form>
          </div>

          {/* Webhook Guide */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-sky-500" />
              <span>官方 Webhook 监听配置</span>
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              设置 Webhook 后，用户向 Bot 发送 /status 等指令时，机器人可直接返回全集群健康度播报。
            </p>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/70 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5">
              <span className="text-[11px] font-semibold text-slate-400 block">本站 Webhook URL:</span>
              <div className="font-mono text-xs text-slate-800 dark:text-slate-200 break-all select-all">
                {webhookUrl}
              </div>
            </div>

            <button
              onClick={copyWebhookCommand}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors"
            >
              {copiedWebhook ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedWebhook ? '已复制 cURL 注册指令' : '复制 Webhook 注册脚本'}</span>
            </button>

            <div className="p-3.5 rounded-xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/60 text-xs text-sky-800 dark:text-sky-200">
              <span className="font-semibold block mb-0.5">安全架构设计</span>
              如需添加服务器探针、新增微服务拨测或修改故障事件，请直接进入顶部的<strong>「后台管理」</strong>控制台进行操作。
            </div>
          </div>
        </div>
      )}

      {/* SubTab 4: Logs */}
      {subTab === 'logs' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ListFilter className="w-4 h-4 text-sky-500" />
                <span>Telegram 推送审计流水</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                实时追踪系统自动告警与手动广播分发的到达状态
              </p>
            </div>
            <button
              onClick={onRefreshData}
              className="flex items-center gap-1 text-xs text-sky-600 dark:text-sky-400 hover:underline"
            >
              <RefreshCw className="w-3 h-3" />
              <span>刷新流水</span>
            </button>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[500px] overflow-y-auto">
            {safeLogs.map((log) => {
              const statusBadge = {
                sent: (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    DELIVERED
                  </span>
                ),
                simulated: (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300">
                    SIMULATED
                  </span>
                ),
                failed: (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                    FAILED
                  </span>
                ),
              }[log.status];

              return (
                <div key={log.id} className="p-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                  <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                    <div className="flex items-center gap-2">
                      {statusBadge}
                      <span className="font-semibold text-xs text-slate-800 dark:text-slate-200">
                        {log.sender}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">
                        Chat: {log.chatId}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                  </div>

                  <div className="text-xs text-slate-600 dark:text-slate-300 font-mono bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-lg whitespace-pre-wrap break-words">
                    {log.content}
                  </div>

                  {log.error && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                      ⚠️ 提示: {log.error}
                    </p>
                  )}
                  {log.dataAction && (
                    <span className="inline-block mt-1 text-[10px] font-mono text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/60 px-2 py-0.5 rounded">
                      Trigger: {log.dataAction}
                    </span>
                  )}
                </div>
              );
            })}

            {safeLogs.length === 0 && (
              <div className="text-center py-12 text-slate-400 text-xs">
                暂无推送审计记录
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
