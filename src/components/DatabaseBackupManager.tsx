import React, { useState, useEffect, useCallback } from 'react';
import {
  Database,
  HardDrive,
  Download,
  Upload,
  RefreshCw,
  Trash2,
  RotateCcw,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  FileText,
  Clock,
  Sparkles,
  Zap,
  ArrowDownToLine,
  Layers,
  Check,
  Copy,
  AlertTriangle,
  Server,
  Activity,
} from 'lucide-react';
import {
  DatabaseBackupMeta,
  DatabaseEngineStats,
  DatabaseOptimizationResult,
} from '../types';
import {
  fetchDatabaseStats,
  optimizeDatabase,
  fetchDatabaseBackups,
  createDatabaseBackup,
  restoreDatabaseBackup,
  deleteDatabaseBackup,
  importDatabaseBackup,
  downloadBackupFile,
} from '../api';

interface DatabaseBackupManagerProps {
  onShowToast: (type: 'success' | 'warning' | 'error' | 'info', title: string, desc?: string) => void;
  onDataRestored?: () => void;
}

export const DatabaseBackupManager: React.FC<DatabaseBackupManagerProps> = ({
  onShowToast,
  onDataRestored,
}) => {
  const [stats, setStats] = useState<DatabaseEngineStats | null>(null);
  const [backups, setBackups] = useState<DatabaseBackupMeta[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [backupDescription, setBackupDescription] = useState('');

  // Restore state
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [confirmRestoreMeta, setConfirmRestoreMeta] = useState<DatabaseBackupMeta | null>(null);

  // Optimization result preview
  const [lastOptResult, setLastOptResult] = useState<DatabaseOptimizationResult | null>(null);

  // Import state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');
  const [importDescription, setImportDescription] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  // Copied checksum
  const [copiedChecksum, setCopiedChecksum] = useState<string | null>(null);

  const loadDatabaseData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [statsRes, backupsRes] = await Promise.all([
        fetchDatabaseStats().catch(() => null),
        fetchDatabaseBackups().catch(() => []),
      ]);
      if (statsRes) setStats(statsRes);
      if (backupsRes) setBackups(backupsRes);
    } catch (err: any) {
      console.error('Failed to load database stats or backups:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDatabaseData();
  }, [loadDatabaseData]);

  // Create Manual Backup
  const handleCreateBackup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      const meta = await createDatabaseBackup('manual', backupDescription.trim() || '管理员手动备份');
      onShowToast(
        'success',
        '数据备份成功生成',
        `已创建快照 ${meta.filename} (${(meta.sizeBytes / 1024).toFixed(1)} KB)`
      );
      setBackupDescription('');
      await loadDatabaseData();
    } catch (err: any) {
      onShowToast('error', '备份失败', err.message);
    } finally {
      setIsCreating(false);
    }
  };

  // Optimize Database
  const handleOptimizeDatabase = async () => {
    setIsOptimizing(true);
    try {
      const result = await optimizeDatabase();
      setLastOptResult(result);
      onShowToast(
        'success',
        '数据库优化完成',
        `回收存储空间 ${(result.reclaimedBytes / 1024).toFixed(1)} KB，耗时 ${result.durationMs}ms`
      );
      await loadDatabaseData();
    } catch (err: any) {
      onShowToast('error', '优化失败', err.message);
    } finally {
      setIsOptimizing(false);
    }
  };

  // Restore Backup
  const handleConfirmRestore = async () => {
    if (!confirmRestoreMeta) return;
    const target = confirmRestoreMeta;
    setRestoringId(target.id);
    try {
      const res = await restoreDatabaseBackup(target.id);
      if (res.success) {
        onShowToast(
          'success',
          '数据库恢复成功',
          `系统已安全还原至「${target.filename}」状态，前置已自动生成回滚保护快照。`
        );
        setConfirmRestoreMeta(null);
        await loadDatabaseData();
        if (onDataRestored) onDataRestored();
      } else {
        onShowToast('error', '恢复失败', res.error || '未知错误');
      }
    } catch (err: any) {
      onShowToast('error', '恢复失败', err.message);
    } finally {
      setRestoringId(null);
    }
  };

  // Delete Backup
  const handleDeleteBackup = async (id: string, filename: string) => {
    if (!confirm(`确认要彻底删除备份文件「${filename}」吗？此操作不可逆。`)) return;
    try {
      await deleteDatabaseBackup(id);
      onShowToast('info', '备份文件已删除', filename);
      await loadDatabaseData();
    } catch (err: any) {
      onShowToast('error', '删除失败', err.message);
    }
  };

  // Download Backup
  const handleDownloadBackup = async (id: string, filename: string) => {
    try {
      await downloadBackupFile(id, filename);
      onShowToast('success', '备份文件开始下载', filename);
    } catch (err: any) {
      onShowToast('error', '下载失败', err.message);
    }
  };

  // Import Backup File
  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setImportJsonText(content);
      if (!importDescription) {
        setImportDescription(`导入文件: ${file.name}`);
      }
    };
    reader.readAsText(file);
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importJsonText.trim()) {
      onShowToast('error', '导入失败', '备份 JSON 内容不可为空');
      return;
    }
    setIsImporting(true);
    try {
      const res = await importDatabaseBackup(importJsonText, importDescription.trim() || '外部导入备份');
      if (res.success && res.backupMeta) {
        onShowToast(
          'success',
          '外部备份已成功导入归档',
          `已存入备份仓库: ${res.backupMeta.filename} (${(res.backupMeta.sizeBytes / 1024).toFixed(1)} KB)`
        );
        setIsImportModalOpen(false);
        setImportJsonText('');
        setImportDescription('');
        await loadDatabaseData();
      } else {
        onShowToast('error', '导入失败', res.error || '格式校验不通过');
      }
    } catch (err: any) {
      onShowToast('error', '导入失败', err.message);
    } finally {
      setIsImporting(false);
    }
  };

  const copyChecksum = (checksum: string) => {
    navigator.clipboard.writeText(checksum);
    setCopiedChecksum(checksum);
    setTimeout(() => setCopiedChecksum(null), 2000);
  };

  return (
    <div id="database-backup-manager-section" className="space-y-6">
      {/* 1. Header & Quick Controls */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                数据库持久化引擎与数据备份
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  原子写保护已启用
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                高可靠原子写入 (Atomic Rename)、故障自愈回滚、定时自动快照与一键全量导出还原
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleOptimizeDatabase}
            disabled={isOptimizing}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-semibold border border-amber-500/20 transition-colors disabled:opacity-50"
            title="去重指标碎片、清理过期会话并压缩持久化文件"
          >
            <Sparkles className={`w-3.5 h-3.5 ${isOptimizing ? 'animate-spin' : ''}`} />
            <span>{isOptimizing ? '正在优化压实...' : '数据库优化与碎片清理'}</span>
          </button>

          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 transition-colors"
          >
            <Upload className="w-3.5 h-3.5 text-sky-500" />
            <span>导入备份文件</span>
          </button>

          <button
            onClick={() => loadDatabaseData()}
            disabled={isLoading}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors"
            title="刷新数据库统计信息"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. Database Engine Health Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Metric 1: Disk File Size */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span className="flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-sky-500" />
              存储占用
            </span>
          </div>
          <div className="text-xl font-bold font-mono text-slate-900 dark:text-white">
            {stats ? `${(stats.dbSizeBytes / 1024).toFixed(1)} KB` : '...'}
          </div>
          <div className="text-[10px] text-slate-400 mt-1 font-mono">
            {stats?.dbFile || 'data_store.json'}
          </div>
        </div>

        {/* Metric 2: Integrity Status */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              数据完整性
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                stats?.integrityStatus === 'healthy'
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                  : stats?.integrityStatus === 'repaired'
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                  : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
              }`}
            >
              {stats?.integrityStatus === 'healthy' ? '健康无损' : stats?.integrityStatus === 'repaired' ? '自动修复' : '注意'}
            </span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1.5">
            双重故障自愈机制
          </div>
        </div>

        {/* Metric 3: Total Backups */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-purple-500" />
              归档快照数
            </span>
          </div>
          <div className="text-xl font-bold font-mono text-slate-900 dark:text-white">
            {backups.length} 份
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            自动轮转保留 25 份
          </div>
        </div>

        {/* Metric 4: Auto-Backup Schedule */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-500" />
              自动调度
            </span>
          </div>
          <div className="text-sm font-bold text-slate-900 dark:text-white mt-1">
            每 {stats?.autoBackupIntervalHours || 12} 小时
          </div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            后台自动执行中
          </div>
        </div>

        {/* Metric 5: Active Entities */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-amber-500" />
              实体对象
            </span>
          </div>
          <div className="text-sm font-semibold text-slate-900 dark:text-white font-mono mt-1">
            {stats ? `${stats.servicesCount} 服务 / ${stats.nodesCount} 探针` : '...'}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            {stats ? `${stats.incidentsCount} 故障 / ${stats.metricsCount} 指标` : '...'}
          </div>
        </div>

        {/* Metric 6: Write Mode */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-emerald-500" />
              写入模式
            </span>
          </div>
          <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            原子文件重命名
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            防突发断电损坏
          </div>
        </div>
      </div>

      {/* 3. Last Optimization Banner (if executed) */}
      {lastOptResult && (
        <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex items-start justify-between gap-3 text-xs">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-semibold text-emerald-900 dark:text-emerald-200">
                {lastOptResult.message}
              </div>
              <div className="text-[11px] text-emerald-700 dark:text-emerald-400 flex flex-wrap gap-x-4 gap-y-1">
                <span>回收体积: {(lastOptResult.reclaimedBytes / 1024).toFixed(1)} KB</span>
                <span>清理重复历史点: {lastOptResult.prunedMetricsCount} 个</span>
                <span>归档多余日志: {lastOptResult.prunedLogsCount} 条</span>
                <span>耗时: {lastOptResult.durationMs}ms</span>
              </div>
            </div>
          </div>
          <button
            onClick={() => setLastOptResult(null)}
            className="text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-200 text-xs"
          >
            关闭
          </button>
        </div>
      )}

      {/* 4. Create Instant Backup Form */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-3 flex items-center gap-2">
          <ArrowDownToLine className="w-3.5 h-3.5 text-sky-500" />
          立即创建全量备份快照
        </h4>
        <form onSubmit={handleCreateBackup} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={backupDescription}
            onChange={(e) => setBackupDescription(e.target.value)}
            placeholder="输入备份说明或备注（例如：例行维护前手动备份、版本发布基线...）"
            className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-sky-500/30"
          />
          <button
            type="submit"
            disabled={isCreating}
            className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold shadow-xs transition-colors flex items-center justify-center gap-2 whitespace-nowrap disabled:opacity-50"
          >
            {isCreating ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>生成中...</span>
              </>
            ) : (
              <>
                <HardDrive className="w-3.5 h-3.5" />
                <span>创建备份快照</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* 5. Backups Archive Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-sky-500" />
              备份历史归档 ({backups.length})
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              支持下载至本地保管，或随时快速将监控系统全量回退恢复
            </p>
          </div>
          <span className="text-[11px] text-slate-400">
            按生成时间降序排列
          </span>
        </div>

        {backups.length === 0 ? (
          <div className="p-12 text-center text-slate-400 dark:text-slate-500 text-xs space-y-2">
            <Database className="w-8 h-8 mx-auto opacity-40 text-slate-400" />
            <div>暂无历史归档快照，点击上方按钮即可创建第一份全量备份。</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 font-medium">
                <tr>
                  <th className="py-3 px-4">备份快照 / 文件名</th>
                  <th className="py-3 px-4">类型 / 说明</th>
                  <th className="py-3 px-4">包含实体</th>
                  <th className="py-3 px-4">存储体积</th>
                  <th className="py-3 px-4">生成时间</th>
                  <th className="py-3 px-4">校验码 (SHA-256)</th>
                  <th className="py-3 px-4 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {backups.map((bk) => (
                  <tr
                    key={bk.id}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-mono font-medium text-slate-900 dark:text-white flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                        <span className="truncate max-w-[200px]" title={bk.filename}>
                          {bk.filename}
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="space-y-1">
                        <span
                          className={`inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                            bk.type === 'auto'
                              ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                              : bk.type === 'pre-restore'
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                              : 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300'
                          }`}
                        >
                          {bk.type === 'auto' ? '自动定时快照' : bk.type === 'pre-restore' ? '恢复前回滚保护' : '手动备份'}
                        </span>
                        <div className="text-slate-500 dark:text-slate-400 text-[11px] truncate max-w-[220px]">
                          {bk.description || '-'}
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                      <span>{bk.servicesCount} 服务</span> • <span>{bk.nodesCount} 探针</span> •{' '}
                      <span>{bk.incidentsCount} 故障</span>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-slate-700 dark:text-slate-300">
                      {(bk.sizeBytes / 1024).toFixed(1)} KB
                    </td>

                    <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {new Date(bk.createdAt).toLocaleString()}
                    </td>

                    <td className="py-3.5 px-4">
                      <button
                        onClick={() => copyChecksum(bk.checksum)}
                        className="inline-flex items-center gap-1 font-mono text-[10px] text-slate-500 dark:text-slate-400 hover:text-sky-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded transition-colors"
                        title="点击复制校验码"
                      >
                        {copiedChecksum === bk.checksum ? (
                          <Check className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        <span>{bk.checksum}</span>
                      </button>
                    </td>

                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5 justify-end">
                        <button
                          onClick={() => handleDownloadBackup(bk.id, bk.filename)}
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
                          title="下载备份文件到本地"
                        >
                          <Download className="w-3.5 h-3.5 text-sky-500" />
                        </button>

                        <button
                          onClick={() => setConfirmRestoreMeta(bk)}
                          disabled={restoringId === bk.id}
                          className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 text-[11px] font-semibold border border-amber-500/20 transition-colors flex items-center gap-1"
                          title="还原数据库至此快照状态"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>恢复</span>
                        </button>

                        <button
                          onClick={() => handleDeleteBackup(bk.id, bk.filename)}
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-500 transition-colors"
                          title="删除此备份文件"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmation Modal for Restore */}
      {confirmRestoreMeta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900 dark:text-white">
                  确认恢复备份快照？
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  当前系统的实体状态将被此备份替换
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700 space-y-1.5 text-xs">
              <div className="font-mono text-slate-900 dark:text-white font-semibold">
                {confirmRestoreMeta.filename}
              </div>
              <div className="text-slate-500 dark:text-slate-400 text-[11px]">
                生成时间: {new Date(confirmRestoreMeta.createdAt).toLocaleString()}
              </div>
              <div className="text-slate-600 dark:text-slate-300 text-[11px]">
                包含: {confirmRestoreMeta.servicesCount} 个微服务拨测，{confirmRestoreMeta.nodesCount} 台服务器探针，{confirmRestoreMeta.incidentsCount} 条故障
              </div>
            </div>

            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>
                系统在应用恢复前，将<strong>自动生成一个当前状态的回滚保护快照</strong>，随时可以一键撤销。
              </span>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmRestoreMeta(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleConfirmRestore}
                disabled={Boolean(restoringId)}
                className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {restoringId ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>正在恢复中...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>确认立即恢复</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Import Backup JSON */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-900 dark:text-white">
                    导入外部备份快照
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    可选择本地 .json 备份文件，或直接粘贴备份数据文本
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleImportSubmit} className="space-y-4">
              {/* File upload input */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  选择备份文件 (.json)
                </label>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleImportFileChange}
                  className="block w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-sky-50 file:text-sky-700 dark:file:bg-sky-950 dark:file:text-sky-300 hover:file:bg-sky-100"
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  导入备注说明
                </label>
                <input
                  type="text"
                  value={importDescription}
                  onChange={(e) => setImportDescription(e.target.value)}
                  placeholder="例如：迁移生产集群导入备份"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-900 dark:text-white"
                />
              </div>

              {/* JSON preview / paste */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  备份 JSON 内容
                </label>
                <textarea
                  rows={6}
                  value={importJsonText}
                  onChange={(e) => setImportJsonText(e.target.value)}
                  placeholder='{"version": "1.2.0", "services": [...], "nodes": [...]}'
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 font-mono text-[11px] text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-sky-500/30"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs text-slate-700 dark:text-slate-300"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isImporting || !importJsonText.trim()}
                  className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {isImporting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>正在导入验证...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      <span>验证并存入备份库</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
