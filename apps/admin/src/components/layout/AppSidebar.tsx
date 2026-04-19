import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Gem,
  Package,
  Users,
  FileText,
  BarChart3,
  Settings,
  ShoppingCart,
  LogOut,
  ChevronLeft,
  ChevronRight,
  BookOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';

interface NavItem {
  label: string;
  icon: React.ElementType;
  to: string;
}

const NAV: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, to: '/dashboard' },
];

const CATALOG_NAV: NavItem[] = [
  { label: 'Products', icon: Gem, to: '/products' },
  { label: 'Inventory', icon: Package, to: '/inventory' },
  { label: 'Day Book', icon: BookOpen, to: '/stock' },
];

const OPS_NAV: NavItem[] = [
  { label: 'Transactions', icon: ShoppingCart, to: '/transactions' },
  { label: 'Invoices', icon: FileText, to: '/invoices' },
];

const OTHER_NAV: NavItem[] = [
  { label: 'Customers', icon: Users, to: '/customers' },
  { label: 'Analytics', icon: BarChart3, to: '/analytics' },
  { label: 'Settings', icon: Settings, to: '/settings' },
];

function SidebarLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const location = useLocation();
  // Exact match for routes that are prefixes of others (e.g. /products vs /products/categories)
  const isActive = location.pathname === item.to || (
    location.pathname.startsWith(item.to + '/') && item.to !== '/'
  );

  return (
    <NavLink
      to={item.to}
      end
      title={collapsed ? item.label : undefined}
      className={() =>
        cn(
          'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-all duration-150',
          collapsed ? 'justify-center px-2' : '',
          isActive
            ? 'bg-[hsl(var(--sidebar-accent))] text-white font-medium border-l-2 border-gold-500'
            : 'text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))] hover:text-white',
        )
      }
    >
      <item.icon className="h-4 w-4 shrink-0" />
      {!collapsed && item.label}
    </NavLink>
  );
}

function SidebarSection({ label, items, collapsed }: { label: string; items: NavItem[]; collapsed: boolean }) {
  return (
    <div className="space-y-0.5">
      {!collapsed && (
        <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--sidebar-foreground)/0.4)]">
          {label}
        </p>
      )}
      {collapsed && <div className="my-1 border-t border-[hsl(var(--sidebar-border))] opacity-30" />}
      {items.map((item) => (
        <SidebarLink key={item.to} item={item} collapsed={collapsed} />
      ))}
    </div>
  );
}

interface AppSidebarProps {
  logoUrl?: string | null;
  shopName?: string;
  collapsed: boolean;
  onToggle: () => void;
}

export function AppSidebar({ logoUrl, shopName = 'Jever Jwellers', collapsed, onToggle }: AppSidebarProps) {
  const { user, clearAuth } = useAuthStore();

  async function handleLogout() {
    try {
      await api.post('/auth/logout');
    } finally {
      clearAuth();
    }
  }

  return (
    <aside
      className={cn(
        'flex h-full flex-col bg-[hsl(var(--sidebar-background))] border-r border-[hsl(var(--sidebar-border))] transition-all duration-200',
        collapsed ? 'w-16' : 'w-[220px]',
      )}
    >
      {/* Logo + Shop Name + Toggle */}
      <div className={cn('flex items-center gap-3 px-3 py-4 border-b border-[hsl(var(--sidebar-border))]', collapsed && 'justify-center')}>
        {logoUrl ? (
          <img src={logoUrl} alt="Logo" className="h-9 w-9 rounded-full object-cover shrink-0" />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-full gold-gradient text-white text-base font-heading font-bold shrink-0">
            J
          </div>
        )}
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="font-heading text-sm font-bold text-gold-400 leading-tight truncate">
              {shopName}
            </p>
            <p className="text-[10px] text-[hsl(var(--sidebar-foreground)/0.5)] tracking-wide uppercase">
              Admin Panel
            </p>
          </div>
        )}
        <button
          onClick={onToggle}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={cn(
            'rounded-md p-1 text-[hsl(var(--sidebar-foreground)/0.5)] hover:text-white hover:bg-[hsl(var(--sidebar-accent))] transition-colors shrink-0',
            collapsed && 'mt-0',
          )}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-5 scrollbar-thin">
        <div className="space-y-0.5">
          {NAV.map((item) => (
            <SidebarLink key={item.to} item={item} collapsed={collapsed} />
          ))}
        </div>

        <SidebarSection label="Catalog" items={CATALOG_NAV} collapsed={collapsed} />
        <SidebarSection label="Operations" items={OPS_NAV} collapsed={collapsed} />

        <div className="space-y-0.5">
          {!collapsed && (
            <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--sidebar-foreground)/0.4)]">
              Other
            </p>
          )}
          {collapsed && <div className="my-1 border-t border-[hsl(var(--sidebar-border))] opacity-30" />}
          {OTHER_NAV.map((item) => (
            <SidebarLink key={item.to} item={item} collapsed={collapsed} />
          ))}
        </div>
      </nav>

      {/* User footer */}
      <div className="border-t border-[hsl(var(--sidebar-border))] p-2">
        <div className={cn('flex items-center gap-2 rounded-md px-2 py-1.5', collapsed && 'justify-center')}>
          <div
            title={collapsed ? `${user?.name} · ${user?.email}` : undefined}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-gold-500/20 text-gold-400 text-xs font-semibold shrink-0"
          >
            {user?.name?.[0]?.toUpperCase() ?? 'A'}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-[hsl(var(--sidebar-foreground))] truncate">{user?.name}</p>
              <p className="text-[10px] text-[hsl(var(--sidebar-foreground)/0.5)] truncate">{user?.email}</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            title="Logout"
            className="text-[hsl(var(--sidebar-foreground)/0.5)] hover:text-red-400 transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
