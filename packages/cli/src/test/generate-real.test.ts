import { vi, test, Mock } from 'vitest'
import { runTestCLI } from '../cli.js'

import * as url from 'url'
import * as path from 'path'
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
export const log = importModule.log as Mock<Parameters<typeof importModule.log>>

test(`generate real script and diff it to ensure that generated code is valid`, async ctx => {
  const filePath = resolveRACache('./3050.js')
  await runTestCLI(['generate', 3050, filePath])
  log.mockClear()
  await runTestCLI(['diff', filePath])
  ctx.expect(log.mock.calls.map(x => x[0]).join('\n')).toMatchInlineSnapshot('"no changes found"')
})
