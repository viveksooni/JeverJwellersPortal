import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';
import { Menu, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TopBarProps {
  collapsed: boolean;
  onToggle: () => void;
  shopName?: string;
}

export function TopBar({ collapsed, onToggle, shopName = 'Jever Jwellers' }: TopBarProps) {
  const { user, clearAuth } = useAuthStore();

  async function handleLogout() {
    try {
      await api.post('/auth/logout');
    } finally {
      clearAuth();
    }
  }

  return (
    <header className="h-14 shrink-0 flex items-center gap-3 border-b border-border bg-background px-3 md:px-4">
      {/* Collapse toggle */}
      <button
        onClick={onToggle}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-label="Toggle sidebar"
        className="rounded-md p-2 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="hidden sm:block">
        <p className="font-heading text-base font-bold text-gold-700 leading-tight truncate">
          {shopName}
        </p>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* User info — row-wise (horizontal): avatar + name/email + logout */}
      <div className="flex items-center gap-2.5">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full bg-gold-500/20 text-gold-700 text-xs font-semibold shrink-0"
          title={`${user?.name} · ${user?.email}`}
        >
          {user?.name?.[0]?.toUpperCase() ?? 'A'}
        </div>

        <div className="hidden md:flex flex-col min-w-0 leading-tight">
          <span className="text-xs font-medium text-foreground truncate max-w-[160px]">
            {user?.name ?? 'Admin'}
          </span>
          <span className="text-[10px] text-muted-foreground truncate max-w-[160px]">
            {user?.email ?? ''}
          </span>
        </div>

        <button
          onClick={handleLogout}
          title="Logout"
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs',
            'text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors border border-transparent hover:border-red-100',
          )}
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
}
