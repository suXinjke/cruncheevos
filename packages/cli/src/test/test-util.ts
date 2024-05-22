import * as memfs from 'memfs'
export const vol = memfs.vol
import * as realFs from 'fs'
import { vi, expect, Mock } from 'vitest'
import { DefaultBodyType, http, HttpResponse, StrictRequest } from 'msw'
import { setupServer } from 'msw/node'
import { diff } from 'json-diff'

import * as url from 'url'
import * as path from 'path'
const thisModuleDir = path.dirname(url.fileURLToPath(import.meta.url))
export const resolveRACache = (inputPath: string) =>
  path.resolve(thisModuleDir, './RACache/data', inputPath)

vi.mock('../mockable.js', async () => {
  const mod = await vi.importActual<typeof import('../mockable.js')>('../mockable.js')
  const log = vi.fn()
  return {
    ...mod,
    getFs: () => memfs.fs as any,
    achievementSetImport: vi.fn(),
    log,
    resolveRACache: path => path,
    confirm: message => {
      log(message + ' [y/N]')
      return mod.confirm(message)
    },
  } as typeof mod
})

import * as importModule from '../mockable.js'
export const fs = importModule.getFs()
export const achievementSetImportMock = importModule.achievementSetImport as Mock<
  Parameters<typeof importModule.achievementSetImport>
>
export const log = importModule.log as Mock<Parameters<typeof importModule.log>>

export const expectedCredentials = { Username: 'cheeseburger', Token: 'bigtoken' }

export const defaultFiles = {
  './RAPrefs_EmuName.cfg': JSON.stringify(expectedCredentials),
}

export function makeDoRequestHandler(
  func: (opts: {
    filePath: string
    request: StrictRequest<DefaultBodyType>
  }) => HttpResponse | Promise<HttpResponse> = ({ filePath }) =>
    HttpResponse.json({
      Success: true,
      PatchData: JSON.parse(realFs.readFileSync(resolveRACache(filePath)).toString()),
    }),
) {
  return http.get('https://retroachievements.org/dorequest.php', ({ request }) => {
    const { searchParams } = new URL(request.url)

    if (
      searchParams.get('r') !== 'patch' ||
      searchParams.get('u') !== expectedCredentials.Username ||
      searchParams.get('t') !== expectedCredentials.Token
    ) {
      return new HttpResponse(null, { status: 403 })
    }

    const filePath = resolveRACache(`./${searchParams.get('g')}.json`)
    if (realFs.existsSync(filePath) === false) {
      return new HttpResponse(null, { status: 404 })
    }

    return func({ filePath, request })
  })
}

export const server = setupServer(
  makeDoRequestHandler(),

  http.get('*', () => {
    return new HttpResponse(null, { status: 500 })
  }),
)

export function makeAssetGenerator(idCounter = 111000001) {
  let achCounter = idCounter
  let lbCounter = idCounter

  return {
    achievement(params: { id?: number; title?: string }) {
      const id = params.id ? params.id : achCounter++
      return {
        title: params.title || `AchTitle_${id}`,
        conditions: `${id}=0`,
      }
    },
    leaderboard(params: { id?: number; title?: string }) {
      const id = params.id ? params.id : lbCounter++
      return {
        title: params.title || `LbTitle_${id}`,
        conditions: {
          start: `${id}=0`,
          cancel: '1=0',
          submit: '1=1',
          value: 'M:0xcafe',
        },
      }
    },
  }
}

export function stringDiff(before: string[], after: string[]) {
  return diff(before, after, { full: true })
    .map(x => (Array.isArray(x) ? x.join(' ') : x))
    .join('\n')
}

expect.addSnapshotSerializer({
  serialize(val, config, indentation, depth, refs, printer) {
    const result = printer(
      val.mock.calls.map(x => x[0]).join('\n'),
      config,
      indentation,
      depth,
      refs,
    )
    return result[1].match(/\s/) ? result : result.replace('"', '').replace(/"$/, '')
  },
  test(val) {
    return val === log
  },
})
