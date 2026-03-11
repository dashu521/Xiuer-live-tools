import { customAlphabet } from 'nanoid'
import type { CreateGiftCardRequest, GiftCard } from '../../../src/types/giftCard'
import { encrypt } from '../utils/crypto'

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function generateCodeSegment(length: number): string {
  const nanoid = customAlphabet(CODE_ALPHABET, length)
  return nanoid()
}

export function generateGiftCardCode(): string {
  return [generateCodeSegment(4), generateCodeSegment(4), generateCodeSegment(4)].join('-')
}

export function validateCodeFormat(code: string): boolean {
  const pattern = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/
  return pattern.test(code)
}

export class GiftCardGenerator {
  static generateBatch(config: CreateGiftCardRequest & { createdBy: string }): GiftCard[] {
    const cards: GiftCard[] = []
    const now = new Date().toISOString()

    for (let i = 0; i < config.quantity; i++) {
      const plainCode = generateGiftCardCode()
      const encryptedCode = encrypt(plainCode)

      // 优先使用 tier，其次 membershipType
      const membershipType = config.tier || config.membershipType || null

      const card: GiftCard = {
        id: `gc_${Date.now()}_${i}`,
        code: encryptedCode,
        codePlain: plainCode,
        type: config.type,
        balance: config.balance,
        currency: 'CNY',
        membershipType,
        tier: membershipType, // tier 与 membershipType 保持一致
        membershipDays: config.membershipDays,
        durationType: config.membershipDays === 0 ? 'permanent' : 'temporary',
        status: 'active',
        createdBy: config.createdBy,
        createdAt: now,
        expiresAt: config.expiresAt || null,
        redeemedAt: null,
        redeemedBy: null,
        orderId: config.orderId || null,
      }

      cards.push(card)
    }

    return cards
  }

  static generateSingle(
    config: Omit<CreateGiftCardRequest, 'quantity'> & { createdBy: string },
  ): GiftCard {
    const plainCode = generateGiftCardCode()
    const encryptedCode = encrypt(plainCode)
    const now = new Date().toISOString()

    // 优先使用 tier，其次 membershipType
    const membershipType = config.tier || config.membershipType || null

    return {
      id: `gc_${Date.now()}`,
      code: encryptedCode,
      codePlain: plainCode,
      type: config.type,
      balance: config.balance,
      currency: 'CNY',
      membershipType,
      tier: membershipType, // tier 与 membershipType 保持一致
      membershipDays: config.membershipDays,
      durationType: config.membershipDays === 0 ? 'permanent' : 'temporary',
      status: 'active',
      createdBy: config.createdBy,
      createdAt: now,
      expiresAt: config.expiresAt || null,
      redeemedAt: null,
      redeemedBy: null,
      orderId: config.orderId || null,
    }
  }
}
