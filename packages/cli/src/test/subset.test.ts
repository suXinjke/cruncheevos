import { beforeEach, describe, test } from 'vitest'

import { fs, log, stringDiff } from './test-util.js'
import { prepareFakeAssets } from './fake-assets-util.js'
import { AchievementSet } from '@cruncheevos/core'
import { runTestCLI } from '../cli.js'
import prompts from 'prompts'

describe('subset', () => {
  beforeEach(() => {
    log.mockClear()
    prepareFakeAssets({
      gameId: 3050,
      remote: './3050.json',
      local: [
        '1.00',
        'Sample',
        `251873:"2=3":Passed - Learning the Basics of Steering 1:Your first experience of circuit racing on a Beginner's course. Beat the time of 1'49.000::::cruncheevos:1:::::279583`,
        `441899|9517:"2=3":Subset_ach_441899:Description_subset_ach_441899::::cruncheevos:100:::::00000`,
        `L106007|9517:"2=3":"1=2":"1=1":"I:0xX621cb4_I:0xX60_I:0xX8_I:0xX0_M:0xX11dc":FIXED3:"subset_leaderboard_106007":"description_subset_leaderboard_106007":1`,
      ].join('\n'),
      inputModule: function () {
        return new AchievementSet({
          gameId: 3050,
          id: 9517,
          title: 'Subset',
        })
          .addAchievement({
            title: 'Subset_ach_441900',
            description: 'Description_subset_ach_441900',
            points: 10,
            conditions: '5=10',
          })
          .addAchievement({
            title: 'Subset_ach_441899',
            description: 'Description_subset_ach_441899',
            points: 100,
            conditions: '2=3',
          })
          .addAchievement({
            title: 'Subset_ach_new',
            description: 'Description_subset_ach_new',
            points: 10,
            conditions: '0=1',
          })
          .addLeaderboard({
            title: 'subset_leaderboard_106007',
            description: 'description_subset_leaderboard_106007',
            type: 'FIXED2',
            lowerIsBetter: true,
            conditions: {
              start: '2=3',
              cancel: '1=2',
              submit: '1=1',
              value: 'I:0xX621cb4_I:0xX60_I:0xX8_I:0xX0_M:0xX11dc',
            },
          })
          .addLeaderboard({
            title: 'subset_leaderboard_new',
            description: 'subset_leaderboadrd_description_new',
            type: 'FIXED3',
            lowerIsBetter: true,
            conditions: {
              start: '0=1',
              cancel: '0=1',
              submit: '1=1',
              value: 'M:0xX621cb4',
            },
          })
      },
    })
  })

  test('works with diff', async ctx => {
    await runTestCLI(['diff', './mySet.js'])

    ctx.expect(log).toMatchInlineSnapshot(`
      New achievements added:
        Subset_ach_new

      New leaderboards added:
        subset_leaderboard_new

      Assets changed:

        L.ID│ 106007 (compared to local)
       Title│ subset_leaderboard_106007
        Type│ FIXED3 -> FIXED2

        A.ID│ 441900 (compared to remote)
       Title│ Subset_ach_441900
        Pts.│ 25 -> 10
      ──────┼────────────────────────────────────────────────
        Code│ Core
            │ Flag Type  Size Value Cmp Type  Size Value Hits
      ──────┼────────────────────────────────────────────────
        1  -│      Value          0  =  Value          1
        +  1│      Value          5  =  Value         10
    `)
  })

  test('works with save', async ctx => {
    const before = fs.readFileSync('./RACache/Data/3050-User.txt').toString().split('\n')

    prompts.inject([true])
    await runTestCLI(['save', './mySet.js'])

    ctx.expect(log).toMatchInlineSnapshot(`
      dumped local data for gameId: 3050: ./RACache/Data/3050-User.txt
      added: 1 achievement, 1 leaderboard
      updated: 1 achievement, 1 leaderboard
    `)

    const after = fs.readFileSync('./RACache/Data/3050-User.txt').toString().split('\n')
    ctx.expect(stringDiff(before, after)).toMatchInlineSnapshot(`
      "  1.00
        Sample
        251873:"2=3":Passed - Learning the Basics of Steering 1:Your first experience of circuit racing on a Beginner's course. Beat the time of 1'49.000::::cruncheevos:1:::::279583
        441899|9517:"2=3":Subset_ach_441899:Description_subset_ach_441899::::cruncheevos:100:::::00000
      - L106007|9517:"2=3":"1=2":"1=1":"I:0xX621cb4_I:0xX60_I:0xX8_I:0xX0_M:0xX11dc":FIXED3:"subset_leaderboard_106007":"description_subset_leaderboard_106007":1
      + 441900|9517:"5=10":Subset_ach_441900:Description_subset_ach_441900::::cruncheevos:10:::::498871
      + 111000001|9517:"0=1":Subset_ach_new:Description_subset_ach_new::::cruncheevos:10:::::00000
      + L106007|9517:"2=3":"1=2":"1=1":"I:0xX621cb4_I:0xX60_I:0xX8_I:0xX0_M:0xX11dc":FIXED2:subset_leaderboard_106007:description_subset_leaderboard_106007:1
      + L111000001|9517:"0=1":"0=1":"1=1":"M:0xX621cb4":FIXED3:subset_leaderboard_new:subset_leaderboadrd_description_new:1
      + "
    `)
  })

  test('works with diff-save', async ctx => {
    const before = fs.readFileSync('./RACache/Data/3050-User.txt').toString().split('\n')

    prompts.inject([true])
    await runTestCLI(['diff-save', './mySet.js'])

    ctx.expect(log).toMatchInlineSnapshot(`
      New achievements added:
        Subset_ach_new

      New leaderboards added:
        subset_leaderboard_new

      Assets changed:

        L.ID│ 106007 (compared to local)
       Title│ subset_leaderboard_106007
        Type│ FIXED3 -> FIXED2

        A.ID│ 441900 (compared to remote)
       Title│ Subset_ach_441900
        Pts.│ 25 -> 10
      ──────┼────────────────────────────────────────────────
        Code│ Core
            │ Flag Type  Size Value Cmp Type  Size Value Hits
      ──────┼────────────────────────────────────────────────
        1  -│      Value          0  =  Value          1
        +  1│      Value          5  =  Value         10

      Proceed to save changes to local file? [y/N]
      dumped local data for gameId: 3050: ./RACache/Data/3050-User.txt
      added: 1 achievement, 1 leaderboard
      updated: 1 achievement, 1 leaderboard
    `)

    const after = fs.readFileSync('./RACache/Data/3050-User.txt').toString().split('\n')
    ctx.expect(stringDiff(before, after)).toMatchInlineSnapshot(`
      "  1.00
        Sample
        251873:"2=3":Passed - Learning the Basics of Steering 1:Your first experience of circuit racing on a Beginner's course. Beat the time of 1'49.000::::cruncheevos:1:::::279583
        441899|9517:"2=3":Subset_ach_441899:Description_subset_ach_441899::::cruncheevos:100:::::00000
      - L106007|9517:"2=3":"1=2":"1=1":"I:0xX621cb4_I:0xX60_I:0xX8_I:0xX0_M:0xX11dc":FIXED3:"subset_leaderboard_106007":"description_subset_leaderboard_106007":1
      + 441900|9517:"5=10":Subset_ach_441900:Description_subset_ach_441900::::cruncheevos:10:::::498871
      + 111000001|9517:"0=1":Subset_ach_new:Description_subset_ach_new::::cruncheevos:10:::::00000
      + L106007|9517:"2=3":"1=2":"1=1":"I:0xX621cb4_I:0xX60_I:0xX8_I:0xX0_M:0xX11dc":FIXED2:subset_leaderboard_106007:description_subset_leaderboard_106007:1
      + L111000001|9517:"0=1":"0=1":"1=1":"M:0xX621cb4":FIXED3:subset_leaderboard_new:subset_leaderboadrd_description_new:1
      + "
    `)
  })
})
