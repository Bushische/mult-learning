import { AppHeader } from "../../dashboard/components/AppHeader";

/** Admin panel — the real panel lands in T13. */
export function AdminPage() {
  return (
    <div className="min-h-screen">
      <AppHeader title="Admin" />
      <main className="p-6">
        <p className="text-lg text-slate-600">Admin tools show up here.</p>
      </main>
    </div>
  );
}
