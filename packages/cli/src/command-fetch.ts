import { Achievement, AchievementSet, Leaderboard } from '@cruncheevos/core'
import { wrappedError } from '@cruncheevos/core/util'
import nodeFetch, { AbortError } from 'node-fetch'
import chalk from 'chalk'

import { getFs, log, resolveRACache } from './mockable.js'
const fs = getFs()

type UnixTime = number

export interface RemoteData {
  ID: number
  Title: string
  RichPresencePatch: string
  Achievements: Array<{
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
  }>
  Leaderboards: Array<{
    ID: number
    Mem: string
    Format: Leaderboard.Type
    LowerIsBetter: boolean | number
    Title: string
    Description: string
    Hidden: boolean
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
  const payload = await nodeFetch(
    `https://retroachievements.org/dorequest.php?r=patch&t=${token}&u=${username}&g=${gameId}`,
    {
      headers: {
        'User-Agent': 'cruncheevos-cli',
      },
      signal: abortController.signal,
    },
  )
    .then(x => {
      if (x.ok) {
        return x.json() as Promise<{ Success: boolean; PatchData: RemoteData }>
      } else {
        throw new Error(`failed to fetch remote data: HTTP ${x.status}`)
      }
    })
    .catch(err => {
      if (err instanceof AbortError) {
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

  return payload.PatchData
}

export default async function fetch(opts: { gameId: number; timeout: number }) {
  const { gameId } = opts
  log(`fetching remote data for gameId ${gameId}`)
  const gameData = await fetchRemoteData(opts)

  const filePath = resolveRACache(`./RACache/Data/${gameId}.json`)
  fs.writeFileSync(filePath, JSON.stringify(gameData))

  log(`dumped remote data for gameId ${gameId}: ${filePath}`)

  return gameData
}

export async function getRemoteData({
  gameId,
  refetch,
  timeout,
}: {
  gameId: number
  refetch: boolean
  timeout: number
}) {
  const filePath = resolveRACache(`./RACache/Data/${gameId}.json`)
  if (!refetch && fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath).toString()) as RemoteData
  }

  return fetch({
    gameId,
    timeout,
  })
}

async function _getSetFromRemote(opts: {
  gameId: number
  excludeUnofficial: boolean
  refetch: boolean
  timeout: number
}) {
  const { gameId } = opts

  const gameData = await getRemoteData(opts)

  const set = new AchievementSet({
    gameId,
    title: gameData.Title,
  })

  gameData.Achievements.forEach((ach, i) => {
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

  gameData.Leaderboards.forEach((lb, i) => {
    if (lb.Hidden && opts.excludeUnofficial) {
      return
    }

    const { ID } = lb
    const leaderboardType: Leaderboard.Type = lb.Format === 'TIME' ? 'FRAMES' : lb.Format

    try {
      set.addLeaderboard({
        id: ID,
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

export async function getSetFromRemote(opts: {
  gameId: number
  refetch: boolean
  excludeUnofficial: boolean
  timeout: number
}) {
  const { gameId, excludeUnofficial, refetch, timeout } = opts
  try {
    return await _getSetFromRemote({ gameId, excludeUnofficial, refetch, timeout })
  } catch (err) {
    if (refetch) {
      throw err
    }

    log(chalk.yellowBright(err.message))
    log(chalk.yellowBright(`remote data got issues, will attempt to refetch it`))
    return await _getSetFromRemote({ gameId, excludeUnofficial, refetch: true, timeout })
  }
}
