import { Achievement, AchievementSet, Leaderboard } from '@cruncheevos/core'
import { Asset } from '@cruncheevos/core/util'
import * as util from 'util'

import { log } from './mockable.js'

// This file is called 'lint' as it may be further expanded
// into producing much more warnings on conditions and assets

const allowedPoints = new Set([0, 1, 2, 3, 4, 5, 10, 25, 50, 100])

interface Issue {
  type: string
  message: string
  badAsset: Asset
  goodAsset?: Asset
}

function truncateLongString(str: string, maxLength: number) {
  if (str.length > maxLength) {
    return str.slice(0, maxLength) + '...'
  }

  return str
}

const checks: Record<string, (set: AchievementSet) => Issue[]> = {
  noLongTitles(set: AchievementSet) {
    const issues = [] as Issue[]
    const maxLength = 255

    for (const asset of set) {
      const type = asset instanceof Achievement ? 'Achievement' : 'Leaderboard'
      if (asset.title.length > 255) {
        issues.push({
          type: 'no-long-titles',
          badAsset: asset,
          message:
            `${type} "${truncateLongString(asset.title, 40)}" has title length above ` +
            `${maxLength}: ${asset.title.length}`,
        })
      }
    }

    return issues
  },

  noLongDescriptions(set: AchievementSet) {
    const issues = [] as Issue[]
    const maxLength = 255

    for (const asset of set) {
      const type = asset instanceof Achievement ? 'Achievement' : 'Leaderboard'
      if (asset.description.length > 255) {
        issues.push({
          type: 'no-long-descriptions',
          badAsset: asset,
          message:
            `${type} "${truncateLongString(asset.title, 40)}" has description length above ` +
            `${maxLength}: ${asset.description.length}`,
        })
      }
    }

    return issues
  },

  noOddPoints(set: AchievementSet) {
    const issues = [] as Issue[]

    for (const ach of set.achievements) {
      if (allowedPoints.has(ach.points) === false) {
        issues.push({
          type: 'no-odd-points',
          badAsset: ach,
          message: `Achievement "${ach.title}" has odd amount of points: ${ach.points}`,
        })
      }
    }

    return issues
  },

  uniqueAchievementTitlesWithoutId(set: AchievementSet) {
    const existing = new Map<string, Achievement>()
    const issues = [] as Issue[]

    for (const ach of set.achievements) {
      const idIsUnique = ach.id < 111000001
      if (idIsUnique) {
        continue
      }

      if (existing.has(ach.title)) {
        issues.push({
          type: 'unique-achievement-titles-without-id',
          badAsset: ach,
          goodAsset: existing.get(ach.title),
          message: `There are several achievements without ID titled "${ach.title}"`,
        })
      } else {
        existing.set(ach.title, ach)
      }
    }

    return issues
  },

  uniqueLeaderboardTitlesWithoutId(set: AchievementSet) {
    const existing = new Map<string, Leaderboard>()
    const issues = [] as Issue[]

    for (const lb of set.leaderboards) {
      const idIsUnique = lb.id < 111000001
      if (idIsUnique) {
        continue
      }

      if (existing.has(lb.title)) {
        issues.push({
          type: 'unique-leaderboard-titles-without-id',
          badAsset: lb,
          goodAsset: existing.get(lb.title),
          message: `There are several achievements without ID titled "${lb.title}"`,
        })
      } else {
        existing.set(lb.title, lb)
      }
    }

    return issues
  },
}

function collectIssues(set: AchievementSet) {
  return Object.values(checks).flatMap(checkFunction => checkFunction(set))
}

export function logWarnings(set: AchievementSet) {
  const issues = collectIssues(set)

  for (const issue of issues) {
    log(util.styleText('yellowBright', `WARN: ${issue.message}`))
  }
}
