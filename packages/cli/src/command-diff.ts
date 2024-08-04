import jsonDiff from 'json-diff'
import { SpanningCellConfig, table } from 'table'
import chalk from 'chalk'

import * as path from 'path'
import { achievementSetImport, log, resolveRACache } from './mockable.js'

import { Condition, Leaderboard, Achievement } from '@cruncheevos/core'
import { capitalizeWord, Asset } from '@cruncheevos/core/util'
import {
  extractAchievementSetFromModule,
  calculateSetChanges,
  getLocalData,
  AssetFilter,
} from './util.js'
import { getSetFromRemote } from './command-fetch.js'
import { logWarnings } from './lint.js'

type ConditionComparisonReport = (string | number)[][]

const diffGapDelimeter = '······'

function makeConditionComparisonReport(opts: {
  original: Condition[]
  modified: Condition[]
  contextLines?: number
}) {
  let longestNumberWidth = 0

  const initialDiff = jsonDiff.diff(
    opts.original.map(x => x.toString()),
    opts.modified.map(x => x.toString()),
    {
      full: true,
    },
  ) as Array<[' ' | '+' | '-', string]>

  // If it returns array of strings only,
  // then there were no changes, that's how library works
  if (initialDiff.some(x => Array.isArray(x) === false)) {
    return { report: [], longestNumberWidth }
  }

  let left = 0
  let right = 0
  const changedLinesIndexes: number[] = []

  let res = initialDiff.map(([type, data], i) => {
    if (type === '+' || type === '-') {
      changedLinesIndexes.push(i)
      longestNumberWidth = Math.max(longestNumberWidth, i.toString().length)
    }

    // prettier-ignore
    return [
      type === '+' ? '+' : ++left,
      type === '-' ? '-' : ++right,
      data
    ]
  })

  if (res.length > 10 || opts.contextLines) {
    const length = Math.min(opts.contextLines || 1, initialDiff.length)

    // line = 5, length = 2 -> [ 3, 4, 5, 6, 7 ]
    const linesToInclude = new Set(
      changedLinesIndexes.flatMap(idx =>
        Array.from({ length: length * 2 + 1 }, (_, i) => i + idx - length),
      ),
    )
    res = res.filter((_, i) => linesToInclude.has(i))
  }

  res = res.map(x => [x[0], x[1], ...new Condition(x[2] as string).toArrayPretty()])

  // inject gaps between lines
  for (let i = res.length - 1; i >= 1; i--) {
    const leftDiff = (res[i][0] as any) - (res[i - 1][0] as any)
    const rightDiff = (res[i][1] as any) - (res[i - 1][1] as any)
    if (leftDiff > 1 && rightDiff > 1) {
      res.splice(i, 0, [diffGapDelimeter, '', '', '', '', '', '', '', '', '', ''])
    }
  }

  res.unshift(['', '', 'Flag', 'Type', 'Size', 'Value', 'Cmp', 'Type', 'Size', 'Value', 'Hits'])

  return { report: res as ConditionComparisonReport, longestNumberWidth }
}

function makeConditionGroupReports(opts: {
  original: Asset
  modified: Asset
  contextLines?: number
}) {
  let longestNumberWidth = 2

  const { original, modified, contextLines } = opts
  const conditionGroupReports = [] as Array<[string, ConditionComparisonReport]>
  const isAchievement = original instanceof Achievement && modified instanceof Achievement
  if (isAchievement) {
    const maxConditionGroupCount = Math.max(original.conditions.length, modified.conditions.length)

    for (let i = 0; i < maxConditionGroupCount; i++) {
      const res = makeConditionComparisonReport({
        original: original.conditions[i] || [],
        modified: modified.conditions[i] || [],
        contextLines,
      })
      longestNumberWidth = Math.max(longestNumberWidth, res.longestNumberWidth)

      if (res.report.length > 0) {
        if (!original.conditions[i] && modified.conditions[i].length === 0) {
          res.report.push([' ', '+', 'no conditions', '', '', '', '', '', '', '', ''])
        } else if (!modified.conditions[i] && original.conditions[i].length === 0) {
          res.report.push(['-', ' ', 'no conditions', '', '', '', '', '', '', '', ''])
        }

        conditionGroupReports.push([i === 0 ? 'Core' : `Alt ${i}`, res.report])
      }
    }
  } else {
    for (const group of ['start', 'cancel', 'submit', 'value']) {
      const maxConditionGroupCount = Math.max(
        original.conditions[group].length,
        modified.conditions[group].length,
      )

      for (let i = 0; i < maxConditionGroupCount; i++) {
        const res = makeConditionComparisonReport({
          original: original.conditions[group][i] || [],
          modified: modified.conditions[group][i] || [],
          contextLines,
        })
        longestNumberWidth = Math.max(longestNumberWidth, res.longestNumberWidth)

        /* Group Header examples:
          Start - Core
          Cancel - Alt 1
          Submit - Alt 2
          Value         (not Value - Core!)
          Value - Alt 1
        */
        if (res.report.length > 0) {
          const groupNameHeaderPieces = [capitalizeWord(group)]
          if (i > 0) {
            groupNameHeaderPieces.push(`Alt ${i}`)
          } else if (group !== 'value') {
            groupNameHeaderPieces.push(`Core`)
          }
          conditionGroupReports.push([groupNameHeaderPieces.join(' - '), res.report])
        }
      }
    }
  }

  return {
    conditionGroupReports,
    firstColumnWidth: conditionGroupReports.length > 0 ? longestNumberWidth : 3,
  }
}

function colorTheLine(line: string, color: string) {
  return line.replace(/^(.+)(│)(.+)$/, (_, left, border, right) => {
    return chalk[color](left) + border + chalk[color](right)
  })
}

function makeAssetDiffReport(opts: {
  original: Asset
  modified: Asset
  comparisonContext: string
  contextLines?: number
}) {
  const lines = []
  const spanningCells: SpanningCellConfig[] = []
  function pushHeaderLines(...incomingLines: Array<string[]>) {
    for (const [header, value] of incomingLines) {
      const row = lines.length
      spanningCells.push({ row, col: 0, colSpan: 2, alignment: 'right' })
      spanningCells.push({ row, col: 2, colSpan: 9, alignment: 'left' })
      lines.push([header, '', value, '', '', '', '', '', '', '', ''])
    }
  }

  const { original, modified, comparisonContext } = opts

  // Deal with changes other than code
  const isAchievement = original instanceof Achievement && modified instanceof Achievement
  const isLeaderboard = original instanceof Leaderboard && modified instanceof Leaderboard

  const titleChanged = original.title !== modified.title
  const achievementBadgeChanged = isAchievement && original.badge !== modified.badge
  const descriptionChanged = original.description !== modified.description
  const achievementTypeChanged = isAchievement && original.type !== modified.type
  const achievementPointsChanged = isAchievement && original.points !== modified.points
  const leaderboardTypeChanged = isLeaderboard && original.type !== modified.type
  const leaderboardLowerIsBetterChanged =
    isLeaderboard && original.lowerIsBetter !== modified.lowerIsBetter

  pushHeaderLines([
    isAchievement ? 'A.ID' : 'L.ID',
    original.id.toString() + ` (${comparisonContext})`,
  ])

  if (titleChanged) {
    pushHeaderLines(
      ['Title', chalk.redBright('- ' + original.title)],
      ['', chalk.greenBright('+ ' + modified.title)],
    )
  } else {
    pushHeaderLines(['Title', original.title])
  }

  // Don't show description if title didn't change, ID and title is enough
  if (titleChanged && descriptionChanged === false) {
    pushHeaderLines(['Desc.', original.description])
  } else if (descriptionChanged) {
    pushHeaderLines(
      ['Desc.', chalk.redBright('- ' + original.description)],
      ['', chalk.greenBright('+ ' + modified.description)],
    )
  }

  if (achievementTypeChanged) {
    const originalType = capitalizeWord(original.type || 'none')
    const modifiedType = capitalizeWord(modified.type || 'none')

    pushHeaderLines([
      'Type',
      chalk.redBright(originalType) + ' -> ' + chalk.greenBright(modifiedType),
    ])
  }

  if (achievementPointsChanged) {
    pushHeaderLines([
      'Pts.',
      chalk.redBright(original.points) + ' -> ' + chalk.greenBright(modified.points),
    ])
  }

  if (achievementBadgeChanged) {
    pushHeaderLines([
      'Badge',
      chalk.redBright(original.badge) + ' -> ' + chalk.greenBright(modified.badge),
    ])
  }

  if (leaderboardTypeChanged) {
    pushHeaderLines([
      'Type',
      chalk.redBright(original.type) + ' -> ' + chalk.greenBright(modified.type),
    ])
  }

  if (leaderboardLowerIsBetterChanged) {
    pushHeaderLines([
      'Low?',
      chalk.redBright(original.lowerIsBetter.toString()) +
        ' -> ' +
        chalk.greenBright(modified.lowerIsBetter.toString()),
    ])
  }

  // Deal with code changes
  const { conditionGroupReports, firstColumnWidth } = makeConditionGroupReports(opts)
  if (
    conditionGroupReports.length === 0 &&
    titleChanged === false &&
    descriptionChanged === false &&
    achievementPointsChanged === false &&
    achievementBadgeChanged === false &&
    achievementTypeChanged === false &&
    leaderboardTypeChanged === false &&
    leaderboardLowerIsBetterChanged === false
  ) {
    return ''
  }

  for (const [groupName, codeLines] of conditionGroupReports) {
    pushHeaderLines(['Code', groupName])

    codeLines.forEach(line => {
      lines.push(line)
      if (line[0] === '······') {
        spanningCells.push({ row: lines.length - 1, col: 0, colSpan: 2, alignment: 'center' })
      }

      if (line[2] === 'no conditions') {
        spanningCells.push({ row: lines.length - 1, col: 2, colSpan: 8 })
      }
    })
  }

  // Now format the table
  const formattedTable = table(lines, {
    columnDefault: {
      paddingRight: 0,
    },
    columns: {
      /* Header title half */ 0: {
        paddingRight: 1,
        alignment: 'right',
        width: firstColumnWidth,
      },
      /* Header title half */ 1: {
        paddingRight: 0,
        alignment: 'right',
      },
      ...(conditionGroupReports.length > 0
        ? {}
        : {
            /* Header value spanning */ 2: { width: 40 },
          }),
      /* lvalue.value */ 5: {
        alignment: 'right',
      },
      /* cmp */ 6: {
        alignment: 'center',
      },
      /* rvalue.value */ 9: {
        alignment: 'right',
      },
      /* hits */ 10: {
        alignment: 'right',
      },
    },
    spanningCells,
    drawHorizontalLine: i => lines[i + 1]?.[2] === 'Flag' || lines[i - 1]?.[2] === 'Flag',
    drawVerticalLine: i => i === 2,
  })

  return (
    '\n' +
    formattedTable
      .split('\n')
      .map(x => {
        if (x.match(/^\s*\+/)) {
          return colorTheLine(x, 'greenBright')
        }
        if (x.match(/^\s*\d+\s+-/) || x.includes('-   │ no conditions')) {
          return colorTheLine(x, 'redBright')
        }

        return x
      })
      .map(x => x.trimEnd())
      .join('\n')
  )
}

export function diffExecute({
  changes,
  contextLines,
}: {
  changes: ReturnType<typeof calculateSetChanges>
  contextLines?: number
}) {
  let result = ''

  const [newAchievementTitles, newLeaderboardTitles] = [Achievement, Leaderboard].map(classDef =>
    changes.addToLocalFromScratch
      .filter(x => x instanceof classDef)
      .map(x => x.title)
      .sort((a, b) => a.localeCompare(b)),
  )

  if (newAchievementTitles.length > 0) {
    result += `New achievements added:\n`
    for (const title of newAchievementTitles) {
      result += '  ' + title + '\n'
    }
    result += '\n'
  }

  if (newLeaderboardTitles.length > 0) {
    result += `New leaderboards added:\n`
    for (const title of newLeaderboardTitles) {
      result += '  ' + title + '\n'
    }
    result += '\n'
  }

  let assetsChangedString = ''
  for (const { original, modified } of changes.updateInLocal) {
    assetsChangedString += makeAssetDiffReport({
      original,
      modified,
      contextLines,
      comparisonContext: 'compared to local',
    })
  }

  for (const { original, modified } of changes.addToLocalByRemoteMatch) {
    assetsChangedString += makeAssetDiffReport({
      original,
      modified,
      contextLines,
      comparisonContext: 'compared to remote',
    })
  }

  if (assetsChangedString.length > 0) {
    result += `Assets changed:\n`
    result += assetsChangedString
  }

  log(result || 'no changes found')

  return { hasChanges: Boolean(result) }
}

export default async function diff(
  inputFilePath: string,
  opts: {
    refetch?: boolean
    includeUnofficial?: boolean
    contextLines?: number
    timeout?: number
    filter?: AssetFilter[]
  },
) {
  const { refetch, includeUnofficial, contextLines, filter = [], timeout = 1000 } = opts

  const absoluteModulePath = path.resolve(inputFilePath)
  const module = await achievementSetImport(absoluteModulePath)
  const inputSet = await extractAchievementSetFromModule(module, absoluteModulePath)
  const { gameId } = inputSet

  const achievementCount = Object.keys(inputSet.achievements).length
  const leaderboardCount = Object.keys(inputSet.leaderboards).length
  const inputSetIsEmpty = achievementCount === 0 && leaderboardCount === 0
  if (inputSetIsEmpty) {
    log(chalk.yellowBright(`set doesn't define any achievements or leaderboards, diff aborted`))
    return { hasChanges: false }
  }

  try {
    var remoteSet = await getSetFromRemote({ gameId, includeUnofficial, refetch, timeout })
  } catch (err) {
    log(chalk.redBright(`remote data got issues, cannot proceed with the diff`))
    throw err
  }

  try {
    var localData = getLocalData({
      gameId,
      throwOnFirstError: false,
    })
  } catch (err) {
    log(chalk.yellowBright(`local file got issues, will not diff against local file`))
    throw err
  }

  if (!localData) {
    const filePath = resolveRACache(`./RACache/Data/${gameId}-User.txt`)
    log(
      chalk.yellowBright(`local file ${filePath} doesn't exist, will not diff against local file`),
    )
  }

  const changes = calculateSetChanges(inputSet, remoteSet, localData, filter)

  diffExecute({ changes, contextLines })
  logWarnings(inputSet)
}
