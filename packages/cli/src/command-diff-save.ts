import * as path from 'path'
import * as util from 'util'
import { log, confirm, resolveRACache, achievementSetImport } from './mockable.js'

import {
  AssetFilter,
  calculateSetChanges,
  extractAchievementSetFromModule,
  getLocalData,
  remoteRefetchRecommendation,
} from './util.js'
import { diffExecute } from './command-diff.js'
import { saveExecute } from './command-save.js'
import { getSetFromRemote } from './command-fetch.js'
import { logWarnings } from './lint.js'

export default async function diffSave(
  inputFilePath: string,
  opts: {
    excludeUnofficial?: boolean
    contextLines?: number
    timeout?: number
    forceRewrite?: boolean
    filter?: AssetFilter[]
  },
) {
  const { excludeUnofficial, contextLines, forceRewrite, filter = [], timeout = 1000 } = opts

  const absoluteModulePath = path.resolve(inputFilePath)
  const module = await achievementSetImport(absoluteModulePath)
  const inputSet = await extractAchievementSetFromModule(module, absoluteModulePath)

  const achievementCount = Object.keys(inputSet.achievements).length
  const leaderboardCount = Object.keys(inputSet.leaderboards).length
  const inputSetIsEmpty = achievementCount === 0 && leaderboardCount === 0
  if (inputSetIsEmpty) {
    log(
      util.styleText(
        'yellowBright',
        `set doesn't define any achievements or leaderboards, diff-save aborted`,
      ),
    )
    return
  }

  try {
    var localData = getLocalData({ gameId: inputSet.gameId, throwOnFirstError: true })
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
    var remoteSet = await getSetFromRemote({
      gameId: inputSet.gameId,
      setId: inputSet.id,
      excludeUnofficial,
      timeout,
    })
  } catch (err) {
    log(util.styleText('redBright', `remote data got issues, cannot proceed with the diff-save`))
    log(util.styleText('yellowBright', remoteRefetchRecommendation))
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
      outputFilePath: resolveRACache(`./RACache/Data/${inputSet.gameId}-User.txt`),
    })
  }
}
