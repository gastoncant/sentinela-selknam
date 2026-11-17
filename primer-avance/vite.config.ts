import { defineConfig } from 'vite';

export default defineConfig({
  worker: { rollupOptions: { output: { inlineDynamicImports: true } } },
});
