import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
// Construcción separada: no cambia el bundle ni las rutas de producción.
export default defineConfig({ root: fileURLToPath(new URL('.', import.meta.url)), base: '/', plugins: [react()], build: {
    outDir: fileURLToPath(new URL('../output/monitor-ensayo-web', import.meta.url)), emptyOutDir: true,
    rollupOptions: { input: fileURLToPath(new URL('./monitor-ensayo.html', import.meta.url)) },
} });
