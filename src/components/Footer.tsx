import React from 'react';
import { Activity, CheckCircle2, Cloud, Sparkles, Cpu } from 'lucide-react';

interface FooterProps {
  onOpenTelegram?: () => void;
}

export const Footer: React.FC<FooterProps> = () => {
  return (
    <footer className="mt-16 border-t border-slate-200/80 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-slate-900 dark:bg-slate-800 text-emerald-400 flex items-center justify-center shadow-xs">
              <Activity className="w-3 h-3" />
            </div>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              CloudPulse Ops Monitor
            </span>
            <span>•</span>
            <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium">
              v2.8.5-edge
            </span>
            <span className="hidden sm:inline">•</span>
            <span className="hidden sm:inline">高可用全栈探针监控与智能运维体系</span>
          </div>

          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            {/* Cloudflare Provider */}
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 font-medium">
              <Cloud className="w-3.5 h-3.5 text-amber-500" />
              <span>Cloudflare Workers & D1</span>
            </div>

            {/* Google AI Gemini */}
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 font-medium">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              <span>Google AI Gemini Engine</span>
            </div>

            <span>•</span>

            {/* SLA Badge */}
            <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>SLA 99.98% 正常</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

