import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node25',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
  esbuildOptions(options) {
    options.jsx = 'automatic';
  },
  onSuccess:
    'mkdir -p dist/migrations && cp src/db/migrations/*.sql dist/migrations/ && find dist -name "*.js" | xargs sed -i "" \'s|from "sqlite"|from "node:sqlite"|g\'',
});
