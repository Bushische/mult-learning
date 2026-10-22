import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AdminPage } from "./features/admin/pages/AdminPage";
import { UserStatsPage } from "./features/admin/pages/UserStatsPage";
import { LoginPage } from "./features/auth/pages/LoginPage";
import { DashboardPage } from "./features/dashboard/pages/DashboardPage";
import { PlayPage } from "./features/play/pages/PlayPage";

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/play/:gameId"
        element={
          <ProtectedRoute>
            <PlayPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute adminOnly>
            <AdminPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/users/:id/stats"
        element={
          <ProtectedRoute adminOnly>
            <UserStatsPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
