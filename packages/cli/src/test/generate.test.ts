import { describe, beforeAll, expect, test, beforeEach } from 'vitest'

import * as realFs from 'fs'
import prompts from 'prompts'

import { fs, vol, log, server, defaultFiles, resolveRACache } from './test-util.js'
import { runTestCLI } from '../cli.js'

beforeAll(() => {
  server.listen()

  return () => {
    vol.reset()
    server.close()
  }
})

beforeEach(() => {
  log.mockClear()
  server.events.removeAllListeners()
  vol.reset()
})

describe('generate', () => {
  test(`works when ran without prefetched achievements, generating again doesn't refetch remote code`, async ctx => {
    vol.mkdirSync('./RACache/Data', { recursive: true })
    vol.fromJSON({
      ...defaultFiles,
    })

    await runTestCLI(['generate', 3050, './3050.js'])

    expect(fs.existsSync('./RACache/Data/3050.json')).toBe(true)

    // It's important to note that remote code has TIME leaderboard type,
    // and it's supposed to be converted into FRAMES,
    // because TIME is not supported in local code.
    const generatedCode = fs.readFileSync('./3050.js').toString()
    ctx.expect(generatedCode).toMatchSnapshot()
    ctx.expect(log).toMatchInlineSnapshot(`
      fetching remote data for gameId 3050
      dumped remote data for gameId 3050: ./RACache/Data/3050.json
      generated code for achievement set for gameId 3050: ./3050.js
    `)
  })

  test(`doesn't fetch remote code if it already exists`, async ctx => {
    vol.fromJSON({
      ...defaultFiles,
      './RACache/Data/3050.json': realFs.readFileSync(resolveRACache('./3050.json')).toString(),
    })

    await runTestCLI(['generate', 3050, './3050.js'])

    ctx
      .expect(log)
      .toMatchInlineSnapshot('generated code for achievement set for gameId 3050: ./3050.js')
  })

  test(`refetch option properly overwrites existing remote code`, async ctx => {
    vol.fromJSON({
      ...defaultFiles,
      './RACache/Data/3050.json': realFs.readFileSync(resolveRACache('./3050.json')).toString(),
    })

    const remoteCodeModificationDate = fs.statSync('./RACache/Data/3050.json').mtime.valueOf()

    await runTestCLI(['generate', 3050, '-r', './3050.js'])

    expect(fs.statSync('./RACache/Data/3050.json').mtime.valueOf()).toBeGreaterThan(
      remoteCodeModificationDate,
    )
    ctx.expect(log).toMatchInlineSnapshot(`
      fetching remote data for gameId 3050
      dumped remote data for gameId 3050: ./RACache/Data/3050.json
      generated code for achievement set for gameId 3050: ./3050.js
    `)
  })

  describe('filter', () => {
    beforeEach(() => {
      vol.fromJSON({
        ...defaultFiles,
        './RACache/Data/3050.json': realFs.readFileSync(resolveRACache('./3050.json')).toString(),
      })
    })

    test('by id', async ctx => {
      await runTestCLI(['generate', 3050, '-fid:251968', './3050.js'])

      const generatedCode = fs.readFileSync('./3050.js').toString()
      ctx.expect(generatedCode).toMatchSnapshot()
      ctx
        .expect(log)
        .toMatchInlineSnapshot('generated code for achievement set for gameId 3050: ./3050.js')
    })

    test('by single name', async ctx => {
      await runTestCLI(['generate', 3050, '--filter=title:passed', './3050.js'])

      const generatedCode = fs.readFileSync('./3050.js').toString()
      ctx.expect(generatedCode).toMatchSnapshot()
      ctx
        .expect(log)
        .toMatchInlineSnapshot('generated code for achievement set for gameId 3050: ./3050.js')
    })

    test('by either name', async ctx => {
      await runTestCLI(['generate', 3050, '-ftitle:(Race|time)', './3050.js'])

      const generatedCode = fs.readFileSync('./3050.js').toString()
      ctx.expect(generatedCode).toMatchSnapshot()
      ctx
        .expect(log)
        .toMatchInlineSnapshot('generated code for achievement set for gameId 3050: ./3050.js')
    })

    test('by description', async ctx => {
      await runTestCLI(['generate', 3050, '--filter=description:legAcy', './3050.js'])

      const generatedCode = fs.readFileSync('./3050.js').toString()
      ctx.expect(generatedCode).toMatchSnapshot()
      ctx
        .expect(log)
        .toMatchInlineSnapshot('generated code for achievement set for gameId 3050: ./3050.js')
    })

    test('by two ids', async ctx => {
      await runTestCLI(['generate', 3050, '--filter=id:251967,251968', './3050.js'])

      const generatedCode = fs.readFileSync('./3050.js').toString()
      ctx.expect(generatedCode).toMatchSnapshot()
      ctx
        .expect(log)
        .toMatchInlineSnapshot('generated code for achievement set for gameId 3050: ./3050.js')
    })
  })

  test('option to include unofficial assets works', async ctx => {
    vol.fromJSON({
      ...defaultFiles,
      './RACache/Data/3050.json': realFs.readFileSync(resolveRACache('./3050.json')).toString(),
    })

    await runTestCLI(['generate', 3050, '--include-unofficial', './3050.js'])

    const generatedCode = fs.readFileSync('./3050.js').toString()
    ctx.expect(generatedCode).toMatchSnapshot()
    ctx
      .expect(log)
      .toMatchInlineSnapshot('generated code for achievement set for gameId 3050: ./3050.js')
  })

  test('warns about assets with missing name or description, yet still generates them', async ctx => {
    const corruptedData = JSON.parse(realFs.readFileSync(resolveRACache('./3050.json')).toString())
    corruptedData.Achievements[1].Title = ''
    corruptedData.Achievements[3].Description = ''
    corruptedData.Leaderboards[0].Title = ''
    corruptedData.Leaderboards[0].Description = ''

    vol.fromJSON({
      ...defaultFiles,
      './RACache/Data/3050.json': JSON.stringify(corruptedData),
    })

    await runTestCLI(['generate', 3050, './3050.js'])

    const generatedCode = fs.readFileSync('./3050.js').toString()
    expect(generatedCode).toMatchSnapshot()

    ctx.expect(log).toMatchInlineSnapshot(`
      Achievement with ID 251873 lacks title, marked with FIXME
      Achievement with ID 251968 lacks description, marked with FIXME
      Leaderboard with ID 44618 lacks title and description, marked with FIXME
      generated code for achievement set for gameId 3050: ./3050.js
    `)
  })

  describe('warns about overwriting an existing file', () => {
    beforeEach(() => {
      vol.fromJSON({
        ...defaultFiles,
        './RACache/Data/3050.json': realFs.readFileSync(resolveRACache('./3050.json')).toString(),
        './3050.js': ':))))))',
      })
    })

    test('agree to overwrite file', async ctx => {
      prompts.inject([true])
      await runTestCLI(['generate', 3050, '-fid:251968', './3050.js'])

      const generatedCode = fs.readFileSync('./3050.js').toString()
      expect(generatedCode).not.toBe(':))))))')
      ctx.expect(log).toMatchInlineSnapshot(`
          file ./3050.js already exists, overwrite? [y/N]
          generated code for achievement set for gameId 3050: ./3050.js
        `)
    })

    test('do nothing', async ctx => {
      prompts.inject([false])
      await runTestCLI(['generate', 3050, '-fid:251968', './3050.js'])

      const generatedCode = fs.readFileSync('./3050.js').toString()
      expect(generatedCode).toBe(':))))))')
      ctx.expect(log).toMatchInlineSnapshot(`file ./3050.js already exists, overwrite? [y/N]`)
    })
  })
})
