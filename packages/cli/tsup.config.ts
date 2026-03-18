import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'],
  target: 'node18',
  clean: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
  external: ['rollup', '@aspect/rollup-plugin'],
  noExternal: [/^(?!rollup$|@aspect\/rollup-plugin$)/],
});
