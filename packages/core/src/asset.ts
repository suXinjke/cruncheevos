import type { Achievement } from './achievement.js'
import type { Leaderboard } from './leaderboard.js'

export interface AssetData {
  /**
   * ID of an Asset matching the one on server.
   * If Asset does not exist on the server yet, `id` should be set
   * to a high number like 111000001, similar to what RAIntegration
   * does when creating local assets.
   */
  id: string | number

  /**
   * Optional Subset ID that an Asset belongs to, matching the one on server.
   */
  setId?: string | number

  /**
   * Title of an Asset, must be set.
   */
  title: string

  /**
   * Description of an Asset, must be set.
   */
  description: string
}

export type Asset = Achievement | Leaderboard
