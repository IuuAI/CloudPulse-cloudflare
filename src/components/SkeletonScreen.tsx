import React from 'react';
import { motion } from 'motion/react';

// Base Skeleton Primitive with Smooth Shimmer
export const SkeletonBox: React.FC<{
  className?: string;
  rounded?: string;
}> = ({ className = 'h-4 w-full', rounded = 'rounded-lg' }) => {
  return (
    <div
      className={`bg-slate-200/70 dark:bg-slate-800/80 animate-skeleton-shimmer ${rounded} ${className}`}
    />
  );
};

// Slim glowing progress bar under the sticky header
export const TopLoadingBar: React.FC<{ isVisible: boolean }> = ({ isVisible }) => {
  if (!isVisible) return null;
  return (
    <div className="fixed top-16 left-0 right-0 z-40 h-[2.5px] overflow-hidden bg-slate-200/30 dark:bg-slate-800/30">
      <div className="h-full w-full bg-gradient-to-r from-emerald-500 via-sky-400 to-emerald-500 animate-pulse bg-[length:200%_100%]" />
    </div>
  );
};

// Overview Skeleton (Mirrors StatusBanner, MetricsTrendChart, ServiceList, NodeList)
export const OverviewSkeleton: React.FC = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      {/* 1. StatusBanner Skeleton */}
      <div className="p-6 sm:p-7 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <SkeletonBox className="w-14 h-14 shrink-0" rounded="rounded-xl" />
            <div className="space-y-2.5 flex-1">
              <div className="flex items-center gap-2">
                <SkeletonBox className="h-7 w-56 sm:w-72" />
                <SkeletonBox className="h-5 w-20" rounded="rounded-full" />
              </div>
              <SkeletonBox className="h-4 w-full max-w-xl" />
            </div>
          </div>
          <SkeletonBox className="h-9 w-40 shrink-0" rounded="rounded-xl" />
        </div>
      </div>

      {/* Metric 4-Pill Summary Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-2.5"
          >
            <div className="flex justify-between items-center">
              <SkeletonBox className="h-3.5 w-20" />
              <SkeletonBox className="h-4 w-4" rounded="rounded-full" />
            </div>
            <div className="flex items-baseline gap-2">
              <SkeletonBox className="h-7 w-24" />
              <SkeletonBox className="h-3 w-12" />
            </div>
          </div>
        ))}
      </div>

      {/* 2. MetricsTrendChart Skeleton */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <SkeletonBox className="w-10 h-10 shrink-0" rounded="rounded-xl" />
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <SkeletonBox className="h-5 w-48 sm:w-64" />
                <SkeletonBox className="h-4 w-16" rounded="rounded-full" />
              </div>
              <SkeletonBox className="h-3.5 w-72 sm:w-96" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <SkeletonBox className="h-8 w-36" rounded="rounded-xl" />
            <SkeletonBox className="h-8 w-48" rounded="rounded-xl" />
          </div>
        </div>

        {/* 4 KPI cards in chart */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800/80 space-y-2"
            >
              <div className="flex justify-between items-center">
                <SkeletonBox className="h-3.5 w-20" />
                <SkeletonBox className="h-3.5 w-10" rounded="rounded-full" />
              </div>
              <SkeletonBox className="h-6 w-16" />
            </div>
          ))}
        </div>

        {/* Chart plot placeholder */}
        <div className="w-full h-64 sm:h-72 rounded-2xl bg-slate-50/70 dark:bg-slate-800/30 p-4 border border-slate-100 dark:border-slate-800/60 flex flex-col justify-between">
          <div className="flex justify-between border-b border-dashed border-slate-200 dark:border-slate-700/50 pb-2">
            <SkeletonBox className="h-3 w-8" />
            <SkeletonBox className="h-3 w-28" />
          </div>
          <div className="border-b border-dashed border-slate-200 dark:border-slate-700/50 py-2">
            <SkeletonBox className="h-3 w-8" />
          </div>
          <div className="border-b border-dashed border-slate-200 dark:border-slate-700/50 py-2">
            <SkeletonBox className="h-3 w-8" />
          </div>
          <div className="flex justify-between items-center pt-2">
            {[1, 2, 3, 4, 5, 6].map((k) => (
              <SkeletonBox key={k} className="h-3 w-10" />
            ))}
          </div>
        </div>
      </div>

      {/* 3. ServiceList Skeleton */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <SkeletonBox className="w-9 h-9 shrink-0" rounded="rounded-xl" />
            <div className="space-y-1">
              <SkeletonBox className="h-5 w-40" />
              <SkeletonBox className="h-3.5 w-56" />
            </div>
          </div>
          <div className="flex gap-2">
            <SkeletonBox className="h-8 w-28 sm:w-44" rounded="rounded-xl" />
            <SkeletonBox className="h-8 w-24" rounded="rounded-xl" />
          </div>
        </div>

        {/* Service rows */}
        <div className="divide-y divide-slate-100 dark:divide-slate-800/80 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50/40 dark:bg-slate-900/40">
          {[1, 2, 3, 4, 5].map((idx) => (
            <div
              key={idx}
              className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3">
                <SkeletonBox className="w-8 h-8 shrink-0" rounded="rounded-lg" />
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <SkeletonBox className="h-4 w-32" />
                    <SkeletonBox className="h-4 w-14" rounded="rounded-md" />
                  </div>
                  <SkeletonBox className="h-3 w-48" />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <SkeletonBox className="h-4 w-28 hidden md:block" />
                <SkeletonBox className="h-4 w-16" />
                <SkeletonBox className="h-6 w-20" rounded="rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. NodeList Skeleton */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <SkeletonBox className="w-9 h-9 shrink-0" rounded="rounded-xl" />
            <div className="space-y-1">
              <SkeletonBox className="h-5 w-36" />
              <SkeletonBox className="h-3.5 w-48" />
            </div>
          </div>
          <SkeletonBox className="h-8 w-28" rounded="rounded-xl" />
        </div>

        {/* 4 Node Grid Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((k) => (
            <div
              key={k}
              className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <SkeletonBox className="w-8 h-8" rounded="rounded-lg" />
                  <div className="space-y-1">
                    <SkeletonBox className="h-3.5 w-20" />
                    <SkeletonBox className="h-2.5 w-12" />
                  </div>
                </div>
                <SkeletonBox className="h-5 w-14" rounded="rounded-full" />
              </div>
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-700/60">
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <SkeletonBox className="h-2.5 w-10" />
                    <SkeletonBox className="h-2.5 w-8" />
                  </div>
                  <SkeletonBox className="h-2 w-full" rounded="rounded-full" />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <SkeletonBox className="h-2.5 w-10" />
                    <SkeletonBox className="h-2.5 w-8" />
                  </div>
                  <SkeletonBox className="h-2 w-full" rounded="rounded-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

// Telegram Tab Skeleton
export const TelegramSkeleton: React.FC = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      {/* Bot status banner */}
      <div className="p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <SkeletonBox className="w-12 h-12 shrink-0" rounded="rounded-xl" />
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <SkeletonBox className="h-6 w-56" />
              <SkeletonBox className="h-5 w-20" rounded="rounded-full" />
            </div>
            <SkeletonBox className="h-3.5 w-80 max-w-full" />
          </div>
        </div>
        <div className="flex gap-2">
          <SkeletonBox className="h-9 w-28" rounded="rounded-xl" />
          <SkeletonBox className="h-9 w-32" rounded="rounded-xl" />
        </div>
      </div>

      {/* 2-Column Hub Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Form: 7 cols */}
        <div className="lg:col-span-7 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="space-y-1">
              <SkeletonBox className="h-5 w-40" />
              <SkeletonBox className="h-3.5 w-60" />
            </div>
            <SkeletonBox className="h-6 w-20" rounded="rounded-full" />
          </div>
          <div className="space-y-3">
            <SkeletonBox className="h-4 w-24" />
            <SkeletonBox className="h-10 w-full" rounded="rounded-xl" />
          </div>
          <div className="space-y-3">
            <SkeletonBox className="h-4 w-28" />
            <SkeletonBox className="h-28 w-full" rounded="rounded-xl" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <SkeletonBox className="h-10 w-24" rounded="rounded-xl" />
            <SkeletonBox className="h-10 w-36" rounded="rounded-xl" />
          </div>
        </div>

        {/* Right Logs: 5 cols */}
        <div className="lg:col-span-5 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="space-y-1">
              <SkeletonBox className="h-5 w-32" />
              <SkeletonBox className="h-3.5 w-44" />
            </div>
            <SkeletonBox className="h-6 w-16" rounded="rounded-full" />
          </div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((k) => (
              <div
                key={k}
                className="p-3 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/30 space-y-2"
              >
                <div className="flex justify-between items-center">
                  <SkeletonBox className="h-3 w-20" />
                  <SkeletonBox className="h-4 w-12" rounded="rounded-md" />
                </div>
                <SkeletonBox className="h-3.5 w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// Incidents Tab Skeleton
export const IncidentsSkeleton: React.FC = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      <div className="p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <SkeletonBox className="h-6 w-48" />
          <SkeletonBox className="h-3.5 w-72" />
        </div>
        <SkeletonBox className="h-9 w-36" rounded="rounded-xl" />
      </div>

      <div className="space-y-4">
        {[1, 2, 3].map((k) => (
          <div
            key={k}
            className="p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <SkeletonBox className="h-5 w-20" rounded="rounded-full" />
                <SkeletonBox className="h-5 w-44" />
              </div>
              <SkeletonBox className="h-4 w-28" />
            </div>
            <SkeletonBox className="h-4 w-full max-w-xl" />
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between">
              <SkeletonBox className="h-3 w-32" />
              <SkeletonBox className="h-3 w-20" />
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

// Admin Tab Skeleton
export const AdminSkeleton: React.FC = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      <div className="p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex items-center justify-between">
        <div className="space-y-1.5">
          <SkeletonBox className="h-6 w-52" />
          <SkeletonBox className="h-3.5 w-80" />
        </div>
        <SkeletonBox className="h-9 w-28" rounded="rounded-xl" />
      </div>

      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        {[1, 2, 3, 4].map((i) => (
          <SkeletonBox key={i} className="h-9 w-28" rounded="rounded-xl" />
        ))}
      </div>

      <div className="p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-4">
        <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
          <SkeletonBox className="h-5 w-36" />
          <SkeletonBox className="h-8 w-28" rounded="rounded-xl" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4].map((k) => (
            <div
              key={k}
              className="p-4 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/30 flex justify-between items-center"
            >
              <div className="space-y-1.5">
                <SkeletonBox className="h-4 w-40" />
                <SkeletonBox className="h-3 w-56" />
              </div>
              <div className="flex gap-2">
                <SkeletonBox className="h-8 w-16" rounded="rounded-lg" />
                <SkeletonBox className="h-8 w-16" rounded="rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

import { MainAppTab } from '../types';

// Master Tab Skeleton Router
export const TabSkeleton: React.FC<{
  tab: MainAppTab;
}> = ({ tab }) => {
  switch (tab) {
    case 'overview':
      return <OverviewSkeleton />;
    case 'telegram':
      return <TelegramSkeleton />;
    case 'incidents':
      return <IncidentsSkeleton />;
    case 'admin':
      return <AdminSkeleton />;
    default:
      return <OverviewSkeleton />;
  }
};
