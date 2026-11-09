// Update Manager: Detectează automat apariția unei noi versiuni și gestionează actualizarea PWA

let currentRegistration = null;
let updateListener = null;

export function initUpdateManager(onUpdateAvailable) {
  updateListener = onUpdateAvailable;

  if ('serviceWorker' in navigator) {
    const notifyIfWaiting = (reg) => {
      if (reg && reg.waiting && navigator.serviceWorker.controller) {
        console.log('[UpdateManager] O nouă versiune așteaptă activarea.');
        if (updateListener) updateListener();
      }
    };

    navigator.serviceWorker.ready.then((reg) => {
      currentRegistration = reg;
      notifyIfWaiting(reg);

      // Ascultă pentru apariția unui update nou
      reg.addEventListener('updatefound', () => {
        const installingWorker = reg.installing;
        if (!installingWorker) return;

        installingWorker.addEventListener('statechange', () => {
          if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('[UpdateManager] O nouă versiune a fost descărcată cu succes.');
            if (updateListener) updateListener();
          }
        });
      });
    });

    const triggerCheck = async () => {
      try {
        const reg = currentRegistration || (await navigator.serviceWorker.getRegistration());
        if (reg) {
          currentRegistration = reg;
          await reg.update();
          notifyIfWaiting(reg);
        }
      } catch (err) {
        // Ignorăm erorile pasive de rețea la verificare
      }
    };

    // Verifică când utilizatorul revine în fereastra aplicației
    window.addEventListener('focus', triggerCheck);

    // Verificare periodică (la fiecare 2 minute)
    setInterval(triggerCheck, 2 * 60 * 1000);

    // Pentru depanare și teste manuale în consolă
    window.__checkAppUpdate = triggerCheck;
  }
}

export async function applyAppUpdate() {
  try {
    if ('serviceWorker' in navigator) {
      const reg = currentRegistration || (await navigator.serviceWorker.getRegistration());
      if (reg && reg.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
      // Curățăm cache-urile vechi ale aplicației
      if ('caches' in window) {
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys.map(k => caches.delete(k)));
      }
    }
  } catch (err) {
    console.warn('[UpdateManager] Eroare la aplicarea actualizării:', err);
  }

  // Reîncărcare forțată a aplicației din noua versiune
  setTimeout(() => {
    window.location.reload();
  }, 100);
}
