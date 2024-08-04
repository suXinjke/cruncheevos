import {
  Achievement,
  AchievementSet,
  Condition,
  Leaderboard,
  RichPresence,
} from '@cruncheevos/core'
import { produce } from 'immer'

import { defaultFiles, vol, achievementSetImportMock } from './test-util.js'

function repeat(conditionString: string, amount: number) {
  return Array.from({ length: amount }, () => conditionString)
}

function repeatGroups(conditionString: string, opts: { groups: number; conditions: number }) {
  const result = {}

  for (let i = 0; i < opts.groups; i++) {
    result[i === 0 ? 'core' : `alt${i}`] = repeat(conditionString, opts.conditions)
  }

  return result as Condition.GroupSet
}

type RepeatFunction = typeof repeat
type RepeatGroupsFunction = typeof repeatGroups

type RenameLater = {
  achievements?: Record<
    number,
    Omit<Achievement.InputObject, 'id' | 'title' | 'points'> &
      Partial<Pick<Achievement.InputObject, 'id' | 'title' | 'points'>> & {
        flags?: number
      }
  >
  leaderboards?: Record<
    number,
    Omit<Leaderboard.InputObject, 'id' | 'title' | 'lowerIsBetter' | 'type'> &
      Partial<Pick<Leaderboard.InputObject, 'id' | 'title' | 'lowerIsBetter' | 'type'>> & {
        hidden?: boolean
      }
  >
}

function conditionsToString(conditions: Condition.GroupNormalized, separator = 'S') {
  return conditions
    .map(group => {
      return group.map(condition => condition.toString()).join('_')
    })
    .join(separator)
}

function makeRemoteMock(id: number, title: string, remote: RenameLater) {
  const payload = {
    ID: id,
    Title: title,
    Flags: 0,
    Achievements: Object.entries(remote.achievements || {}).map(([id, input]) => {
      const title = input.title || `Ach_${id}`
      const description = input.description || `Ach_${id} description`
      const author = 'AchAuthor'
      const points = input.points ?? 1

      const ach = new Achievement({
        id,
        title,
        description,
        points,
        conditions: input.conditions,
      })

      return {
        ID: Number(id),
        Title: title,
        Description: description,
        Points: points,
        Author: author,
        Flags: input.flags ?? 3,
        BadgeName: input.badge || '00000',
        MemAddr: conditionsToString(ach.conditions),
        Type: input.type ?? null,
      }
    }),

    Leaderboards: Object.entries(remote.leaderboards || {}).map(([id, input]) => {
      const title = input.title || `Lb_${id}`
      const description = input.description || `Lb_${id} description`
      const lowerIsBetter = input.lowerIsBetter ?? false
      const type = input.type ?? 'SCORE'

      const lb = new Leaderboard({
        id: Number(id),
        title,
        description,
        lowerIsBetter,
        type,
        conditions: input.conditions,
      })

      return {
        ID: Number(id),
        Title: title,
        Description: description,
        Format: type,
        LowerIsBetter: lowerIsBetter,
        Hidden: input.hidden ?? false,
        Mem: [
          'STA:',
          conditionsToString(lb.conditions.start),
          '::CAN:',
          conditionsToString(lb.conditions.cancel),
          '::SUB:',
          conditionsToString(lb.conditions.submit),
          '::VAL:',
          conditionsToString(lb.conditions.value, '$'),
        ].join(''),
      }
    }),
  }

  return JSON.stringify(payload, null, 2)
}

function makeSet(gameId: number, title: string, setInput: RenameLater) {
  const set = new AchievementSet({
    gameId,
    title,
  })

  for (const achId in setInput.achievements) {
    const input = setInput.achievements[achId]

    const title = input.title || `Ach_${achId}`
    const description = input.description || `Ach_${achId} description`

    set.addAchievement({
      id: 'id' in input ? input.id : Number(achId),
      title,
      description,
      points: input.points ?? 1,
      author: 'AchAuthor',
      conditions: input.conditions,
      badge: input.badge,
      type: input.type,
    })
  }

  for (const lbId in setInput.leaderboards) {
    const input = setInput.leaderboards[lbId]

    const title = input.title || `Lb_${lbId}`
    const description = input.description || `Lb_${lbId} description`

    set.addLeaderboard({
      id: 'id' in input ? input.id : Number(lbId),
      title,
      description,
      lowerIsBetter: input.lowerIsBetter ?? false,
      type: input.type ?? 'SCORE',
      conditions: input.conditions,
    })
  }

  return set
}

function makeLocalMock(id: number, title: string, local: RenameLater) {
  return makeSet(id, title, local).toString()
}

type FakeAssetContext = {
  repeat: RepeatFunction
  repeatGroups: RepeatGroupsFunction
  base: RenameLater
}

// TODO: make it provide generic achievement / leaderboard
export function prepareFakeAssets(
  opts: {
    gameId?: number

    baseConditions?: (opts: Omit<FakeAssetContext, 'base'>) => RenameLater
    remote?: (opts: FakeAssetContext) => void
    local?: (opts: FakeAssetContext) => void
    rich?: string | ReturnType<typeof RichPresence>
  } & (
    | {
        input: (opts: FakeAssetContext) => void
        inputModule?: never
      }
    | {
        input?: never
        inputModule: () => Promise<AchievementSet> | AchievementSet
      }
  ),
) {
  const { gameId = 1234 } = opts
  const title = 'SampleAchievementSet'

  const mockedFiles = {
    ...defaultFiles,
  }

  const base = opts.baseConditions?.({
    repeat,
    repeatGroups,
  }) ?? { achievements: {}, leaderboards: {} }

  const remote =
    opts.remote &&
    produce(base, base =>
      opts.remote({
        base,
        repeat,
        repeatGroups,
      }),
    )
  if (remote) {
    mockedFiles[`./RACache/Data/${gameId}.json`] = makeRemoteMock(gameId, title, remote)
  }

  const local =
    opts.local &&
    produce(base, base =>
      opts.local({
        base,
        repeat,
        repeatGroups,
      }),
    )
  if (local) {
    mockedFiles[`./RACache/Data/${gameId}-User.txt`] = makeLocalMock(gameId, title, local)
  }

  vol.mkdirSync('./RACache/Data', { recursive: true })
  vol.fromJSON(mockedFiles)

  achievementSetImportMock.mockImplementation(async () => {
    const result = {
      default: opts.inputModule
        ? opts.inputModule
        : makeSet(
            gameId,
            title,
            produce(base, base => opts.input({ repeat, repeatGroups, base })),
          ),
    } as {
      default: typeof opts.inputModule
      rich?: string | ReturnType<typeof RichPresence>
    }

    if (opts.hasOwnProperty('rich')) {
      result.rich = opts.rich
    }

    return result
  })
}
