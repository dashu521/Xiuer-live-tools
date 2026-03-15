import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { app } from 'electron'
import { normalizePlan } from 'shared/planRules'
import { v4 as uuidv4 } from 'uuid'
import type {
  GiftCard,
  GiftCardListFilter,
  GiftCardRedemption,
  GiftCardStats,
  GiftCardStatus,
  GiftCardType,
} from '../../../src/types/giftCard'
import { createLogger } from '../logger'

interface GiftCardRow {
  id: string
  code: string
  code_plain: string
  type: string
  balance: number
  currency: string
  membership_type: string | null
  membership_days: number
  duration_type: string
  status: string
  created_by: string
  created_at: string
  expires_at: string | null
  redeemed_at: string | null
  redeemed_by: string | null
  order_id: string | null
}

interface RedemptionRow {
  id: string
  gift_card_id: string
  user_id: string
  redeemed_at: string
  previous_balance: number
  new_balance: number
  previous_membership_type: string | null
  new_membership_type: string | null
  previous_expiry_date: string | null
  new_expiry_date: string | null
  ip_address: string
  device_info: string
}

let dbInstance: Database.Database | null = null
const logger = createLogger('GiftCardDatabase')

export function getGiftCardDatabase(): Database.Database {
  if (dbInstance) return dbInstance

  const userDataPath = app.getPath('userData')
  logger.info('获取 userData 路径:', userDataPath)

  let dbDir = userDataPath
  if (!existsSync(userDataPath)) {
    logger.info('userData 目录不存在，尝试使用临时目录')
    dbDir = app.getPath('temp')
  }

  if (!existsSync(dbDir)) {
    logger.info('临时目录也不存在，创建中...')
    mkdirSync(dbDir, { recursive: true })
  }

  const dbPath = join(dbDir, 'giftcard.db')
  logger.info('数据库路径:', dbPath)

  dbInstance = new Database(dbPath)
  initTables(dbInstance)
  return dbInstance
}

function initTables(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS gift_cards (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      code_plain TEXT NOT NULL,
      type TEXT NOT NULL,
      balance INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'CNY',
      membership_type TEXT,
      membership_days INTEGER NOT NULL DEFAULT 0,
      duration_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT,
      redeemed_at TEXT,
      redeemed_by TEXT,
      order_id TEXT
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS gift_card_redemptions (
      id TEXT PRIMARY KEY,
      gift_card_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      redeemed_at TEXT NOT NULL,
      previous_balance INTEGER NOT NULL,
      new_balance INTEGER NOT NULL,
      previous_membership_type TEXT,
      new_membership_type TEXT,
      previous_expiry_date TEXT,
      new_expiry_date TEXT,
      ip_address TEXT NOT NULL,
      device_info TEXT NOT NULL,
      FOREIGN KEY (gift_card_id) REFERENCES gift_cards(id)
    )
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_gift_cards_code ON gift_cards(code);
    CREATE INDEX IF NOT EXISTS idx_gift_cards_status ON gift_cards(status);
    CREATE INDEX IF NOT EXISTS idx_gift_cards_type ON gift_cards(type);
    CREATE INDEX IF NOT EXISTS idx_gift_card_redemptions_user ON gift_card_redemptions(user_id);
    CREATE INDEX IF NOT EXISTS idx_gift_card_redemptions_gift_card ON gift_card_redemptions(gift_card_id);
  `)
}

function mapRowToGiftCard(row: GiftCardRow): GiftCard {
  const membershipType = row.membership_type as GiftCard['membershipType']
  return {
    id: row.id,
    code: row.code,
    codePlain: row.code_plain,
    type: row.type as GiftCardType,
    balance: row.balance,
    currency: row.currency,
    membershipType,
    tier: membershipType, // tier 与 membershipType 保持一致
    membershipDays: row.membership_days,
    durationType: row.duration_type as GiftCard['durationType'],
    status: row.status as GiftCardStatus,
    createdBy: row.created_by,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    redeemedAt: row.redeemed_at,
    redeemedBy: row.redeemed_by,
    orderId: row.order_id,
  }
}

function mapRowToRedemption(row: RedemptionRow): GiftCardRedemption {
  return {
    id: row.id,
    giftCardId: row.gift_card_id,
    userId: row.user_id,
    redeemedAt: row.redeemed_at,
    previousBalance: row.previous_balance,
    newBalance: row.new_balance,
    previousMembershipType: normalizePlan(row.previous_membership_type),
    newMembershipType: normalizePlan(row.new_membership_type),
    previousExpiryDate: row.previous_expiry_date,
    newExpiryDate: row.new_expiry_date,
    ipAddress: row.ip_address,
    deviceInfo: row.device_info,
  }
}

export class GiftCardDatabase {
  private db: Database.Database

  constructor() {
    this.db = getGiftCardDatabase()
  }

  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)()
  }

  createGiftCard(
    card: Omit<GiftCard, 'id' | 'createdAt' | 'status' | 'redeemedAt' | 'redeemedBy'>,
  ): GiftCard {
    const id = uuidv4()
    const now = new Date().toISOString()

    const stmt = this.db.prepare(`
      INSERT INTO gift_cards (
        id, code, code_plain, type, balance, currency,
        membership_type, membership_days, duration_type, status,
        created_by, created_at, expires_at, redeemed_at, redeemed_by, order_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      id,
      card.code,
      card.codePlain,
      card.type,
      card.balance,
      card.currency,
      card.membershipType,
      card.membershipDays,
      card.durationType,
      'active',
      card.createdBy,
      now,
      card.expiresAt,
      null,
      null,
      card.orderId,
    )

    return {
      ...card,
      id,
      status: 'active',
      createdAt: now,
      redeemedAt: null,
      redeemedBy: null,
    }
  }

  getGiftCardByCode(code: string): GiftCard | null {
    const stmt = this.db.prepare('SELECT * FROM gift_cards WHERE code = ?')
    const row = stmt.get(code) as GiftCardRow | undefined
    return row ? mapRowToGiftCard(row) : null
  }

  getGiftCardByPlainCode(codePlain: string): GiftCard | null {
    const stmt = this.db.prepare('SELECT * FROM gift_cards WHERE code_plain = ?')
    const row = stmt.get(codePlain.toUpperCase()) as GiftCardRow | undefined
    return row ? mapRowToGiftCard(row) : null
  }

  getGiftCardById(id: string): GiftCard | null {
    const stmt = this.db.prepare('SELECT * FROM gift_cards WHERE id = ?')
    const row = stmt.get(id) as GiftCardRow | undefined
    return row ? mapRowToGiftCard(row) : null
  }

  updateGiftCardStatus(
    id: string,
    status: GiftCardStatus,
    redeemedBy?: string,
    redeemedAt?: string,
  ): void {
    const stmt = this.db.prepare(`
      UPDATE gift_cards
      SET status = ?, redeemed_by = ?, redeemed_at = ?
      WHERE id = ?
    `)
    stmt.run(status, redeemedBy || null, redeemedAt || null, id)
  }

  getGiftCards(filter?: GiftCardListFilter): GiftCard[] {
    let sql = 'SELECT * FROM gift_cards WHERE 1=1'
    const params: (string | number)[] = []

    if (filter?.status) {
      sql += ' AND status = ?'
      params.push(filter.status)
    }
    if (filter?.type) {
      sql += ' AND type = ?'
      params.push(filter.type)
    }
    if (filter?.startDate) {
      sql += ' AND created_at >= ?'
      params.push(filter.startDate)
    }
    if (filter?.endDate) {
      sql += ' AND created_at <= ?'
      params.push(filter.endDate)
    }

    sql += ' ORDER BY created_at DESC'

    const stmt = this.db.prepare(sql)
    const rows = stmt.all(...params) as GiftCardRow[]
    return rows.map(mapRowToGiftCard)
  }

  getStats(): GiftCardStats {
    const totalStmt = this.db.prepare('SELECT COUNT(*) as count FROM gift_cards')
    const activeStmt = this.db.prepare(
      "SELECT COUNT(*) as count FROM gift_cards WHERE status = 'active'",
    )
    const redeemedStmt = this.db.prepare(
      "SELECT COUNT(*) as count FROM gift_cards WHERE status = 'redeemed'",
    )
    const expiredStmt = this.db.prepare(
      "SELECT COUNT(*) as count FROM gift_cards WHERE status = 'expired'",
    )
    const _disabledStmt = this.db.prepare(
      "SELECT COUNT(*) as count FROM gift_cards WHERE status = 'disabled'",
    )
    const totalBalanceStmt = this.db.prepare('SELECT SUM(balance) as total FROM gift_cards')
    const redeemedBalanceStmt = this.db.prepare(
      "SELECT SUM(balance) as total FROM gift_cards WHERE status = 'redeemed'",
    )

    return {
      totalCards: (totalStmt.get() as { count: number }).count,
      activeCards: (activeStmt.get() as { count: number }).count,
      redeemedCards: (redeemedStmt.get() as { count: number }).count,
      expiredCards: (expiredStmt.get() as { count: number }).count,
      totalBalance: (totalBalanceStmt.get() as { total: number | null }).total || 0,
      totalRedeemedBalance: (redeemedBalanceStmt.get() as { total: number | null }).total || 0,
    }
  }

  createRedemption(
    redemption: Omit<GiftCardRedemption, 'id' | 'redeemedAt' | 'giftCard'>,
  ): GiftCardRedemption {
    const id = uuidv4()
    const now = new Date().toISOString()

    const stmt = this.db.prepare(`
      INSERT INTO gift_card_redemptions (
        id, gift_card_id, user_id, redeemed_at,
        previous_balance, new_balance,
        previous_membership_type, new_membership_type,
        previous_expiry_date, new_expiry_date,
        ip_address, device_info
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      id,
      redemption.giftCardId,
      redemption.userId,
      now,
      redemption.previousBalance,
      redemption.newBalance,
      redemption.previousMembershipType,
      redemption.newMembershipType,
      redemption.previousExpiryDate,
      redemption.newExpiryDate,
      redemption.ipAddress,
      redemption.deviceInfo,
    )

    return {
      ...redemption,
      id,
      redeemedAt: now,
    }
  }

  getRedemptionsByUserId(userId: string, limit = 20): GiftCardRedemption[] {
    const stmt = this.db.prepare(`
      SELECT * FROM gift_card_redemptions
      WHERE user_id = ?
      ORDER BY redeemed_at DESC
      LIMIT ?
    `)
    const rows = stmt.all(userId, limit) as RedemptionRow[]
    return rows.map(row => {
      const redemption = mapRowToRedemption(row)
      const card = this.getGiftCardById(redemption.giftCardId)
      return {
        ...redemption,
        giftCard: card || undefined,
      }
    })
  }

  getRedemptionByGiftCardId(giftCardId: string): GiftCardRedemption | null {
    const stmt = this.db.prepare('SELECT * FROM gift_card_redemptions WHERE gift_card_id = ?')
    const row = stmt.get(giftCardId) as RedemptionRow | undefined
    return row ? mapRowToRedemption(row) : null
  }

  checkAndUpdateExpiredCards(): number {
    const stmt = this.db.prepare(`
      UPDATE gift_cards
      SET status = 'expired'
      WHERE status = 'active' AND expires_at IS NOT NULL AND expires_at < ?
    `)
    const result = stmt.run(new Date().toISOString())
    return result.changes
  }
}
