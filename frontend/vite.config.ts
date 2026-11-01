import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
  root: resolve(__dirname, 'admin'),
  base: '/admin/ui/',
  plugins: [vue()],
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
      external: [
        /^\/vw_static\/.*/
      ],
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/admin': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
});
