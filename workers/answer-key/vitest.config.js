import path from 'node:path';
import {cloudflareTest,readD1Migrations} from '@cloudflare/vitest-plugin';
import {defineConfig} from 'vitest/config';

export default defineConfig({
 plugins:[cloudflareTest(async()=>({
  main:'./src/index.js',
  wrangler:{configPath:'./wrangler.jsonc'},
  miniflare:{bindings:{TEST_MIGRATIONS:await readD1Migrations(path.join(import.meta.dirname,'migrations'))}}
 }))],
 test:{include:['test/runtime.test.js'],setupFiles:['./test/setup.js']}
});
