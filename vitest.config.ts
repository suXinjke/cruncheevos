import { defineConfig } from 'vitest/config'

import * as url from 'url'
import * as path from 'path'
const thisModuleDir = path.dirname(url.fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: {
    // This allows for relevant 'package/cli' tests to be automatically run in watch mode when code in 'package/core' changes
    tsconfigPaths: true,
  },
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
