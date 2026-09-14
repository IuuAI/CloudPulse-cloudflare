import React, { useEffect, useState, useRef } from 'react';
import { Sun, Moon, Zap, Globe, Terminal, ChevronDown, Check, Sparkles } from 'lucide-react';
import { ThemeMode } from '../types';

export const ThemeToggle: React.FC = () => {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('cp_theme_mode') as ThemeMode;
      if (saved && ['light', 'dark', 'cyberpunk', 'tech-blue', 'matrix'].includes(saved)) {
        return saved;
      }
    }
    return 'dark';
  });

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = document.documentElement;

    const applyTheme = () => {
      root.classList.remove('light', 'dark', 'cyberpunk', 'tech-blue', 'matrix');

      if (theme === 'light') {
        root.classList.add('light');
      } else if (theme === 'dark') {
        root.classList.add('dark');
      } else if (theme === 'cyberpunk') {
        root.classList.add('dark', 'cyberpunk');
      } else if (theme === 'tech-blue') {
        root.classList.add('dark', 'tech-blue');
      } else if (theme === 'matrix') {
        root.classList.add('dark', 'matrix');
      }
    };

    applyTheme();
    localStorage.setItem('cp_theme_mode', theme);
  }, [theme]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const options: Array<{
    mode: ThemeMode;
    label: string;
    sublabel: string;
    feature: string;
    icon: React.ReactNode;
    color: string;
    badgeColor: string;
  }> = [
    {
      mode: 'light',
      label: '明亮模式',
      sublabel: '白色为主 • 雅致纯净',
      feature: '纯白高对比度',
      icon: <Sun className="w-4 h-4 text-amber-500" />,
      color: 'text-amber-500',
      badgeColor: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
    },
    {
      mode: 'dark',
      label: '暗黑模式',
      sublabel: '黑色为主 • 深邃质感',
      feature: '黑曜石沉浸夜色',
      icon: <Moon className="w-4 h-4 text-slate-300" />,
      color: 'text-slate-300',
      badgeColor: 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-300',
    },
    {
      mode: 'cyberpunk',
      label: '赛博朋克',
      sublabel: '紫色为主 • 霓虹光晕',
      feature: '紫粉线条光晕效果',
      icon: <Zap className="w-4 h-4 text-fuchsia-400 fill-fuchsia-400/20" />,
      color: 'text-fuchsia-400',
      badgeColor: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-950 dark:text-fuchsia-300',
    },
    {
      mode: 'tech-blue',
      label: '蓝色妖姬',
      sublabel: '蓝色为主 • 魅惑光晕',
      feature: '妖姬深蓝光晕效果',
      icon: <Globe className="w-4 h-4 text-sky-400" />,
      color: 'text-sky-400',
      badgeColor: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
    },
    {
      mode: 'matrix',
      label: '极客矩阵',
      sublabel: '绿色为主 • 终端荧光',
      feature: '翡翠荧光线条光晕',
      icon: <Terminal className="w-4 h-4 text-emerald-400" />,
      color: 'text-emerald-400',
      badgeColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
    },
  ];

  const currentOption = options.find((o) => o.mode === theme) || options[1];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        id="theme-selector-btn"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-xs"
        title="切换主题模式 (5种视觉风格)"
      >
        <span className="shrink-0">{currentOption.icon}</span>
        <span className="hidden sm:inline-block font-semibold">{currentOption.label}</span>
        <ChevronDown className="w-3 h-3 text-slate-400 ml-0.5 transition-transform" style={{ transform: isOpen ? 'rotate(180deg)' : 'none' }} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl z-50 p-2 divide-y divide-slate-100 dark:divide-slate-800 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-2.5 py-2 flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-amber-500" />
              主题色彩 (5类经典模式)
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-400">
              光晕支持
            </span>
          </div>

          <div className="pt-1.5 space-y-1">
            {options.map((opt) => {
              const isSelected = opt.mode === theme;
              return (
                <button
                  key={opt.mode}
                  id={`theme-opt-${opt.mode}`}
                  onClick={() => {
                    setTheme(opt.mode);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs transition-all ${
                    isSelected
                      ? 'bg-slate-100 dark:bg-slate-800/90 text-slate-900 dark:text-white font-semibold ring-1 ring-slate-300 dark:ring-slate-700'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 shrink-0">
                      {opt.icon}
                    </div>
                    <div className="text-left">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-slate-900 dark:text-white">{opt.label}</span>
                        <span className={`text-[9px] px-1 py-0.2 rounded font-mono ${opt.badgeColor}`}>
                          {opt.mode}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-normal">{opt.sublabel}</div>
                    </div>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-emerald-500 shrink-0" />}
                </button>
              );
            })}
          </div>

          <div className="p-2 text-[10px] text-slate-400 leading-tight">
            💡 赛博朋克、蓝色妖姬与极客矩阵模式带有高科技光晕霓虹线条渲染。
          </div>
        </div>
      )}
    </div>
  );
};
