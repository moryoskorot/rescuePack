import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

function redirectBuildingSheet(server) {
  server.middlewares.use((request, response, next) => {
    const url = new URL(request.url, 'http://localhost');
    if (url.pathname === '/buildingsheet' || url.pathname === '/rescuePack/buildingsheet') {
      response.statusCode = 307;
      response.setHeader('Location', `${url.pathname}/${url.search}`);
      response.end();
      return;
    }
    next();
  });
}

export default defineConfig(({ command, isPreview }) => ({
  // Keep localhost at / while publishing all game assets beneath the repo URL.
  base: command === 'build' || isPreview ? '/rescuePack/' : '/',
  plugins: [{
    name: 'building-sheet-slash-redirect',
    configureServer: redirectBuildingSheet,
    configurePreviewServer: redirectBuildingSheet,
  }],
  build: {
    rollupOptions: {
      input: {
        game: fileURLToPath(new URL('./index.html', import.meta.url)),
        buildingsheet: fileURLToPath(new URL('./buildingsheet/index.html', import.meta.url)),
      },
    },
  },
}));
