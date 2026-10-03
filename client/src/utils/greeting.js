// Shared time-of-day greeting — used by both the persistent header text
// and the full-screen login flash, so the two can never drift apart.
export const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 5) return 'Good night';
  if (hour < 8) return 'Good early morning';
  if (hour < 12) return 'Good morning';
  if (hour < 14) return 'Good midday';
  if (hour < 17) return 'Good afternoon';
  if (hour < 20) return 'Good evening';
  return 'Good night';
};