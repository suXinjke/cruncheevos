import { describe, beforeAll, beforeEach, expect, test } from 'vitest'

import { fs, log, vol, server, makeDoRequestHandler, makeAssetGenerator } from './test-util.js'
import { prepareFakeAssets } from './fake-assets-util.js'
import { AchievementSet } from '@cruncheevos/core'
import { runTestCLI } from '../cli.js'
import { HttpResponse } from 'msw'

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

describe('diff', () => {
  test(`fetches remote file if there's none`, async ctx => {
    prepareFakeAssets({
      gameId: 3050,
      inputModule: () =>
        new AchievementSet({ gameId: 3050, title: 'cheese' }).addAchievement({
          title: 'Dummy',
          description: 'Dummy',
          points: 5,
          conditions: '0=1',
        }),
    })

    await runTestCLI(['diff', './3050.js'])

    expect(fs.existsSync('./RACache/Data/3050.json')).toBe(true)
    ctx.expect(log).toMatchInlineSnapshot(`
      fetching remote data for gameId 3050
      dumped remote data for gameId 3050: ./RACache/Data/3050.json
      local file ./RACache/Data/3050-User.txt doesn't exist, will not diff against local file
      New achievements added:
        Dummy
    `)
  })

  test(`doesn't proceed if remote file cannot be fetched`, () => {
    prepareFakeAssets({
      gameId: 3050,
      inputModule: () =>
        new AchievementSet({ gameId: 3050, title: 'cheese' }).addAchievement({
          title: 'Dummy',
          description: 'Dummy',
          points: 5,
          conditions: '0=1',
        }),
    })

    server.use(makeDoRequestHandler(() => new HttpResponse(null, { status: 500 })))

    return expect(runTestCLI(['diff', './3050.js'])).rejects.toThrowErrorMatchingInlineSnapshot(
      `[Error: failed to fetch remote data: HTTP 500]`,
    )
  })

  test(`shows warnings on corrupted local lines and skips them during processing`, async ctx => {
    prepareFakeAssets({
      gameId: 3050,
      baseConditions: ({ repeat }) => ({
        achievements: {
          4: {
            conditions: repeat('0=1', 5),
          },
          8: {
            conditions: repeat('0=1', 5),
          },
        },
        leaderboards: {
          10: {
            conditions: {
              start: '0=1',
              cancel: '0=1',
              submit: '1=1',
              value: '47',
            },
          },
          33: {
            conditions: {
              start: '0=1',
              cancel: '0=1',
              submit: '1=1',
              value: '47',
            },
          },
        },
      }),
      local: () => {},
      remote: () => {},
      input: () => {},
    })

    const localFileCorrupted = fs
      .readFileSync('./RACache/Data/3050-User.txt')
      .toString()
      .replace(/^(4)|(L33)/gm, x => x + 'baobab')

    fs.writeFileSync('./RACache/Data/3050-User.txt', localFileCorrupted)

    await runTestCLI(['diff', './3050.js'])
    ctx.expect(log).toMatchInlineSnapshot(`
      local file, ignoring line 3: expected id as unsigned integer, but got "4baobab"
      local file, ignoring line 6: expected id as unsigned integer, but got "33baobab"
      no changes found
    `)
  })

  describe('on achievement', () => {
    describe('against remote', () => {
      test('with 5 conditions in Core group', async ctx => {
        prepareFakeAssets({
          baseConditions: ({ repeat }) => ({
            achievements: {
              1: {
                conditions: [...repeat('1=0', 5)],
              },
            },
          }),
          remote: () => {},
          input: ({ base }) => {
            base.achievements[1].conditions[2] = '0xXcafe=2'
          },
        })

        await runTestCLI(['diff', './mySet.js'])
        ctx.expect(log).toMatchInlineSnapshot(`
          local file ./RACache/Data/1234-User.txt doesn't exist, will not diff against local file
          Assets changed:

            A.ID│ 1 (compared to remote)
           Title│ Ach_1
          ──────┼──────────────────────────────────────────────────
            Code│ Core
                │ Flag Type  Size   Value Cmp Type  Size Value Hits
          ──────┼──────────────────────────────────────────────────
            1  1│      Value            1  =  Value          0
            2  2│      Value            1  =  Value          0
            +  3│      Mem   32bit 0xcafe  =  Value          2
            3  4│      Value            1  =  Value          0
            4  5│      Value            1  =  Value          0
            5  -│      Value            1  =  Value          0
        `)
      })

      test('with 12 conditions in Core group, only show 2 lines of context around change', async ctx => {
        prepareFakeAssets({
          baseConditions: ({ repeat }) => ({
            achievements: {
              100: {
                conditions: repeat('1=0', 12),
              },
            },
          }),
          remote: () => {},
          input: ({ base }) => {
            base.achievements[100].conditions[0] = '0xcafe=0xfeed.1.'
            base.achievements[100].conditions[8] = '0xcafe=0xfeed.1.'
          },
        })

        await runTestCLI(['diff', './mySet.js'])
        ctx.expect(log).toMatchInlineSnapshot(`
          local file ./RACache/Data/1234-User.txt doesn't exist, will not diff against local file
          Assets changed:

             A.ID│ 100 (compared to remote)
            Title│ Ach_100
          ───────┼────────────────────────────────────────────────────
             Code│ Core
                 │ Flag Type  Size   Value Cmp Type  Size   Value Hits
          ───────┼────────────────────────────────────────────────────
            +   1│      Mem   16bit 0xcafe  =  Mem   16bit 0xfeed    1
            1   2│      Value            1  =  Value            0
           ······│
            7   8│      Value            1  =  Value            0
            +   9│      Mem   16bit 0xcafe  =  Mem   16bit 0xfeed    1
            8  10│      Value            1  =  Value            0
           ······│
           10  12│      Value            1  =  Value            0
           11   -│      Value            1  =  Value            0
           12   -│      Value            1  =  Value            0
        `)
      })
    })

    describe('against local', () => {
      test('with 2 conditions in Alt 7 group', async ctx => {
        prepareFakeAssets({
          baseConditions: ({ repeatGroups }) => ({
            achievements: {
              1: {
                conditions: repeatGroups('1=0', { groups: 8, conditions: 2 }),
              },
            },
          }),
          local: () => {},
          remote: () => {},
          input: ({ base }) => {
            base.achievements[1].conditions['alt7'][0] = '0xcafe=0xfeed'
          },
        })

        await runTestCLI(['diff', './mySet.js'])
        ctx.expect(log).toMatchInlineSnapshot(`
          Assets changed:

            A.ID│ 1 (compared to local)
           Title│ Ach_1
          ──────┼────────────────────────────────────────────────────
            Code│ Alt 7
                │ Flag Type  Size   Value Cmp Type  Size   Value Hits
          ──────┼────────────────────────────────────────────────────
            +  1│      Mem   16bit 0xcafe  =  Mem   16bit 0xfeed
            1  2│      Value            1  =  Value            0
            2  -│      Value            1  =  Value            0
        `)
      })

      test('with 7 conditions in Core group, only show optional 2 lines of context around one change', async ctx => {
        prepareFakeAssets({
          baseConditions: ({ repeat }) => ({
            achievements: {
              1: {
                conditions: repeat('1=0', 7),
              },
            },
          }),
          local: () => {},
          remote: () => {},
          input: ({ base }) => {
            ;(base.achievements[1].conditions as string[]).pop()
          },
        })

        await runTestCLI(['diff', '--context-lines=2', './mySet.js'])
        ctx.expect(log).toMatchInlineSnapshot(`
          Assets changed:

            A.ID│ 1 (compared to local)
           Title│ Ach_1
          ──────┼────────────────────────────────────────────────
            Code│ Core
                │ Flag Type  Size Value Cmp Type  Size Value Hits
          ──────┼────────────────────────────────────────────────
            5  5│      Value          1  =  Value          0
            6  6│      Value          1  =  Value          0
            7  -│      Value          1  =  Value          0
        `)
      })
    })

    describe('on multiple achievements, against local and remote', () => {
      test('1st: 4 conditions in Core and 2 conditions in Alt 7 group; 2nd: 12 conditions in Core', async ctx => {
        prepareFakeAssets({
          baseConditions: ({ repeat, repeatGroups }) => ({
            achievements: {
              1: {
                conditions: {
                  ...(repeatGroups('0=1', { conditions: 4, groups: 8 }) as any),
                  alt7: repeat('0=1', 2),
                },
              },
              8: {
                conditions: repeat('0=1', 12),
              },
            },
          }),
          local: ({ base }) => {
            base.achievements[1].conditions['core'][3] = '0xcafe=0xfeed'
            base.achievements[1].conditions['alt7'][1] = '0xcafe=0xfeed'

            delete base.achievements[8]
          },
          remote: ({ base }) => {
            base.achievements[8].conditions[4] = '0xcafe=0xfeed'
          },
          input: ({ base }) => {
            base.achievements[1].conditions['core'][3] = '0xcafe1=0xfeed'
            base.achievements[1].conditions['alt7'][1] = '0xcafe2=0xfeed'
          },
        })

        await runTestCLI(['diff', './mySet.js'])
        ctx.expect(log).toMatchInlineSnapshot(`
          Assets changed:

            A.ID│ 1 (compared to local)
           Title│ Ach_1
          ──────┼─────────────────────────────────────────────────────
            Code│ Core
                │ Flag Type  Size    Value Cmp Type  Size   Value Hits
          ──────┼─────────────────────────────────────────────────────
            1  1│      Value             0  =  Value            1
            2  2│      Value             0  =  Value            1
            3  3│      Value             0  =  Value            1
            4  -│      Mem   16bit  0xcafe  =  Mem   16bit 0xfeed
            +  4│      Mem   16bit 0xcafe1  =  Mem   16bit 0xfeed
          ──────┼─────────────────────────────────────────────────────
            Code│ Alt 7
                │ Flag Type  Size    Value Cmp Type  Size   Value Hits
          ──────┼─────────────────────────────────────────────────────
            1  1│      Value             0  =  Value            1
            2  -│      Mem   16bit  0xcafe  =  Mem   16bit 0xfeed
            +  2│      Mem   16bit 0xcafe2  =  Mem   16bit 0xfeed

             A.ID│ 8 (compared to remote)
            Title│ Ach_8
          ───────┼────────────────────────────────────────────────────
             Code│ Core
                 │ Flag Type  Size   Value Cmp Type  Size   Value Hits
          ───────┼────────────────────────────────────────────────────
            1   -│      Value            0  =  Value            1
            2   -│      Value            0  =  Value            1
            3   -│      Value            0  =  Value            1
            4   -│      Value            0  =  Value            1
            5   -│      Mem   16bit 0xcafe  =  Mem   16bit 0xfeed
            6   1│      Value            0  =  Value            1
           ······│
           12   7│      Value            0  =  Value            1
            +   8│      Value            0  =  Value            1
            +   9│      Value            0  =  Value            1
            +  10│      Value            0  =  Value            1
            +  11│      Value            0  =  Value            1
            +  12│      Value            0  =  Value            1
        `)
      })
    })
  })

  describe('on leaderboard', () => {
    const genericLeaderboard = ({ repeat, repeatGroups }) => ({
      leaderboards: {
        22: {
          conditions: {
            start: repeat('1=0', 5),
            cancel: repeatGroups('1=0', { conditions: 5, groups: 3 }),
            submit: {
              core: '0xab=1',
              alt1: ['O:0xff=1', 'O:0xff=2', '0xff=3'],
            },
            value: 'M:0xcafe',
          },
        },
      },
    })

    describe('against remote', () => {
      test(`within Start, Core group`, async ctx => {
        prepareFakeAssets({
          baseConditions: genericLeaderboard,
          remote: () => {},
          input: ({ base }) => {
            base.leaderboards[22].conditions['start'][2] = '5=0'
          },
        })

        await runTestCLI(['diff', './mySet.js'])
        ctx.expect(log).toMatchInlineSnapshot(`
          local file ./RACache/Data/1234-User.txt doesn't exist, will not diff against local file
          Assets changed:

            L.ID│ 22 (compared to remote)
           Title│ Lb_22
          ──────┼────────────────────────────────────────────────
            Code│ Start - Core
                │ Flag Type  Size Value Cmp Type  Size Value Hits
          ──────┼────────────────────────────────────────────────
            1  1│      Value          1  =  Value          0
            2  2│      Value          1  =  Value          0
            +  3│      Value          5  =  Value          0
            3  4│      Value          1  =  Value          0
            4  5│      Value          1  =  Value          0
            5  -│      Value          1  =  Value          0
        `)
      })

      test(`within Submit, Alt 1 group`, async ctx => {
        prepareFakeAssets({
          baseConditions: genericLeaderboard,
          remote: () => {},
          input: ({ base }) => {
            base.leaderboards[22].conditions['submit']['alt1'][2] = '0xff=5'
          },
        })

        await runTestCLI(['diff', './mySet.js'])
        ctx.expect(log).toMatchInlineSnapshot(`
          local file ./RACache/Data/1234-User.txt doesn't exist, will not diff against local file
          Assets changed:

            L.ID│ 22 (compared to remote)
           Title│ Lb_22
          ──────┼──────────────────────────────────────────────────
            Code│ Submit - Alt 1
                │ Flag   Type Size  Value Cmp Type  Size Value Hits
          ──────┼──────────────────────────────────────────────────
            1  1│ OrNext Mem  16bit  0xff  =  Value          1
            2  2│ OrNext Mem  16bit  0xff  =  Value          2
            3  -│        Mem  16bit  0xff  =  Value          3
            +  3│        Mem  16bit  0xff  =  Value          5
        `)
      })
    })

    describe('against local', () => {
      test(`within Cancel, Alt 1 group`, async ctx => {
        prepareFakeAssets({
          baseConditions: genericLeaderboard,
          remote: () => {},
          local: () => {},
          input: ({ base }) => {
            base.leaderboards[22].conditions['cancel']['alt1'][2] = '0xfeed=0xcafe'
            base.leaderboards[22].conditions['cancel']['alt1'].shift()
          },
        })

        await runTestCLI(['diff', './mySet.js'])
        ctx.expect(log).toMatchInlineSnapshot(`
          Assets changed:

            L.ID│ 22 (compared to local)
           Title│ Lb_22
          ──────┼────────────────────────────────────────────────────
            Code│ Cancel - Alt 1
                │ Flag Type  Size   Value Cmp Type  Size   Value Hits
          ──────┼────────────────────────────────────────────────────
            +  1│      Value            1  =  Value            0
            +  2│      Mem   16bit 0xfeed  =  Mem   16bit 0xcafe
            1  3│      Value            1  =  Value            0
            2  4│      Value            1  =  Value            0
            3  -│      Value            1  =  Value            0
            4  -│      Value            1  =  Value            0
            5  -│      Value            1  =  Value            0
        `)
      })

      test(`within Value, Core group`, async ctx => {
        prepareFakeAssets({
          baseConditions: genericLeaderboard,
          remote: () => {},
          input: ({ base }) => {
            base.leaderboards[22].conditions['value'] = 'I:0xfeed_M:0xcafe'
          },
        })

        await runTestCLI(['diff', './mySet.js'])
        ctx.expect(log).toMatchInlineSnapshot(`
          local file ./RACache/Data/1234-User.txt doesn't exist, will not diff against local file
          Assets changed:

            L.ID│ 22 (compared to remote)
           Title│ Lb_22
          ──────┼──────────────────────────────────────────────────────
            Code│ Value
                │ Flag       Type Size   Value Cmp Type Size Value Hits
          ──────┼──────────────────────────────────────────────────────
            +  1│ AddAddress Mem  16bit 0xfeed
            1  2│ Measured   Mem  16bit 0xcafe
        `)
      })
    })
  })

  test(`the input assets without IDs are changed and can borrow the IDs from remote`, async ctx => {
    prepareFakeAssets({
      baseConditions: () => ({
        achievements: {
          21: {
            title: 'first',
            description: 'same',
            conditions: '1=0',
          },
          22: {
            title: 'second',
            description: 'same',
            conditions: '1=0',
          },
        },
        leaderboards: {
          21: {
            title: 'first',
            description: 'same',
            conditions: {
              start: '1=0',
              cancel: '1=0',
              submit: '1=1',
              value: 'M:0xcafe',
            },
          },
          22: {
            title: 'second',
            description: 'same',
            conditions: {
              start: '1=0',
              cancel: '1=0',
              submit: '1=1',
              value: 'M:0xcafe',
            },
          },
        },
      }),
      remote: () => {},
      inputModule() {
        return new AchievementSet({
          gameId: 1234,
          title: 'Set',
        })
          .addAchievement({
            title: 'second',
            description: 'same',
            points: 1,
            conditions: '5=0',
          })
          .addLeaderboard({
            title: 'first',
            description: 'same',
            lowerIsBetter: false,
            type: 'SCORE',
            conditions: {
              start: '5=0',
              cancel: '1=0',
              submit: '1=1',
              value: 'M:0xcafe',
            },
          })
      },
    })

    await runTestCLI(['diff', './mySet.js'])
    ctx.expect(log).toMatchInlineSnapshot(`
      local file ./RACache/Data/1234-User.txt doesn't exist, will not diff against local file
      Assets changed:

        A.ID│ 22 (compared to remote)
       Title│ second
      ──────┼────────────────────────────────────────────────
        Code│ Core
            │ Flag Type  Size Value Cmp Type  Size Value Hits
      ──────┼────────────────────────────────────────────────
        1  -│      Value          1  =  Value          0
        +  1│      Value          5  =  Value          0

        L.ID│ 21 (compared to remote)
       Title│ first
      ──────┼────────────────────────────────────────────────
        Code│ Start - Core
            │ Flag Type  Size Value Cmp Type  Size Value Hits
      ──────┼────────────────────────────────────────────────
        1  -│      Value          1  =  Value          0
        +  1│      Value          5  =  Value          0
    `)
  })

  test('add two achievements and leaderboards, remove achievement and leaderboard, change one achievement', async ctx => {
    const generate = makeAssetGenerator()

    prepareFakeAssets({
      baseConditions: () => ({
        achievements: {
          1: generate.achievement({ id: 1 }),
          3: generate.achievement({ id: 3 }),
        },
        leaderboards: {
          2: generate.leaderboard({ id: 2 }),
          4: generate.leaderboard({ id: 4 }),
        },
      }),
      remote: () => {},
      local: () => {},
      input: ({ base }) => {
        base.achievements[1].conditions = '0xfeed=0xcafe'

        base.achievements[111000001] = generate.achievement({
          title: 'Wooly',
        })

        base.achievements[111000002] = generate.achievement({
          title: 'Kiwi',
        })

        base.leaderboards[111000001] = generate.leaderboard({
          title: 'Wooly Leaderboard',
        })

        base.leaderboards[111000002] = generate.leaderboard({
          title: 'Kiwi Leaderboard',
        })

        delete base.achievements[3]
        delete base.leaderboards[2]
      },
    })

    await runTestCLI(['diff', './mySet.js'])
    ctx.expect(log).toMatchInlineSnapshot(`
      New achievements added:
        Kiwi
        Wooly

      New leaderboards added:
        Kiwi Leaderboard
        Wooly Leaderboard

      Assets changed:

        A.ID│ 1 (compared to local)
       Title│ AchTitle_1
      ──────┼────────────────────────────────────────────────────
        Code│ Core
            │ Flag Type  Size   Value Cmp Type  Size   Value Hits
      ──────┼────────────────────────────────────────────────────
        1  -│      Value            1  =  Value            0
        +  1│      Mem   16bit 0xfeed  =  Mem   16bit 0xcafe
    `)
  })

  test(`one achievement and leaderboard doesn't exist in the local, it will compare against remote`, async ctx => {
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

    prepareFakeAssets({
      baseConditions: () => ({
        achievements: {
          1: genericAchievement,
          3: genericAchievement,
        },
        leaderboards: {
          2: genericLeaderboard,
          4: genericLeaderboard,
        },
      }),
      remote: () => {},
      local: ({ base }) => {
        delete base.achievements[1]
        delete base.leaderboards[2]
      },
      input: ({ base }) => {
        base.achievements[1].conditions = '0xfeed=0xcafe'
        base.achievements[3].conditions = '0xfeed=0xcafe'
        base.leaderboards[2].conditions['start'] = '0xfeed=0xcafe'
      },
    })

    await runTestCLI(['diff', './mySet.js'])
    ctx.expect(log).toMatchInlineSnapshot(`
      Assets changed:

        A.ID│ 3 (compared to local)
       Title│ Ach_3
      ──────┼────────────────────────────────────────────────────
        Code│ Core
            │ Flag Type  Size   Value Cmp Type  Size   Value Hits
      ──────┼────────────────────────────────────────────────────
        1  -│      Value            1  =  Value            0
        +  1│      Mem   16bit 0xfeed  =  Mem   16bit 0xcafe

        A.ID│ 1 (compared to remote)
       Title│ Ach_1
      ──────┼────────────────────────────────────────────────────
        Code│ Core
            │ Flag Type  Size   Value Cmp Type  Size   Value Hits
      ──────┼────────────────────────────────────────────────────
        1  -│      Value            1  =  Value            0
        +  1│      Mem   16bit 0xfeed  =  Mem   16bit 0xcafe

        L.ID│ 2 (compared to remote)
       Title│ Lb_2
      ──────┼────────────────────────────────────────────────────
        Code│ Start - Core
            │ Flag Type  Size   Value Cmp Type  Size   Value Hits
      ──────┼────────────────────────────────────────────────────
        1  -│      Value            1  =  Value            0
        +  1│      Mem   16bit 0xfeed  =  Mem   16bit 0xcafe
    `)
  })

  test('rename achievements and leaderboards, adjust points', async ctx => {
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

    prepareFakeAssets({
      baseConditions: () => ({
        achievements: {
          1: genericAchievement,
          3: genericAchievement,
        },
        leaderboards: {
          2: genericLeaderboard,
          4: genericLeaderboard,
        },
      }),
      remote: () => {},
      local: ({ base }) => {
        delete base.achievements[1]
        delete base.leaderboards[2]
      },
      input: ({ base }) => {
        base.achievements[3].title = 'NewAch3_name'

        base.achievements[1].title = 'NewAch1_name'
        base.achievements[1].points = 25

        base.leaderboards[2].title = 'NewLb2_name'
      },
    })

    await runTestCLI(['diff', './mySet.js'])
    ctx.expect(log).toMatchInlineSnapshot(`
      Assets changed:

        A.ID│ 3 (compared to local)
       Title│ - Ach_3
            │ + NewAch3_name
       Desc.│ Ach_3 description

        A.ID│ 1 (compared to remote)
       Title│ - Ach_1
            │ + NewAch1_name
       Desc.│ Ach_1 description
        Pts.│ 1 -> 25

        L.ID│ 2 (compared to remote)
       Title│ - Lb_2
            │ + NewLb2_name
       Desc.│ Lb_2 description
    `)
  })

  test('change descriptions on achievements and leaderboards, adjust leaderboard type', async ctx => {
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

    prepareFakeAssets({
      baseConditions: () => ({
        achievements: {
          1: genericAchievement,
          3: genericAchievement,
        },
        leaderboards: {
          2: genericLeaderboard,
          4: genericLeaderboard,
        },
      }),
      remote: () => {},
      local: ({ base }) => {
        delete base.achievements[1]
        delete base.leaderboards[2]
      },
      input: ({ base }) => {
        base.achievements[3].description = 'NewAch3_description'

        base.achievements[1].description = 'NewAch1_description'

        base.leaderboards[2].description = 'NewLb2_description'
        base.leaderboards[2].type = 'FRAMES'
        base.leaderboards[2].lowerIsBetter = true
      },
    })

    await runTestCLI(['diff', './mySet.js'])
    ctx.expect(log).toMatchInlineSnapshot(`
      Assets changed:

        A.ID│ 3 (compared to local)
       Title│ Ach_3
       Desc.│ - Ach_3 description
            │ + NewAch3_description

        A.ID│ 1 (compared to remote)
       Title│ Ach_1
       Desc.│ - Ach_1 description
            │ + NewAch1_description

        L.ID│ 2 (compared to remote)
       Title│ Lb_2
       Desc.│ - Lb_2 description
            │ + NewLb2_description
        Type│ SCORE -> FRAMES
        Low?│ false -> true
    `)
  })

  test('tweak achievement badge with legit ID against remote', async ctx => {
    const genericAchievement = {
      conditions: '1=0',
    }

    prepareFakeAssets({
      baseConditions: () => ({
        achievements: {
          1: {
            ...genericAchievement,
            badge: 1234,
          },
          2: {
            ...genericAchievement,
            badge: 1235,
          },
          3: {
            ...genericAchievement,
            badge: '0',
          },
          4: {
            ...genericAchievement,
            badge: 1236,
          },
        },
      }),
      remote: () => {},
      local: ({ base }) => {
        delete base.achievements[1]
        delete base.achievements[2]
        delete base.achievements[3]
        delete base.achievements[4]
      },
      input: ({ base }) => {
        // change expected because proper IDs are changed
        base.achievements[1].badge = 2222

        // change not expected because otherwise local would
        // always try to overwrite remote
        base.achievements[2].badge = 'local\\\\peepy.png'

        // change expected because remote badge is not set
        base.achievements[3].badge = 'local\\\\peepy.png'

        // title change expected, badge change not expected
        base.achievements[4].title = 'new_title'
        base.achievements[4].badge = undefined
      },
    })

    await runTestCLI(['diff', './mySet.js'])
    ctx.expect(log).toMatchInlineSnapshot(`
      Assets changed:

        A.ID│ 1 (compared to remote)
       Title│ Ach_1
       Badge│ 01234 -> 02222

        A.ID│ 3 (compared to remote)
       Title│ Ach_3
       Badge│ 00000 -> local\\\\peepy.png

        A.ID│ 4 (compared to remote)
       Title│ - Ach_4
            │ + new_title
       Desc.│ Ach_4 description
    `)
  })

  test('tweak achievement badge with legit ID against local', async ctx => {
    const genericAchievement = {
      conditions: '1=0',
    }

    prepareFakeAssets({
      baseConditions: () => ({
        achievements: {
          1: {
            ...genericAchievement,
            badge: 1,
          },
          2: {
            ...genericAchievement,
            badge: 2,
          },
          3: {
            ...genericAchievement,
            badge: 3,
          },
          4: {
            id: undefined,
            ...genericAchievement,
            badge: 4,
          },
          5: {
            id: undefined,
            ...genericAchievement,
            badge: 5,
          },
          6: {
            ...genericAchievement,
            badge: 6,
          },
          7: {
            ...genericAchievement,
            badge: 7,
          },
        },
      }),
      remote: ({ base }) => {
        delete base.achievements[4]
        delete base.achievements[5]
      },
      local: ({ base }) => {
        base.achievements[1].badge = 1111
        base.achievements[2].badge = 2222
        base.achievements[3].badge = 3333
      },
      input: ({ base }) => {
        // expected to be removed from local file, badge matches remote one
        base.achievements[1].badge = 1

        // expected to be compared against local file
        base.achievements[2].badge = 2233

        // changes not expected because asset exists in remote
        // and local badge would always try to overwrite it after upload
        base.achievements[3].badge = 'local\\\\peepy.png'

        // change expected because it's only against local
        base.achievements[4].badge = 777
        base.achievements[5].badge = 'local\\\\peepy.png'

        // title change expected
        // badge change not expected (it's already set in remote)
        base.achievements[6].title = 'new_title'
        base.achievements[6].badge = undefined

        base.achievements[7].title = 'new_title'
        base.achievements[7].badge = undefined
        base.achievements[7].id = undefined
      },
    })

    await runTestCLI(['diff', './mySet.js'])
    ctx.expect(log).toMatchInlineSnapshot(
      `
      Assets changed:

        A.ID│ 2 (compared to local)
       Title│ Ach_2
       Badge│ 02222 -> 02233

        A.ID│ 6 (compared to local)
       Title│ - Ach_6
            │ + new_title
       Desc.│ Ach_6 description

        A.ID│ 7 (compared to local)
       Title│ - Ach_7
            │ + new_title
       Desc.│ Ach_7 description

        A.ID│ 111000001 (compared to local)
       Title│ Ach_4
       Badge│ 00004 -> 00777

        A.ID│ 111000002 (compared to local)
       Title│ Ach_5
       Badge│ 00005 -> local\\\\peepy.png
    `,
    )
  })

  test(`moving the condition doesn't result in annoying diffs`, async ctx => {
    prepareFakeAssets({
      baseConditions: () => ({
        achievements: {
          1: {
            conditions: {
              core: [
                ['', 'Mem', '8bit', 0x34444, '=', 'Value', '', 0],
                ['', 'Mem', '8bit', 0x34445, '=', 'Value', '', 0],
                ['', 'Mem', '8bit', 0x34446, '=', 'Value', '', 0],
                ['', 'Mem', '8bit', 0x34446, '=', 'Value', '', 0],
                ['', 'Mem', '8bit', 0x34446, '=', 'Value', '', 0],
                ['', 'Mem', '8bit', 0x34446, '=', 'Value', '', 0],
                ['', 'Mem', '8bit', 0x34446, '=', 'Value', '', 0],
                ['', 'Mem', '8bit', 0x34446, '=', 'Value', '', 0],
                ['', 'Mem', '8bit', 0x34447, '=', 'Value', '', 0],
                ['', 'Mem', '8bit', 0x34449, '=', 'Value', '', 0],
                ['', 'Mem', '8bit', 0x3444b, '=', 'Value', '', 0],
              ],
            },
          },
        },
      }),
      remote: () => {},
      input: ({ base }) => {
        const firstCondition = base.achievements[1].conditions['core'].shift()
        base.achievements[1].conditions['core'].push(firstCondition)
      },
    })

    await runTestCLI(['diff', './mySet.js'])
    ctx.expect(log).toMatchInlineSnapshot(`
      local file ./RACache/Data/1234-User.txt doesn't exist, will not diff against local file
      Assets changed:

         A.ID│ 1 (compared to remote)
        Title│ Ach_1
      ───────┼─────────────────────────────────────────────────
         Code│ Core
             │ Flag Type Size   Value Cmp Type  Size Value Hits
      ───────┼─────────────────────────────────────────────────
        1   -│      Mem  8bit 0x34444  =  Value          0
        2   1│      Mem  8bit 0x34445  =  Value          0
       ······│
       11  10│      Mem  8bit 0x3444b  =  Value          0
        +  11│      Mem  8bit 0x34444  =  Value          0
    `)
  })

  test(`different order of assets in the input doesn't cause unnecessary/wrong diffs`, async ctx => {
    prepareFakeAssets({
      baseConditions: () => ({
        achievements: {
          1: {
            id: undefined,
            title: 'First',
            description: 'Description',
            conditions: [
              ['', 'Mem', '8bit', 0x34444, '=', 'Value', '', 0],
              ['', 'Mem', '8bit', 0x34445, '=', 'Value', '', 0],
            ],
          },
          2: {
            id: undefined,
            title: 'Second',
            description: 'Description',
            conditions: [
              ['', 'Mem', '8bit', 0xcafe, '=', 'Value', '', 0],
              ['', 'Mem', '8bit', 0xfeed, '=', 'Value', '', 0],
            ],
          },
        },
      }),
      local: () => {},
      remote: ({ base }) => {
        delete base.achievements[1]
        delete base.achievements[2]
      },
      input: ({ base }) => {
        ;[base.achievements[1], base.achievements[2]] = [base.achievements[2], base.achievements[1]]
      },
    })

    await runTestCLI(['diff', './mySet.js'])
    ctx.expect(log).toMatchInlineSnapshot('no changes found')
  })

  test('adding new asset with only different title/description should not match against existing asset', async ctx => {
    prepareFakeAssets({
      baseConditions: () => ({
        achievements: {
          111000008: {
            title: 'Title',
            description: 'Description',
            conditions: '1=0',
          },
        },
      }),
      remote: ({ base }) => {
        delete base.achievements[111000008]
      },
      local: () => {},
      input: ({ base }) => {
        base.achievements[111000009] = {
          title: 'NewTitle',
          description: 'Description',
          conditions: '1=0',
        }
      },
    })

    await runTestCLI(['diff', './mySet.js'])
    ctx.expect(log).toMatchInlineSnapshot(`
      New achievements added:
        NewTitle
    `)
  })

  test(`collisions between leaderboards and achievements in titles/descriptions do not cause crashes`, async ctx => {
    prepareFakeAssets({
      baseConditions: () => ({
        achievements: {},
        leaderboards: {
          3: {
            title: 'Third',
            description: 'Description',
            lowerIsBetter: false,
            type: 'SCORE',
            conditions: {
              start: '1=0',
              cancel: '1=0',
              submit: '1=1',
              value: 'M:0xcafe',
            },
          },
        },
      }),
      remote: () => {},
      input: ({ base }) => {
        base.achievements[111000001] = {
          title: 'Third',
          description: 'Description',
          conditions: [['', 'Mem', '8bit', 0xcaf1, '=', 'Value', '', 0]],
        }
      },
    })

    await runTestCLI(['diff', './mySet.js'])
    ctx.expect(log).toMatchInlineSnapshot(`
      local file ./RACache/Data/1234-User.txt doesn't exist, will not diff against local file
      New achievements added:
        Third
    `)
  })

  test(`negative integer values are shown with minus sign if they're greater or equal than -4096`, async ctx => {
    prepareFakeAssets({
      baseConditions: () => ({
        achievements: {
          1: {
            conditions: ['1=1', '1=2'],
          },
        },
      }),
      remote: () => {},
      input: ({ base }) => {
        base.achievements[1].conditions = ['1=-1', '1=-hFFF', '1=-4096', '1=-4097']
      },
    })

    await runTestCLI(['diff', './mySet.js'])
    ctx.expect(log).toMatchInlineSnapshot(`
      local file ./RACache/Data/1234-User.txt doesn't exist, will not diff against local file
      Assets changed:

        A.ID│ 1 (compared to remote)
       Title│ Ach_1
      ──────┼─────────────────────────────────────────────────────
        Code│ Core
            │ Flag Type  Size Value Cmp Type  Size      Value Hits
      ──────┼─────────────────────────────────────────────────────
        1  -│      Value          1  =  Value               1
        2  -│      Value          1  =  Value               2
        +  1│      Value          1  =  Value              -1
        +  2│      Value          1  =  Value           -4095
        +  3│      Value          1  =  Value           -4096
        +  4│      Value          1  =  Value      0xffffefff
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
      .expect(runTestCLI(['diff', './mySet.js']))
      .rejects.toThrowErrorMatchingInlineSnapshot(
        `[Error: Core, condition 1: expected a legal condition flag, but got ":"]`,
      )
    // TODO: should this be empty?
    ctx.expect(log).toMatchInlineSnapshot('')
  })
})
