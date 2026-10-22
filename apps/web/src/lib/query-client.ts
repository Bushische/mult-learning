import { QueryClient } from "@tanstack/react-query";

/** The app-wide TanStack Query client (also used for cache invalidation). */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5_000,
    },
  },
});
