/**
 * Workbox runtime caching rules.
 *
 * `/api` is always network-only: the app must never show stale game data
 * instead of an honest "you are offline" state.
 */
export const apiRuntimeCaching = [
  {
    urlPattern: /\/api\/.*/,
    handler: "NetworkOnly",
  },
] as const;
