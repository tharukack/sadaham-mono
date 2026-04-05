import { Menu } from 'lucide-react';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Sheet, SheetContent, SheetTrigger } from '../ui/sheet';
import { Sidebar } from './sidebar';
import { api } from '../../lib/api';
import { clearStoredOtpState, clearStoredSession } from '../../lib/session';

export function Topbar({ title }: { title: string }) {
  const router = useRouter();
  const [profileOpen, setProfileOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<any | null>(null);
  const currentCampaignQuery = useQuery({
    queryKey: ['campaign-current'],
    queryFn: async () => (await api.get('/campaigns/current')).data,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = localStorage.getItem('user');
    if (!raw) return;
    try {
      setUserProfile(JSON.parse(raw));
    } catch {
      setUserProfile(null);
    }
  }, []);

  const initials = useMemo(() => {
    const first = userProfile?.firstName?.[0] || '';
    const last = userProfile?.lastName?.[0] || '';
    const fallback = `${first}${last}`.trim();
    return fallback || 'SA';
  }, [userProfile]);

  const fullName = useMemo(() => {
    const name = `${userProfile?.firstName || ''} ${userProfile?.lastName || ''}`.trim();
    return name || 'Account';
  }, [userProfile]);

  const campaignHeaderText = useMemo(() => {
    const eventDateRaw = currentCampaignQuery.data?.eventDate;
    if (!eventDateRaw) return '';
    const eventDate = new Date(eventDateRaw);
    if (Number.isNaN(eventDate.getTime())) return '';
    const cutoffDate = new Date(eventDate);
    cutoffDate.setDate(cutoffDate.getDate() - 7);
    const formatDate = (value: Date) =>
      value.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    return `Next Lunch Packet Drive ${formatDate(eventDate)} - Order Cut Off ${formatDate(cutoffDate)}`;
  }, [currentCampaignQuery.data?.eventDate]);

  const handleLogout = async () => {
    if (typeof window === 'undefined') return;
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore logout errors; still clear local session
    }
    clearStoredSession();
    clearStoredOtpState();
    router.push('/login');
  };

  return (
    <div className="relative flex flex-wrap items-center justify-between gap-4 border-b bg-background px-4 py-3 sm:px-6 sm:py-4">
      <div className="flex min-w-0 items-center gap-3">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="lg:hidden" aria-label="Open menu">
              <Menu className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0">
            <Sidebar />
          </SheetContent>
        </Sheet>
        <div className="truncate text-lg font-semibold">{title}</div>
      </div>
      {campaignHeaderText && (
        <div className="order-last w-full text-center text-base font-semibold tracking-wide text-amber-700 md:absolute md:left-1/2 md:top-1/2 md:w-auto md:-translate-x-1/2 md:-translate-y-1/2 md:px-4 md:text-lg lg:text-xl">
          {campaignHeaderText}
        </div>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <span className="hidden text-sm font-medium sm:inline">{fullName}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setProfileOpen(true);
            }}
          >
            Profile
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              handleLogout();
            }}
          >
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div>
                <div className="font-medium">{fullName}</div>
                <div className="text-muted-foreground">{userProfile?.role || '-'}</div>
              </div>
            </div>
            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Mobile</span>
                <span className="font-medium">{userProfile?.mobile || '-'}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Email</span>
                <span className="font-medium">{userProfile?.email || '-'}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Address</span>
                <span className="font-medium">{userProfile?.address || '-'}</span>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
