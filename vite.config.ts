import { dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { glob } from 'glob';
import { analyzer } from 'vite-bundle-analyzer';
import dts from 'vite-plugin-dts';
import { codecovVitePlugin } from '@codecov/vite-plugin';

import pkg from './package.json';
const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PROXY_URL = 'http://localhost:3000';
const DEFAULT_WSS_PROXY_URL = 'ws://localhost:3000';
export default defineConfig({
  plugins: [
    process.env.ANALYZE ? analyzer() : undefined,
    dts({ tsconfigPath: './tsconfig.app.json' }),
    codecovVitePlugin({
      enableBundleAnalysis: process.env.CODECOV_TOKEN !== undefined,
      bundleName: '@algorandfoundation/liquid-client',
      uploadToken: process.env.CODECOV_TOKEN,
    }),
  ],
  resolve: {
    alias: {
      '@algorandfoundation/liquid-client': resolve(__dirname, './src'),
      '@algorandfoundation/liquid-client/assertion': resolve(
        __dirname,
        './src/assertion',
      ),
      '@algorandfoundation/liquid-client/encoding': resolve(
        __dirname,
        './src/encoder',
      ),
    },
  },

  server: {
    proxy: {
      '^/auth/.*': process.env.PROXY_URL || DEFAULT_PROXY_URL,
      '^/.well-known/.*': process.env.PROXY_URL || DEFAULT_PROXY_URL,
      '^/connect/.*': process.env.PROXY_URL || DEFAULT_PROXY_URL,
      '^/attestation/.*': process.env.PROXY_URL || DEFAULT_PROXY_URL,
      '^/assertion/.*': process.env.PROXY_URL || DEFAULT_PROXY_URL,
      '/socket.io': {
        target: process.env.WSS_PROXY_SERVER || DEFAULT_WSS_PROXY_URL,
        ws: true,
      },
    },
  },
  build: {
    minify: false,
    sourcemap: true,
    copyPublicDir: false,
    emptyOutDir: true,
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
    },
    outDir: 'lib',
    rollupOptions: {
      external: Object.keys(pkg.dependencies),
      input: Object.fromEntries(
        glob
          .sync('src/**/*.ts', {
            ignore: [
              '**/test/**',
              '**/*.test.ts',
              '**/*.fixtures.ts',
              '**/*.spec.ts',
              '**/*.bench.ts',
            ],
          })
          .map((file) => {
            return [
              relative(
                'src',
                file.slice(0, file.length - extname(file).length),
              ),
              fileURLToPath(new URL(file, import.meta.url)),
            ];
          }),
      ),
      output: {
        compact: false,
        preserveModules: true,
        entryFileNames: '[name].js',
      },
    },
  },
  test: {
    coverage: {
      exclude: ['*.bench.ts', 'main.ts', 'test', 'vite.config.ts'],
    },
    browser: {
      enabled: false,
      provider: 'playwright',
      instances: [
        { browser: 'chromium' },
        { browser: 'firefox' },
        { browser: 'webkit' },
      ],
    },
  },
});
