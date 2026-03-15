import { normalizePlan } from 'shared/planRules'
import type {
  CreateGiftCardRequest,
  GiftCard,
  GiftCardListFilter,
  GiftCardRedemption,
  GiftCardRedemptionRequest,
  GiftCardRedemptionResult,
  GiftCardValidationResult,
} from '../../../src/types/giftCard'
import { AuthService } from './AuthService'
import { GiftCardDatabase } from './GiftCardDatabase'
import { GiftCardGenerator } from './GiftCardGenerator'

// 单例实例
let giftCardDb: GiftCardDatabase | null = null

function getGiftCardDb(): GiftCardDatabase {
  if (!giftCardDb) {
    giftCardDb = new GiftCardDatabase()
  }
  return giftCardDb
}

export class GiftCardService {
  /**
   * 验证礼品卡
   */
  static validateGiftCard(code: string): GiftCardValidationResult {
    const card = getGiftCardDb().getGiftCardByCode(code)

    if (!card) {
      return {
        valid: false,
        error: 'CARD_NOT_FOUND',
        message: '礼品卡不存在',
      }
    }

    if (card.status === 'redeemed') {
      return {
        valid: false,
        error: 'ALREADY_REDEEMED',
        message: '礼品卡已被兑换',
      }
    }

    if (card.status === 'disabled') {
      return {
        valid: false,
        error: 'CARD_DISABLED',
        message: '礼品卡已失效',
      }
    }

    if (card.status === 'expired' || (card.expiresAt && new Date(card.expiresAt) < new Date())) {
      return {
        valid: false,
        error: 'CARD_EXPIRED',
        message: '礼品卡已过期',
      }
    }

    return {
      valid: true,
      card,
    }
  }

  /**
   * 兑换礼品卡
   */
  static redeemGiftCard(request: GiftCardRedemptionRequest): GiftCardRedemptionResult {
    const validation = GiftCardService.validateGiftCard(request.code)

    if (!validation.valid || !validation.card) {
      return {
        success: false,
        error: validation.error,
        message: validation.message,
      }
    }

    const card = validation.card
    const user = AuthService.getUserById(request.userId)

    if (!user) {
      return {
        success: false,
        error: 'USER_NOT_FOUND',
        message: '用户不存在',
      }
    }

    const previousBalance = user.balance || 0
    const previousPlan = user.plan
    const previousExpireAt = user.expire_at

    let newBalance = previousBalance
    let newPlan = previousPlan
    let newExpireAt = previousExpireAt

    if (card.balance > 0) {
      newBalance = previousBalance + card.balance
    }

    if (card.membershipType) {
      newPlan = normalizePlan(card.membershipType)

      if (card.durationType === 'permanent') {
        newExpireAt = null
      } else if (card.membershipDays > 0) {
        const baseDate = previousExpireAt ? new Date(previousExpireAt) : new Date()
        const newDate = new Date(baseDate)
        newDate.setDate(newDate.getDate() + card.membershipDays)
        newExpireAt = newDate.getTime()
      }
    }

    try {
      const db = getGiftCardDb()
      db.transaction(() => {
        db.updateGiftCardStatus(card.id, 'redeemed', request.userId, new Date().toISOString())

        AuthService.updateUserAccount(request.userId, {
          balance: newBalance,
          plan: newPlan,
          expire_at: newExpireAt,
        })

        db.createRedemption({
          giftCardId: card.id,
          userId: request.userId,
          previousBalance,
          newBalance,
          previousMembershipType: previousPlan,
          newMembershipType: newPlan,
          previousExpiryDate: previousExpireAt ? String(previousExpireAt) : null,
          newExpiryDate: newExpireAt ? String(newExpireAt) : null,
          ipAddress: request.ipAddress || '',
          deviceInfo: request.deviceInfo || '',
        })
      })

      return {
        success: true,
        data: {
          redeemedBalance: card.balance,
          membershipType: card.membershipType,
          membershipDays: card.membershipDays,
          newBalance,
          newPlan,
          newExpireAt,
        },
      }
    } catch (error) {
      console.error('Gift card redemption error:', error)
      return {
        success: false,
        error: 'REDEEM_FAILED',
        message: '兑换失败，请稍后重试',
      }
    }
  }

  static getUserRedemptions(userId: string, limit = 20): GiftCardRedemption[] {
    return getGiftCardDb().getRedemptionsByUserId(userId, limit)
  }

  static async createGiftCards(
    config: CreateGiftCardRequest & { createdBy: string },
  ): Promise<GiftCard[]> {
    const cards = await GiftCardGenerator.generateBatch(config)
    const savedCards: GiftCard[] = []

    for (const card of cards) {
      const saved = getGiftCardDb().createGiftCard(card)
      savedCards.push(saved)
    }

    return savedCards
  }

  static getAllGiftCards(filters?: GiftCardListFilter): GiftCard[] {
    return getGiftCardDb().getGiftCards(filters)
  }

  static disableGiftCard(cardId: string): boolean {
    const card = getGiftCardDb().getGiftCardById(cardId)
    if (!card) return false

    getGiftCardDb().updateGiftCardStatus(cardId, 'disabled')
    return true
  }
}
