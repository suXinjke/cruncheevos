import { defineConfig } from 'eslint/config'
import tseslint from 'typescript-eslint'
import pluginESx from 'eslint-plugin-es-x'

export default defineConfig({
  extends: [tseslint.configs.base, pluginESx.configs['flat/restrict-to-es2018']],
  files: ['packages/core/src/*.ts'],
})
