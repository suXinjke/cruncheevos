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
        fileName: format => {
          const prefix = format === 'umd' ? 'umd.' : ''
          return mode === 'dev' ? `cruncheevos.${prefix}js` : `cruncheevos.min.${prefix}js`
        },
      },
    },
  }
})
