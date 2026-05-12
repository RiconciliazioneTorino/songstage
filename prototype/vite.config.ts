import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        master: resolve(__dirname, 'master.html'),
        projector: resolve(__dirname, 'projector.html'),
      },
    },
  },
});
