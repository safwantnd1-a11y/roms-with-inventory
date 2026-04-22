/**
 * build-server.mjs
 * Bundles server.ts → server.cjs with ALL dependencies included.
 * Only native modules (better-sqlite3) stay external.
 */
import { build } from 'esbuild';

console.log('📦 Building server.ts → server.cjs (fully bundled)...');

await build({
  entryPoints: ['server.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  outfile: 'server.cjs',
  // Only native modules stay external — everything else is bundled IN
  external: [
    'better-sqlite3',
    'vite',          // only used in dev mode, not needed in production
  ],
  define: {
    'import.meta.url': '__importMetaUrl',
  },
  banner: {
    js: "const __importMetaUrl = require('url').pathToFileURL(__filename).href;",
  },
  // Reduce bundle size
  minify: false,
  treeShaking: true,
});

console.log('✅ server.cjs built (all deps bundled)!');
