import { Achievement, Leaderboard } from '@cruncheevos/core'
import * as path from 'path'
import * as util from 'util'

import { achievementSetImport, getFs, log, resolveRACache } from './mockable.js'
const fs = getFs()

import {
  AssetFilter,
  calculateSetChanges,
  extractAchievementSetFromModule,
  getLocalData,
  remoteRefetchRecommendation,
} from './util.js'
import { getSetFromRemote } from './command-fetch.js'
import { logWarnings } from './lint.js'

import * as os from 'os'
import { AchievementSet } from '@cruncheevos/core'

function makeUpdateStats(ops: ReturnType<typeof calculateSetChanges>) {
  const { updateInLocal, addToLocalByRemoteMatch, addToLocalFromScratch, removeFromLocal } = ops
  const achievementsUpdated = [...updateInLocal, ...addToLocalByRemoteMatch].filter(
    x => x.modified instanceof Achievement,
  ).length
  const leaderboardsUpdated = [...updateInLocal, ...addToLocalByRemoteMatch].filter(
    x => x.modified instanceof Leaderboard,
  ).length
  const achievementsAdded = addToLocalFromScratch.filter(x => x instanceof Achievement).length
  const leaderboardsAdded = addToLocalFromScratch.filter(x => x instanceof Leaderboard).length

  const achievementsRemovedFromLocal = removeFromLocal.filter(x => x instanceof Achievement).length
  const leaderboardsRemovedFromLocal = removeFromLocal.filter(x => x instanceof Leaderboard).length

  const updateStats = (
    [
      [
        'added',
        [
          [achievementsAdded, 'achievement'],
          [leaderboardsAdded, 'leaderboard'],
        ],
      ],
      [
        'updated',
        [
          [achievementsUpdated, 'achievement'],
          [leaderboardsUpdated, 'leaderboard'],
        ],
      ],
      [
        'removed from local (similar to remote)',
        [
          [achievementsRemovedFromLocal, 'achievement'],
          [leaderboardsRemovedFromLocal, 'leaderboard'],
        ],
      ],
    ] as const
  )
    .map(([header, stats]) => {
      const statStrings = stats
        .filter(([count]) => count > 0)
        .map(([count, statName]) => {
          const pluralSuffix = count > 1 ? 's' : ''
          return count + ' ' + statName + pluralSuffix
        })

      if (statStrings.length === 0) {
        return ''
      }

      return header + ': ' + statStrings.join(', ')
    })
    .filter(Boolean)
    .join('\n')

  return updateStats
}

const assetIdRegex = /(.+?):/
function sortLocalDataById(a: string, b: string) {
  const aId = Number(a.match(assetIdRegex)[1])
  const bId = Number(b.match(assetIdRegex)[1])
  return aId - bId
}

export function saveExecute({
  changes,
  localData,
  inputSet,
  outputFilePath,
}: {
  outputFilePath: string
  changes: ReturnType<typeof calculateSetChanges>
  localData: ReturnType<typeof getLocalData>
  inputSet: AchievementSet
}) {
  const eol = localData ? localData.eol : os.EOL

  const sortedAchievementLines = changes.newLocalFileLines
    .filter(x => x.startsWith('L') === false)
    .sort(sortLocalDataById)

  const sortedLeaderboardLines = changes.newLocalFileLines
    .filter(x => x.startsWith('L'))
    .sort(sortLocalDataById)

  const codeNoteLines = localData?.entries.filter(x => x.type === 'codenote').map(x => x.line) || []

  fs.writeFileSync(
    outputFilePath,
    [
      localData?.version || '1.0',
      localData?.title || inputSet.title,
      ...sortedAchievementLines,
      ...sortedLeaderboardLines,
      ...codeNoteLines,
    ].join(eol) + eol,
  )
  log(`dumped local data for gameId: ${inputSet.gameId}: ${outputFilePath}`)

  const updateStats = makeUpdateStats(changes)
  if (updateStats) {
    log(updateStats)
  }
}

export default async function save(
  inputFilePath: string,
  opts: {
    excludeUnofficial?: boolean
    timeout?: number
    forceRewrite?: boolean
    filter?: AssetFilter[]
  },
) {
  const { excludeUnofficial, forceRewrite, filter = [], timeout = 1000 } = opts

  const absoluteModulePath = path.resolve(inputFilePath)
  const module = await achievementSetImport(absoluteModulePath)
  const inputSet = await extractAchievementSetFromModule(module, absoluteModulePath)
  const { gameId } = inputSet

  const achievementCount = Object.keys(inputSet.achievements).length
  const leaderboardCount = Object.keys(inputSet.leaderboards).length
  const inputSetIsEmpty = achievementCount === 0 && leaderboardCount === 0
  if (inputSetIsEmpty) {
    log(
      util.styleText(
        'yellowBright',
        `set doesn't define any achievements or leaderboards, save aborted`,
      ),
    )
    return
  }

  try {
    var localData = getLocalData({ gameId, throwOnFirstError: true })
  } catch (err) {
    if (!forceRewrite) {
      log(util.styleText('yellowBright', `local file got issues`))
      log(util.styleText('yellowBright', `will not update local file to prevent loss of data`))
      log(
        util.styleText(
          'yellowBright',
          `you can force overwrite local file by specifying --force-rewrite parameter`,
        ),
      )
      throw err
    }
  }

  try {
    var remoteSet = await getSetFromRemote({ gameId, excludeUnofficial, timeout })
  } catch (err) {
    log(util.styleText('redBright', err.message))
    log(util.styleText('redBright', `remote data got issues, cannot proceed with the save`))
    log(util.styleText('yellowBright', remoteRefetchRecommendation))
    throw err
  }

  const changes = calculateSetChanges(inputSet, remoteSet, localData, filter)

  saveExecute({
    changes,
    inputSet,
    localData,
    outputFilePath: resolveRACache(`./RACache/Data/${gameId}-User.txt`),
  })
  logWarnings(inputSet)
}
