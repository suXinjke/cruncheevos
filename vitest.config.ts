import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

import * as url from 'url'
import * as path from 'path'
const thisModuleDir = path.dirname(url.fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    coverage: {
      provider: 'istanbul',
      exclude: ['**/dist', '**/test', 'docs'],
      reporter: ['html', 'text-summary'],
    },
    env: {
      RACACHE: path.resolve(thisModuleDir, './packages/cli/src/test'),
      FORCE_COLOR: '0',
    },
  },
})
