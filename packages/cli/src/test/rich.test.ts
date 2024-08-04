import { describe, beforeEach, expect, test } from 'vitest'
import { prepareFakeAssets } from './fake-assets-util.js'
import { vol, fs, log } from './test-util.js'
import { runTestCLI } from '../cli.js'
import prompts from 'prompts'
import { RichPresence } from '@cruncheevos/core'

beforeEach(() => {
  log.mockClear()
  vol.reset()
})

describe('rich-save', () => {
  test('rich is not exported', async ctx => {
    prepareFakeAssets({
      gameId: 3050,
      input: () => ({}),
    })

    await runTestCLI(['rich-save', './mySet.js'])
    expect(fs.existsSync('./RACache/Data/3050-Rich.txt')).toBe(false)
    ctx
      .expect(log)
      .toMatchInlineSnapshot(`set doesn't export a string named 'rich', rich-save aborted`)
  })

  test('rich is not exported as string or object', async ctx => {
    prepareFakeAssets({
      gameId: 3050,
      input: () => ({}),
      rich: 47 as any,
    })

    await runTestCLI(['rich-save', './mySet.js'])
    expect(fs.existsSync('./RACache/Data/3050-Rich.txt')).toBe(false)
    ctx
      .expect(log)
      .toMatchInlineSnapshot(
        `expected set to export a string named 'rich' or object returned by RichPresence, but it exported a number instead, rich-save aborted`,
      )
  })

  test('rich is exported correctly as string and user is prompted to overwrite', async ctx => {
    prepareFakeAssets({
      gameId: 3050,
      input: () => ({}),
      rich: 'Playing a certain game',
    })

    await runTestCLI(['rich-save', './mySet.js'])
    ctx
      .expect(log)
      .toMatchInlineSnapshot(`dumped Rich Presence for gameId: 3050: ./RACache/Data/3050-Rich.txt`)

    expect(fs.readFileSync('./RACache/Data/3050-Rich.txt').toString()).toMatchInlineSnapshot(
      `"Playing a certain game"`,
    )

    log.mockClear()
    prepareFakeAssets({
      gameId: 3050,
      input: () => ({}),
      rich: 'Updated Rich Presence String',
    })
    prompts.inject([false])
    await runTestCLI(['rich-save', './mySet.js'])
    ctx
      .expect(log)
      .toMatchInlineSnapshot(`file ./RACache/Data/3050-Rich.txt already exists, overwrite? [y/N]`)

    expect(fs.readFileSync('./RACache/Data/3050-Rich.txt').toString()).toMatchInlineSnapshot(
      `"Playing a certain game"`,
    )

    log.mockClear()
    prompts.inject([true])
    await runTestCLI(['rich-save', './mySet.js'])
    ctx.expect(log).toMatchInlineSnapshot(`
      file ./RACache/Data/3050-Rich.txt already exists, overwrite? [y/N]
      dumped Rich Presence for gameId: 3050: ./RACache/Data/3050-Rich.txt
    `)

    expect(fs.readFileSync('./RACache/Data/3050-Rich.txt').toString()).toMatchInlineSnapshot(
      `"Updated Rich Presence String"`,
    )
  })

  test('rich is exported correctly as object', async ctx => {
    prepareFakeAssets({
      gameId: 3050,
      input: () => ({}),
      rich: RichPresence({
        displays: () => ['0xCAFE=1', 'Playing a certain game'],
      }),
    })

    await runTestCLI(['rich-save', './mySet.js'])
    ctx
      .expect(log)
      .toMatchInlineSnapshot(`dumped Rich Presence for gameId: 3050: ./RACache/Data/3050-Rich.txt`)
  })
})
