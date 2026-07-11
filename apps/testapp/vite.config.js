import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig({
  build: {
    minify: false,
  },
  resolve: {
    alias: {
      '@cruncheevos/utils': path.resolve(__dirname, '../../packages/utils/src'),
    },
  },
})
