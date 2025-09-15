import { describe, test, expect, beforeAll, beforeEach } from 'vitest'
import { vol, server, makeDoRequestHandler, expectedCredentials } from './test-util.js'
import { runTestCLI } from '../cli.js'
import { HttpResponse } from 'msw'

beforeAll(() => {
  server.listen()

  return () => {
    server.close()
  }
})

beforeEach(() => {
  vol.reset()
})

describe('fetch', () => {
  describe('gives proper error', () => {
    test.each([{ value: 'invalid_id' }, { value: '36.6' }])(
      'when id is invalid: $value',
      ({ value }) => {
        return expect(runTestCLI(['fetch', value])).rejects.toThrowError(
          `expected game_id to be positive integer, but got ${value}`,
        )
      },
    )

    test(`when RAPrefs doesn't exist`, () => {
      vol.fromJSON({ './absolutely': 'nothing' })

      return expect(runTestCLI(['fetch', 1234])).rejects.toThrowErrorMatchingInlineSnapshot(
        `[Error: expected RAPrefs.cfg file, but found none]`,
      )
    })

    test(`when RAPrefs is malformed JSON`, () => {
      vol.fromJSON({
        './RAPrefs_Emu.cfg': '{1234',
      })

      return expect(runTestCLI(['fetch', 1234])).rejects.toThrowError(
        `RAPrefs_Emu.cfg: Expected property name or '}' in JSON at position 1`,
      )
    })

    test.each([{ prop: 'Username' }, { prop: 'Token' }])(
      `when RAPrefs doesn't have: $prop`,
      ({ prop }) => {
        const malformedCredentials = {
          ...expectedCredentials,
        }

        delete malformedCredentials[prop]

        vol.fromJSON({
          './RAPrefs_Emu.cfg': JSON.stringify(malformedCredentials),
        })

        return expect(runTestCLI(['fetch', 1234])).rejects.toThrowError(
          `RAPrefs_Emu.cfg: expected ${prop} property as string, but got undefined`,
        )
      },
    )

    test('when HTTP != 200', () => {
      vol.fromJSON({
        './RAPrefs_Emu.cfg': JSON.stringify(expectedCredentials),
      })

      return expect(runTestCLI(['fetch', 1234])).rejects.toThrowErrorMatchingInlineSnapshot(
        `[Error: failed to fetch remote data: HTTP 404]`,
      )
    })

    test('when HTTP 200 but lacks Success: true in payload', () => {
      vol.fromJSON({
        './RAPrefs_Emu.cfg': JSON.stringify(expectedCredentials),
      })

      server.use(
        makeDoRequestHandler(() => HttpResponse.json({ Success: false })),
      )

      return expect(runTestCLI(['fetch', 3050])).rejects.toThrowErrorMatchingInlineSnapshot(
        `[Error: failed to fetch remote data: expected payload.Success to be true, but got false]`,
      )
    })

    test(`when it's timeout`, () => {
      vol.fromJSON({
        './RAPrefs_Emu.cfg': JSON.stringify(expectedCredentials),
      })

      server.use(
        makeDoRequestHandler(async () => {
          await new Promise(res => setTimeout(res, 10000))
          return new HttpResponse(null)
        }),
      )

      return expect(
        runTestCLI(['fetch', 3050, '-t100']),
      ).rejects.toThrowErrorMatchingInlineSnapshot(`[Error: failed to fetch remote data: timed out]`)
    })
  })
})
