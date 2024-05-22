import { beforeAll, beforeEach, test } from 'vitest'
import { prepareFakeAssets } from './fake-assets-util.js'
import { vol, fs, log, server } from './test-util.js'
import { runTestCLI } from '../cli.js'

import { AchievementSet } from '@cruncheevos/core'

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

const genericAchievement = {
  conditions: '1=0',
}
const genericLeaderboard = {
  conditions: {
    start: '1=0',
    cancel: '1=0',
    submit: '1=1',
    value: 'M:0xcafe',
  },
}

test(`adding new local assets does not lead to ID collisions`, async ctx => {
  prepareFakeAssets({
    gameId: 1234,
    baseConditions: () => ({
      achievements: {
        111000001: {
          ...genericAchievement,
          title: 'OldTitle',
          description: 'OldDescription',
        },
      },
      leaderboards: {
        111000001: {
          ...genericLeaderboard,
          title: 'OldTitle',
          description: 'OldDescription',
        },
      },
    }),
    remote: ({ base }) => {
      delete base.achievements[111000001]
      delete base.leaderboards[111000001]
    },
    local: () => {},
    inputModule: () => {
      return new AchievementSet({ gameId: 1234, title: 'AchievementSet' })
        .addAchievement({
          title: 'NewTitle',
          description: 'NewDescription',
          points: 1,
          conditions: '0=1',
        })
        .addLeaderboard({
          title: 'NewTitle',
          description: 'NewDescription',
          lowerIsBetter: true,
          type: 'SECS',
          conditions: {
            start: '0=1',
            cancel: '0=1',
            submit: '0=1',
            value: '0=1',
          },
        })
    },
  })

  await runTestCLI(['save', './mySet.js'])
  ctx.expect(fs.readFileSync('./RACache/Data/1234-User.txt').toString()).toMatchInlineSnapshot(`
    "1.0
    SampleAchievementSet
    111000001:"1=0":OldTitle:OldDescription::::AchAuthor:1:::::00000
    111000002:"0=1":NewTitle:NewDescription::::cruncheevos:1:::::00000
    L111000001:"1=0":"1=0":"1=1":"M:0x cafe":SCORE:OldTitle:OldDescription:0
    L111000002:"0=1":"0=1":"0=1":"M:0=1":SECS:NewTitle:NewDescription:1
    "
  `)
})

test('Resaving new local asset does not make it disappear', async ctx => {
  prepareFakeAssets({
    gameId: 3050,
    remote: ({ base }) => {
      base.achievements[1] = {
        id: 1,
        title: 'Cronus',
        description: 'baobab',
        points: 10,
        conditions: '4=4',
      }

      base.leaderboards[1] = {
        id: 1,
        title: 'TEST-LB-GOOD',
        description: 'TEST-LB-GOOD',
        lowerIsBetter: false,
        type: 'VALUE',
        conditions: {
          start: '1=1',
          cancel: '1=1',
          submit: '1=1',
          value: '1=1',
        },
      }
    },
    inputModule: () => {
      return new AchievementSet({ title: 'test', gameId: 3050 })
        .addAchievement({
          title: 'Cronus',
          description: 'baobab',
          points: 10,
          conditions: '4=4',
        })
        .addAchievement({
          title: 'TEST-1',
          description: 'TEST-1',
          points: 10,
          conditions: '1=1',
        })
        .addAchievement({
          title: 'TEST-2',
          description: 'TEST-2',
          points: 10,
          conditions: '3=3',
        })
        .addLeaderboard({
          title: 'TEST-LB-GOOD',
          description: 'TEST-LB-GOOD',
          lowerIsBetter: false,
          type: 'VALUE',
          conditions: {
            start: '1=1',
            cancel: '1=1',
            submit: '1=1',
            value: '1=1',
          },
        })
        .addLeaderboard({
          title: 'TEST-L2',
          description: 'TEST-L2',
          lowerIsBetter: false,
          type: 'VALUE',
          conditions: {
            start: '2=2',
            cancel: '1=1',
            submit: '1=1',
            value: '1=1',
          },
        })
        .addLeaderboard({
          title: 'TEST-L3',
          description: 'TEST-L3',
          lowerIsBetter: false,
          type: 'VALUE',
          conditions: {
            start: '3=3',
            cancel: '1=1',
            submit: '1=1',
            value: '1=1',
          },
        })
    },
  })

  await runTestCLI(['save', './mySet.js'])

  const before = fs.readFileSync('./RACache/Data/3050-User.txt').toString()

  await runTestCLI(['save', './mySet.js'])
  const after = fs.readFileSync('./RACache/Data/3050-User.txt').toString()
  ctx.expect(after).toEqual(before)
})
