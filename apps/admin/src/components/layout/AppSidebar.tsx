import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Users,
  FileText,
  BarChart3,
  Settings,
  ShoppingCart,
  BookOpen,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  icon: React.ElementType;
  to: string;
}

const NAV: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, to: '/dashboard' },
];

const CATALOG_NAV: NavItem[] = [
  { label: 'Inventory', icon: Package, to: '/products' },
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
  const isActive =
    location.pathname === item.to ||
    (location.pathname.startsWith(item.to + '/') && item.to !== '/');

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
      {!collapsed && <span className="truncate">{item.label}</span>}
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
  user?: { name?: string; email?: string } | null;
  onLogout?: () => void;
}

export function AppSidebar({ logoUrl, shopName = 'Jever Jwellers', collapsed, user, onLogout }: AppSidebarProps) {
  const initials = user?.name?.[0]?.toUpperCase() ?? 'A';

  return (
    <aside
      className={cn(
        'flex h-full flex-col bg-[hsl(var(--sidebar-background))] border-r border-[hsl(var(--sidebar-border))] transition-all duration-200',
        collapsed ? 'w-16' : 'w-[220px]',
      )}
    >
      {/* Logo + Shop Name */}
      <div
        className={cn(
          'flex items-center gap-3 px-3 py-4 border-b border-[hsl(var(--sidebar-border))] h-14',
          collapsed && 'justify-center px-0',
        )}
      >
        {logoUrl ? (
          <img src={logoUrl} alt="Logo" className="h-8 w-8 rounded-full object-cover shrink-0" />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full gold-gradient text-white text-sm font-heading font-bold shrink-0">
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
        <SidebarSection label="Other" items={OTHER_NAV} collapsed={collapsed} />
      </nav>

      {/* Bottom: User info + Logout */}
      <div className={cn(
        'border-t border-[hsl(var(--sidebar-border))] px-2 py-3 shrink-0',
        collapsed ? 'flex flex-col items-center gap-2' : 'space-y-2',
      )}>
        {!collapsed && (
          <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-md">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gold-500/20 text-gold-700 text-xs font-semibold shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-[hsl(var(--sidebar-foreground))] truncate leading-tight">
                {user?.name ?? 'Admin'}
              </p>
              <p className="text-[10px] text-[hsl(var(--sidebar-foreground)/0.5)] truncate">
                {user?.email ?? ''}
              </p>
            </div>
          </div>
        )}

        {collapsed && (
          <div
            className="flex h-7 w-7 items-center justify-center rounded-full bg-gold-500/20 text-gold-700 text-xs font-semibold shrink-0"
            title={`${user?.name ?? 'Admin'} · ${user?.email ?? ''}`}
          >
            {initials}
          </div>
        )}

        <button
          onClick={onLogout}
          title="Logout"
          className={cn(
            'flex items-center gap-2 rounded-md px-2 py-1.5 text-xs w-full transition-colors',
            'text-[hsl(var(--sidebar-foreground)/0.6)] hover:text-red-400 hover:bg-red-500/10',
            collapsed && 'justify-center px-0 w-auto',
          )}
        >
          <LogOut className="h-3.5 w-3.5 shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
}
