import { useRegisterSW } from "virtual:pwa-register/react";
import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Registers the service worker and offers the "install to home screen" button
 * when the browser fires `beforeinstallprompt`.
 */
export function PwaUpdater() {
  const { needRefresh, offlineReady, updateServiceWorker } = useRegisterSW({ immediate: true });
  const [needsRefresh] = needRefresh;
  const [isOfflineReady] = offlineReady;
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!installEvent && !isOfflineReady && !needsRefresh) return null;

  return (
    <div className="flex flex-col gap-2 p-3" data-testid="pwa-updater">
      {installEvent ? (
        <button
          type="button"
          onClick={() => {
            void installEvent.prompt();
            setInstallEvent(null);
          }}
          className="min-h-[48px] rounded-xl bg-sky-500 px-4 font-bold text-white"
        >
          Install to home screen
        </button>
      ) : null}
      {isOfflineReady ? (
        <p className="text-sm text-slate-500" data-testid="pwa-offline-ready">
          Ready to work offline.
        </p>
      ) : null}
      {needsRefresh ? (
        <button
          type="button"
          onClick={() => void updateServiceWorker(true)}
          className="min-h-[44px] rounded-xl border border-slate-300 px-4"
          data-testid="pwa-update"
        >
          A new version is available — tap to update.
        </button>
      ) : null}
    </div>
  );
}
