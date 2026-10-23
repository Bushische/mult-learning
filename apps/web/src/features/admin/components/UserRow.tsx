import type { AdminUser, Game } from "@mult/shared";
import { useState } from "react";
import { Link } from "react-router-dom";
import { formatBank } from "../../dashboard/lib/format";

interface UserRowProps {
  user: AdminUser;
  games: Game[];
  onSave: (id: string, patch: { username?: string; pin?: string; role?: "admin" | "user" }) => void;
  onDelete: (id: string) => void;
  onAssign: (id: string, gameIds: string[]) => void;
  onReset: (id: string) => void;
}

/** One user row: edit, game assignment, delete and reset. */
export function UserRow({ user, games, onSave, onDelete, onAssign, onReset }: UserRowProps) {
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState(user.username);
  const [pin, setPin] = useState("");
  const [role, setRole] = useState<"admin" | "user">(user.role);
  const [selectedGames, setSelectedGames] = useState<string[]>(user.games);
  const [confirming, setConfirming] = useState<"delete" | "reset" | null>(null);

  const toggleGame = (gameId: string) => {
    setSelectedGames((current) =>
      current.includes(gameId) ? current.filter((id) => id !== gameId) : [...current, gameId],
    );
  };

  return (
    <li
      className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm"
      data-testid={`user-${user.username}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-lg font-bold">{user.username}</p>
          <p className="text-sm text-slate-500">
            {user.role} · {formatBank(user.timeBankSeconds)} bank
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to={`/admin/users/${user.id}/stats`}
            data-testid={`stats-link-${user.username}`}
            className="flex min-h-[44px] items-center rounded-xl border border-slate-300 px-4"
          >
            Stats
          </Link>
          <button
            type="button"
            onClick={() => {
              setEditing((current) => !current);
              setUsername(user.username);
              setRole(user.role);
              setPin("");
            }}
            className="min-h-[44px] rounded-xl border border-slate-300 px-4"
          >
            Edit
          </button>
        </div>
      </div>

      {editing ? (
        <div className="flex flex-col gap-2" data-testid={`edit-${user.username}`}>
          <label className="flex flex-col text-sm">
            Username
            <input
              className="min-h-[44px] rounded-xl border border-slate-300 px-3"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </label>
          <label className="flex flex-col text-sm">
            New PIN (4 digits)
            <input
              className="min-h-[44px] rounded-xl border border-slate-300 px-3"
              value={pin}
              inputMode="numeric"
              maxLength={4}
              onChange={(event) => setPin(event.target.value)}
            />
          </label>
          <label className="flex flex-col text-sm">
            Role
            <select
              className="min-h-[44px] rounded-xl border border-slate-300 px-3"
              value={role}
              onChange={(event) => setRole(event.target.value === "admin" ? "admin" : "user")}
            >
              <option value="user">user</option>
              <option value="admin">admin</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => {
              onSave(user.id, {
                username: username !== user.username ? username : undefined,
                pin: pin.length > 0 ? pin : undefined,
                role: role !== user.role ? role : undefined,
              });
              setEditing(false);
            }}
            className="min-h-[44px] rounded-xl bg-sky-500 px-4 font-bold text-white"
          >
            Save
          </button>
        </div>
      ) : null}

      <fieldset className="flex flex-col gap-1" data-testid={`games-${user.username}`}>
        <legend className="text-sm font-semibold text-slate-600">Games</legend>
        {games.map((game) => (
          <label key={game.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={selectedGames.includes(game.id)}
              onChange={() => toggleGame(game.id)}
            />
            {game.name}
          </label>
        ))}
        <button
          type="button"
          onClick={() => onAssign(user.id, selectedGames)}
          className="min-h-[44px] self-start rounded-xl border border-slate-300 px-4"
        >
          Save games
        </button>
      </fieldset>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setConfirming("reset")}
          className="min-h-[44px] rounded-xl bg-red-600 px-4 font-bold text-white"
        >
          Reset Progress / Heatmap
        </button>
        <button
          type="button"
          onClick={() => setConfirming("delete")}
          className="min-h-[44px] rounded-xl border border-red-300 px-4 text-red-700"
        >
          Delete
        </button>
      </div>

      {confirming ? (
        <div
          className="flex flex-col gap-2 rounded-xl bg-red-50 p-3"
          data-testid={`confirm-${user.username}`}
        >
          <p className="text-sm font-semibold text-red-800">
            {confirming === "delete"
              ? `Really delete ${user.username}? This cannot be undone.`
              : `Really reset the progress of ${user.username}?`}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                if (confirming === "delete") onDelete(user.id);
                else onReset(user.id);
                setConfirming(null);
              }}
              className="min-h-[44px] rounded-xl bg-red-600 px-4 font-bold text-white"
            >
              Yes, {confirming === "delete" ? "delete" : "reset"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(null)}
              className="min-h-[44px] rounded-xl border border-slate-300 px-4"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
}
