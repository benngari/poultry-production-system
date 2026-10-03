import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getGreeting } from '../utils/greeting';

// A brief full-screen overlay shown exactly once, right after a real
// login (not on page refresh). Fades in, holds, fades out, then unmounts
// itself — purely decorative, never blocks interaction once it's gone,
// and pointer-events are dropped as soon as the fade-out starts so it
// can't eat a click on the dashboard underneath.
const WelcomeFlash = () => {
  const { user, justLoggedIn, clearJustLoggedIn } = useAuth();
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (!justLoggedIn) return;
    setMounted(true);
    const showTimer = setTimeout(() => setVisible(true), 20);
    const hideTimer = setTimeout(() => setVisible(false), 1800);
    const unmountTimer = setTimeout(() => {
      setMounted(false);
      clearJustLoggedIn();
    }, 2300);
    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
      clearTimeout(unmountTimer);
    };
  }, [justLoggedIn, clearJustLoggedIn]);

  if (!mounted) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-accent-600 transition-opacity duration-500 ${
        visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      <div className="text-center text-white px-6">
        <div className="text-3xl sm:text-5xl font-bold mb-3">
          {getGreeting()}, {user?.name}
        </div>
        <div className="text-accent-50 text-sm sm:text-lg">Welcome back to Poultry Pro</div>
      </div>
    </div>
  );
};

export default WelcomeFlash;