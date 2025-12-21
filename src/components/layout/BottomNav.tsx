import { Home, DollarSign, History, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NavLink } from '@/components/layout/NavLink';

export const BottomNav = () => {
  const navItems = [
    { path: '/dashboard', icon: Home, label: 'Home' },
    { path: '/earnings', icon: DollarSign, label: 'Earnings' },
    { path: '/history', icon: History, label: 'History' },
    { path: '/profile', icon: User, label: 'Profile' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50">
      <div className="max-w-6xl mx-auto flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className="flex flex-col items-center justify-center py-3 px-4 min-w-[80px] transition-colors text-muted-foreground hover:text-foreground"
              activeClassName="text-primary"
            >
              <Icon className={cn('w-6 h-6 mb-1')} />
              <span className="text-xs font-medium">{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </div>
  );
};
