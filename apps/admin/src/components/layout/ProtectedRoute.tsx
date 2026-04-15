import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';
import { Loader2 } from 'lucide-react';

export function ProtectedRoute() {
  const { isAuthenticated, setAuth, clearAuth } = useAuthStore();
  const [checking, setChecking] = useState(!isAuthenticated);

  useEffect(() => {
    if (isAuthenticated) return;

    // Try to restore session via refresh token cookie
    api
      .post('/auth/refresh')
      .then((res) => {
        const { accessToken } = res.data.data;
        // Get user info
        return api
          .get('/auth/me', { headers: { Authorization: `Bearer ${accessToken}` } })
          .then((r) => setAuth(r.data.data, accessToken));
      })
      .catch(() => clearAuth())
      .finally(() => setChecking(false));
  }, []);

  if (checking) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 rounded-full gold-gradient flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-white" />
          </div>
          <p className="text-sm text-muted-foreground font-medium">Loading Jever Jwellers…</p>
        </div>
      </div>
    );
  }

  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
}
