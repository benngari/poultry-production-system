import React, { useEffect, useState } from 'react';
import { Download } from 'lucide-react';

// Browsers fire "beforeinstallprompt" once, early. Catch it here at module load,
// so it is not missed if this button mounts later (e.g. after login).
let deferredPrompt = null;
const listeners = new Set();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    listeners.forEach((fn) => fn());
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    listeners.forEach((fn) => fn());
  });
}

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent);

const InstallApp = () => {
  const [, refresh] = useState(0);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    const fn = () => refresh((n) => n + 1);
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, []);

  if (isStandalone()) return null;            // already installed and opened as an app
  if (!deferredPrompt && !isIos()) return null; // this browser is not offering install

  const install = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null; // an install prompt can only be used once
      refresh((n) => n + 1);
    } else {
      setShowIosHelp((v) => !v);
    }
  };

  return (
    <div className="px-3 pb-3 shrink-0">
      <button
        type="button"
        onClick={install}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold bg-accent-600 text-white"
      >
        <Download size={17} /> Install app
      </button>
      {showIosHelp && (
        <p className="mt-2 text-xs text-neutral-500">
          On iPhone: tap the Share button in Safari, then Add to Home Screen.
        </p>
      )}
    </div>
  );
};

export default InstallApp;
