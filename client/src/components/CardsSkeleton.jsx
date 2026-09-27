import React from 'react';

// Mimics the real .stat-card structure — a thin label-shaped bar over a
// taller value-shaped bar — instead of one flat pulsing rectangle, so the
// skeleton reads as "a stat card" rather than just "loading".
const CardsSkeleton = ({ count = 4, columns = 'sm:grid-cols-2 lg:grid-cols-4' }) => (
  <div className={`grid grid-cols-2 gap-4 ${columns}`}>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="stat-card">
        <div className="h-2.5 w-16 mb-3 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
        <div className="h-5 w-20 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
      </div>
    ))}
  </div>
);

export default CardsSkeleton;