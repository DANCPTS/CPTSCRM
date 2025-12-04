'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import {
  LayoutDashboard,
  Users,
  Building2,
  UserCircle,
  BookOpen,
  Calendar,
  CalendarDays,
  ClipboardCheck,
  ListTodo,
  Settings,
  LogOut,
  GraduationCap,
  Bell,
  Mail,
  UserCheck,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/leads', label: 'Leads', icon: Users },
  { href: '/companies', label: 'Companies', icon: Building2 },
  { href: '/contacts', label: 'Contacts', icon: UserCircle },
  { href: '/candidates', label: 'Candidates', icon: GraduationCap },
  { href: '/courses', label: 'Courses', icon: BookOpen },
  { href: '/runs', label: 'Runs', icon: Calendar },
  { href: '/trainers', label: 'Trainers', icon: UserCheck },
  { href: '/bookings', label: 'Bookings', icon: ClipboardCheck },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/marketing', label: 'Marketing', icon: Mail },
  { href: '/tasks', label: 'Tasks', icon: ListTodo },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function AppNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { userProfile, signOut } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [popoverOpen, setPopoverOpen] = useState(false);

  useEffect(() => {
    if (userProfile?.id) {
      loadNotifications();

      const subscription = supabase
        .channel('notifications')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userProfile.id}`,
          },
          () => {
            loadNotifications();
          }
        )
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [userProfile?.id]);

  const loadNotifications = async () => {
    if (!userProfile?.id) return;

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userProfile.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Failed to load notifications:', error);
      return;
    }

    setNotifications(data || []);
    setUnreadCount(data?.filter(n => !n.read).length || 0);
  };

  const handleNotificationClick = async (notification: any) => {
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notification.id);

    loadNotifications();
    setPopoverOpen(false);

    if (notification.reference_type === 'booking_form' && notification.reference_id) {
      router.push(`/bookings/${notification.reference_id}`);
    } else if (notification.reference_type === 'lead' && notification.reference_id) {
      router.push(`/leads`);
    }
  };

  const markAllAsRead = async () => {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userProfile?.id)
      .eq('read', false);

    if (error) {
      console.error('Failed to mark all as read:', error);
      return;
    }

    loadNotifications();
  };

  return (
    <div className="flex h-screen w-64 flex-col border-r bg-gradient-to-b from-primary/5 to-background shadow-lg">
      <div className="flex h-16 items-center justify-between border-b border-primary/10 px-6 bg-card/50 backdrop-blur-sm">
        <img
          src="/cpcs-training-courses-logo-removebg-preview.png"
          alt="CPTS Training"
          className="h-10 w-auto object-contain"
        />

        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="relative">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -right-1 -top-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
                >
                  {unreadCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="end">
            <div className="flex items-center justify-between border-b p-3">
              <h3 className="font-semibold text-sm">Notifications</h3>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={markAllAsRead}
                >
                  Mark all read
                </Button>
              )}
            </div>
            <ScrollArea className="h-[400px]">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Bell className="h-8 w-8 text-muted mb-2" />
                  <p className="text-sm text-muted-foreground">No notifications</p>
                </div>
              ) : (
                <div className="divide-y">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={cn(
                        'p-3 hover:bg-accent/50 cursor-pointer transition-colors',
                        !notification.read && 'bg-primary/5'
                      )}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">
                            {notification.title}
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {notification.message}
                          </p>
                          <p className="text-xs text-muted-foreground/70 mt-1">
                            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                          </p>
                        </div>
                        {!notification.read && (
                          <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-1" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </PopoverContent>
        </Popover>
      </div>

      <nav className="flex-1 space-y-2 px-3 py-6">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all',
                isActive
                  ? 'bg-gradient-to-r from-primary to-secondary text-primary-foreground shadow-md scale-105'
                  : 'text-primary/80 hover:bg-accent/20 hover:text-accent-foreground hover:scale-102 hover:shadow-sm'
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-primary/10 p-4 bg-card/50 backdrop-blur-sm">
        <div className="mb-3 text-sm">
          <p className="font-bold text-primary">{userProfile?.full_name}</p>
          <p className="text-xs text-muted-foreground capitalize">{userProfile?.role}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full border-primary/20 hover:bg-accent hover:text-accent-foreground hover:border-accent transition-all"
          onClick={() => signOut()}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}
