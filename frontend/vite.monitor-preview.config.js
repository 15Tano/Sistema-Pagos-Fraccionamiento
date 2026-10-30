import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
// Exportacion ficticia separada. Sin .env, public/, API ni artefactos productivos.
export default defineConfig({
    root: fileURLToPath(new URL('.', import.meta.url)), base: '/', envDir: false, publicDir: false,
    plugins: [react()], build: {
        outDir: fileURLToPath(new URL('../output/sites/lecturas-demo-20261029/dist', import.meta.url)),
        emptyOutDir: false, copyPublicDir: false, sourcemap: false,
        rollupOptions: { input: fileURLToPath(new URL('./monitor-preview.html', import.meta.url)) },
    },
});
