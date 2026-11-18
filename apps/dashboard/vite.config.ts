import { sveltekit } from '@sveltejs/kit/vite';
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';
export default defineConfig(({ mode }) => ({
  plugins: [
    sveltekit({
      preprocess: vitePreprocess(),
      adapter: adapter({
        pages: '../../dist',
        assets: '../../dist',
        fallback: 'index.html',
        precompress: false,
      }),
    }),
  ],
  define: {
    'import.meta.env.VITE_CLOUDLANE_DATA_MODE': JSON.stringify(
      mode === 'production' ? 'http' : 'demo',
    ),
  },
  server: { allowedHosts: true, proxy: { '/api/v1': 'http://127.0.0.1:3001' } },
}));
