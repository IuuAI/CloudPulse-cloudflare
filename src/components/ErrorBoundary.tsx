import React, { type ErrorInfo, type ReactNode } from 'react';
import { RefreshCw, ShieldAlert } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('CloudPulse Uncaught React UI Exception:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4 font-sans antialiased text-slate-900 dark:text-white">
          <div className="max-w-lg w-full bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-rose-200/80 dark:border-rose-900/60 shadow-2xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-2xl">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  CloudPulse 界面防护保护已拦截异常
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  检测到前端渲染异常，系统已安全隔离故障模块，保证后端服务持续可用
                </p>
              </div>
            </div>

            {this.state.error && (
              <div className="p-3.5 bg-slate-100 dark:bg-slate-800/80 rounded-xl font-mono text-xs text-rose-600 dark:text-rose-400 break-words max-h-40 overflow-y-auto">
                <strong>错误详情:</strong> {this.state.error.message || '未知渲染错误'}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <button
                onClick={this.handleReset}
                className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold shadow-xs transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                <span>恢复并重新加载界面</span>
              </button>

              <button
                onClick={() => {
                  try {
                    localStorage.removeItem('cloudpulse_admin_token');
                    window.location.reload();
                  } catch {
                    window.location.reload();
                  }
                }}
                className="w-full sm:w-auto flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 transition-colors"
              >
                <span>清除缓存后重启</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
