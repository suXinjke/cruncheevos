import { vi, test, expect, Mock } from 'vitest'
import { runTestCLI } from '../cli.js'

import * as url from 'url'
import * as fs from 'fs'
import * as path from 'path'
import prompts from 'prompts'
const thisModuleDir = path.dirname(url.fileURLToPath(import.meta.url))
export const resolveRACache = (inputPath: string) =>
  path.resolve(thisModuleDir, './RACache/data', inputPath)

vi.mock('../mockable.js', async () => {
  const mod = await vi.importActual<typeof import('../mockable.js')>('../mockable.js')
  return {
    ...mod,
    log: vi.fn(),
  } as typeof mod
})
import * as importModule from '../mockable.js'
export const log = importModule.log as Mock<typeof importModule.log>

test(`attempt to import rich presence from real module, reject overwriting, must not throw`, async () => {
  prompts.inject([false])
  await runTestCLI(['rich-save', resolveRACache('./1.js')])
  expect(fs.readFileSync(resolveRACache('./1-Rich.txt')).toString()).toBe(
    'Sonic Rich Presence test',
  )
})
