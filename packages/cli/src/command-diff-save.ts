import chalk from 'chalk'

import * as path from 'path'
import { log, confirm, resolveRACache, achievementSetImport } from './mockable.js'

import {
  AssetFilter,
  calculateSetChanges,
  extractAchievementSetFromModule,
  getLocalData,
} from './util.js'
import { diffExecute } from './command-diff.js'
import { saveExecute } from './command-save.js'
import { getSetFromRemote } from './command-fetch.js'
import { logWarnings } from './lint.js'

export default async function diffSave(
  inputFilePath: string,
  opts: {
    refetch?: boolean
    excludeUnofficial?: boolean
    contextLines?: number
    timeout?: number
    forceRewrite?: boolean
    filter?: AssetFilter[]
  },
) {
  const {
    refetch,
    excludeUnofficial,
    contextLines,
    forceRewrite,
    filter = [],
    timeout = 1000,
  } = opts

  const absoluteModulePath = path.resolve(inputFilePath)
  const module = await achievementSetImport(absoluteModulePath)
  const inputSet = await extractAchievementSetFromModule(module, absoluteModulePath)
  const { gameId } = inputSet

  const achievementCount = Object.keys(inputSet.achievements).length
  const leaderboardCount = Object.keys(inputSet.leaderboards).length
  const inputSetIsEmpty = achievementCount === 0 && leaderboardCount === 0
  if (inputSetIsEmpty) {
    log(
      chalk.yellowBright(`set doesn't define any achievements or leaderboards, diff-save aborted`),
    )
    return
  }

  try {
    var localData = getLocalData({ gameId, throwOnFirstError: true })
  } catch (err) {
    if (!forceRewrite) {
      log(chalk.yellowBright(`local file got issues`))
      log(chalk.yellowBright(`will not update local file to prevent loss of data`))
      log(
        chalk.yellowBright(
          `you can force overwrite local file by specifying --force-rewrite parameter`,
        ),
      )
      throw err
    }
  }

  try {
    var remoteSet = await getSetFromRemote({ gameId, excludeUnofficial, refetch, timeout })
  } catch (err) {
    log(chalk.redBright(`remote data got issues, cannot proceed with the diff-save`))
    throw err
  }

  const changes = calculateSetChanges(inputSet, remoteSet, localData, filter)

  const { hasChanges } = diffExecute({
    changes,
    contextLines,
  })

  logWarnings(inputSet)

  if (hasChanges === false) {
    return
  }

  const agreeToSave = await confirm('Proceed to save changes to local file?')

  if (agreeToSave) {
    saveExecute({
      changes,
      inputSet,
      localData,
      outputFilePath: resolveRACache(`./RACache/Data/${gameId}-User.txt`),
    })
  }
}
