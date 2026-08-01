import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard, FolderOpen, Share2, Star, Trash2, KeyRound, Code2, Settings, Shield, LogOut,
  Brain, Rocket, Server, Activity, Bell, BarChart3, CloudUpload, Building2,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/format";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; badge?: number };

const groups: { label: string; items: NavItem[] }[] = [
  {
    label: "Workspace",
    items: [
      { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
      { to: "/activity", label: "Activity", icon: Activity },
      { to: "/notifications", label: "Notifications", icon: Bell },
    ],
  },
  {
    label: "Storage",
    items: [
      { to: "/files", label: "My Files", icon: FolderOpen },
      { to: "/shared", label: "Shared", icon: Share2 },
      { to: "/share-diagnostics", label: "Link Diagnostics", icon: Share2 },

      { to: "/favorites", label: "Favorites", icon: Star },
      { to: "/trash", label: "Trash", icon: Trash2 },
      { to: "/storage-analytics", label: "Analytics", icon: BarChart3 },
      { to: "/backup", label: "Backup Center", icon: CloudUpload },
    ],
  },
  {
    label: "Collaboration",
    items: [
      { to: "/organizations", label: "Organizations", icon: Building2 },
    ],
  },
  {
    label: "AI Hub",
    items: [
      { to: "/ai/models", label: "Models", icon: Brain },
      { to: "/ai/deployments", label: "Deployments", icon: Rocket },
    ],
  },
  {
    label: "Developer",
    items: [
      { to: "/api-keys", label: "API Keys", icon: KeyRound },
      { to: "/developer", label: "Console", icon: Code2 },
      { to: "/security", label: "Security", icon: Shield },
    ],
  },
];

export function AppSidebar() {
  const { user } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      return data;
    },
  });

  const { data: isAdmin } = useQuery({
    queryKey: ["is-admin", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user!.id).eq("role", "admin").maybeSingle();
      return !!data;
    },
  });

  const { data: unreadCount } = useQuery({
    queryKey: ["notif-unread", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .is("read_at", null);
      return count ?? 0;
    },
    refetchInterval: 30_000,
  });

  const used = profile?.storage_used ?? 0;
  const quota = profile?.storage_quota ?? 10 * 1024 ** 3;
  const pct = Math.min(100, (Number(used) / Number(quota)) * 100);

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/auth", replace: true });
  }

  const isActive = (p: string) => pathname === p || pathname.startsWith(p + "/");

  function renderItem(item: NavItem) {
    const active = isActive(item.to);
    const badge = item.to === "/notifications" ? unreadCount : item.badge;
    return (
      <Link
        key={item.to}
        to={item.to}
        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
          active
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
        }`}
      >
        <item.icon className="h-4 w-4" />
        <span className="flex-1 truncate">{item.label}</span>
        {badge ? (
          <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold leading-4 text-primary-foreground">
            {badge > 99 ? "99+" : badge}
          </span>
        ) : null}
      </Link>
    );
  }

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="px-5 py-5">
        <Link to="/dashboard"><Logo /></Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {groups.map((g, i) => (
          <div key={g.label} className={i === 0 ? "" : "mt-5"}>
            <div className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
              {g.label}
            </div>
            <div className="space-y-0.5">{g.items.map(renderItem)}</div>
          </div>
        ))}

        {isAdmin && (
          <div className="mt-5">
            <div className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
              Administration
            </div>
            <div className="space-y-0.5">
              {renderItem({ to: "/admin", label: "Admin Panel", icon: Shield })}
              {renderItem({ to: "/ai/orchestrators", label: "GPU Runners", icon: Server })}
            </div>
          </div>
        )}

        <div className="mt-5">
          <div className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
            Settings
          </div>
          <div className="space-y-0.5">
            {renderItem({ to: "/settings", label: "Preferences", icon: Settings })}
          </div>
        </div>
      </nav>

      <div className="border-t border-sidebar-border p-4">
        <div className="mb-3">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="text-sidebar-foreground/70">Storage</span>
            <span className="font-mono text-sidebar-foreground/70">
              {formatBytes(Number(used))} / {formatBytes(Number(quota))}
            </span>
          </div>
          <Progress value={pct} className="h-1.5" />
        </div>
        <div className="flex items-center gap-2">
          <Link to="/settings" className="flex flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-sidebar-accent/50">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
              {(profile?.display_name || user?.email || "?")[0]?.toUpperCase()}
            </div>
            <span className="truncate text-xs font-medium">{profile?.display_name || user?.email}</span>
          </Link>
          <ThemeToggle />
          <Button variant="ghost" size="icon" onClick={handleSignOut} aria-label="Sign out">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}
