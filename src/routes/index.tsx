import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, Cloud, Code2, FolderTree, KeyRound, Share2, Shield, Zap } from "lucide-react";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "E-Cloud — API-first cloud storage" },
      { name: "description", content: "Modern cloud storage with a developer-first REST API. Upload files, share securely, and integrate in minutes." },
      { property: "og:title", content: "E-Cloud — API-first cloud storage" },
      { property: "og:description", content: "Upload, manage, and share files. Ship features fast with our REST API." },
    ],
  }),
  component: Landing,
});

function Feature({ icon: Icon, title, desc }: { icon: typeof Cloud; title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-soft transition-all hover:shadow-elegant hover:-translate-y-0.5">
      <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary-soft text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mb-1 font-display text-lg font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
    </div>
  );
}

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Logo />
          <nav className="hidden items-center gap-8 md:flex">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground">Features</a>
            <a href="#developers" className="text-sm text-muted-foreground hover:text-foreground">Developers</a>
            <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground">Pricing</a>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link to="/auth"><Button variant="ghost" size="sm">Sign in</Button></Link>
            <Link to="/auth"><Button size="sm">Get started</Button></Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden bg-hero-gradient">
        <div className="mx-auto max-w-7xl px-6 py-24 md:py-36">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="max-w-3xl"
          >
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              API-first cloud infrastructure
            </div>
            <h1 className="font-display text-5xl font-bold leading-[1.05] text-foreground md:text-7xl">
              Storage your users<br />
              <span className="text-primary">and your code</span> love.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground">
              E-Cloud is a modern cloud storage platform with a clean UI and a powerful REST API.
              Upload, organize, share, and integrate — all from one place.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/auth">
                <Button size="lg" className="gap-2">
                  Start for free <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <a href="#developers">
                <Button size="lg" variant="outline">Read the API docs</Button>
              </a>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.2, ease: "easeOut" }}
            className="mt-16 overflow-hidden rounded-2xl border border-border bg-card shadow-elegant"
          >
            <div className="flex items-center gap-2 border-b border-border bg-surface-2 px-4 py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
              <span className="ml-3 font-mono text-xs text-muted-foreground">POST /api/public/v1/files/upload</span>
            </div>
            <pre className="overflow-x-auto p-6 text-sm leading-relaxed">
              <code className="font-mono text-foreground">{`curl -X POST https://cloud.egreedtech.org/api/public/v1/files/upload \\
  -H "X-API-Key: eck_live_••••••••••••••" \\
  -F "file=@invoice.pdf" \\
  -F "folder=receipts"

{
  "id": "b4c1...",
  "name": "invoice.pdf",
  "size": 84213,
  "url": "https://cloud.egreedtech.org/s/xk92..."
}`}</code>
            </pre>
          </motion.div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-7xl px-6 py-24">
        <div className="mb-12 max-w-2xl">
          <h2 className="font-display text-4xl font-bold">Everything you need to store, share, and ship.</h2>
          <p className="mt-3 text-muted-foreground">A minimal interface for humans. A predictable REST API for machines.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Feature icon={Cloud} title="Fast uploads" desc="Drag & drop. Resumable, chunked uploads for large files." />
          <Feature icon={FolderTree} title="Nested folders" desc="Organize with folders, favorites, and a full trash with restore." />
          <Feature icon={Share2} title="Secure sharing" desc="Public links with expiration and optional password protection." />
          <Feature icon={KeyRound} title="Scoped API keys" desc="Generate, monitor, and revoke keys per app or integration." />
          <Feature icon={Shield} title="Row-level security" desc="Every file, folder, and share is scoped to its owner by default." />
          <Feature icon={Zap} title="Signed URLs" desc="Short-lived signed download URLs — never expose raw storage paths." />
        </div>
      </section>

      <section id="developers" className="border-y border-border bg-surface-2">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 py-24 lg:grid-cols-2">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium">
              <Code2 className="h-3 w-3" /> Developer platform
            </div>
            <h2 className="font-display text-4xl font-bold">A REST API you'd actually enjoy using.</h2>
            <p className="mt-4 text-muted-foreground">
              Every action in the dashboard is available through the API — auth,
              file uploads, folders, sharing. Bring your own frontend, mobile app,
              or backend integration.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              {[
                "POST /api/public/v1/files/upload — multipart upload",
                "GET  /api/public/v1/files — list files",
                "GET  /api/public/v1/files/:id — signed download URL",
                "DELETE /api/public/v1/files/:id — remove file",
              ].map((line) => (
                <li key={line} className="rounded-md border border-border bg-card px-3 py-2 font-mono text-xs">
                  {line}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6 shadow-elegant">
            <div className="mb-4 flex items-center justify-between">
              <span className="font-mono text-xs text-muted-foreground">example.ts</span>
              <span className="rounded bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary">TypeScript</span>
            </div>
            <pre className="overflow-x-auto text-sm leading-relaxed"><code className="font-mono">{`const res = await fetch(
  "https://ecloud.app/api/public/v1/files",
  { headers: { "X-API-Key": process.env.ECLOUD_KEY! } }
);
const { files } = await res.json();
console.log(files.length, "files");`}</code></pre>
          </div>
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-4xl px-6 py-24 text-center">
        <h2 className="font-display text-4xl font-bold">Start with 10 GB — free.</h2>
        <p className="mt-3 text-muted-foreground">Every account ships with the full API. Upgrade when you scale.</p>
        <div className="mt-8">
          <Link to="/auth"><Button size="lg" className="gap-2">Create your account <ArrowRight className="h-4 w-4" /></Button></Link>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-8 md:flex-row">
          <Logo />
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} EGreed. Built on E-Cloud.</p>
        </div>
      </footer>
    </div>
  );
}
