import React, { useEffect, useState } from 'react';
let evt = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); evt = e; window.dispatchEvent(new Event('install-ready')); });
export default function InstallApp() {
  const [, bump] = useState(0);
  useEffect(() => { const f = () => bump((n) => n + 1); window.addEventListener('install-ready', f); return () => window.removeEventListener('install-ready', f); }, []);
  if (!evt) return null;
  return (
    <button type="button" className="mx-3 mb-3 px-3 py-2 rounded-lg text-sm font-semibold bg-accent-600 text-white"
      onClick={async () => { evt.prompt(); await evt.userChoice; evt = null; bump((n) => n + 1); }}>
      Install app
    </button>
  );
}
