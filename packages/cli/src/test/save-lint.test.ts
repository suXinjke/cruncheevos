import { describe, test, beforeAll, beforeEach } from 'vitest'
import { prepareFakeAssets } from './fake-assets-util.js'
import { vol, fs, log, server, makeDoRequestHandler, stringDiff } from './test-util.js'
import { runTestCLI } from '../cli.js'

import { AchievementSet } from '@cruncheevos/core'

const genericLeaderboard = {
  conditions: {
    start: '1=0',
    cancel: '1=0',
    submit: '1=1',
    value: 'M:0xcafe',
  },
}
const genericAchievement = {
  conditions: '1=0',
}

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

describe('save and linting', () => {
  test('warn about odd number of points on the achievement', async ctx => {
    prepareFakeAssets({
      gameId: 1234,
      baseConditions: () => ({
        achievements: {
          1: genericAchievement,
        },
      }),
      remote: () => {},
      local: () => {},
      input: ({ base }) => {
        base.achievements[1].points = 47
      },
    })

    const before = fs.readFileSync('./RACache/Data/1234-User.txt').toString().split('\n')

    await runTestCLI(['save', './mySet.js'])
    ctx.expect(log).toMatchInlineSnapshot(`
      dumped local data for gameId: 1234: ./RACache/Data/1234-User.txt
      updated: 1 achievement
      WARN: Achievement "Ach_1" has odd amount of points: 47
    `)

    const after = fs.readFileSync('./RACache/Data/1234-User.txt').toString().split('\n')
    ctx.expect(stringDiff(before, after)).toMatchInlineSnapshot(`
      "  1.0
        SampleAchievementSet
      - 1:"1=0":Ach_1:Ach_1 description::::AchAuthor:1:::::00000
      + 1:"1=0":Ach_1:Ach_1 description::::AchAuthor:47:::::00000
        "
    `)
  })

  test('warn about duplicate names for achievements and leaderboards without ID', async ctx => {
    const ach: AchievementSet.AchievementInput = {
      title: 'Ach1',
      description: 'AchDesc1',
      points: 5,
      conditions: '1=0',
    }

    const lb: AchievementSet.LeaderboardInput = {
      title: 'Lb1',
      description: 'LbDesc1',
      lowerIsBetter: true,
      type: 'FRAMES',
      ...genericLeaderboard,
    }

    prepareFakeAssets({
      gameId: 1234,
      baseConditions: () => ({
        achievements: {
          3: { id: 3, ...ach, description: 'AchDesc3' },
        },
        leaderboards: {
          6: { id: 6, ...lb, description: 'LbDesc3' },
        },
      }),
      remote: () => {},
      inputModule: () => {
        return new AchievementSet({ gameId: 1234, title: 'Sample' })
          .addAchievement(ach)
          .addAchievement({ ...ach, description: 'AchDesc2' })
          .addAchievement({ ...ach, id: 3, description: 'AchDesc3' })
          .addLeaderboard(lb)
          .addLeaderboard({ ...lb, description: 'LbDesc2' })
          .addLeaderboard({ ...lb, id: 6, description: 'LbDesc3' })
      },
    })

    await runTestCLI(['save', './mySet.js'])
    ctx.expect(log).toMatchInlineSnapshot(`
      dumped local data for gameId: 1234: ./RACache/Data/1234-User.txt
      added: 2 achievements, 2 leaderboards
      WARN: There are several achievements without ID titled "Ach1"
      WARN: There are several achievements without ID titled "Lb1"
    `)
  })

  test('warn about long asset titles and descriptions', async ctx => {
    prepareFakeAssets({
      gameId: 1234,
      baseConditions: () => ({
        achievements: {
          1: genericAchievement,
        },
        leaderboards: {
          1: genericLeaderboard,
        },
      }),
      remote: () => {},
      local: () => {},
      input: ({ base }) => {
        base.achievements[1].title = 'extremely_long_title_'.repeat(13)
        base.achievements[1].description = 'extremely_long_description_'.repeat(10)
        base.leaderboards[1].title = 'extremely_long_title_'.repeat(13)
        base.leaderboards[1].description = 'extremely_long_description_'.repeat(10)
      },
    })

    await runTestCLI(['save', './mySet.js'])
    ctx.expect(log).toMatchInlineSnapshot(`
      dumped local data for gameId: 1234: ./RACache/Data/1234-User.txt
      updated: 1 achievement, 1 leaderboard
      WARN: Achievement "extremely_long_title_extremely_long_titl..." has title length above 255: 273
      WARN: Leaderboard "extremely_long_title_extremely_long_titl..." has title length above 255: 273
      WARN: Achievement "extremely_long_title_extremely_long_titl..." has description length above 255: 270
      WARN: Leaderboard "extremely_long_title_extremely_long_titl..." has description length above 255: 270
    `)
  })
})
