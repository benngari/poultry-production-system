import React from 'react';

const Line = ({ className = '', style }) => (
  <div className={`animate-pulse rounded bg-neutral-200 dark:bg-neutral-700 ${className}`} style={style} />
);

// Mimics the actual .stat-card shape (label bar + value bar) rather than
// a single flat block, so the skeleton matches the real content it stands in for.
const StatCardSkeleton = () => (
  <div className="stat-card">
    <Line className="h-2.5 w-16 mb-3" />
    <Line className="h-5 w-20" />
  </div>
);

// Deterministic "random-looking" bar heights so the fake chart doesn't
// pop between different heights on every re-render.
const BAR_HEIGHTS = [55, 78, 40, 90, 65, 50, 82];

const DashboardSkeleton = () => (
  <div className="space-y-6">
    <Line className="h-6 w-32" />

    {/* Row 1 — Today's stats */}
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>

    {/* Poultry Totals (All Time) */}
    <div>
      <Line className="h-3 w-48 mb-3" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
    </div>

    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {/* Weekly Production chart shell */}
      <div className="app-card lg:col-span-2">
        <div className="flex items-center justify-between mb-6">
          <Line className="h-4 w-32" />
          <Line className="h-7 w-44 rounded-full" />
        </div>
        <div className="flex items-end gap-3 h-56 px-1">
          {BAR_HEIGHTS.map((h, i) => (
            <Line key={i} className="flex-1 rounded-t" style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>

      {/* Low Stock Alerts shell */}
      <div className="app-card">
        <Line className="h-4 w-28 mb-4" />
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Line key={i} className="h-9 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  </div>
);

export default DashboardSkeleton;