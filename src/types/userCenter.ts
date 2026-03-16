import type { LucideIcon } from 'lucide-react'
import type { PlanType } from '@/domain/access/planRules'

export interface UserCenterProps {
  isOpen: boolean
  onClose: () => void
}

export interface BenefitItem {
  name: string
  description: string
  icon: LucideIcon
}

export interface PlanColors {
  badge: string
  gradient: string
  icon: string
}

export interface ExpiryInfo {
  date: Date | null
  isExpired: boolean
  isPermanent: boolean
  displayText: string
}

export interface UserInfo {
  plan: PlanType
  expiry: ExpiryInfo
  benefits: BenefitItem[]
  accountLimitDisplay: string
  remainingDays: number | null
}
