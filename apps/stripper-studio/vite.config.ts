import { fileURLToPath, URL } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Serves /api/colors during dev, mirroring the deployed serverless function.
 * The payload module is loaded through Vite's own pipeline (ssrLoadModule) so
 * the config itself never imports the engine's TS sources.
 */
function colorsApi(): Plugin {
  return {
    name: 'colors-api',
    configureServer(server) {
      server.middlewares.use('/api/colors', (req, res) => {
        server
          .ssrLoadModule('/src/lib/colorsEndpoint.ts')
          .then((mod) => {
            const q = new URLSearchParams(req.url?.split('?')[1] ?? '');
            const { status, body } = mod.colorsPayload(q) as { status: number; body: string };
            res.statusCode = status;
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Content-Type', 'application/json');
            res.end(body);
          })
          .catch((e) => {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }));
          });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), colorsApi()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
