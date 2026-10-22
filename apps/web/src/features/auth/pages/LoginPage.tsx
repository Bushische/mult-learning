import type { LoginGridUser } from "packages/shared";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginWithPin } from "../api";
import { PinPad } from "../components/PinPad";
import { UserGrid } from "../components/UserGrid";
import { useLoginGrid } from "../hooks/useLoginGrid";

export function LoginPage() {
  const navigate = useNavigate();
  const { data: users, isLoading, error } = useLoginGrid();
  const [selected, setSelected] = useState<LoginGridUser | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submitPin = async (pin: string) => {
    if (!selected) return;
    setBusy(true);
    setPinError(null);
    try {
      await loginWithPin(selected.username, pin);
      navigate("/", { replace: true });
    } catch {
      setPinError("Wrong PIN — try again");
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-6">
      <h1 className="text-3xl font-black">Who is playing?</h1>

      {error ? <p className="text-red-600">Could not load the player list.</p> : null}
      {isLoading ? <p className="text-slate-500">Loading…</p> : null}

      {selected ? (
        <PinPad
          username={selected.username}
          error={pinError}
          disabled={busy}
          onSubmit={submitPin}
          onBack={() => {
            setSelected(null);
            setPinError(null);
          }}
        />
      ) : (
        <UserGrid users={users ?? []} onSelect={setSelected} />
      )}
    </main>
  );
}
