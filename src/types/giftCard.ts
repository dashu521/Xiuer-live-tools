import type { PlanType } from '@/domain/access/planRules'

export type GiftCardType = 'balance' | 'membership' | 'both'

export type GiftCardDurationType = 'permanent' | 'temporary'

export type GiftCardStatus = 'active' | 'redeemed' | 'expired' | 'disabled'

export interface GiftCard {
  id: string
  code: string
  codePlain: string
  type: GiftCardType
  balance: number
  currency: string
  /**
   * @deprecated 使用 tier 字段
   */
  membershipType: PlanType | null
  /**
   * 礼品卡档位
   */
  tier: PlanType | null
  membershipDays: number
  durationType: GiftCardDurationType
  status: GiftCardStatus
  createdBy: string
  createdAt: string
  expiresAt: string | null
  redeemedAt: string | null
  redeemedBy: string | null
  orderId: string | null
}

export interface GiftCardRedemption {
  id: string
  giftCardId: string
  userId: string
  redeemedAt: string
  previousBalance: number
  newBalance: number
  previousMembershipType: PlanType | null
  newMembershipType: PlanType | null
  previousExpiryDate: string | null
  newExpiryDate: string | null
  ipAddress: string
  deviceInfo: string
  giftCard?: GiftCard
}

export interface CreateGiftCardRequest {
  type: GiftCardType
  balance: number
  /**
   * @deprecated 使用 tier 字段
   */
  membershipType?: PlanType
  /**
   * 礼品卡档位
   */
  tier?: PlanType
  membershipDays: number
  quantity: number
  expiresAt?: string
  orderId?: string
}

export interface GiftCardListFilter {
  status?: GiftCardStatus
  type?: GiftCardType
  startDate?: string
  endDate?: string
  searchQuery?: string
}

export interface GiftCardStats {
  totalCards: number
  activeCards: number
  redeemedCards: number
  expiredCards: number
  totalBalance: number
  totalRedeemedBalance: number
}

export interface RedeemResult {
  success: boolean
  error?: string
  message?: string
  data?: {
    membershipType: PlanType | null
    membershipDays: number
    newMembershipType: PlanType
    newExpiryDate: string | null
    tier?: PlanType
    maxAccounts?: number
    previousMaxAccounts?: number
    redeemedBalance: number
    newBalance: number
  }
}

export interface GiftCardRedemptionWithDetails extends GiftCardRedemption {
  giftCard: GiftCard
  user?: {
    id: string
    username: string
    email: string
  }
}

export interface GiftCardValidationResult {
  valid: boolean
  card?: GiftCard
  error?: string
  message?: string
}

export interface GiftCardRedemptionRequest {
  code: string
  userId: string
  ipAddress?: string
  deviceInfo?: string
}

export interface GiftCardRedemptionResult {
  success: boolean
  error?: string
  message?: string
  data?: {
    redeemedBalance: number
    membershipType: PlanType | null
    membershipDays: number
    newBalance: number
    newPlan: PlanType
    newExpireAt: string | null
  }
}
