import { Achievement, AchievementSet, Leaderboard } from '@cruncheevos/core'
import { wrappedError } from '@cruncheevos/core/util'

import { getFs, log, resolveRACache } from './mockable.js'
const fs = getFs()

type UnixTime = number

interface RemoteAchievement {
  ID: number
  MemAddr: string
  Title: string
  Description: string
  Points: number
  Author: string
  Modified: UnixTime
  Created: UnixTime
  BadgeName: string
  Flags: number
  Type: Achievement.Type
}

interface RemoteLeaderboard {
  ID: number
  Mem: string
  Format: Leaderboard.Type
  LowerIsBetter: boolean | number
  Title: string
  Description: string
  Hidden: boolean
}

interface RemoteDataLegacy {
  ID: number
  Title: string
  RichPresencePatch: string
  Achievements: RemoteAchievement[]
  Leaderboards: RemoteLeaderboard[]
}

export interface RemoteData {
  Success: boolean
  Title: string
  Sets: Array<{
    Title: string
    GameId: number
    AchievementSetId: number
    Type: 'core'
    Achievements: RemoteAchievement[]
    Leaderboards: RemoteLeaderboard[]
  }>
}

let cachedCredentials: {
  username: string
  token: string
}

function getCredentials() {
  if (cachedCredentials) {
    return cachedCredentials
  }

  const configFile = fs
    .readdirSync(resolveRACache('./'))
    .filter(x => x.match(/^raprefs.*\.cfg$/i))[0]

  if (!configFile) {
    throw new Error(`expected RAPrefs.cfg file, but found none`)
  }

  const configJSON = fs.readFileSync(resolveRACache(`./${configFile}`)).toString()
  try {
    var config = JSON.parse(configJSON)
  } catch (err) {
    throw wrappedError(err, `${configFile}: ${err.message}`)
  }

  if (!config.Username) {
    throw new Error(
      `${configFile}: expected Username property as string, but got ${config.Username}`,
    )
  }

  if (!config.Token) {
    throw new Error(`${configFile}: expected Token property as string, but got ${config.Token}`)
  }

  cachedCredentials = {
    username: config.Username,
    token: config.Token,
  }
  return cachedCredentials
}

async function fetchRemoteData(opts: {
  gameId: number | string
  timeout: number
}): Promise<RemoteData> {
  const { gameId, timeout } = opts

  const { username, token } = getCredentials()

  const abortController = new AbortController()

  const timeoutHandle = setTimeout(() => abortController.abort(), timeout)
  const payload = await fetch(
    `https://retroachievements.org/dorequest.php?r=achievementsets&t=${token}&u=${username}&g=${gameId}`,
    {
      headers: {
        'User-Agent': 'cruncheevos-cli',
      },
      signal: abortController.signal,
    },
  )
    .then(x => {
      if (x.ok) {
        return x.json() as Promise<RemoteData>
      } else {
        throw new Error(`failed to fetch remote data: HTTP ${x.status}`)
      }
    })
    .catch(err => {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw wrappedError(err, `failed to fetch remote data: timed out`)
      } else {
        throw err
      }
    })
    .finally(() => clearTimeout(timeoutHandle))

  if (payload.Success !== true) {
    throw new Error(
      `failed to fetch remote data: expected payload.Success to be true, but got ${payload.Success}`,
    )
  }
  return payload
}

export default async function fetchAssets(opts: { gameId: number; timeout: number }) {
  const { gameId } = opts
  log(`fetching remote data for gameId ${gameId}`)
  const gameData = await fetchRemoteData(opts)

  const filePath = resolveRACache(`./RACache/Data/${gameId}.json`)
  fs.writeFileSync(filePath, JSON.stringify(gameData))

  log(`dumped remote data for gameId ${gameId}: ${filePath}`)

  return gameData
}

export async function getRemoteData({ gameId, timeout }: { gameId: number; timeout: number }) {
  const filePath = resolveRACache(`./RACache/Data/${gameId}.json`)
  if (fs.existsSync(filePath) === false) {
    return fetchAssets({
      gameId,
      timeout,
    })
  }

  const parsed = JSON.parse(fs.readFileSync(filePath).toString()) as RemoteData | RemoteDataLegacy
  if ('Sets' in parsed === false) {
    return {
      ...parsed,
      Success: true,
      Sets: [
        {
          Title: parsed.Title,
          GameId: parsed.ID,
          AchievementSetId: parsed.ID,
          Type: 'core',
          Achievements: parsed.Achievements,
          Leaderboards: parsed.Leaderboards,
        },
      ],
    } as RemoteData
  }

  return parsed as RemoteData
}

export function getSetFromRemoteData(remoteData: RemoteData, setId?: number) {
  if (setId) {
    return remoteData.Sets.find(set => set.AchievementSetId === setId)
  }

  return remoteData.Sets.find(set => set.Type === 'core')
}

// TODO: add support for setId
export async function getSetFromRemote(opts: {
  gameId: number
  setId?: number
  excludeUnofficial: boolean
  timeout: number
}) {
  const { gameId, setId } = opts

  const remoteData = await getRemoteData(opts)
  const { Achievements, Leaderboards } = getSetFromRemoteData(remoteData, setId)

  const set = new AchievementSet({
    gameId,
    id: setId,
    title: remoteData.Title,
  })

  Achievements.forEach((ach, i) => {
    if (ach.Flags === 5 && opts.excludeUnofficial) {
      return
    }

    if (ach.Flags !== 3 && ach.Flags !== 5) {
      return
    }

    try {
      set.addAchievement({
        id: ach.ID,
        title: ach.Title,
        description: ach.Description,
        points: ach.Points,
        type: ach.Type || '',
        author: ach.Author,
        badge: ach.BadgeName,
        conditions: ach.MemAddr,
      })
    } catch (err) {
      throw wrappedError(err, `Achievements[${i}]: ${err.message}`)
    }
  })

  Leaderboards.forEach((lb, i) => {
    if (lb.Hidden && opts.excludeUnofficial) {
      return
    }

    const leaderboardType: Leaderboard.Type = lb.Format === 'TIME' ? 'FRAMES' : lb.Format

    try {
      set.addLeaderboard({
        id: lb.ID,
        title: lb.Title,
        description: lb.Description,
        lowerIsBetter: Boolean(lb.LowerIsBetter),
        conditions: lb.Mem,
        type: leaderboardType,
      })
    } catch (err) {
      throw wrappedError(err, `Leaderboards[${i}]: ${err.message}`)
    }
  })

  return set
}
