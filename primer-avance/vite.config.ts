import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  build: { rollupOptions: { output: { inlineDynamicImports: mode === 'standalone' } } },
  worker: { rollupOptions: { output: { inlineDynamicImports: true } } },
}));
