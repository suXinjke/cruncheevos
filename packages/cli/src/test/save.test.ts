import { describe, beforeAll, beforeEach, expect, test } from 'vitest'
import { prepareFakeAssets } from './fake-assets-util.js'
import { vol, fs, log, server, makeDoRequestHandler, stringDiff } from './test-util.js'
import { runTestCLI } from '../cli.js'

import { AchievementSet } from '@cruncheevos/core'
import { HttpResponse, http } from 'msw'

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

describe('save', () => {
  describe(`remote file didn't exist`, () => {
    test(`doesn't fetch remote data if set is empty`, async ctx => {
      prepareFakeAssets({
        gameId: 3050,
        input: () => ({}),
      })

      await runTestCLI(['save', './mySet.js'])

      expect(fs.existsSync('./RACache/Data/3050.json')).toBe(false)
      ctx
        .expect(log)
        .toMatchInlineSnapshot("set doesn't define any achievements or leaderboards, save aborted")
    })

    test(`fetches remote data and creates local file`, async ctx => {
      prepareFakeAssets({
        gameId: 3050,
        input: ({ base }) => {
          base.achievements[111000001] = {
            conditions: '1=0',
          }
        },
      })

      await runTestCLI(['save', './mySet.js'])

      expect(fs.existsSync('./RACache/Data/3050.json')).toBe(true)
      expect(fs.existsSync('./RACache/Data/3050-User.txt')).toBe(true)
      ctx.expect(log).toMatchInlineSnapshot(`
        fetching remote data for gameId 3050
        dumped remote data for gameId 3050: ./RACache/Data/3050.json
        dumped local data for gameId: 3050: ./RACache/Data/3050-User.txt
        added: 1 achievement
      `)
    })

    test(`doesn't produce local file if remote data cannot be fetched`, async ctx => {
      prepareFakeAssets({
        gameId: 3050,
        input: ({ base }) => {
          base.achievements[1] = {
            conditions: '1=0',
          }
        },
      })

      server.use(makeDoRequestHandler(() => new HttpResponse(null, { status: 500 })))

      await ctx
        .expect(runTestCLI(['save', './mySet.js']))
        .rejects.toThrowErrorMatchingInlineSnapshot(
          `[Error: failed to fetch remote data: HTTP 500]`,
        )

      expect(fs.existsSync('./RACache/Data/3050.json')).toBe(false)
      expect(fs.existsSync('./RACache/Data/3050-User.txt')).toBe(false)
      ctx.expect(log).toMatchInlineSnapshot(`
        fetching remote data for gameId 3050
        failed to fetch remote data: HTTP 500
        remote data got issues, will attempt to refetch it
        fetching remote data for gameId 3050
        failed to fetch remote data: HTTP 500
        remote data got issues, cannot proceed with the save
      `)
    })
  })

  describe(`remote file exists, local file didn't exist`, () => {
    test('saves new set, ids are sorted ascending', async ctx => {
      prepareFakeAssets({
        gameId: 1234,
        remote: () => {},
        input: ({ base }) => {
          for (let i = 1; i <= 2; i++) {
            const id = 111000000 + i
            base.achievements[id] = {
              ...genericAchievement,
              title: `Ach_${i}`,
              description: `Ach_${i} description`,
            }
            base.leaderboards[id] = {
              ...genericLeaderboard,
              title: `Lb_${i}`,
              description: `Lb_${i} description`,
            }
          }
        },
      })

      await runTestCLI(['save', './mySet.js'])
      ctx.expect(log).toMatchInlineSnapshot(`
        dumped local data for gameId: 1234: ./RACache/Data/1234-User.txt
        added: 2 achievements, 2 leaderboards
      `)
      ctx.expect(fs.readFileSync('./RACache/Data/1234-User.txt').toString()).toMatchInlineSnapshot(`
        "1.0
        SampleAchievementSet
        111000001:"1=0":Ach_1:Ach_1 description::::AchAuthor:1:::::00000
        111000002:"1=0":Ach_2:Ach_2 description::::AchAuthor:1:::::00000
        L111000001:"1=0":"1=0":"1=1":"M:0x cafe":SCORE:Lb_1:Lb_1 description:0
        L111000002:"1=0":"1=0":"1=1":"M:0x cafe":SCORE:Lb_2:Lb_2 description:0
        "
      `)
    })

    test('works if set is produced by async function', async ctx => {
      server.use(
        http.get('https://mysecretstash.com/achievements', () =>
          HttpResponse.json([
            {
              title: 'MyAchievement',
              description: 'MyDescription',
              points: 5,
              conditions: '1=0',
            },
          ]),
        ),
      )

      prepareFakeAssets({
        gameId: 1234,
        remote: () => {},
        inputModule: async function () {
          const achievementInput = await fetch('https://mysecretstash.com/achievements')
            .then(x => x.json())
            .then(x => x[0])

          const set = new AchievementSet({
            gameId: 1234,
            title: 'AsyncAchievementSet',
          })

          set.addAchievement(achievementInput)

          return set
        },
      })

      await runTestCLI(['save', './mySet.js'])
      ctx.expect(log).toMatchInlineSnapshot(`
        dumped local data for gameId: 1234: ./RACache/Data/1234-User.txt
        added: 1 achievement
      `)
      ctx.expect(fs.readFileSync('./RACache/Data/1234-User.txt').toString()).toMatchInlineSnapshot(`
        "1.0
        AsyncAchievementSet
        111000001:"1=0":MyAchievement:MyDescription::::cruncheevos:5:::::00000
        "
      `)
    })

    test('correctly reports some error within the set', async ctx => {
      prepareFakeAssets({
        gameId: 1234,
        remote: () => {},
        inputModule: function () {
          return new AchievementSet({
            gameId: 1234,
            title: 'AsyncAchievementSet',
          }).addAchievement({
            title: 'FaultyAchievement',
            description: 'MyDescription',
            points: 3,
            conditions: ':DDD',
          })
        },
      })

      await ctx
        .expect(runTestCLI(['save', './mySet.js']))
        .rejects.toThrowErrorMatchingInlineSnapshot(
          `[Error: Core, condition 1: expected a legal condition flag, but got ":"]`,
        )
      expect(fs.existsSync('./RACache/Data/3050-User.txt')).toBe(false)
      // TODO: should this be empty?
      ctx.expect(log).toMatchInlineSnapshot('')
    })

    test(`remote file is corrupted - refetch it and give a message about it`, async ctx => {
      prepareFakeAssets({
        gameId: 3050,
        baseConditions: () => ({
          achievements: {
            111000001: {
              conditions: '1=0',
            },
          },
        }),
        remote: () => {},
        input: () => {},
      })

      fs.writeFileSync('./RACache/Data/3050.json', ':DDD')

      // TODO: the JSON error message is node-version dependant when it shouldn't be
      await runTestCLI(['save', './mySet.js'])
      expect(fs.existsSync('./RACache/Data/3050-User.txt')).toBe(true)
      ctx.expect(log).toMatchInlineSnapshot(`
        Unexpected token ':', ":DDD" is not valid JSON
        remote data got issues, will attempt to refetch it
        fetching remote data for gameId 3050
        dumped remote data for gameId 3050: ./RACache/Data/3050.json
        dumped local data for gameId: 3050: ./RACache/Data/3050-User.txt
        added: 1 achievement
      `)
    })
  })

  describe('remote file exists, local file exists', () => {
    test('add achievement and leaderboard without affecting anything else in the local file', async ctx => {
      prepareFakeAssets({
        gameId: 1234,
        baseConditions: () => ({
          achievements: {
            1: genericAchievement,
            2: genericAchievement,
          },
          leaderboards: {
            1: genericLeaderboard,
            2: genericLeaderboard,
          },
        }),
        remote: () => {},
        local: ({ base }) => {
          delete base.achievements[1]
          delete base.leaderboards[1]
        },
        inputModule: () => {
          return new AchievementSet({ gameId: 1234, title: 'SampleGame' })
            .addAchievement({
              title: 'FreshAchievement',
              description: 'FreshDescription',
              conditions: '2=0',
              points: 1,
            })
            .addLeaderboard({
              title: 'FreshLeaderboard',
              description: 'FreshDescription',
              type: 'SCORE',
              lowerIsBetter: false,
              conditions: {
                start: '0xcafe=0xfeed',
                cancel: '0=1',
                submit: '1=1',
                value: '0xbeef',
              },
            })
        },
      })

      const before = fs.readFileSync('./RACache/Data/1234-User.txt').toString().split('\n')

      await runTestCLI(['save', './mySet.js'])
      ctx.expect(log).toMatchInlineSnapshot(`
        dumped local data for gameId: 1234: ./RACache/Data/1234-User.txt
        added: 1 achievement, 1 leaderboard
      `)

      const after = fs.readFileSync('./RACache/Data/1234-User.txt').toString().split('\n')
      ctx.expect(stringDiff(before, after)).toMatchInlineSnapshot(`
        "  1.0
          SampleAchievementSet
          2:"1=0":Ach_2:Ach_2 description::::AchAuthor:1:::::00000
        + 111000001:"2=0":FreshAchievement:FreshDescription::::cruncheevos:1:::::00000
          L2:"1=0":"1=0":"1=1":"M:0x cafe":SCORE:Lb_2:Lb_2 description:0
        + L111000001:"0x cafe=0x feed":"0=1":"1=1":"M:0x beef":SCORE:FreshLeaderboard:FreshDescription:0
          "
      `)
    })

    test('change achievement, while local file is empty', async ctx => {
      prepareFakeAssets({
        gameId: 1234,
        baseConditions: () => ({
          achievements: {
            1: genericAchievement,
            2: genericAchievement,
          },
        }),
        remote: () => {},
        local: ({ base }) => {
          delete base.achievements[1]
          delete base.achievements[2]
        },
        inputModule: () => {
          return new AchievementSet({ gameId: 1234, title: 'SampleGame' }).addAchievement({
            id: 1,
            title: 'FreshAchievement',
            description: 'FreshDescription',
            conditions: '0xcafe=0xfeed',
            points: 1,
          })
        },
      })

      const before = fs.readFileSync('./RACache/Data/1234-User.txt').toString().split('\n')

      await runTestCLI(['save', './mySet.js'])
      ctx.expect(log).toMatchInlineSnapshot(`
        dumped local data for gameId: 1234: ./RACache/Data/1234-User.txt
        updated: 1 achievement
      `)

      const after = fs.readFileSync('./RACache/Data/1234-User.txt').toString().split('\n')
      ctx.expect(stringDiff(before, after)).toMatchInlineSnapshot(`
        "  1.0
          SampleAchievementSet
        + 1:"0x cafe=0x feed":FreshAchievement:FreshDescription::::cruncheevos:1:::::00000
          "
      `)
    })

    describe('overwrite achievement 1 and leaderboard 2', () => {
      test('target the id', async ctx => {
        prepareFakeAssets({
          gameId: 1234,
          baseConditions: () => ({
            achievements: {
              1: genericAchievement,
              2: genericAchievement,
            },
            leaderboards: {
              1: genericLeaderboard,
              2: genericLeaderboard,
            },
          }),
          remote: () => {},
          local: () => {},
          inputModule: () => {
            return new AchievementSet({ gameId: 1234, title: 'SampleGame' })
              .addAchievement({
                id: 1,
                title: 'Ach_1',
                description: 'Ach_1 description',
                conditions: '0xcafe=0xfeed',
                points: 100,
                badge: 'local\\\\kiwi.png',
              })
              .addLeaderboard({
                id: 2,
                title: 'Lb_2',
                description: 'Lb_2 description',
                type: 'SCORE',
                lowerIsBetter: false,
                conditions: {
                  start: '0xcafe=0xfeed',
                  cancel: '0=1',
                  submit: '1=1',
                  value: '0xbeef',
                },
              })
          },
        })

        const before = fs.readFileSync('./RACache/Data/1234-User.txt').toString().split('\n')

        await runTestCLI(['save', './mySet.js'])
        ctx.expect(log).toMatchInlineSnapshot(`
          dumped local data for gameId: 1234: ./RACache/Data/1234-User.txt
          updated: 1 achievement, 1 leaderboard
        `)

        const after = fs.readFileSync('./RACache/Data/1234-User.txt').toString().split('\n')
        ctx.expect(stringDiff(before, after)).toMatchInlineSnapshot(`
          "  1.0
            SampleAchievementSet
          - 1:"1=0":Ach_1:Ach_1 description::::AchAuthor:1:::::00000
          + 1:"0x cafe=0x feed":Ach_1:Ach_1 description::::cruncheevos:100:::::"local\\\\kiwi.png"
            2:"1=0":Ach_2:Ach_2 description::::AchAuthor:1:::::00000
            L1:"1=0":"1=0":"1=1":"M:0x cafe":SCORE:Lb_1:Lb_1 description:0
          - L2:"1=0":"1=0":"1=1":"M:0x cafe":SCORE:Lb_2:Lb_2 description:0
          + L2:"0x cafe=0x feed":"0=1":"1=1":"M:0x beef":SCORE:Lb_2:Lb_2 description:0
            "
        `)
      })

      test('target the name/description', async ctx => {
        prepareFakeAssets({
          gameId: 1234,
          baseConditions: () => ({
            achievements: {
              1: genericAchievement,
              2: genericAchievement,
            },
            leaderboards: {
              1: genericLeaderboard,
              2: genericLeaderboard,
            },
          }),
          remote: () => {},
          local: () => {},
          inputModule: () => {
            return new AchievementSet({ gameId: 1234, title: 'SampleGame' })
              .addAchievement({
                title: 'Ach_1',
                description: 'Ach_1 description',
                conditions: '0xcafe=0xfeed',
                points: 100,
              })
              .addLeaderboard({
                title: 'Lb_2',
                description: 'Lb_2 description',
                type: 'SCORE',
                lowerIsBetter: false,
                conditions: {
                  start: '0xcafe=0xfeed',
                  cancel: '0=1',
                  submit: '1=1',
                  value: '0xbeef',
                },
              })
          },
        })

        const before = fs.readFileSync('./RACache/Data/1234-User.txt').toString().split('\n')

        await runTestCLI(['save', './mySet.js'])
        ctx.expect(log).toMatchInlineSnapshot(`
          dumped local data for gameId: 1234: ./RACache/Data/1234-User.txt
          updated: 1 achievement, 1 leaderboard
        `)

        const after = fs.readFileSync('./RACache/Data/1234-User.txt').toString().split('\n')
        ctx.expect(stringDiff(before, after)).toMatchInlineSnapshot(`
          "  1.0
            SampleAchievementSet
          - 1:"1=0":Ach_1:Ach_1 description::::AchAuthor:1:::::00000
          + 1:"0x cafe=0x feed":Ach_1:Ach_1 description::::cruncheevos:100:::::00000
            2:"1=0":Ach_2:Ach_2 description::::AchAuthor:1:::::00000
            L1:"1=0":"1=0":"1=1":"M:0x cafe":SCORE:Lb_1:Lb_1 description:0
          - L2:"1=0":"1=0":"1=1":"M:0x cafe":SCORE:Lb_2:Lb_2 description:0
          + L2:"0x cafe=0x feed":"0=1":"1=1":"M:0x beef":SCORE:Lb_2:Lb_2 description:0
            "
        `)
      })

      test('target the name', async ctx => {
        prepareFakeAssets({
          gameId: 1234,
          baseConditions: () => ({
            achievements: {
              1: genericAchievement,
              2: genericAchievement,
            },
            leaderboards: {
              1: genericLeaderboard,
              2: genericLeaderboard,
            },
          }),
          remote: () => {},
          local: () => {},
          inputModule: () => {
            return new AchievementSet({ gameId: 1234, title: 'SampleGame' })
              .addAchievement({
                title: 'Ach_1',
                description: 'FreshDescription',
                conditions: '0xcafe=0xfeed',
                points: 100,
              })
              .addLeaderboard({
                title: 'Lb_2',
                description: 'FreshDescription',
                type: 'SCORE',
                lowerIsBetter: false,
                conditions: {
                  start: '0xcafe=0xfeed',
                  cancel: '0=1',
                  submit: '1=1',
                  value: '0xbeef',
                },
              })
          },
        })

        const before = fs.readFileSync('./RACache/Data/1234-User.txt').toString().split('\n')

        await runTestCLI(['save', './mySet.js'])
        ctx.expect(log).toMatchInlineSnapshot(`
          dumped local data for gameId: 1234: ./RACache/Data/1234-User.txt
          updated: 1 achievement, 1 leaderboard
        `)

        const after = fs.readFileSync('./RACache/Data/1234-User.txt').toString().split('\n')
        ctx.expect(stringDiff(before, after)).toMatchInlineSnapshot(`
          "  1.0
            SampleAchievementSet
          - 1:"1=0":Ach_1:Ach_1 description::::AchAuthor:1:::::00000
          + 1:"0x cafe=0x feed":Ach_1:FreshDescription::::cruncheevos:100:::::00000
            2:"1=0":Ach_2:Ach_2 description::::AchAuthor:1:::::00000
            L1:"1=0":"1=0":"1=1":"M:0x cafe":SCORE:Lb_1:Lb_1 description:0
          - L2:"1=0":"1=0":"1=1":"M:0x cafe":SCORE:Lb_2:Lb_2 description:0
          + L2:"0x cafe=0x feed":"0=1":"1=1":"M:0x beef":SCORE:Lb_2:FreshDescription:0
            "
        `)
      })

      test('target the description', async ctx => {
        prepareFakeAssets({
          gameId: 1234,
          baseConditions: () => ({
            achievements: {
              1: genericAchievement,
              2: genericAchievement,
            },
            leaderboards: {
              1: genericLeaderboard,
              2: genericLeaderboard,
            },
          }),
          remote: () => {},
          local: () => {},
          inputModule: () => {
            return new AchievementSet({ gameId: 1234, title: 'SampleGame' })
              .addAchievement({
                title: 'FreshName',
                description: 'Ach_1 description',
                conditions: '0xcafe=0xfeed',
                points: 100,
              })
              .addLeaderboard({
                title: 'FreshName',
                description: 'Lb_2 description',
                type: 'SCORE',
                lowerIsBetter: false,
                conditions: {
                  start: '0xcafe=0xfeed',
                  cancel: '0=1',
                  submit: '1=1',
                  value: '0xbeef',
                },
              })
          },
        })

        const before = fs.readFileSync('./RACache/Data/1234-User.txt').toString().split('\n')

        await runTestCLI(['save', './mySet.js'])
        ctx.expect(log).toMatchInlineSnapshot(`
          dumped local data for gameId: 1234: ./RACache/Data/1234-User.txt
          updated: 1 achievement, 1 leaderboard
        `)

        const after = fs.readFileSync('./RACache/Data/1234-User.txt').toString().split('\n')
        ctx.expect(stringDiff(before, after)).toMatchInlineSnapshot(`
          "  1.0
            SampleAchievementSet
          - 1:"1=0":Ach_1:Ach_1 description::::AchAuthor:1:::::00000
          + 1:"0x cafe=0x feed":FreshName:Ach_1 description::::cruncheevos:100:::::00000
            2:"1=0":Ach_2:Ach_2 description::::AchAuthor:1:::::00000
            L1:"1=0":"1=0":"1=1":"M:0x cafe":SCORE:Lb_1:Lb_1 description:0
          - L2:"1=0":"1=0":"1=1":"M:0x cafe":SCORE:Lb_2:Lb_2 description:0
          + L2:"0x cafe=0x feed":"0=1":"1=1":"M:0x beef":SCORE:FreshName:Lb_2 description:0
            "
        `)
      })
    })

    test('if local fully matches the remote, it should be removed from the local', async ctx => {
      prepareFakeAssets({
        gameId: 1234,
        baseConditions: () => ({
          achievements: {
            1: genericAchievement,
          },
          leaderboards: {
            2: genericLeaderboard,
          },
        }),
        remote: () => {},
        local: ({ base }) => {
          base.achievements[1].conditions = '1=0xcafe'
          base.leaderboards[2].conditions['start'] = '1=0xcafe'
        },
        input: () => {},
      })

      const before = fs.readFileSync('./RACache/Data/1234-User.txt').toString().split('\n')

      await runTestCLI(['save', './mySet.js'])
      ctx.expect(log).toMatchInlineSnapshot(`
          dumped local data for gameId: 1234: ./RACache/Data/1234-User.txt
          removed from local (similar to remote): 1 achievement, 1 leaderboard
        `)

      const after = fs.readFileSync('./RACache/Data/1234-User.txt').toString().split('\n')
      ctx.expect(stringDiff(before, after)).toMatchInlineSnapshot(`
        "  1.0
          SampleAchievementSet
        - 1:"1=0x cafe":Ach_1:Ach_1 description::::AchAuthor:1:::::00000
        - L2:"1=0x cafe":"1=0":"1=1":"M:0x cafe":SCORE:Lb_2:Lb_2 description:0
          "
      `)
    })

    test(`lack of ID specified in the asset, or condition producing undefined values shouldn't result in false "updated" messages`, async ctx => {
      const achievement = {
        ...genericAchievement,
        title: 'My Achievement',
        description: 'do something',
        points: 5,
      }

      const leaderboard = {
        ...genericLeaderboard,
        conditions: {
          ...genericLeaderboard.conditions,
          value: 'M:0xXb711c4',
        },
        title: 'My Leaderboard',
        description: 'be fast',
        type: 'SCORE' as const,
        lowerIsBetter: true,
      }

      prepareFakeAssets({
        gameId: 1234,
        baseConditions: () => ({
          achievements: {
            1: achievement,
          },
          leaderboards: {
            1: leaderboard,
          },
        }),
        remote: () => {},
        inputModule: () => {
          return new AchievementSet({ gameId: 1234, title: 'SampleAchievementSet' })
            .addAchievement(achievement)
            .addLeaderboard({
              ...leaderboard,
              conditions: {
                ...leaderboard.conditions,
                value: [
                  // unfinished rvalue resulted in comparison bug!
                  ['Measured', 'Mem', '32bit', 0xb711c4, '', '', ''],
                ],
              },
            })
        },
      })

      await runTestCLI(['save', './mySet.js'])
      ctx
        .expect(log)
        .toMatchInlineSnapshot('dumped local data for gameId: 1234: ./RACache/Data/1234-User.txt')
    })

    describe(`but local file is corrupted`, () => {
      beforeEach(() => {
        prepareFakeAssets({
          gameId: 1234,
          baseConditions: () => ({
            achievements: {
              1: genericAchievement,
              2: genericAchievement,
            },
          }),
          remote: () => {},
          local: () => {},
          inputModule: () => {
            return new AchievementSet({ gameId: 1234, title: 'SampleGame' }).addAchievement({
              title: 'Ach_1',
              description: 'Ach_1 description',
              conditions: '0xcafe=0xfeed',
              points: 100,
            })
          },
        })

        const corruptedData = fs
          .readFileSync('./RACache/Data/1234-User.txt')
          .toString()
          .replace('1=0', ':DDDD')

        fs.writeFileSync('./RACache/Data/1234-User.txt', corruptedData)
      })

      test(`doesn't allow to overwrite it because data can be lost`, async ctx => {
        await ctx
          .expect(runTestCLI(['save', './mySet.js']))
          .rejects.toThrowErrorMatchingInlineSnapshot(
            `[Error: line 3: Core, condition 1: expected a legal condition flag, but got ":"]`,
          )

        ctx.expect(log).toMatchInlineSnapshot(`
          local file got issues
          will not update local file to prevent loss of data
          you can force overwrite local file by specifying --force-rewrite parameter
        `)
      })

      test(`allows to overwrite it if option is given`, async ctx => {
        await runTestCLI(['save', '--force-rewrite', './mySet.js'])

        ctx.expect(log).toMatchInlineSnapshot(`
          dumped local data for gameId: 1234: ./RACache/Data/1234-User.txt
          updated: 1 achievement
        `)
      })
    })

    describe('ignorance', () => {
      test(`if set achievement and leaderboard code matches remote code despite different raw form`, async ctx => {
        prepareFakeAssets({
          gameId: 1234,
          remote: ({ base }) => {
            base.achievements[1] = genericAchievement
            base.leaderboards[1] = genericLeaderboard
          },
          inputModule: () => {
            return new AchievementSet({ gameId: 1234, title: 'SampleGame' })
              .addAchievement({
                id: 1,
                title: 'Ach_1',
                description: 'Ach_1 description',
                conditions: '1=0',
                points: 1,
              })
              .addAchievement({
                title: 'FreshAchievement',
                description: 'FreshDescription',
                conditions: '0x00cafe=0x00feed',
                points: 100,
              })
              .addLeaderboard({
                id: 1,
                title: 'Lb_1',
                description: 'Lb_1 description',
                lowerIsBetter: false,
                type: 'SCORE',
                conditions: {
                  start: '1=0',
                  cancel: '1=0',
                  submit: '1=h1',
                  value: 'M:0x0000cafe',
                },
              })
          },
        })

        const payload = JSON.parse(fs.readFileSync('./RACache/Data/1234.json').toString())
        payload.Sets[0].Achievements[0].MemAddr = '1=h0'
        payload.Sets[0].Leaderboards[0].Mem = 'STA:1=0::CAN:1=0::SUB:1=h1::VAL:M:0x0000cafe'
        fs.writeFileSync('./RACache/Data/1234.json', JSON.stringify(payload))

        await runTestCLI(['save', './mySet.js'])
        ctx.expect(log).toMatchInlineSnapshot(`
          dumped local data for gameId: 1234: ./RACache/Data/1234-User.txt
          added: 1 achievement
        `)

        const after = fs.readFileSync('./RACache/Data/1234-User.txt').toString()
        ctx.expect(after).toMatchInlineSnapshot(`
          "1.0
          SampleGame
          111000001:"0x cafe=0x feed":FreshAchievement:FreshDescription::::cruncheevos:100:::::00000
          "
        `)
      })

      test(`if set achievement and leaderboard code matches local code despite different raw form`, async ctx => {
        prepareFakeAssets({
          gameId: 1234,
          remote: () => {},
          local: () => {},
          inputModule: () => {
            return new AchievementSet({ gameId: 1234, title: 'SampleAchievementSet' })
              .addAchievement({
                id: 1,
                title: 'Ach_1',
                description: 'Ach_1 description',
                conditions: '12=0',
                points: 1,
              })
              .addAchievement({
                title: 'FreshAchievement',
                description: 'FreshDescription',
                conditions: '0x00cafe=0x00feed',
                points: 100,
              })
              .addLeaderboard({
                id: 1,
                title: 'Lb_1',
                description: 'Lb_1 description',
                lowerIsBetter: false,
                type: 'SCORE',
                conditions: {
                  start: 'h1=0',
                  cancel: 'h1=0',
                  submit: '1=h1',
                  value: 'M:0x0000cafe',
                },
              })
          },
        })

        const before = [
          '1.0',
          'SampleAchievementSet',
          '1:"hc=0":Ach_1:Ach_1 description::::AchAuthor:1:::::00000',
          'L1:"1=0":"1=0":"1=1":"M:0x0000cafe":SCORE:Lb_1:Lb_1 description:0',
          '',
        ]
        fs.writeFileSync('./RACache/Data/1234-User.txt', before.join('\n'))

        await runTestCLI(['save', './mySet.js'])
        ctx.expect(log).toMatchInlineSnapshot(`
          dumped local data for gameId: 1234: ./RACache/Data/1234-User.txt
          added: 1 achievement
        `)

        const after = fs.readFileSync('./RACache/Data/1234-User.txt').toString().split('\n')
        ctx.expect(stringDiff(before, after)).toMatchInlineSnapshot(`
          "  1.0
            SampleAchievementSet
            1:"hc=0":Ach_1:Ach_1 description::::AchAuthor:1:::::00000
          + 111000001:"0x cafe=0x feed":FreshAchievement:FreshDescription::::cruncheevos:100:::::00000
            L1:"1=0":"1=0":"1=1":"M:0x0000cafe":SCORE:Lb_1:Lb_1 description:0
            "
        `)
      })

      test('if local file contains local code notes, marked as N0', async ctx => {
        prepareFakeAssets({
          gameId: 1234,
          remote: () => {},
          local: () => {},
          inputModule: () => {
            return new AchievementSet({
              gameId: 1234,
              title: 'SampleAchievementSet',
            }).addAchievement({
              id: 1,
              title: 'Ach_1',
              description: 'Ach_1 description',
              conditions: '12=0',
              points: 1,
            })
          },
        })

        const before = [
          '1.0',
          'SampleAchievementSet',
          '1:"hc=0":Ach_1:Ach_1 description::::AchAuthor:1:::::00000',
          'N0:0x00cafe:"Feed cafe note"',
          '',
        ].join('\n')
        fs.writeFileSync('./RACache/Data/1234-User.txt', before)

        await runTestCLI(['save', './mySet.js'])
        ctx
          .expect(log)
          .toMatchInlineSnapshot('dumped local data for gameId: 1234: ./RACache/Data/1234-User.txt')

        const after = fs.readFileSync('./RACache/Data/1234-User.txt').toString()
        ctx.expect(after).toBe(before)
      })
    })

    test(`preserve original ID for matched local asset if there's an ID mismatch`, async ctx => {
      prepareFakeAssets({
        gameId: 1234,
        remote: () => {},
        local: () => {},
        inputModule: () => {
          return new AchievementSet({
            gameId: 1234,
            title: 'Gran Turismo 3: A-Spec',
          })
            .addAchievement({
              title: 'License B-3',
              description: 'Earn the gold reward',
              conditions: '0=1',
              points: 2,
            })
            .addAchievement({
              title: 'Sunday Cup',
              description: 'Win all events of Sunday Cup in one sitting.',
              conditions: '0=6',
              points: 3,
            })
            .addLeaderboard({
              title: 'LB1',
              description: 'Desc_1',
              lowerIsBetter: true,
              type: 'FIXED3',
              conditions: { start: '0=5', cancel: '0=1', submit: '1=1', value: 'M:0x1' },
            })
            .addLeaderboard({
              title: 'LB3',
              description: 'Desc_3',
              lowerIsBetter: true,
              type: 'FIXED3',
              conditions: { start: '0=8', cancel: '0=1', submit: '1=1', value: 'M:0x1' },
            })
        },
      })

      const before = [
        '1.3.0.0',
        'Gran Turismo 3: A-Spec',
        '111000001:"0=1":License B-3:Earn the gold reward::::cruncheevos:2:::::00000',
        '111000002:"0=2":cars:::::suXin:0:::::00000',
        '111000004:"0=4":Sunday Cup:Win all events of Sunday Cup in one sitting.::::cruncheevos:3:::::00000',
        'L111000001:"0=5":"0=1":"1=1":"M:0x1":FIXED3:"LB1":Desc_1:1',
        'L111000002:"0=6":"0=1":"1=1":"M:0x1":FIXED3:"lb_not_in_the_set":Desc_2:1',
        'L111000003:"0=7":"0=1":"1=1":"M:0x1":FIXED3:"LB3":Desc_3:1',
        '',
      ]

      fs.writeFileSync('./RACache/Data/1234-User.txt', before.join('\n'))

      await runTestCLI(['save', './mySet.js'])
      ctx.expect(log).toMatchInlineSnapshot(`
        dumped local data for gameId: 1234: ./RACache/Data/1234-User.txt
        updated: 1 achievement, 1 leaderboard
      `)

      const after = fs.readFileSync('./RACache/Data/1234-User.txt').toString().split('\n')
      ctx.expect(stringDiff(before, after)).toMatchInlineSnapshot(`
        "  1.3.0.0
          Gran Turismo 3: A-Spec
          111000001:"0=1":License B-3:Earn the gold reward::::cruncheevos:2:::::00000
          111000002:"0=2":cars:::::suXin:0:::::00000
        - 111000004:"0=4":Sunday Cup:Win all events of Sunday Cup in one sitting.::::cruncheevos:3:::::00000
        + 111000004:"0=6":Sunday Cup:Win all events of Sunday Cup in one sitting.::::cruncheevos:3:::::00000
          L111000001:"0=5":"0=1":"1=1":"M:0x1":FIXED3:"LB1":Desc_1:1
          L111000002:"0=6":"0=1":"1=1":"M:0x1":FIXED3:"lb_not_in_the_set":Desc_2:1
        - L111000003:"0=7":"0=1":"1=1":"M:0x1":FIXED3:"LB3":Desc_3:1
        + L111000003:"0=8":"0=1":"1=1":"M:0x 1":FIXED3:LB3:Desc_3:1
          "
      `)
    })
  })
})
