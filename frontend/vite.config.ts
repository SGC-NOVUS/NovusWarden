import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';
import fs from 'fs';

const backendTarget = process.env.VITE_BACKEND_URL || 'https://vault.sgc-novus.xyz';
const webVaultDir = resolve(__dirname, '../web-vault/web-vault');
const overlayDir = resolve(__dirname, '../docker/web-vault-overlay');

export default defineConfig({
  root: resolve(__dirname, 'admin'),
  base: '/admin/ui/',
  plugins: [
    vue(),
    {
      name: 'web-vault-and-redirects',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          // If user visits /login, redirect to /#/login (User Web Vault login)
          if (req.url === '/login' || req.url === '/login/') {
            res.writeHead(302, { Location: '/#/login' });
            res.end();
            return;
          }

          // If user visits /admin in browser (GET /admin or /admin/), redirect to /admin/ui/
          if (req.method === 'GET' && (req.url === '/admin' || req.url === '/admin/')) {
            res.writeHead(302, { Location: '/admin/ui/' });
            res.end();
            return;
          }

          // Serve live novus-brand.css so edits are reflected immediately
          if (req.url?.startsWith('/novus-brand.css')) {
            const cssPath = resolve(overlayDir, 'novus-brand.css');
            if (fs.existsSync(cssPath)) {
              res.setHeader('Content-Type', 'text/css');
              res.end(fs.readFileSync(cssPath));
              return;
            }
          }

          // Proxy /css/vaultwarden.css directly to backendTarget
          if (req.url?.startsWith('/css/vaultwarden.css')) {
            fetch(`${backendTarget}/css/vaultwarden.css`)
              .then(async (remoteRes) => {
                if (remoteRes.ok) {
                  const cssText = await remoteRes.text();
                  res.setHeader('Content-Type', 'text/css');
                  res.end(cssText);
                } else {
                  res.setHeader('Content-Type', 'text/css');
                  res.end('/* vaultwarden.css empty fallback */');
                }
              })
              .catch(() => {
                res.setHeader('Content-Type', 'text/css');
                res.end('/* vaultwarden.css error fallback */');
              });
            return;
          }

          // If request is for /admin/ui or internal Vite modules, let Vite handle it
          if (
            req.url?.startsWith('/admin/ui') ||
            req.url?.startsWith('/@') ||
            req.url?.startsWith('/src') ||
            req.url?.startsWith('/node_modules')
          ) {
            return next();
          }

          // If request is for /admin, let proxy handle it
          if (
            req.url?.startsWith('/admin') ||
            req.url?.startsWith('/api') ||
            req.url?.startsWith('/identity') ||
            req.url?.startsWith('/vw_static') ||
            req.url?.startsWith('/css/vaultwarden.css')
          ) {
            return next();
          }

          // Otherwise, serve from local web-vault or overlay!
          const cleanUrl = req.url?.split('?')[0] || '/';
          if (cleanUrl === '/' || !cleanUrl.includes('.')) {
            // Serve web-vault index.html
            const indexPath = resolve(webVaultDir, 'index.html');
            if (fs.existsSync(indexPath)) {
              let html = fs.readFileSync(indexPath, 'utf-8');
              if (!html.includes('novus-brand.css')) {
                html = html.replace('</head>', '<link rel="stylesheet" href="/novus-brand.css?v=' + Date.now() + '"></head>');
              }
              res.setHeader('Content-Type', 'text/html; charset=utf-8');
              res.end(html);
              return;
            }
          }

          // Serve static files: first check overlayDir, then webVaultDir
          const overlayPath = resolve(overlayDir, '.' + cleanUrl);
          const diskPath = fs.existsSync(overlayPath) && fs.statSync(overlayPath).isFile()
            ? overlayPath
            : resolve(webVaultDir, '.' + cleanUrl);

          if (fs.existsSync(diskPath) && fs.statSync(diskPath).isFile()) {
            const ext = cleanUrl.split('.').pop()?.toLowerCase();
            const mimeTypes: Record<string, string> = {
              js: 'application/javascript',
              css: 'text/css',
              html: 'text/html',
              json: 'application/json',
              png: 'image/png',
              jpg: 'image/jpeg',
              svg: 'image/svg+xml',
              ico: 'image/x-icon',
              woff: 'font/woff',
              woff2: 'font/woff2',
              wasm: 'application/wasm',
            };
            res.setHeader('Content-Type', mimeTypes[ext || ''] || 'application/octet-stream');
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
      '@': resolve(__dirname, 'admin/src'),
    },
  },
  build: {
    outDir: resolve(__dirname, '../src/static/admin_ui'),
    emptyOutDir: true,
    target: 'es2022',
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
    proxy: {
      '/admin/ui': {
        // Handled by Vite directly
        bypass: (req) => {
          if (req.url?.startsWith('/admin/ui')) {
            return req.url;
          }
        },
      },
      '/admin': {
        target: backendTarget,
        changeOrigin: true,
        secure: false,
        cookieDomainRewrite: 'localhost',
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            const sc = proxyRes.headers['set-cookie'];
            if (sc) {
              proxyRes.headers['set-cookie'] = sc.map(c =>
                c.replace(/;\s*Secure/gi, '')
                 .replace(/;\s*SameSite=Strict/gi, '; SameSite=Lax')
                 .replace(/Domain=[^;]+/gi, 'Domain=localhost')
              );
            }
          });
        },
      },
      '/vw_static': {
        target: backendTarget,
        changeOrigin: true,
        secure: false,
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
});


