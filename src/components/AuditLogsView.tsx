import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Shield,
  Search,
  Filter,
  RefreshCw,
  Clock,
  User,
  Globe,
} from 'lucide-react';
import { AuditLogItem, AuditCategory } from '../types';
import { fetchAuditLogs } from '../api';

interface AuditLogsViewProps {
  onShowToast: (type: 'success' | 'warning' | 'error' | 'info', title: string, desc?: string) => void;
}

export const AuditLogsView: React.FC<AuditLogsViewProps> = ({ onShowToast }) => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<AuditCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const loadLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchAuditLogs();
      setLogs(data);
    } catch (err: any) {
      console.error('Failed to fetch audit logs:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const filteredLogs = logs.filter((log) => {
    const matchesCategory = selectedCategory === 'all' || log.category === selectedCategory;
    const matchesQuery =
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.actor.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesQuery;
  });

  return (
    <div className="space-y-6">
      {/* 1. Header & Filters */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                系统安全审计日志与操作追踪
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                  SecOps Audit
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                实时记录管理员后台登录、服务启停、探针配置修改、数据库备份恢复及 Webhook 策略变动
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索操作动作或详情..."
              className="pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs w-full sm:w-64"
            />
          </div>

          <button
            onClick={() => loadLogs()}
            disabled={isLoading}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
            title="刷新审计日志"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. Category Tabs */}
      <div className="flex flex-wrap gap-2">
        {(['all', 'auth', 'service', 'node', 'incident', 'backup', 'webhook', 'settings'] as const).map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold capitalize transition-colors ${
              selectedCategory === cat
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            {cat === 'all' ? '全部日志' : cat}
          </button>
        ))}
      </div>

      {/* 3. Logs Timeline Table */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase font-semibold">
              <tr>
                <th className="px-5 py-3">时间戳</th>
                <th className="px-5 py-3">分类</th>
                <th className="px-5 py-3">操作动作 (Action)</th>
                <th className="px-5 py-3">操作人 / 来源 IP</th>
                <th className="px-5 py-3">详细变更说明</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {filteredLogs.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                  <td className="px-5 py-3.5 font-mono text-slate-500 whitespace-nowrap flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    {new Date(item.timestamp).toLocaleString()}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      {item.category}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 font-bold font-mono text-indigo-600 dark:text-indigo-400">
                    {item.action}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1 font-medium">
                      <User className="w-3 h-3 text-slate-400" />
                      <span>{item.actor}</span>
                      <span className="text-slate-400 text-[11px] font-mono">({item.ip || '127.0.0.1'})</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-slate-600 dark:text-slate-400">
                    {item.details}
                  </td>
                </tr>
              ))}
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-slate-400">
                    未找到符合条件的审计日志记录
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
