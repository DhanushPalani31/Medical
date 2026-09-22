import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    watch: {
      // Native filesystem change events (chokidar's default) are unreliable
      // on some synced/cloud-backed folders (OneDrive, Dropbox, Google
      // Drive, etc.) and on some network/virtual drives — the OS never
      // fires the notification Vite is waiting for, so the dev server
      // keeps serving a stale cached copy of a file forever, no matter how
      // many times the browser hard-reloads. Polling (actually re-stat'ing
      // files on an interval) works everywhere, at the cost of a little
      // CPU. If edits still don't show up after this, restart `npm run
      // dev` — the running server process itself can only pick up config
      // changes like this one on its own restart.
      usePolling: true,
      interval: 300,
    },
  },
});
