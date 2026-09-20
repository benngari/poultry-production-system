import React from 'react';

const CardsSkeleton = ({ count = 4, columns = 'sm:grid-cols-2 lg:grid-cols-4' }) => (
  <div className={`grid grid-cols-2 gap-4 ${columns}`}>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="h-20 animate-pulse rounded-xl bg-neutral-200 dark:bg-neutral-700" />
    ))}
  </div>
);

export default CardsSkeleton;