import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";

const STATIC_MIME: Record<string, string> = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".png": "image/png",  ".webp": "image/webp",
  ".gif": "image/gif",  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".mp4": "video/mp4",  ".webm": "video/webm", ".mov": "video/quicktime",
  ".mp3": "audio/mpeg",
  ".json": "application/json",
  ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf",
};

// Bypass Vite's publicFiles Set and serve any real file found on disk,
// so assets added after server start always load without a restart.
function servePublicAlways(): Plugin {
  let publicDir: string;
  return {
    name: "serve-public-always",
    configResolved(config) { publicDir = config.publicDir; },
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
        try { stat = fs.statSync(filePath); } catch { return next(); }
        if (!stat.isFile()) return next();
        res.setHeader("Content-Type", mime);
        res.setHeader("Content-Length", stat.size);
        res.setHeader("Cache-Control", "no-cache");
        fs.createReadStream(filePath).pipe(res);
      });
    },
  };
}

// Strips // and /* */ comments from inside GLSL template literals at build time.
// JS/CSS comments are already removed by esbuild minification, but shader source
// lives inside string literals, so the minifier leaves it untouched. Only applied
// to project source files (not node_modules) — dependencies like PlayCanvas use
// `//` inside template literals as URL protocol strings, not GLSL comments.
function stripShaderComments(): Plugin {
  return {
    name: "strip-shader-comments",
    apply: "build",
    transform(code, id) {
      if (id.includes("node_modules")) return null;
      if (!/\.(ts|tsx|js|mjs|cjs)$/.test(id)) return null;
      if (!code.includes("`")) return null;
      const cleaned = code.replace(/`[\s\S]*?`/g, (literal) =>
        literal
          .replace(/\/\*[\s\S]*?\*\//g, "") // block comments
          .replace(/(?<!:)\/\/[^\n]*/g, "")  // line comments (skip URLs like https://)
      );
      return cleaned !== code ? { code: cleaned, map: null } : null;
    },
  };
}

export default defineConfig({
  root: path.resolve(__dirname, "v2"),
  publicDir: path.resolve(__dirname, "public"),

  server: {
    host: "127.0.0.1",
    port: 5174,
    strictPort: true,
    allowedHosts: "all",
  },

  preview: {
    host: "127.0.0.1",
    port: 5174,
    strictPort: true,
  },

  build: {
    outDir: path.resolve(__dirname, "dist"),
    emptyOutDir: true,
  },

  plugins: [react(), servePublicAlways(), stripShaderComments()],
});
