import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";

const STATIC_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".json": "application/json",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
};

/**
 * Serves files from publicDir directly, bypassing Vite's publicFiles Set.
 * Vite builds publicFiles at startup; files created by the generator after
 * the server starts can miss registration due to a chokidar race condition,
 * causing those files to fall through to the SPA fallback (index.html).
 * This plugin intercepts before that check and serves any real file found on disk.
 */
function servePublicAlways(): Plugin {
  let publicDir: string;
  return {
    name: "serve-public-always",
    configResolved(config) {
      publicDir = config.publicDir;
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? "";
        if (!url || url.startsWith("/@") || url.startsWith("/__")) return next();
        const pathname = url.split("?")[0];
        const ext = path.extname(pathname).toLowerCase();
        const mime = STATIC_MIME[ext];
        if (!mime) return next();
        const filePath = path.join(publicDir, decodeURIComponent(pathname));
        let stat: fs.Stats;
        try {
          stat = fs.statSync(filePath);
        } catch {
          return next();
        }
        if (!stat.isFile()) return next();
        res.setHeader("Content-Type", mime);
        res.setHeader("Content-Length", stat.size);
        res.setHeader("Cache-Control", "no-cache");
        fs.createReadStream(filePath).pipe(res);
      });
    },
  };
}

export default defineConfig({
  plugins: [servePublicAlways(), react()],
});
