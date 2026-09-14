import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  PlusCircle,
  MessageSquare,
  ShieldAlert,
} from 'lucide-react';
import { Incident, IncidentSeverity, IncidentStatus } from '../types';

interface IncidentSectionProps {
  incidents: Incident[];
  onCreateIncident: (incident: Partial<Incident>) => Promise<void>;
  onAddUpdate: (incidentId: string, status: IncidentStatus, message: string) => Promise<void>;
  onResolveIncident: (incidentId: string, message: string) => Promise<void>;
}

export const IncidentSection: React.FC<IncidentSectionProps> = ({
  incidents = [],
  onCreateIncident,
  onAddUpdate,
  onResolveIncident,
}) => {
  const safeIncidents = Array.isArray(incidents) ? incidents : [];
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');

  // Form states for creating incident
  const [title, setTitle] = useState('');
  const [severity, setSeverity] = useState<IncidentSeverity>('minor');
  const [description, setDescription] = useState('');
  const [affected, setAffected] = useState('REST & GraphQL Core Gateway');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state for adding update
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [updateStatus, setUpdateStatus] = useState<IncidentStatus>('monitoring');
  const [updateMessage, setUpdateMessage] = useState('');

  const activeIncidents = safeIncidents.filter((i) => i.status !== 'resolved');
  const pastIncidents = safeIncidents.filter((i) => i.status === 'resolved');

  const displayedIncidents = activeTab === 'active' ? activeIncidents : pastIncidents;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setIsSubmitting(true);
    try {
      await onCreateIncident({
        title,
        severity,
        affectedServices: affected ? [affected] : [],
        timeline: [
          {
            id: `upd-${Date.now()}`,
            status: 'investigating',
            message: description || '运维团队已收到告警，正在全力排查故障原因。',
            timestamp: new Date().toISOString(),
          },
        ],
      });
      setTitle('');
      setDescription('');
      setShowCreateModal(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePostUpdate = async (incidentId: string) => {
    if (!updateMessage.trim()) return;
    await onAddUpdate(incidentId, updateStatus, updateMessage);
    setUpdateMessage('');
    setSelectedIncidentId(null);
  };

  const getSeverityBadge = (sev: IncidentSeverity) => {
    switch (sev) {
      case 'critical':
        return (
          <span className="px-2 py-0.5 text-xs font-bold rounded bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
            CRITICAL
          </span>
        );
      case 'major':
        return (
          <span className="px-2 py-0.5 text-xs font-bold rounded bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300 border border-orange-300 dark:border-orange-800">
            MAJOR
          </span>
        );
      case 'minor':
        return (
          <span className="px-2 py-0.5 text-xs font-bold rounded bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
            MINOR
          </span>
        );
    }
  };

  return (
    <div id="incidents-page-container" className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-500" />
            <span>故障事件与应急响应中心</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            发布、跟进与解除生产环境故障，所有事件变动将全自动推送至 Telegram 运维广播通道
          </p>
        </div>

        <button
          id="btn-open-create-incident"
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-amber-500 hover:bg-amber-600 text-white shadow-xs transition-colors self-start sm:self-auto"
        >
          <PlusCircle className="w-4 h-4" />
          <span>报告新故障事件</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('active')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
            activeTab === 'active'
              ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>处理中事件 ({activeIncidents.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
            activeTab === 'history'
              ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          <span>历史事件记录 ({pastIncidents.length})</span>
        </button>
      </div>

      {/* Incident List */}
      <div className="space-y-4">
        {displayedIncidents.map((incident) => (
          <div
            key={incident.id}
            id={`incident-card-${incident.id}`}
            className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4"
          >
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5 flex-wrap">
                  {getSeverityBadge(incident.severity)}
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {incident.title}
                  </h3>
                  <span className="font-mono text-xs text-slate-400">
                    ID: {incident.id}
                  </span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <span>创建时间: {new Date(incident.createdAt).toLocaleString()}</span>
                  <span>•</span>
                  <span>影响服务: {incident.affectedServices.join(', ') || '核心链路'}</span>
                </div>
              </div>

              {/* Status and Resolve action */}
              <div className="flex items-center gap-2 shrink-0">
                {incident.status !== 'resolved' ? (
                  <>
                    <button
                      onClick={() =>
                        setSelectedIncidentId(
                          selectedIncidentId === incident.id ? null : incident.id
                        )
                      }
                      className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-1.5"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>追加进展</span>
                    </button>
                    <button
                      onClick={() =>
                        onResolveIncident(
                          incident.id,
                          '故障根因已排查定位并完成修复，经拨测指标已全量恢复正常。'
                        )
                      }
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>标记已解决</span>
                    </button>
                  </>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    已解除恢复
                  </span>
                )}
              </div>
            </div>

            {/* Quick Update Input if opened */}
            {selectedIncidentId === incident.id && (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  追加最新排查进展 (将即时通知 Telegram)
                </p>
                <div className="flex items-center gap-2">
                  {(['investigating', 'identified', 'monitoring'] as IncidentStatus[]).map(
                    (st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setUpdateStatus(st)}
                        className={`px-2.5 py-1 text-xs font-medium rounded-md capitalize transition-colors ${
                          updateStatus === st
                            ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {st === 'investigating'
                          ? '调查中'
                          : st === 'identified'
                          ? '已定位'
                          : '监控中'}
                      </button>
                    )
                  )}
                </div>
                <textarea
                  value={updateMessage}
                  onChange={(e) => setUpdateMessage(e.target.value)}
                  placeholder="输入最新排查结论或恢复动作..."
                  rows={2}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setSelectedIncidentId(null)}
                    className="px-3 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                  >
                    取消
                  </button>
                  <button
                    onClick={() => handlePostUpdate(incident.id)}
                    className="px-3 py-1 text-xs font-semibold rounded-lg bg-amber-500 text-white hover:bg-amber-600"
                  >
                    确认发布进展
                  </button>
                </div>
              </div>
            )}

            {/* Timeline updates */}
            <div className="border-t border-slate-100 dark:border-slate-800/80 pt-4">
              <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
                {(incident.timeline || []).map((update, idx) => (
                  <div key={update.id || idx} className="relative">
                    <div
                      className={`absolute -left-6 top-1 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-900 ${
                        update.status === 'resolved'
                          ? 'bg-emerald-500'
                          : update.status === 'monitoring'
                          ? 'bg-sky-500'
                          : 'bg-amber-500'
                      }`}
                    />
                    <div>
                      <div className="flex items-center gap-2 text-xs mb-0.5">
                        <span className="font-semibold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                          {update.status === 'investigating'
                            ? '调查进展 (Investigating)'
                            : update.status === 'identified'
                            ? '已定位原因 (Identified)'
                            : update.status === 'monitoring'
                            ? '观察恢复中 (Monitoring)'
                            : '已彻底恢复 (Resolved)'}
                        </span>
                        <span className="text-slate-400">
                          {new Date(update.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        {update.message}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}

        {displayedIncidents.length === 0 && (
          <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-80" />
            <h4 className="text-base font-semibold text-slate-800 dark:text-slate-200">
              {activeTab === 'active' ? '当前无任何活动故障事件' : '暂无历史事件记录'}
            </h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              系统处于平稳健康的运转状态，如遇链路抖动可通过右上角按钮或 Telegram Bot 发起故障通报
            </p>
          </div>
        )}
      </div>

      {/* Create Incident Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 max-w-lg w-full shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
              报告新的故障事件
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              提交后将立即记录入库，并自动触发 Telegram Bot 告警推送至订阅群组与频道
            </p>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  事件标题
                </label>
                <input
                  type="text"
                  required
                  placeholder="例如：主数据库集群读写延迟抖动"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    严重级别
                  </label>
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value as IncidentSeverity)}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="minor">Minor (轻度影响)</option>
                    <option value="major">Major (严重影响)</option>
                    <option value="critical">Critical (致命/中断)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    主要受影响服务
                  </label>
                  <input
                    type="text"
                    value={affected}
                    onChange={(e) => setAffected(e.target.value)}
                    placeholder="例如：REST API Gateway"
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  初期排查描述
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="记录初步现象、异常指标或受影响的用户范围..."
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-medium rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-50"
                >
                  {isSubmitting ? '正在创建并推送...' : '确认发布并推送告警'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
