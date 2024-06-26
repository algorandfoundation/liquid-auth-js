import { defineConfig } from 'vite';

const DEFAULT_PROXY_URL = 'http://localhost:3000';
const DEFAULT_WSS_PROXY_URL = 'ws://localhost:3000';

export default defineConfig({
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
    }
  }
});
