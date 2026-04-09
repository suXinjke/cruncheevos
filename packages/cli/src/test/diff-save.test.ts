import { describe, beforeAll, beforeEach, test } from 'vitest'

import { fs, log, vol, server, stringDiff } from './test-util.js'
import { prepareFakeAssets } from './fake-assets-util.js'
import { Achievement, AchievementSet, Leaderboard } from '@cruncheevos/core'
import { runTestCLI } from '../cli.js'
import prompts from 'prompts'

beforeAll(() => {
  server.listen()

  return () => {
    server.close()
  }
})

beforeEach(() => {
  log.mockClear()
  vol.reset()
  server.resetHandlers()
})

describe('diff-save', () => {
  test('complex case', async ctx => {
    const lbAsset: Leaderboard.InputObject = {
      id: 47,
      title: 'MyTitle',
      description: 'MyDescription',
      lowerIsBetter: false,
      type: 'SCORE',
      conditions: {
        start: '0=1',
        cancel: '0=1',
        submit: '1=1',
        value: '47',
      },
    }

    const lbSimilarAsset = {
      ...lbAsset,
      id: 48,
      title: 'SimilarTitle',
    }

    const lbSimilarWithoutId = {
      ...lbAsset,
      id: undefined,
      title: 'YetAnotherTitle',
      description: 'MyDescription',
    }

    const thisLbMustNotBeInLocalFile = {
      ...lbAsset,
      id: undefined,
      title: 'YetAnotherTitle2',
      description: 'MyDescription2',
    }

    const achAsset: Achievement.InputObject = {
      id: 30,
      title: 'MyTitle',
      description: 'MyDescription',
      points: 1,
      conditions: '0=1',
    }

    const thisAchMustNotBeInLocalFile: Achievement.InputObject = {
      id: 31,
      title: 'MyTitle2',
      description: 'MyDescription2',
      points: 1,
      conditions: '0=2',
      badge: 777,
    }

    prepareFakeAssets({
      gameId: 3050,
      baseConditions: () => ({
        achievements: {
          30: achAsset,
          31: thisAchMustNotBeInLocalFile,
        },
        leaderboards: {
          47: lbAsset,
          48: lbSimilarAsset,
          49: {
            ...lbSimilarWithoutId,
            id: 49,
          },
          50: {
            ...thisLbMustNotBeInLocalFile,
            id: 50,
          },
        },
      }),
      local: ({ base }) => {
        base.achievements[31].points = 5
        base.achievements[31].badge = 999

        delete base.achievements[30]
        delete base.leaderboards[47]
        delete base.leaderboards[48]
        delete base.leaderboards[49]
        delete base.leaderboards[50]
      },
      remote: () => {},
      inputModule() {
        return new AchievementSet({
          gameId: 3050,
          title: 'Set',
        })
          .addAchievement({
            ...achAsset,
            badge: 'local\\\\new_badge.png',
            type: 'missable',
          })
          .addAchievement({
            id: undefined,
            ...thisAchMustNotBeInLocalFile,
            points: 1,
            badge: 777,
          })
          .addLeaderboard(lbAsset)
          .addLeaderboard({
            ...lbSimilarAsset,
            conditions: {
              ...(lbSimilarAsset.conditions as Leaderboard.InputConditions),
              value: '9999',
            },
          })
          .addLeaderboard({
            ...lbSimilarWithoutId,
            description: 'DifferentDescription',
          })
          .addLeaderboard(thisLbMustNotBeInLocalFile)
      },
    })

    await runTestCLI(['diff', './mySet.js'])
    ctx.expect(log).toMatchInlineSnapshot(`
      Assets changed:

        A.ID│ 30 (compared to remote)
       Title│ MyTitle
        Type│ None -> Missable
       Badge│ 00000 -> local\\\\new_badge.png

        L.ID│ 48 (compared to remote)
       Title│ SimilarTitle
      ──────┼───────────────────────────────────────────────────
        Code│ Value
            │ Flag     Type  Size Value Cmp Type Size Value Hits
      ──────┼───────────────────────────────────────────────────
        1  -│ Measured Value         47
        +  1│ Measured Value       9999

        L.ID│ 49 (compared to remote)
       Title│ YetAnotherTitle
       Desc.│ - MyDescription
            │ + DifferentDescription
    `)

    const before = fs.readFileSync('./RACache/Data/3050-User.txt').toString().split('\n')

    await runTestCLI(['save', './mySet.js'])

    const after = fs.readFileSync('./RACache/Data/3050-User.txt').toString().split('\n')
    ctx.expect(stringDiff(before, after)).toMatchInlineSnapshot(`
      "  1.0
        SampleAchievementSet
      - 31:"0=2":MyTitle2:MyDescription2::::AchAuthor:5:::::00999
      + 30:"0=1":MyTitle:MyDescription:::missable:cruncheevos:1:::::"local\\\\new_badge.png"
      + L48:"0=1":"0=1":"1=1":"M:9999":SCORE:SimilarTitle:MyDescription:0
      + L49:"0=1":"0=1":"1=1":"M:47":SCORE:YetAnotherTitle:DifferentDescription:0
        "
    `)

    log.mockClear()
    await runTestCLI(['diff', './mySet.js'])
    ctx.expect(log).toMatchInlineSnapshot('no changes found')
  })

  test('badge ID preservation when compared to remote + diff-save command', async ctx => {
    const genericAchievement = {
      conditions: '1=0',
    }

    prepareFakeAssets({
      baseConditions: () => ({
        achievements: {
          1: {
            ...genericAchievement,
            badge: 1234,
            type: 'progression',
          },
        },
      }),
      remote: () => {},
      local: ({ base }) => {
        delete base.achievements[1]
      },
      input: ({ base }) => {
        base.achievements[1].id = undefined
        base.achievements[1].badge = undefined
        base.achievements[1].type = undefined
      },
    })

    prompts.inject([true])
    await runTestCLI(['diff-save', './mySet.js'])
    ctx.expect(log).toMatchInlineSnapshot(`
      Assets changed:

        A.ID│ 1 (compared to remote)
       Title│ Ach_1
        Type│ Progression -> None

      Proceed to save changes to local file? [y/N]
      dumped local data for gameId: 1234: ./RACache/Data/1234-User.txt
      updated: 1 achievement
    `)

    const localContents = fs.readFileSync('./RACache/Data/1234-User.txt').toString().split('\n')

    ctx.expect(localContents).toMatchInlineSnapshot(`
      [
        "1.0",
        "SampleAchievementSet",
        "1:"1=0":Ach_1:Ach_1 description::::AchAuthor:1:::::01234",
        "",
      ]
    `)
  })

  test('filter by name and description works', async ctx => {
    prepareFakeAssets({
      baseConditions: () => ({
        achievements: {
          1: {
            conditions: '0=1',
          },
          2: {
            conditions: '0=1',
          },
          3: {
            conditions: '0=1',
          },
          4: {
            conditions: '0=1',
          },
        },
      }),
      remote: () => {},
      local: () => {},
      input: ({ base }) => {
        base.achievements[1].title = 'myname'
        base.achievements[2].points = 100
        base.achievements[3].description = 'mydescription'
        base.achievements[4].points = 100
      },
    })

    const before = fs.readFileSync('./RACache/Data/1234-User.txt').toString().split('\n')

    prompts.inject([true])
    await runTestCLI(['diff-save', '-ftitle:my', '--filter=description:my', './mySet.js'])
    ctx.expect(log).toMatchInlineSnapshot(`
      Assets changed:

        A.ID│ 1 (compared to local)
       Title│ - Ach_1
            │ + myname
       Desc.│ Ach_1 description

        A.ID│ 3 (compared to local)
       Title│ Ach_3
       Desc.│ - Ach_3 description
            │ + mydescription

      Proceed to save changes to local file? [y/N]
      dumped local data for gameId: 1234: ./RACache/Data/1234-User.txt
      updated: 2 achievements
    `)

    const after = fs.readFileSync('./RACache/Data/1234-User.txt').toString().split('\n')
    ctx.expect(stringDiff(before, after)).toMatchInlineSnapshot(`
      "  1.0
        SampleAchievementSet
      - 1:"0=1":Ach_1:Ach_1 description::::AchAuthor:1:::::00000
      + 1:"0=1":myname:Ach_1 description::::AchAuthor:1:::::00000
        2:"0=1":Ach_2:Ach_2 description::::AchAuthor:1:::::00000
      - 3:"0=1":Ach_3:Ach_3 description::::AchAuthor:1:::::00000
      + 3:"0=1":Ach_3:mydescription::::AchAuthor:1:::::00000
        4:"0=1":Ach_4:Ach_4 description::::AchAuthor:1:::::00000
        "
    `)
  })

  test('works with unofficial achievements', async ctx => {
    prepareFakeAssets({
      baseConditions: () => ({
        achievements: {
          1: {
            conditions: '0=1',
            flags: 5,
          },
        },
      }),
      remote: () => {},
      input: ({ base }) => {
        base.achievements[1].conditions = '0=2'
      },
    })

    prompts.inject([true])
    await runTestCLI(['diff-save', './mySet.js'])
    ctx.expect(log).toMatchInlineSnapshot(`
      Assets changed:

        A.ID│ 1 (compared to remote)
       Title│ Ach_1
      ──────┼────────────────────────────────────────────────
        Code│ Core
            │ Flag Type  Size Value Cmp Type  Size Value Hits
      ──────┼────────────────────────────────────────────────
        1  -│      Value          0  =  Value          1
        +  1│      Value          0  =  Value          2

      Proceed to save changes to local file? [y/N]
      dumped local data for gameId: 1234: ./RACache/Data/1234-User.txt
      updated: 1 achievement
    `)

    const after = fs.readFileSync('./RACache/Data/1234-User.txt').toString().split('\n')
    ctx.expect(stringDiff([], after)).toMatchInlineSnapshot(`
      "+ 1.0
      + SampleAchievementSet
      + 1:"0=2":Ach_1:Ach_1 description::::AchAuthor:1:::::00000
      + "
    `)
  })

  test('properly excludes unofficial achievements', async ctx => {
    prepareFakeAssets({
      baseConditions: () => ({
        achievements: {
          1: {
            conditions: '0=1',
            flags: 5,
          },
          2: {
            conditions: '0=1',
          },
        },
      }),
      remote: () => {},
      input: ({ base }) => {
        delete base.achievements[1]
        base.achievements[2].conditions = '0=2'
      },
    })

    prompts.inject([true])
    await runTestCLI(['diff-save', '--exclude-unofficial', './mySet.js'])
    ctx.expect(log).toMatchInlineSnapshot(`
      Assets changed:

        A.ID│ 2 (compared to remote)
       Title│ Ach_2
      ──────┼────────────────────────────────────────────────
        Code│ Core
            │ Flag Type  Size Value Cmp Type  Size Value Hits
      ──────┼────────────────────────────────────────────────
        1  -│      Value          0  =  Value          1
        +  1│      Value          0  =  Value          2

      Proceed to save changes to local file? [y/N]
      dumped local data for gameId: 1234: ./RACache/Data/1234-User.txt
      updated: 1 achievement
    `)

    const after = fs.readFileSync('./RACache/Data/1234-User.txt').toString().split('\n')
    ctx.expect(stringDiff([], after)).toMatchInlineSnapshot(`
      "+ 1.0
      + SampleAchievementSet
      + 2:"0=2":Ach_2:Ach_2 description::::AchAuthor:1:::::00000
      + "
    `)
  })
})
