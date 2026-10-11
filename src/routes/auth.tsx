import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Link } from "@tanstack/react-router";
import { oauthReturnPath } from "@/lib/oauth-return-path";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — E-Cloud" }, { name: "description", content: "Sign in or create an E-Cloud account." }] }),
  ssr: false,
  validateSearch: (s: { next?: unknown }): { next?: string } => ({ next: typeof s.next === "string" ? oauthReturnPath(s.next) : undefined }),
  beforeLoad: async ({ search }) => {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      if (search.next && search.next !== "/") throw redirect({ href: search.next });
      throw redirect({ to: "/dashboard" });
    }
  },
  component: AuthPage,
});

const emailSchema = z.string().trim().email("Enter a valid email").max(255);
const passwordSchema = z.string().min(8, "Password must be at least 8 characters").max(100);
const nameSchema = z.string().trim().min(1, "Name required").max(80);

function AuthPage() {
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const go = () => (next && next !== "/" ? (window.location.href = next) : navigate({ to: "/dashboard" }));
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"signin" | "signup">("signin");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    const em = emailSchema.safeParse(email);
    const pw = passwordSchema.safeParse(password);
    if (!em.success) return toast.error(em.error.issues[0].message);
    if (!pw.success) return toast.error(pw.error.issues[0].message);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: em.data, password: pw.data });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome back");
    go();
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    const em = emailSchema.safeParse(email);
    const pw = passwordSchema.safeParse(password);
    const nm = nameSchema.safeParse(name);
    if (!nm.success) return toast.error(nm.error.issues[0].message);
    if (!em.success) return toast.error(em.error.issues[0].message);
    if (!pw.success) return toast.error(pw.error.issues[0].message);
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: em.data,
      password: pw.data,
      options: {
        emailRedirectTo: next && next !== "/" ? new URL(next, window.location.origin).href : window.location.origin,
        data: { display_name: nm.data },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Account created — welcome to E-Cloud");
    go();
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-hero-gradient lg:block">
        <div className="absolute left-8 top-8"><Link to="/"><Logo /></Link></div>
        <div className="flex h-full items-center px-16">
          <div className="max-w-md">
            <h2 className="font-display text-4xl font-bold leading-tight">
              Cloud storage & a REST API — in one place.
            </h2>
            <p className="mt-4 text-muted-foreground">
              Sign in to your workspace or create a new account. Every account
              includes the full developer API and 10 GB of storage to start.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col justify-center px-6 py-12 md:px-16">
        <div className="mb-8 flex items-center justify-between lg:hidden">
          <Link to="/"><Logo /></Link>
          <ThemeToggle />
        </div>
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-6 hidden justify-end lg:flex"><ThemeToggle /></div>
          <h1 className="font-display text-3xl font-bold">Welcome</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sign in or create your E-Cloud account.</p>

          <Tabs value={tab} onValueChange={(v) => setTab(v as "signin" | "signup")} className="mt-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <Card className="mt-4 p-6">
                <form className="space-y-4" onSubmit={handleSignIn}>
                  <div className="space-y-2">
                    <Label htmlFor="si-email">Email</Label>
                    <Input id="si-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="si-password">Password</Label>
                    <Input id="si-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Signing in..." : "Sign in"}
                  </Button>
                </form>
              </Card>
            </TabsContent>

            <TabsContent value="signup">
              <Card className="mt-4 p-6">
                <form className="space-y-4" onSubmit={handleSignUp}>
                  <div className="space-y-2">
                    <Label htmlFor="su-name">Display name</Label>
                    <Input id="su-name" value={name} onChange={(e) => setName(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="su-email">Email</Label>
                    <Input id="su-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="su-password">Password</Label>
                    <Input id="su-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                    <p className="text-xs text-muted-foreground">At least 8 characters. We check against known breached passwords.</p>
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Creating account..." : "Create account"}
                  </Button>
                </form>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
