import { defineConfig } from 'vite';

export default defineConfig(({ command, isPreview }) => ({
  // Keep localhost at / while publishing all game assets beneath the repo URL.
  base: command === 'build' || isPreview ? '/rescuePack/' : '/',
}));
