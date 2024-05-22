import { describe, expect, test } from 'vitest'
import { Achievement, AchievementSet, Leaderboard } from '../index.js'
import { eatSymbols } from '../util.js'
import { giveValuesNotMatching } from './test-util.js'

function makeAchievementInput(title: string, id?: number) {
  return {
    id,
    title,
    description: 'AchievementDescription',
    author: 'cheeseburger',
    points: 25,
    conditions: '1=0',
  }
}

function makeLeaderboardInput(title: string, id?: number) {
  return {
    id,
    title,
    description: 'LeaderboardtDescription',
    lowerIsBetter: false,
    type: 'FRAMES' as Leaderboard.Type,
    conditions: {
      start: '0=1',
      cancel: '0=1',
      submit: '0xCAFE=47',
      value: 'M:0xXfeed',
    },
  }
}

function validateIdOrder(set: AchievementSet, ids: string[]) {
  const inputIds = set
    .toString()
    .split('\n')
    .slice(2)
    .slice(0, -1)
    .map(line => line.match(/^L?(\d+)/)[1])

  expect(inputIds).toEqual(ids)
}

function validateNameToIdMatch(
  set: Record<string, Achievement | Leaderboard>,
  expectations: Record<string, string>,
) {
  expect(
    Object.entries(set).reduce((prev, [id, piece]) => {
      prev[piece.title] = id
      return prev
    }, {}),
  ).toEqual(expectations)
}

describe('Achievement Set', () => {
  test('add achievements and leaderboards', () => {
    const achievements = {
      111000001:
        '111000001:"1=0":"Achievement:Name":AchievementDescription::::cheeseburger:25:::::12345',

      111000002: '111000002:"5=7":Kiwi:AchievementDescription::::cheeseburger:25:::::12345',
    }

    const leaderboards = {
      111000001:
        'L111000001:"0xHcafe=47_d0xHcafe=0":"0=1":"0xHcafe=48":"M:0xXfeed":SCORE:Name:Description:0',
      111000002:
        'L111000002:"0xHfeed=47_d0xHfeed=0":"0=1":"0xHfeed=48":"M:0xXcafe$M:0xXfeed":SCORE:Name2:Description2:1',
    }

    const set = new AchievementSet({ gameId: 1, title: 'GameName' })
      .addAchievement({
        id: 111000002,
        title: 'Kiwi',
        description: 'AchievementDescription',
        author: 'cheeseburger',
        points: 25,
        conditions: [['', 'Value', '', 5, '=', 'Value', '', 7]],
        badge: '12345',
      })
      .addAchievement(achievements[111000001])
      .addLeaderboard({
        id: 111000002,
        lowerIsBetter: true,
        title: 'Name2',
        description: 'Description2',
        type: 'SCORE',
        conditions: {
          start: '0xHfeed=47_d0xHfeed=0',
          cancel: '0=1',
          submit: '0xHfeed=48',
          value: {
            core: 'M:0xXcafe',
            alt1: 'M:0xXfeed',
          },
        },
      })
      .addLeaderboard(leaderboards[111000001])

    // Notice that ids are sorted ascending, compared to
    // order they were defined originally
    expect(set.toString()).toBe(
      [
        '1.0',
        'GameName',
        achievements[111000001],
        achievements[111000002],
        leaderboards[111000001],
        leaderboards[111000002],
        '',
      ].join('\n'),
    )
  })

  test('adding achievements with autoincrement id', () => {
    const set = new AchievementSet({ gameId: 1, title: 'GameName' })

    set.addAchievement(makeAchievementInput('Ach1'))
    set.addAchievement(makeAchievementInput('Ach2'))
    set.addAchievement(makeAchievementInput('Ach3', 47))
    set.addAchievement(
      new Achievement(makeAchievementInput('Ach4', 111000008) as Achievement.Input).toString(),
    )
    set.addAchievement(makeAchievementInput('Ach5'))

    validateIdOrder(set, ['47', '111000001', '111000002', '111000008', '111000009'])
    validateNameToIdMatch(set.achievements, {
      Ach1: '111000001',
      Ach2: '111000002',
      Ach3: '47',
      Ach4: '111000008',
      Ach5: '111000009',
    })
  })

  test('adding leaderboards with autoincrement id', () => {
    const set = new AchievementSet({ gameId: 1, title: 'GameName' })

    set.addLeaderboard(makeLeaderboardInput('Lb1'))
    set.addLeaderboard(makeLeaderboardInput('Lb2'))
    set.addLeaderboard(makeLeaderboardInput('Lb3', 47))
    set.addLeaderboard(
      new Leaderboard(makeLeaderboardInput('Lb4', 111000008) as Leaderboard.Input).toString(),
    )
    set.addLeaderboard(makeLeaderboardInput('Lb5'))

    validateIdOrder(set, ['47', '111000001', '111000002', '111000008', '111000009'])
    validateNameToIdMatch(set.leaderboards, {
      Lb1: '111000001',
      Lb2: '111000002',
      Lb3: '47',
      Lb4: '111000008',
      Lb5: '111000009',
    })
  })

  test('not allowed to define achievements with same id', () => {
    const set = new AchievementSet({ gameId: 1, title: 'Sample' })
      .addLeaderboard(makeLeaderboardInput('Lb1'))
      .addAchievement(makeAchievementInput('Ach1'))

    expect(() => set.addAchievement(makeAchievementInput('Ach2', 111000001))).toThrowError(
      `achievement with id 111000001: "Ach1", already exists`,
    )
  })

  test('not allowed to define leaderboards with same id', () => {
    const set = new AchievementSet({ gameId: 1, title: 'Sample' })
      .addAchievement(makeAchievementInput('Ach1'))
      .addLeaderboard(makeLeaderboardInput('Lb1'))

    expect(() => set.addLeaderboard(makeLeaderboardInput('Lb2', 111000001))).toThrowError(
      `leaderboard with id 111000001: "Lb1", already exists`,
    )
  })

  describe('validations', () => {
    describe('id', () => {
      giveValuesNotMatching('number', t => {
        test(t.assertion, () => {
          expect(() => new AchievementSet({ gameId: t.value, title: 'Sample' })).toThrowError(
            t.type === 'type-check'
              ? eatSymbols`expected gameId as unsigned integer, but got ${t.value}`
              : /^expected gameId to be within the range/,
          )
        })
      })
    })

    describe('name', () => {
      giveValuesNotMatching(['string'], t => {
        test(t.assertion, () => {
          expect(() => new AchievementSet({ gameId: 1, title: t.value })).toThrowError(
            eatSymbols`expected achievement set title as non-empty string, but got ${t.value}`,
          )
        })
      })
    })

    test('cannot be empty string', () => {
      expect(() => new AchievementSet({ gameId: 1, title: '' })).toThrowError(
        `expected achievement set title as non-empty string, but got ""`,
      )

      expect(() => new AchievementSet({ gameId: 1, title: '  ' })).toThrowError(
        `expected achievement set title as non-empty string, but got "  "`,
      )
    })
  })
})
