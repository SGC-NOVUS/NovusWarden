import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';
import fs from 'fs';

const backendTarget = process.env.VITE_BACKEND_URL || 'http://127.0.0.1:8088';
const overlayDir = resolve(__dirname, '../docker/web-vault-overlay');
const staticDir = resolve(__dirname, '../src/static');

export default defineConfig(({ mode }) => {
  const isAdminBuild = mode === 'admin';
  const isVaultBuild = mode === 'vault';

  const outDir = isAdminBuild
    ? resolve(__dirname, '../src/static/admin_ui')
    : isVaultBuild
    ? resolve(__dirname, 'dist/vault')
    : resolve(__dirname, 'dist');

  const rollupInput = isAdminBuild
    ? { admin: resolve(__dirname, 'admin/index.html') }
    : isVaultBuild
    ? {
        vault: resolve(__dirname, 'vault/index.html'),
        'webauthn-fallback-connector': resolve(__dirname, 'vault/webauthn-fallback-connector.html'),
      }
    : {
        vault: resolve(__dirname, 'vault/index.html'),
        'webauthn-fallback-connector': resolve(__dirname, 'vault/webauthn-fallback-connector.html'),
        admin: resolve(__dirname, 'admin/index.html'),
      };

  return {
  root: resolve(__dirname),
  base: isAdminBuild ? '/admin/ui/' : '/',
  plugins: [
    vue(),
    {
      name: 'novus-flatten-html-entry',
      closeBundle() {
        if (!isAdminBuild && !isVaultBuild) return;
        const subDirName = isAdminBuild ? 'admin' : 'vault';
        const nestedDir = resolve(outDir, subDirName);
        if (fs.existsSync(nestedDir)) {
          for (const entry of fs.readdirSync(nestedDir)) {
            if (entry.endsWith('.html')) {
              fs.renameSync(resolve(nestedDir, entry), resolve(outDir, entry));
            }
          }
          fs.rmSync(nestedDir, { recursive: true, force: true });
        }
      },
    },
    {
      name: 'novus-multi-spa-router',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          const rawUrl = req.url || '/';
          const cleanUrl = rawUrl.split('?')[0];

          // 1. Direct redirects
          if (cleanUrl === '/login' || cleanUrl === '/login/') {
            res.writeHead(302, { Location: '/#/login' });
            res.end();
            return;
          }
          if (cleanUrl === '/signup' || cleanUrl === '/signup/') {
            res.writeHead(302, { Location: '/#/signup' });
            res.end();
            return;
          }
          if (cleanUrl === '/vault' || cleanUrl === '/vault/') {
            res.writeHead(302, { Location: '/#/vault' });
            res.end();
            return;
          }
          if ((req.method === 'GET' || req.method === 'HEAD') && (cleanUrl === '/admin' || cleanUrl === '/admin/')) {
            res.writeHead(302, { Location: '/admin/ui/' });
            res.end();
            return;
          }

          // 2. Serve static assets from src/static (/vw_static/* or /images/*)
          if (cleanUrl.startsWith('/vw_static/') || cleanUrl.startsWith('/images/')) {
            let relativePath = cleanUrl.startsWith('/vw_static/')
              ? cleanUrl.slice('/vw_static/'.length)
              : cleanUrl.slice('/images/'.length);

            let diskPath = resolve(staticDir, 'images', relativePath);
            if (!fs.existsSync(diskPath) || !fs.statSync(diskPath).isFile()) {
              diskPath = resolve(staticDir, relativePath);
            }
            if (!fs.existsSync(diskPath) || !fs.statSync(diskPath).isFile()) {
              diskPath = resolve(overlayDir, 'images', relativePath);
            }
            if (!fs.existsSync(diskPath) || !fs.statSync(diskPath).isFile()) {
              diskPath = resolve(overlayDir, relativePath);
            }

            if (fs.existsSync(diskPath) && fs.statSync(diskPath).isFile()) {
              const ext = diskPath.split('.').pop()?.toLowerCase();
              const mimeMap: Record<string, string> = {
                png: 'image/png',
                jpg: 'image/jpeg',
                jpeg: 'image/jpeg',
                webp: 'image/webp',
                svg: 'image/svg+xml',
                ico: 'image/x-icon',
                css: 'text/css',
                js: 'application/javascript',
              };
              res.setHeader('Content-Type', mimeMap[ext || ''] || 'application/octet-stream');
              res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
              res.end(fs.readFileSync(diskPath));
              return;
            }
          }

          // 3. Admin Control Plane UI SPA
          if (cleanUrl === '/admin/ui' || cleanUrl === '/admin/ui/') {
            const adminHtmlPath = resolve(__dirname, 'admin/index.html');
            if (fs.existsSync(adminHtmlPath)) {
              let html = fs.readFileSync(adminHtmlPath, 'utf-8');
              html = await server.transformIndexHtml('/admin/ui/', html);
              res.setHeader('Content-Type', 'text/html; charset=utf-8');
              res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
              res.end(html);
              return;
            }
          }

          // 3.5 WebAuthn Fallback Connector (Vue 3 + Vite)
          if (cleanUrl === '/webauthn-fallback-connector.html') {
            const connectorHtmlPath = resolve(__dirname, 'vault/webauthn-fallback-connector.html');
            if (fs.existsSync(connectorHtmlPath)) {
              let html = fs.readFileSync(connectorHtmlPath, 'utf-8');
              html = await server.transformIndexHtml('/webauthn-fallback-connector.html', html);
              res.setHeader('Content-Type', 'text/html; charset=utf-8');
              res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
              res.end(html);
              return;
            }
          }

          // 4. Vite Internal / Dev Modules -> let Vite handle
          if (
            cleanUrl.startsWith('/@') ||
            cleanUrl.startsWith('/node_modules') ||
            cleanUrl.startsWith('/vault/') ||
            cleanUrl.startsWith('/admin/src') ||
            cleanUrl.startsWith('/shared/')
          ) {
            return next();
          }

          // 5. Backend Proxied routes -> let Proxy handle
          if (
            cleanUrl.startsWith('/admin') ||
            cleanUrl.startsWith('/api') ||
            cleanUrl.startsWith('/identity') ||
            cleanUrl.startsWith('/notifications/hub')
          ) {
            return next();
          }

          // 6. User Web Vault Vue 3 SPA (Root, /#/login, /#/vault, etc.)
          const acceptHeader = req.headers['accept'] || '';
          const isHtmlRequest =
            cleanUrl === '/' ||
            !cleanUrl.includes('.') ||
            acceptHeader.includes('text/html');

          if (isHtmlRequest) {
            const vaultHtmlPath = resolve(__dirname, 'vault/index.html');
            if (fs.existsSync(vaultHtmlPath)) {
              let html = fs.readFileSync(vaultHtmlPath, 'utf-8');
              html = await server.transformIndexHtml('/', html);
              res.setHeader('Content-Type', 'text/html; charset=utf-8');
              res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
              res.end(html);
              return;
            }
          }

          // 7. Fallback to branded static overlay assets if any
          const diskPath = resolve(overlayDir, '.' + cleanUrl);

          if (fs.existsSync(diskPath) && fs.statSync(diskPath).isFile()) {
            const ext = cleanUrl.split('.').pop()?.toLowerCase();
            const mimeTypes: Record<string, string> = {
              js: 'application/javascript',
              css: 'text/css',
              html: 'text/html',
              json: 'application/json',
              png: 'image/png',
              jpg: 'image/jpeg',
              jpeg: 'image/jpeg',
              webp: 'image/webp',
              svg: 'image/svg+xml',
              ico: 'image/x-icon',
              woff: 'font/woff',
              woff2: 'font/woff2',
              wasm: 'application/wasm',
            };
            res.setHeader('Content-Type', mimeTypes[ext || ''] || 'application/octet-stream');
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.end(fs.readFileSync(diskPath));
            return;
          }

          next();
        });
      },
    },
  ],
  resolve: {
    alias: {
      '@admin': resolve(__dirname, 'admin/src'),
      '@vault': resolve(__dirname, 'vault/src'),
      '@shared': resolve(__dirname, 'shared'),
    },
  },
  build: {
    target: 'es2022',
    outDir,
    emptyOutDir: true,
    rollupOptions: {
      input: rollupInput,
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
    proxy: {
      '/admin': {
        target: backendTarget,
        changeOrigin: true,
        secure: false,
        cookieDomainRewrite: 'localhost',
        bypass: (req) => {
          if (
            req.url?.startsWith('/admin/ui') ||
            req.url?.startsWith('/admin/src') ||
            req.url?.startsWith('/admin/index.html')
          ) {
            return req.url;
          }
        },
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            const sc = proxyRes.headers['set-cookie'];
            if (sc) {
              proxyRes.headers['set-cookie'] = sc.map((c) =>
                c
                  .replace(/;\s*Secure/gi, '')
                  .replace(/;\s*SameSite=Strict/gi, '; SameSite=Lax')
                  .replace(/Domain=[^;]+/gi, 'Domain=localhost')
                  .replace(/Path=[^;]+/gi, 'Path=/')
              );
            }
          });
        },
      },
      '/notifications/hub': {
        target: backendTarget,
        changeOrigin: true,
        secure: false,
        ws: true,
      },
      '/api': {
        target: backendTarget,
        changeOrigin: true,
        secure: false,
        cookieDomainRewrite: 'localhost',
      },
      '/identity': {
        target: backendTarget,
        changeOrigin: true,
        secure: false,
        cookieDomainRewrite: 'localhost',
      },
    },
  },
  };
});
