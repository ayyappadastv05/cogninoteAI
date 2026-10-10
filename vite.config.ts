import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import dotenv from 'dotenv';
import { defineConfig, type Plugin } from 'vite';
import { handleAiRequest } from './src/server/aiHandler';

dotenv.config();

function cogniNoteAiBackendPlugin(): Plugin {
  return {
    name: 'cogninote-ai-backend-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || '';
        const pathname = url.split('?')[0];

        if (pathname.startsWith('/api/ai/')) {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });

          req.on('end', async () => {
            let parsedBody: any = {};
            if (body.trim()) {
              try {
                parsedBody = JSON.parse(body);
              } catch {
                parsedBody = {};
              }
            }

            (req as any).body = parsedBody;

            try {
              const handled = await handleAiRequest(req, res, pathname, parsedBody);
              if (!handled) next();
            } catch (err: any) {
              if (!res.headersSent) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: err?.message || 'Internal AI Server Error' }));
              }
            }
          });

          req.on('error', () => {
            if (!res.headersSent) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Failed to read request body stream' }));
            }
          });

          return;
        }

        next();
      });
    },
  };
}

export default defineConfig(() => {
  const geminiApiKey = process.env.GEMINI_API_KEY || '';

  return {
    plugins: [react(), tailwindcss(), cogniNoteAiBackendPlugin()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(geminiApiKey),
      'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(geminiApiKey),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
