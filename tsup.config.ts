import { defineConfig } from 'tsup';
import { readFileSync } from 'node:fs';
import { parseChangelog } from './src/utils/changelog-parser.js';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8')) as { version: string };
const changelogRaw = readFileSync('./CHANGELOG.md', 'utf-8');
const changelogEntries = parseChangelog(changelogRaw);

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
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __CHANGELOG_ENTRIES__: JSON.stringify(changelogEntries),
  },
  esbuildOptions(options) {
    options.jsx = 'automatic';
  },
  onSuccess:
    'mkdir -p dist/migrations && cp src/db/migrations/*.sql dist/migrations/ && find dist -name "*.js" | xargs sed -i "" \'s|from "sqlite"|from "node:sqlite"|g\'',
});
