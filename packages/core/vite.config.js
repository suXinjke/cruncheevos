import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig(({ mode }) => {
  return {
    build: {
      minify: mode !== 'dev',
      emptyOutDir: false,
      lib: {
        entry: resolve(__dirname, 'src/index.ts'),
        name: 'cruncheevos',
        fileName: mode === 'dev' ? 'cruncheevos' : 'cruncheevos.min',
      },
    },
  }
})
