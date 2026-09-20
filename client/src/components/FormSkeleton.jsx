import React from 'react';

const FormSkeleton = ({ fields = 8 }) => (
  <div className="app-card grid grid-cols-1 sm:grid-cols-2 gap-4">
    {Array.from({ length: fields }).map((_, i) => (
      <div key={i}>
        <div className="h-3 w-24 mb-2 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
        <div className="h-9 w-full animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-700" />
      </div>
    ))}
  </div>
);

export default FormSkeleton;