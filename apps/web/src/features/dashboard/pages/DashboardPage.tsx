import { AppHeader } from "../components/AppHeader";

/** Dashboard — replaced by the full dashboard in T11. */
export function DashboardPage() {
  return (
    <div className="min-h-screen">
      <AppHeader title="Dashboard" />
      <main className="p-6">
        <p className="text-lg text-slate-600">Your games and progress show up here.</p>
      </main>
    </div>
  );
}
