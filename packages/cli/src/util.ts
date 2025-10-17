import { Achievement, AchievementSet, Leaderboard, Condition } from '@cruncheevos/core'
import chalk from 'chalk'

const fs = getFs()
import { getFs, log, resolveRACache } from './mockable.js'
import { wrappedError, Asset, AssetData } from '@cruncheevos/core/util'

function conditionGroupSetsAreSame(
  groupSetOriginal: Condition.GroupNormalized,
  groupSetModified: Condition.GroupNormalized,
) {
  if (groupSetOriginal.length !== groupSetModified.length) {
    return false
  }

  for (let groupSetIndex = 0; groupSetIndex < groupSetOriginal.length; groupSetIndex++) {
    const groupOriginal = groupSetOriginal[groupSetIndex]
    const groupModified = groupSetModified[groupSetIndex]
    if (groupOriginal.length !== groupModified.length) {
      return false
    }

    for (let groupIndex = 0; groupIndex < groupOriginal.length; groupIndex++) {
      if (groupOriginal[groupIndex].toString() !== groupModified[groupIndex].toString()) {
        return false
      }
    }
  }

  return true
}

export async function extractAchievementSetFromModule(
  module: any,
  absoluteModulePath: string,
): Promise<AchievementSet> {
  if (typeof module.default === 'function') {
    const setOrThenable = module.default()
    if (setOrThenable.then) {
      const set = await setOrThenable
      if (set instanceof AchievementSet) {
        return set
      } else {
        throw new Error(
          `expected module "${absoluteModulePath}" to resolve into AchievementSet, but got ${set}`,
        )
      }
    } else {
      if (setOrThenable instanceof AchievementSet) {
        return setOrThenable
      } else {
        throw new Error(
          `expected module "${absoluteModulePath}" to return AchievementSet, but got ${setOrThenable}`,
        )
      }
    }
  }

  if (module.default instanceof AchievementSet) {
    return module.default
  } else {
    throw new Error(
      `expected module "${absoluteModulePath}" to default export AchievementSet, but got ${module.default}`,
    )
  }
}

interface LocalData {
  eol: '\n' | '\r\n'
  version: string
  title: string
  entries: Array<
    (
      | {
          type: 'empty' | 'codenote'
        }
      | {
          type: 'achievement'
          asset: Achievement
        }
      | {
          type: 'leaderboard'
          asset: Leaderboard
        }
      | {
          type: 'error'
          err: Error
        }
    ) & {
      line: string
      idx: number
    }
  >
}

export function getLocalData(opts: { gameId: number; throwOnFirstError: boolean }): LocalData {
  const filePath = resolveRACache(`./RACache/Data/${opts.gameId}-User.txt`)
  if (fs.existsSync(filePath) === false) {
    return null
  }

  const content = fs.readFileSync(filePath).toString()
  const [version, title, ...lines] = content.split(/\r?\n/)
  if (version === undefined) {
    throw new Error('expected a version number in local file on line 1 but got none')
  }
  if (title === undefined) {
    throw new Error('expected a title in local file on line 2 but got none')
  }

  return {
    eol: content[content.indexOf('\n') - 1] === '\r' ? '\r\n' : '\n',
    version,
    title,
    entries: lines.map((line, idx) => {
      idx = idx + 3

      if (!line.trim()) {
        return { type: 'empty', idx, line }
      } else if (line.startsWith('N0:')) {
        return { type: 'codenote', idx, line }
      } else {
        try {
          if (line.startsWith('L')) {
            const asset = new Leaderboard(line)
            return { type: 'leaderboard', idx, line, asset }
          } else {
            const asset = new Achievement(line)
            return { type: 'achievement', idx, line, asset }
          }
        } catch (err) {
          if (opts.throwOnFirstError) {
            throw wrappedError(err, `line ${idx}: ${err.message}`)
          }

          return { type: 'error', idx, line, err }
        }
      }
    }),
  }
}

function badgeIsSet(badge: string) {
  return Number(badge) > 0 || badge.startsWith('local\\\\')
}

function badgeIsSetById(badge: string) {
  return Number(badge) > 0
}

function remoteBadgeIsNotSet(badge: string) {
  const num = Number(badge)
  return num === 0 || Number.isNaN(num)
}

function badgeIsSetAgainstRemote(target: Asset, current: Asset) {
  if (target instanceof Achievement === false || current instanceof Achievement === false) {
    return false
  }

  if (remoteBadgeIsNotSet(target.badge) && badgeIsSet(current.badge)) {
    return true
  }

  return badgeIsSetById(current.badge) && current.badge !== target.badge
}

function badgeIsSetAgainstLocal(oldAsset: Asset, newAsset: Asset) {
  if (oldAsset instanceof Achievement === false || newAsset instanceof Achievement === false) {
    return false
  }

  return oldAsset.badge !== newAsset.badge
}

function compareAssets(a: Asset, b: Asset) {
  return {
    get haveSameTitle() {
      return a.title === b.title
    },
    get haveSameDescription() {
      return a.description === b.description
    },
    get haveSamePoints() {
      return (a as Achievement).points === (b as Achievement).points
    },
    get haveSameLowerIsBetter() {
      return (a as Leaderboard).lowerIsBetter === (b as Leaderboard).lowerIsBetter
    },
    get haveSameType() {
      return a.type === b.type
    },
    get haveSameCode() {
      if (a instanceof Achievement && b instanceof Achievement) {
        return conditionGroupSetsAreSame(a.conditions, b.conditions)
      } else if (a instanceof Leaderboard && b instanceof Leaderboard) {
        return (
          conditionGroupSetsAreSame(a.conditions.start, b.conditions.start) &&
          conditionGroupSetsAreSame(a.conditions.cancel, b.conditions.cancel) &&
          conditionGroupSetsAreSame(a.conditions.submit, b.conditions.submit) &&
          conditionGroupSetsAreSame(a.conditions.value, b.conditions.value)
        )
      } else {
        throw new Error('Both original and modified arguments must be same type of Asset')
      }
    },
    get similarity() {
      if (a instanceof Achievement && b instanceof Achievement) {
        return (
          (Number(this.haveSameTitle) +
            Number(this.haveSameDescription) +
            Number(this.haveSamePoints) +
            Number(this.haveSameType) +
            Number(this.haveSameCode)) /
          5
        )
      } else if (a instanceof Leaderboard && b instanceof Leaderboard) {
        return (
          (Number(this.haveSameTitle) +
            Number(this.haveSameDescription) +
            Number(this.haveSameType) +
            Number(this.haveSameLowerIsBetter) +
            Number(this.haveSameCode)) /
          5
        )
      } else {
        throw new Error('Both original and modified arguments must be same type of Asset')
      }
    },

    get areSame() {
      if (a instanceof Achievement && b instanceof Achievement) {
        return (
          this.haveSameTitle &&
          this.haveSameDescription &&
          this.haveSamePoints &&
          this.haveSameType &&
          this.haveSameCode
        )
      } else if (a instanceof Leaderboard && b instanceof Leaderboard) {
        return (
          this.haveSameTitle &&
          this.haveSameDescription &&
          this.haveSameType &&
          this.haveSameLowerIsBetter &&
          this.haveSameCode
        )
      } else {
        throw new Error('Both original and modified arguments must be same type of Asset')
      }
    },

    get areDifferent() {
      if (a instanceof Achievement && b instanceof Achievement) {
        return (
          this.haveSameTitle === false ||
          this.haveSameDescription === false ||
          this.haveSamePoints === false ||
          this.haveSameType === false ||
          this.haveSameCode === false
        )
      } else if (a instanceof Leaderboard && b instanceof Leaderboard) {
        return (
          this.haveSameTitle === false ||
          this.haveSameDescription === false ||
          this.haveSameType === false ||
          this.haveSameLowerIsBetter === false ||
          this.haveSameCode === false
        )
      } else {
        throw new Error('Both original and modified arguments must be same type of Asset')
      }
    },
  }
}

function getMostSimilarCandidate(localCandidates: Asset[], asset: Asset) {
  const sortedCandidates = localCandidates
    .map(candidate => {
      const their = compareAssets(candidate, asset)
      return {
        similarity: their.similarity,
        asset: candidate,
      }
    })
    .filter(({ similarity }) => similarity >= 0.6)
    .sort((a, b) => b.similarity - a.similarity)

  const bestCandidate = sortedCandidates[0]

  const maxSimilarity = bestCandidate.similarity
  const candidiatesWithSameMaxSimilarity = sortedCandidates.filter(
    candidate => candidate.similarity === maxSimilarity,
  )

  if (candidiatesWithSameMaxSimilarity.length > 1) {
    return {
      ambiguousMatchesTitles: candidiatesWithSameMaxSimilarity.map(({ asset }) => asset.title),
    }
  }

  return { bestCandidate, similarity: bestCandidate.similarity }
}

function* iterateMatchables(matchables: Set<Asset>, asset: Asset) {
  for (const match of matchables) {
    if (match.constructor !== asset.constructor) {
      continue
    }

    yield match
  }
}

function getMatchByIdFrom(matchables: Set<Asset>, asset: Asset) {
  for (const match of matchables) {
    if (match.constructor !== asset.constructor) {
      continue
    }

    if (match.id === asset.id) {
      return match
    }
  }
}

function idIsUnique(asset: Asset) {
  return asset.id < 111000001
}

function getCandidatesByTitleOrDescription({
  matchables,
  asset,
  onTitleCollision,
}: {
  matchables: Set<Asset>
  asset: Asset
  onTitleCollision?: (asset: Asset) => void
}): Asset[] {
  const candidates = [] as Asset[]
  const candidateTitles = new Set<string>()

  for (const matchable of iterateMatchables(matchables, asset)) {
    const they = compareAssets(asset, matchable)
    if (they.haveSameTitle === false && they.haveSameDescription === false) {
      continue
    }

    if (onTitleCollision) {
      if (candidateTitles.has(matchable.title)) {
        onTitleCollision(matchable)
      }

      candidateTitles.add(matchable.title)
    }

    candidates.push(matchable)
  }

  return candidates
}

function makeMatcher(inputSet: AchievementSet, remoteSet: AchievementSet) {
  type OpResult =
    | {
        type: 'keep' | 'delete' | 'skip'
      }
    | {
        type: 'write'
        asset: Asset
        old: Asset
        preserveBadge?: boolean
      }

  // Make sure assets with unique IDs will be encountered first
  //
  // During matching local assets to new ones, new matchables
  // should be removed from the set once they're
  // actually matched against something,
  // so there are less elements to iterate over when
  // new assets are being matched against remote.
  const inputMatchables = new Set(
    Array.from(inputSet).sort((a, b) => {
      return Number(idIsUnique(b)) - Number(idIsUnique(a))
    }),
  )
  const remoteMatchables = new Set(remoteSet)

  function matchLocalToInputById(local: Asset): OpResult {
    if (idIsUnique(local) === false) {
      return { type: 'skip' }
    }

    const inputMatch = getMatchByIdFrom(inputMatchables, local)
    if (!inputMatch) {
      return { type: 'skip' }
    }

    inputMatchables.delete(inputMatch)

    const localAndNew = compareAssets(local, inputMatch)
    if (localAndNew.areDifferent || badgeIsSetAgainstLocal(local, inputMatch)) {
      const remoteMatch = getMatchByIdFrom(remoteMatchables, inputMatch)

      if (!remoteMatch) {
        throw new Error(
          `Input asset ${inputMatch.title} (${inputMatch.id}) matched against local one by ID, ` +
            `but there's no match by this ID against remote, that doesn't make sense. ` +
            `You may need to refetch remote assets, if that doesn't help - ` +
            `specify correct ID or remove asset with invalid ID from local.`,
        )
      }

      const inputAndRemote = compareAssets(inputMatch, remoteMatch)
      remoteMatchables.delete(remoteMatch)

      const shouldNotSetBadge = badgeIsSetAgainstRemote(remoteMatch, inputMatch) === false
      if (inputAndRemote.areSame && shouldNotSetBadge) {
        return { type: 'delete' }
      } else {
        return {
          type: 'write',
          asset: inputMatch,
          old: local,
          preserveBadge: shouldNotSetBadge,
        }
      }
    }

    return { type: 'keep' }
  }

  function matchLocalToInputByCode(local: Asset) {
    // TODO: suspicious about correctness of duplicate code, need tests?
    let candidate: Asset
    let candidateCode = ''

    for (const inputAsset of iterateMatchables(inputMatchables, local)) {
      const they = compareAssets(inputAsset, local)
      if (they.haveSameCode === false) {
        continue
      }

      const assetConditions = JSON.stringify(local.conditions)
      if (candidate && candidateCode === assetConditions) {
        throw new Error(
          `Local Asset ${local.title} matched against several local ones by having exact same code, ` +
            `after failing to match by anything else, that's ambiguous.` +
            `Generally you must not have assets with same code.`,
        )
      }

      candidate = inputAsset
      candidateCode = assetConditions
    }

    return candidate
  }

  function matchInputToRemoteById(inputAsset: Asset): OpResult {
    const remote = getMatchByIdFrom(remoteMatchables, inputAsset)
    if (!remote) {
      throw new Error(
        `Input asset ${inputAsset.title} (${inputAsset.id}) didn't match against anything in local and remote by ID. ` +
          `You may need to refetch remote assets, if that doesn't help - ` +
          `specify correct ID or remove the ID.`,
      )
    }

    remoteMatchables.delete(remote)

    const they = compareAssets(remote, inputAsset)
    const shouldSetBadge = badgeIsSetAgainstRemote(remote, inputAsset)
    if (they.areDifferent || shouldSetBadge) {
      return {
        type: 'write',
        asset: inputAsset,
        old: remote,
        preserveBadge: shouldSetBadge === false,
      }
    } else {
      return { type: 'skip' }
    }
  }

  return {
    localToInput(local: Asset): OpResult {
      const idMatch = matchLocalToInputById(local)
      if (idMatch.type !== 'skip') {
        return idMatch
      }

      const inputCandidates = getCandidatesByTitleOrDescription({
        matchables: inputMatchables,
        asset: local,
        onTitleCollision(asset) {
          throw new Error(
            `Local asset ${asset.title} matched against several input ones by title, that's ambiguous. ` +
              `If you absolutely need to deal with assets that have same title - rely on IDs instead.`,
          )
        },
      })

      let inputCandidate: Asset
      if (inputCandidates.length > 1) {
        const { bestCandidate, ambiguousMatchesTitles } = getMostSimilarCandidate(
          inputCandidates,
          local,
        )
        if (ambiguousMatchesTitles) {
          throw new Error(
            `Local asset ${local.title} matched against several similar input ones: ` +
              ambiguousMatchesTitles.join(', ') +
              `; that's ambiguous`,
          )
        }

        inputCandidate = bestCandidate.asset
      } else if (inputCandidates.length === 1) {
        inputCandidate = inputCandidates[0]
      } else if (inputCandidates.length === 0) {
        // Last resort after neither title or description have matched
        inputCandidate = matchLocalToInputByCode(local)
      }

      if (!inputCandidate) {
        return { type: 'keep' }
      }

      inputMatchables.delete(inputCandidate)

      const they = compareAssets(inputCandidate, local)
      const shouldSetBadge = badgeIsSetAgainstLocal(local, inputCandidate)
      if (they.areDifferent || shouldSetBadge) {
        return {
          type: 'write',
          asset: inputCandidate,
          old: local,
          preserveBadge:
            idIsUnique(local) &&
            inputCandidate instanceof Achievement &&
            badgeIsSet(inputCandidate.badge) === false,
        }
      } else {
        return { type: 'keep' }
      }
    },

    inputToRemote(inputAsset: Asset): OpResult {
      if (idIsUnique(inputAsset)) {
        return matchInputToRemoteById(inputAsset)
      }

      const remoteCandidates = getCandidatesByTitleOrDescription({
        matchables: remoteMatchables,
        asset: inputAsset,
      })

      let candidate: Asset
      if (remoteCandidates.length > 1) {
        const { bestCandidate, ambiguousMatchesTitles } = getMostSimilarCandidate(
          remoteCandidates,
          inputAsset,
        )
        if (ambiguousMatchesTitles) {
          throw new Error(
            `Asset ${inputAsset.title} matched against several similar remote ones: ` +
              ambiguousMatchesTitles.join(', ') +
              `; that's ambiguous`,
          )
        }

        candidate = bestCandidate.asset
      } else if (remoteCandidates.length === 1) {
        candidate = remoteCandidates[0]
      }

      if (!candidate) {
        return { type: 'write', asset: inputAsset, old: null }
      }

      remoteMatchables.delete(candidate)

      const they = compareAssets(candidate, inputAsset)
      const shouldSetBadge = badgeIsSetAgainstRemote(candidate, inputAsset)
      if (they.areDifferent || shouldSetBadge) {
        return {
          type: 'write',
          asset: inputAsset,
          old: candidate,
          preserveBadge: shouldSetBadge === false,
        }
      } else {
        return { type: 'skip' }
      }
    },

    inputMatchables,
  }
}

export const availableFilterTypes = new Set(['id', 'title', 'description'])

export type AssetFilter = (asset: AssetData) => boolean

export function makeAssetFilter(arg: string): AssetFilter {
  let match: RegExpMatchArray
  let type: string
  if ((match = arg.match(/(.+?):/))) {
    arg = arg.slice(match[0].length)
    type = match[1]
  } else {
    throw new Error(`expected filter param to start with 'type:', but got '${arg}'`)
  }

  if (availableFilterTypes.has(type) === false) {
    const correctTypes = [...availableFilterTypes].join(', ')
    throw new Error(
      `expected filter param to have correct type, but got '${type}', correct types are: ${correctTypes}`,
    )
  }

  if (arg.trim().length === 0) {
    const got = arg.length > 0 ? `got whitespace: '${arg}'` : 'got nothing'
    throw new Error(`expected filter param to end with value, but ${got}`)
  }

  if (type === 'id') {
    const ids = new Set(arg.split(/,\s*/).map(Number))
    return function filter(asset: AssetData) {
      return ids.has(asset.id)
    }
  }

  const regex = new RegExp(arg, 'i')
  return function filter(asset: AssetData) {
    return regex.test(asset[type])
  }
}

export function filtersMatch(asset: AssetData, filters: AssetFilter[]) {
  return filters.length === 0 || filters.some(filter => filter(asset))
}

export function calculateSetChanges(
  inputSet: AchievementSet,
  remoteSet: AchievementSet,
  localData?: LocalData,
  filters: AssetFilter[] = [],
) {
  type Diff = {
    original: Asset
    modified: Asset
  }

  const addToLocalByRemoteMatch = [] as Diff[]
  const addToLocalFromScratch = [] as Asset[]
  const updateInLocal = [] as Diff[]
  const removeFromLocal = [] as Asset[]
  const keepInLocal = [] as Asset[]
  const newLocalFileLines = [] as string[]

  const getMatchOf = makeMatcher(inputSet, remoteSet)

  // I don't fully comprehend max values initialized like that,
  // I wish I just set them both to 111000001, without
  // doing weird increment after checking local entries
  let maxAchLocalId = 111000000
  let maxLbLocalId = 111000000

  const localEntries = localData?.entries || []

  // Local file has to be matched against input set first,
  // to calculate the initial auto-incremented id for input assets,
  // and to correctly preserve unmatched/bad local assets
  for (const local of localEntries) {
    if (local.type === 'error') {
      newLocalFileLines.push(local.line)
      log(chalk.yellowBright(`local file, ignoring line ${local.idx}: ${local.err.message}`))
    }

    if (local.type === 'achievement' || local.type === 'leaderboard') {
      if (idIsUnique(local.asset) === false) {
        if (local.type === 'achievement') {
          maxAchLocalId = Math.max(maxAchLocalId, local.asset.id)
        } else if (local.type === 'leaderboard') {
          maxLbLocalId = Math.max(maxLbLocalId, local.asset.id)
        }
      }

      const match = getMatchOf.localToInput(local.asset)

      if (match.type === 'keep') {
        newLocalFileLines.push(local.line)
        keepInLocal.push(local.asset)
      }

      if (match.type === 'delete') {
        removeFromLocal.push(local.asset)
      }

      if (match.type === 'write') {
        let inputAsset = match.asset

        const preserveRemoteId = idIsUnique(local.asset) && idIsUnique(match.asset) === false

        const preserveOriginalLocalId =
          idIsUnique(local.asset) === false &&
          idIsUnique(match.asset) === false &&
          local.asset.id !== match.asset.id

        if (preserveRemoteId || preserveOriginalLocalId) {
          inputAsset = match.asset.with({ id: local.asset.id })
        }

        if (
          match.preserveBadge &&
          match.old instanceof Achievement &&
          inputAsset instanceof Achievement
        ) {
          inputAsset = inputAsset.with({ badge: match.old.badge })
        }

        if (filtersMatch(inputAsset, filters)) {
          newLocalFileLines.push(inputAsset.toString())
          updateInLocal.push({ original: local.asset, modified: inputAsset })
        } else {
          newLocalFileLines.push(local.line)
        }
      }
    }
  }

  // Wish I could get rid of this, see init of these above
  maxAchLocalId++
  maxLbLocalId++

  // Now whatever unmatched new assets have
  // to be matched against remote ones
  const { inputMatchables } = getMatchOf
  for (const asset of inputMatchables) {
    const match = getMatchOf.inputToRemote(asset)

    if (match.type === 'write') {
      const matchedAgainstRemote = Boolean(match.old)

      let inputAsset = match.asset
      if (matchedAgainstRemote) {
        if (match.old instanceof Achievement && match.asset instanceof Achievement) {
          inputAsset = asset.with({
            id: match.old.id,
            badge: match.preserveBadge ? match.old.badge : match.asset.badge,
          })
        } else {
          inputAsset = asset.with({ id: match.old.id })
        }
      } else {
        inputAsset =
          inputAsset instanceof Achievement
            ? inputAsset.with({ id: maxAchLocalId++ })
            : inputAsset.with({ id: maxLbLocalId++ })
      }

      if (filtersMatch(inputAsset, filters)) {
        newLocalFileLines.push(inputAsset.toString())

        if (match.old) {
          addToLocalByRemoteMatch.push({
            original: match.old,
            modified: inputAsset,
          })
        } else {
          addToLocalFromScratch.push(inputAsset)
        }
      }
    }
  }

  return {
    addToLocalByRemoteMatch,
    addToLocalFromScratch,
    removeFromLocal,
    updateInLocal,
    keepInLocal,

    newLocalFileLines,
  }
}
