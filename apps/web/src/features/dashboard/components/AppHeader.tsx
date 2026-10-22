import { useNavigate } from "react-router-dom";
import { logout } from "../../auth/api";
import { useMe } from "../hooks/useMe";
import { formatBank } from "../lib/format";

interface AppHeaderProps {
  title?: string;
}

/** Header: user name, time bank, logout. */
export function AppHeader({ title }: AppHeaderProps) {
  const navigate = useNavigate();
  const { data: me } = useMe();

  return (
    <header className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-3">
      <div>
        <p className="text-lg font-bold" data-testid="header-username">
          {me?.username ?? ""}
        </p>
        {title ? <p className="text-sm text-slate-500">{title}</p> : null}
      </div>
      <div className="flex items-center gap-3">
        <span
          className="rounded-full bg-emerald-100 px-3 py-1 text-lg font-bold text-emerald-800"
          data-testid="header-bank"
        >
          {formatBank(me?.timeBankSeconds ?? 0)}
        </span>
        <button
          type="button"
          onClick={() => {
            void logout().then(() => navigate("/login", { replace: true }));
          }}
          className="min-h-[44px] rounded-xl border border-slate-300 px-4 text-slate-700"
        >
          Logout
        </button>
      </div>
    </header>
  );
}
