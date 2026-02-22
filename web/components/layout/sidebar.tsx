import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import {
  ClipboardList,
  BarChart3,
  LayoutDashboard,
  MapPin,
  MessageSquare,
  ShieldCheck,
  ShoppingBag,
  Truck,
  Users,
} from 'lucide-react';

import { cn } from '../../lib/utils';
import { Separator } from '../ui/separator';

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const router = useRouter();
  const [currentRole, setCurrentRole] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem('user');
      if (stored) {
        const parsed = JSON.parse(stored);
        setCurrentRole(parsed?.role || '');
      }
    } catch {
      setCurrentRole('');
    }
  }, []);

  const navSections = useMemo(() => {
    const isEditor = currentRole === 'EDITOR';
    const isViewer = currentRole === 'VIEWER';
    return [
      {
        title: 'Overview',
        items: [{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }],
      },
      {
        title: 'Operations',
        items: [
          { href: '/orders', label: 'Orders', icon: ShoppingBag },
          { href: '/dispatch', label: 'Dispatch', icon: Truck },
          { href: '/customers/search', label: 'Customers', icon: Users },
          { href: '/admin/locations', label: 'Pickup Locations', icon: MapPin },
        ].filter((item) => {
          if (isViewer) {
            return ['/dispatch'].includes(item.href);
          }
          return true;
        }),
      },
      {
        title: 'Admin',
        items: [
          { href: '/admin/users', label: 'Users', icon: Users },
          { href: '/admin/campaign', label: 'Campaigns', icon: ClipboardList },
          { href: '/stats', label: 'Stats', icon: BarChart3 },
          { href: '/admin/sms', label: 'SMS Templates', icon: MessageSquare },
          { href: '/admin/audit', label: 'Audit Log', icon: ShieldCheck },
        ].filter((item) => {
          if (isViewer) return false;
          if (!isEditor) return true;
          return ![
            '/admin/users',
            '/admin/campaign',
            '/stats',
            '/admin/sms',
            '/admin/audit',
          ].includes(item.href);
        }),
      },
    ].filter((section) => section.items.length > 0);
  }, [currentRole]);

  return (
    <aside className="flex h-full w-full flex-col gap-6 p-4">
      <div className="px-2">
        <div className="text-lg font-semibold">Sadaham Admin</div>
        <div className="text-xs text-muted-foreground">Order management console</div>
      </div>
      <div className="flex flex-1 flex-col gap-6">
        {navSections.map((section, index) => (
          <div key={section.title} className="space-y-3">
            <div className="px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {section.title}
            </div>
            <div className="space-y-1">
              {section.items.map((item) => {
                const isActive = router.pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
                      isActive && 'bg-accent text-foreground'
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
            {index < navSections.length - 1 && <Separator />}
          </div>
        ))}
      </div>
    </aside>
  );
}
