import React from 'react';

const Block = ({ className }) => (
  <div className={`animate-pulse rounded-xl bg-neutral-200 dark:bg-neutral-700 ${className}`} />
);

const DashboardSkeleton = () => (
  <div className="space-y-6">
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Block key={i} className="h-20" />
      ))}
    </div>
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <Block key={i} className="h-20" />
      ))}
    </div>
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Block className="h-72 lg:col-span-2" />
      <Block className="h-72" />
    </div>
  </div>
);

export default DashboardSkeleton;
