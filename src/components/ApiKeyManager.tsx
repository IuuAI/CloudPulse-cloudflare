import React, { useState, useEffect, useCallback } from 'react';
import {
  Key,
  Shield,
  Eye,
  EyeOff,
  Sparkles,
  Cloud,
  Bot,
  Terminal,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Save,
  Copy,
  ExternalLink,
  Lock,
  Cpu,
  Webhook,
} from 'lucide-react';
import { SystemApiKeysConfig } from '../types';
import { fetchApiKeysConfig, saveApiKeysConfig, testApiKey } from '../api';

interface ApiKeyManagerProps {
  onShowToast: (type: 'success' | 'warning' | 'error' | 'info', title: string, desc?: string) => void;
}

export const ApiKeyManager: React.FC<ApiKeyManagerProps> = ({ onShowToast }) => {
  const [config, setConfig] = useState<SystemApiKeysConfig>({
    geminiApiKey: '',
    geminiModel: 'gemini-2.5-flash',
    cloudflareApiToken: '',
    cloudflareAccountId: '',
    cloudflareZoneId: '',
    telegramBotToken: '',
    telegramChatId: '',
    probeSecretKey: '',
    webhookSigningSecret: '',
    openApiBearerToken: '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Show/hide visibility toggles
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showCfToken, setShowCfToken] = useState(false);
  const [showTgToken, setShowTgToken] = useState(false);
  const [showProbeKey, setShowProbeKey] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);

  // Testing states
  const [testingKey, setTestingKey] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const loadKeys = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchApiKeysConfig();
      setConfig((prev) => ({
        ...prev,
        ...data,
      }));
    } catch (err: any) {
      console.error('Failed to load api keys:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadKeys();
  }, [loadKeys]);

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    onShowToast('success', '已复制到剪贴板', text.slice(0, 24) + '...');
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleGenerateRandomKey = (field: 'probeSecretKey' | 'webhookSigningSecret' | 'openApiBearerToken') => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_';
    let result = field === 'webhookSigningSecret' ? 'whsec_' : field === 'openApiBearerToken' ? 'cpm_token_' : 'probe_sec_';
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setConfig((prev) => ({ ...prev, [field]: result }));
    onShowToast('info', '已生成新随机密钥', '请记得点击右上角「保存设置」使新密钥生效');
  };

  const handleTestKey = async (type: 'gemini' | 'cloudflare' | 'telegram' | 'probe') => {
    setTestingKey(type);
    let keyVal = '';
    if (type === 'gemini') keyVal = config.geminiApiKey || '';
    if (type === 'cloudflare') keyVal = config.cloudflareApiToken || '';
    if (type === 'telegram') keyVal = config.telegramBotToken || '';
    if (type === 'probe') keyVal = config.probeSecretKey || '';

    try {
      const res = await testApiKey(type, keyVal);
      onShowToast('success', '连通测试成功', res.message);
    } catch (err: any) {
      onShowToast('error', '连通测试失败', err.message);
    } finally {
      setTestingKey(null);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await saveApiKeysConfig(config);
      onShowToast('success', 'API Key 配置已保存', res.message || '系统环境变量与凭证已更新');
      loadKeys();
    } catch (err: any) {
      onShowToast('error', '保存失败', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* 1. Header Banner */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
            <Key className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              API KEY 与多云服务凭证配置
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                安全隔离存储
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              集中配置与验证 Google AI Gemini、Cloudflare 边缘架构、Telegram Bot 告警及边缘探针 Agent 通信密匙
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadKeys}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>重新载入</span>
          </button>

          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
          >
            <Save className={`w-3.5 h-3.5 ${isSaving ? 'animate-spin' : ''}`} />
            <span>{isSaving ? '保存中...' : '保存全部 API Key'}</span>
          </button>
        </div>
      </div>

      {/* 2. Grid of API Key Services */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Module 0: Split Deployment Backend Worker URL */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Cloud className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Cloudflare Pages + Workers 分离部署配置 (API Base URL)
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  若前端静态页面托管在 Cloudflare Pages，后端 API 托管在独立的 Cloudflare Worker，请在此填入 Worker 访问地址
                </p>
              </div>
            </div>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                config.apiBaseUrl
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
              }`}
            >
              {config.apiBaseUrl ? '已绑定独立后端' : '默认同源 / 同域名'}
            </span>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Worker API 后端根地址 (API Base URL)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={config.apiBaseUrl || ''}
                  onChange={(e) => setConfig({ ...config, apiBaseUrl: e.target.value })}
                  placeholder="https://your-worker-backend.workers.dev"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                留空则默认使用同源请求。设置后所有 /api/* 请求将自动转发至此独立 Worker 地址（解决 Pages 静态托管只返回 HTML 的问题）。
              </p>
            </div>
          </div>
        </div>

        {/* Module A: Google AI Gemini Engine */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Google AI Gemini 智能引擎
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  用于故障智能根因诊断、故障通报自动生成与智能运维
                </p>
              </div>
            </div>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                config.geminiApiKey || config.hasGeminiApiKey
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
              }`}
            >
              {config.geminiApiKey || config.hasGeminiApiKey ? '已配置' : '未配置'}
            </span>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Gemini API Key
              </label>
              <div className="relative">
                <input
                  type={showGeminiKey ? 'text' : 'password'}
                  value={config.geminiApiKey || ''}
                  onChange={(e) => setConfig({ ...config, geminiApiKey: e.target.value })}
                  placeholder="AIzaSy..."
                  className="w-full px-3.5 py-2 pr-20 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setShowGeminiKey(!showGeminiKey)}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showGeminiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  {config.geminiApiKey && (
                    <button
                      type="button"
                      onClick={() => handleCopy(config.geminiApiKey || '', 'gemini')}
                      className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  推荐模型版本
                </label>
                <select
                  value={config.geminiModel || 'gemini-2.5-flash'}
                  onChange={(e) => setConfig({ ...config, geminiModel: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash (极速推荐)</option>
                  <option value="gemini-2.5-pro">Gemini 2.5 Pro (深度分析)</option>
                  <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                </select>
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => handleTestKey('gemini')}
                  disabled={testingKey === 'gemini'}
                  className="w-full py-2 px-3 rounded-xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                >
                  {testingKey === 'gemini' ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  <span>测试 Key 连通性</span>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1">
              <span>还没有 API Key？</span>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 font-medium"
              >
                <span>免费获取 Google AI Studio Key</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>

        {/* Module B: Cloudflare API Token & Account */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Cloud className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Cloudflare 边缘部署与 D1 凭证
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  用于 CI/CD 代码变更自动部署、D1 数据库与 KV 边缘缓存同步
                </p>
              </div>
            </div>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                config.cloudflareApiToken || config.hasCloudflareApiToken
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
              }`}
            >
              {config.cloudflareApiToken || config.hasCloudflareApiToken ? '已绑定' : '未绑定'}
            </span>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Cloudflare API Token (需包含 Workers/D1 编辑权限)
              </label>
              <div className="relative">
                <input
                  type={showCfToken ? 'text' : 'password'}
                  value={config.cloudflareApiToken || ''}
                  onChange={(e) => setConfig({ ...config, cloudflareApiToken: e.target.value })}
                  placeholder="例如：g7b-kL9QxW..."
                  className="w-full px-3.5 py-2 pr-12 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowCfToken(!showCfToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showCfToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Account ID
                </label>
                <input
                  type="text"
                  value={config.cloudflareAccountId || ''}
                  onChange={(e) => setConfig({ ...config, cloudflareAccountId: e.target.value })}
                  placeholder="32位十六进制字符串"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => handleTestKey('cloudflare')}
                  disabled={testingKey === 'cloudflare'}
                  className="w-full py-2 px-3 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 hover:bg-amber-100 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                >
                  {testingKey === 'cloudflare' ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Cloud className="w-3.5 h-3.5" />
                  )}
                  <span>验证 Token 授权</span>
                </button>
              </div>
            </div>

            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between pt-1">
              <span>GitHub Actions 部署密钥同步</span>
              <span className="font-mono text-[10px] text-slate-400">CLOUDFLARE_API_TOKEN</span>
            </div>
          </div>
        </div>



        {/* Module D: Probe Agent Ingest Secret Key */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Terminal className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  边缘探针通信密钥 (X-Probe-Key)
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  服务器边缘探针向中心上报 CPU、内存、延迟等指标时的身份鉴权
                </p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              探针安全隔离
            </span>
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  通信通信密钥 (X-Probe-Key)
                </label>
                <button
                  type="button"
                  onClick={() => handleGenerateRandomKey('probeSecretKey')}
                  className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline font-medium"
                >
                  重新生成强密钥
                </button>
              </div>
              <div className="relative">
                <input
                  type={showProbeKey ? 'text' : 'password'}
                  value={config.probeSecretKey || ''}
                  onChange={(e) => setConfig({ ...config, probeSecretKey: e.target.value })}
                  className="w-full px-3.5 py-2 pr-20 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setShowProbeKey(!showProbeKey)}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showProbeKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopy(config.probeSecretKey || '', 'probeSecretKey')}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Ready-to-copy Probe Report Command */}
            <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800 text-[11px] font-mono text-slate-600 dark:text-slate-400">
              <div className="flex items-center justify-between mb-1 text-[10px] text-slate-400 uppercase tracking-wider font-sans font-bold">
                <span>边缘节点一键心跳命令</span>
                <button
                  type="button"
                  onClick={() =>
                    handleCopy(
                      `curl -X POST https://your-domain.com/api/probe/report -H "X-Probe-Key: ${config.probeSecretKey || 'secret'}" -d '{"cpu": 15.2, "mem": 42.1}'`,
                      'probeCommand'
                    )
                  }
                  className="text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" />
                  <span>复制脚本</span>
                </button>
              </div>
              <div className="truncate">
                curl -X POST /api/probe/report -H "X-Probe-Key: {config.probeSecretKey?.slice(0, 10)}..."
              </div>
            </div>
          </div>
        </div>

        {/* Module E: Webhook Signature Secret & OpenAPI Bearer Token */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400">
                <Webhook className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Webhook 签名秘钥与 OpenAPI 授权令牌
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  保障外部系统（Prometheus、Grafana、企业微信/飞书/Slack）回调及数据拉取的安全性
                </p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300">
              HMAC-SHA256
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Webhook HMAC 签名密钥
                </label>
                <button
                  type="button"
                  onClick={() => handleGenerateRandomKey('webhookSigningSecret')}
                  className="text-[11px] text-teal-600 dark:text-teal-400 hover:underline"
                >
                  随机生成
                </button>
              </div>
              <div className="relative">
                <input
                  type={showWebhookSecret ? 'text' : 'password'}
                  value={config.webhookSigningSecret || ''}
                  onChange={(e) => setConfig({ ...config, webhookSigningSecret: e.target.value })}
                  className="w-full px-3.5 py-2 pr-12 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowWebhookSecret(!showWebhookSecret)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showWebhookSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  OpenAPI Bearer Token
                </label>
                <button
                  type="button"
                  onClick={() => handleGenerateRandomKey('openApiBearerToken')}
                  className="text-[11px] text-teal-600 dark:text-teal-400 hover:underline"
                >
                  随机生成
                </button>
              </div>
              <input
                type="text"
                value={config.openApiBearerToken || ''}
                onChange={(e) => setConfig({ ...config, openApiBearerToken: e.target.value })}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono"
              />
            </div>
          </div>
        </div>
      </div>
    </form>
  );
};
