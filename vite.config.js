import { defineConfig } from 'vite';
import { precacheManifest } from './scripts/precache-plugin.js';

export default defineConfig({
  base: '/kyukana-converter/',
  plugins: [precacheManifest()],
});
