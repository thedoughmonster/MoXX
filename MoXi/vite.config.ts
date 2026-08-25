import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

function releaseAssets(): Plugin {
  const release = process.env.VITE_RELEASE_ID?.trim() || 'local-dev';
  const stage = process.env.VITE_APP_STAGE?.trim() || 'preview';

  return {
    name: 'moxi-release-assets',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'health.json',
        source: `${JSON.stringify({ status: 'ready', scope: 'preorder.dough.monster', release, stage })}\n`
      });
      this.emitFile({
        type: 'asset',
        fileName: 'smoke.json',
        source: `${JSON.stringify({ ok: true, name: 'moxi-web-preorder', release })}\n`
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), releaseAssets()],
  build: {
    sourcemap: true
  }
});
