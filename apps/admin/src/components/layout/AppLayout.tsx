import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';
import { TopBar } from './TopBar';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';

export function AppLayout() {
  const { data } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get('/settings').then((r) => r.data.data),
    staleTime: 5 * 60 * 1000,
  });

  const { user, clearAuth } = useAuthStore();

  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebar-collapsed') === 'true');

  function handleToggle() {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem('sidebar-collapsed', String(next));
      return next;
    });
  }

  async function handleLogout() {
    try {
      await api.post('/auth/logout');
    } finally {
      clearAuth();
    }
  }

  const logoUrl = data?.logo_url ? data.logo_url : null;
  const shopName = data?.shop_name ?? 'Jever Jwellers';

  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar
        logoUrl={logoUrl}
        shopName={shopName}
        collapsed={collapsed}
        user={user}
        onLogout={handleLogout}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar collapsed={collapsed} onToggle={handleToggle} />
        <main className="flex-1 overflow-y-auto bg-background">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
