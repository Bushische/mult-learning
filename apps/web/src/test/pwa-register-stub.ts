/**
 * Test stub for the `virtual:pwa-register*` modules (provided by
 * vite-plugin-pwa at build time). The root vitest.config.ts aliases them to
 * this file, so the tests run without a bundler plugin.
 */
export interface RegisterSWOptions {
  immediate?: boolean;
  onNeedRefresh?: () => void;
  onOfflineReady?: () => void;
  onRegistered?: (registration: unknown) => void;
  onRegisteredSW?: (swUrl: string, registration: unknown) => void;
  onRegisterError?: (error: unknown) => void;
}

export interface RegisterSWResult {
  updateSW: (reloadPage?: boolean) => Promise<void>;
  needRefresh: () => void;
  offlineReady: () => void;
}

export function registerSW(options: RegisterSWOptions = {}): RegisterSWResult {
  options.onOfflineReady?.();
  return {
    updateSW: async () => undefined,
    needRefresh: () => options.onNeedRefresh?.(),
    offlineReady: () => options.onOfflineReady?.(),
  };
}

export interface UseRegisterSWResult {
  needRefresh: [boolean, (value: boolean) => void];
  offlineReady: [boolean, (value: boolean) => void];
  updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
}

export function useRegisterSW(options: RegisterSWOptions = {}): UseRegisterSWResult {
  options.onOfflineReady?.();
  return {
    needRefresh: [false, () => options.onNeedRefresh?.()],
    offlineReady: [true, () => options.onOfflineReady?.()],
    updateServiceWorker: async () => undefined,
  };
}
