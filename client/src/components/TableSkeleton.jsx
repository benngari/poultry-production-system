import React from 'react';

const TableSkeleton = ({ columns = 4, rows = 6 }) => (
  <div className="p-2">
    {Array.from({ length: rows }).map((_, r) => (
      <div
        key={r}
        className="flex gap-4 px-4 py-3 border-b last:border-0"
        style={{ borderColor: 'var(--border)' }}
      >
        {Array.from({ length: columns }).map((_, c) => (
          <div
            key={c}
            className="h-4 flex-1 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700"
            style={{ maxWidth: c === 0 ? '30%' : undefined }}
          />
        ))}
      </div>
    ))}
  </div>
);

export default TableSkeleton;