import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, FolderOpen, Share2, Star, Trash2, KeyRound, Code2, Settings, Shield, LogOut } from "lucide-react";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/format";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/files", label: "My Files", icon: FolderOpen },
  { to: "/shared", label: "Shared", icon: Share2 },
  { to: "/favorites", label: "Favorites", icon: Star },
  { to: "/trash", label: "Trash", icon: Trash2 },
] as const;

const devNav = [
  { to: "/api-keys", label: "API Keys", icon: KeyRound },
  { to: "/developer", label: "Developer", icon: Code2 },
] as const;

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

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="px-5 py-5">
        <Link to="/dashboard"><Logo /></Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3">
        <div className="space-y-0.5">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive(item.to)
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </div>

        <div className="mt-6 mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
          Developer
        </div>
        <div className="space-y-0.5">
          {devNav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive(item.to)
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </div>

        {isAdmin && (
          <>
            <div className="mt-6 mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
              Admin
            </div>
            <Link
              to="/admin"
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive("/admin")
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              }`}
            >
              <Shield className="h-4 w-4" />
              Admin Panel
            </Link>
          </>
        )}
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
