import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  // Force enable the nitro deploy plugin for Vercel
  nitro: {
    preset: "vercel"
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { 
      entry: "server"
    },
  },
});
