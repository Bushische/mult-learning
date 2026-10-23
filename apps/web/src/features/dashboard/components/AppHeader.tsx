import { useLocation, useNavigate } from "react-router-dom";
import { logout } from "../../auth/api";
import { useMe } from "../hooks/useMe";
import { formatBank, formatDuration } from "../lib/format";

interface AppHeaderProps {
  title?: string;
  /**
   * When set, the header pill shows today's earned time (child dashboard)
   * instead of the lifetime bank. Admin and play screens omit it (bank stays).
   */
  todayEarned?: number;
}

/** Header: user name, today/bank pill, admin entry, logout. */
export function AppHeader({ title, todayEarned }: AppHeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: me } = useMe();
  const isAdmin = me?.role === "admin";
  const onAdminPage = location.pathname.startsWith("/admin");
  const pillTestId = todayEarned === undefined ? "header-bank" : "header-today";
  const pillText =
    todayEarned === undefined
      ? formatBank(me?.timeBankSeconds ?? 0)
      : `+${formatDuration(todayEarned)}`;

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
          data-testid={pillTestId}
        >
          {pillText}
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
        {isAdmin ? (
          <button
            type="button"
            data-testid="header-admin"
            onClick={() => navigate(onAdminPage ? "/" : "/admin")}
            className="min-h-[44px] rounded-xl bg-slate-800 px-4 font-bold text-white"
          >
            {onAdminPage ? "Dashboard" : "Admin"}
          </button>
        ) : null}
      </div>
    </header>
  );
}
