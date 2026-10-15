import { defineConfig } from 'vite';

export default defineConfig({
  base: '/maple-path/',
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three', 'three/addons/controls/OrbitControls.js'],
        },
      },
    },
  },
});
