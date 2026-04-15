import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Gem,
  Package,
  Users,
  Receipt,
  FileText,
  BarChart3,
  Settings,
  ShoppingCart,
  Wrench,
  LogOut,
  ChevronRight,
  Coins,
  BookOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';
import { toast } from '@/hooks/use-toast';

interface NavItem {
  label: string;
  icon: React.ElementType;
  to: string;
  children?: { label: string; to: string }[];
}

const NAV: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, to: '/dashboard' },
];

const CATALOG_NAV: NavItem[] = [
  { label: 'Products', icon: Gem, to: '/products' },
  { label: 'Inventory', icon: Package, to: '/inventory' },
  { label: 'Stock Register', icon: BookOpen, to: '/stock' },
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

function SidebarLink({ item }: { item: NavItem }) {
  const location = useLocation();
  const isActive = location.pathname.startsWith(item.to) && item.to !== '/';

  return (
    <NavLink
      to={item.to}
      className={({ isActive: navActive }) =>
        cn(
          'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-all duration-150',
          (navActive || isActive)
            ? 'bg-[hsl(var(--sidebar-accent))] text-white font-medium border-l-2 border-gold-500'
            : 'text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))] hover:text-white',
        )
      }
    >
      <item.icon className="h-4 w-4 shrink-0" />
      {item.label}
    </NavLink>
  );
}

function SidebarSection({ label, items }: { label: string; items: NavItem[] }) {
  return (
    <div className="space-y-0.5">
      <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--sidebar-foreground)/0.4)]">
        {label}
      </p>
      {items.map((item) => (
        <SidebarLink key={item.to} item={item} />
      ))}
    </div>
  );
}

interface AppSidebarProps {
  logoUrl?: string | null;
  shopName?: string;
}

export function AppSidebar({ logoUrl, shopName = 'Jever Jwellers' }: AppSidebarProps) {
  const { user, clearAuth } = useAuthStore();

  async function handleLogout() {
    try {
      await api.post('/auth/logout');
    } finally {
      clearAuth();
    }
  }

  return (
    <aside className="flex h-full w-[220px] flex-col bg-[hsl(var(--sidebar-background))] border-r border-[hsl(var(--sidebar-border))]">
      {/* Logo + Shop Name */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-[hsl(var(--sidebar-border))]">
        {logoUrl ? (
          <img src={logoUrl} alt="Logo" className="h-10 w-10 rounded-full object-cover" />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full gold-gradient text-white text-lg font-heading font-bold shrink-0">
            J
          </div>
        )}
        <div className="min-w-0">
          <p className="font-heading text-base font-bold text-gold-400 leading-tight truncate">
            {shopName}
          </p>
          <p className="text-[10px] text-[hsl(var(--sidebar-foreground)/0.5)] tracking-wide uppercase">
            Admin Panel
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5 scrollbar-thin">
        <div className="space-y-0.5">
          {NAV.map((item) => (
            <SidebarLink key={item.to} item={item} />
          ))}
        </div>

        <SidebarSection label="Catalog" items={CATALOG_NAV} />
        <SidebarSection label="Operations" items={OPS_NAV} />

        <div className="space-y-0.5">
          <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--sidebar-foreground)/0.4)]">
            Other
          </p>
          {OTHER_NAV.map((item) => (
            <SidebarLink key={item.to} item={item} />
          ))}
        </div>
      </nav>

      {/* User footer */}
      <div className="border-t border-[hsl(var(--sidebar-border))] p-3">
        <div className="flex items-center gap-2 rounded-md px-2 py-1.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gold-500/20 text-gold-400 text-xs font-semibold shrink-0">
            {user?.name?.[0]?.toUpperCase() ?? 'A'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-[hsl(var(--sidebar-foreground))] truncate">{user?.name}</p>
            <p className="text-[10px] text-[hsl(var(--sidebar-foreground)/0.5)] truncate">{user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-[hsl(var(--sidebar-foreground)/0.5)] hover:text-red-400 transition-colors"
            title="Logout"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
