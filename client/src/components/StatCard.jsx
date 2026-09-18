import React from 'react';

const StatCard = ({ label, value, tone }) => {
  const toneClass = tone === 'positive' ? 'text-accent-600' : tone === 'negative' ? 'text-red-600' : '';
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${toneClass}`}>{value}</div>
    </div>
  );
};

export default StatCard;
