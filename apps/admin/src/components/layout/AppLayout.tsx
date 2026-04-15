import { Outlet } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

export function AppLayout() {
  const { data } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get('/settings').then((r) => r.data.data),
    staleTime: 5 * 60 * 1000,
  });

  const logoUrl = data?.logo_url ? data.logo_url : null;
  const shopName = data?.shop_name ?? 'Jever Jwellers';

  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar logoUrl={logoUrl} shopName={shopName} />
      <main className="flex-1 overflow-y-auto bg-background">
        <Outlet />
      </main>
    </div>
  );
}
