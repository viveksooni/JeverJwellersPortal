import { Menu } from 'lucide-react';

interface TopBarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function TopBar({ collapsed, onToggle }: TopBarProps) {
  return (
    <header className="h-14 shrink-0 flex items-center border-b border-border bg-background px-3 md:px-4">
      <button
        onClick={onToggle}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-label="Toggle sidebar"
        className="rounded-md p-2 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
      >
        <Menu className="h-5 w-5" />
      </button>
    </header>
  );
}
