import { type LoginResponse, loginRequestSchema, loginResponseSchema } from "@mult/shared";
import { api } from "../../lib/api-client";
import { useAuthStore } from "../../stores/auth-store";

/** Log in with username + PIN and keep the access token in memory. */
export async function loginWithPin(username: string, pin: string): Promise<LoginResponse> {
  const body = loginRequestSchema.parse({ username, pin });
  const response = await api.post<LoginResponse>("/auth/login", body, loginResponseSchema);
  useAuthStore.getState().setSession(response.accessToken, response.user);
  return response;
}

/** Log out: drop the in-memory session and clear the refresh cookie server-side. */
export async function logout(): Promise<void> {
  try {
    await api.post("/auth/logout");
  } catch {
    // the local session is dropped either way
  }
  useAuthStore.getState().clear();
}
