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
}

export function AppSidebar({ logoUrl, shopName = 'Jever Jwellers', collapsed }: AppSidebarProps) {
  return (
    <aside
      className={cn(
        'flex h-full flex-col bg-[hsl(var(--sidebar-background))] border-r border-[hsl(var(--sidebar-border))] transition-all duration-200',
        collapsed ? 'w-16' : 'w-[220px]',
      )}
    >
      {/* Logo + Shop Name — collapsed mode = row-wise compact (icon only) */}
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
    </aside>
  );
}
