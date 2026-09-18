import React from 'react';

const EmptyState = ({ message = 'Nothing here yet.' }) => (
  <div className="py-12 text-center text-sm text-neutral-500">{message}</div>
);

export default EmptyState;
