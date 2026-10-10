// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: [mcpPlugin()],
    resolve: {
      alias: [
        // ES5-compiled dependencies (asn1js / @peculiar/* pulled in by WebAuthn)
        // do `require("tslib").__extends`. In the Worker build tslib resolves to
        // its ESM entry, whose interop `default` is undefined, which crashed the
        // whole worker with:
        //   TypeError: Cannot destructure property '__extends' of '__toESM(...).default'
        // Pointing tslib at its CommonJS entry restores a real default export.
        { find: /^tslib$/, replacement: "tslib/tslib.js" },
      ],
    },
  },
});
