import { Check, Crown, Gift, type LucideIcon, Star, Zap } from 'lucide-react'
import type { PlanType } from '@/domain/access/planRules'
import type { BenefitItem, PlanColors } from '@/types/userCenter'

// 所有套餐的权益配置
export const TIER_BENEFITS: Record<PlanType, BenefitItem[]> = {
  trial: [
    { name: '直播控制', description: '完整直播控制功能', icon: Check },
    { name: '自动回复', description: '智能自动回复评论', icon: Check },
    { name: '自动发言', description: '定时自动发言功能', icon: Check },
    { name: '自动弹窗', description: '自动弹出商品卡片', icon: Check },
    { name: 'AI 助手', description: 'AI 智能辅助功能', icon: Check },
    { name: '高级设置', description: '高级应用设置选项', icon: Check },
  ],
  pro: [
    { name: '直播控制', description: '完整直播控制功能', icon: Check },
    { name: '自动回复', description: '智能自动回复评论', icon: Check },
    { name: '自动发言', description: '定时自动发言功能', icon: Check },
    { name: '自动弹窗', description: '自动弹出商品卡片', icon: Check },
    { name: 'AI 助手', description: 'AI 智能辅助功能', icon: Check },
    { name: '高级设置', description: '高级应用设置选项', icon: Check },
    { name: '1 个直播账号', description: '支持 1 个直播账号同时在线', icon: Check },
  ],
  pro_max: [
    { name: '直播控制', description: '完整直播控制功能', icon: Check },
    { name: '自动回复', description: '智能自动回复评论', icon: Check },
    { name: '自动发言', description: '定时自动发言功能', icon: Check },
    { name: '自动弹窗', description: '自动弹出商品卡片', icon: Check },
    { name: 'AI 助手', description: 'AI 智能辅助功能', icon: Check },
    { name: '高级设置', description: '高级应用设置选项', icon: Check },
    { name: '3 个直播账号', description: '支持 3 个直播账号同时在线', icon: Check },
    { name: '多账号管理', description: '便捷的多账号切换和管理', icon: Check },
  ],
  ultra: [
    { name: '直播控制', description: '完整直播控制功能', icon: Check },
    { name: '自动回复', description: '智能自动回复评论', icon: Check },
    { name: '自动发言', description: '定时自动发言功能', icon: Check },
    { name: '自动弹窗', description: '自动弹出商品卡片', icon: Check },
    { name: 'AI 助手', description: 'AI 智能辅助功能', icon: Check },
    { name: '高级设置', description: '高级应用设置选项', icon: Check },
    { name: '无限直播账号', description: '直播账号数量无限制', icon: Check },
    { name: '多账号管理', description: '便捷的多账号切换和管理', icon: Check },
    { name: '专属客服支持', description: '优先响应的专属客户服务', icon: Check },
  ],
}

// 套餐图标映射 - 差异化设计
export const PLAN_ICON_MAP: Record<PlanType, LucideIcon> = {
  trial: Gift,
  pro: Crown,
  pro_max: Zap,
  ultra: Star,
}

// 套餐颜色样式映射 - 差异化设计
export const PLAN_COLOR_MAP: Record<PlanType, PlanColors> = {
  trial: {
    badge: 'border border-blue-500/30 text-blue-400 bg-blue-500/5',
    gradient: 'from-blue-500/5 to-blue-500/10 border-blue-500/20',
    icon: 'bg-blue-500/10 text-blue-400',
  },
  pro: {
    badge: 'border border-primary/30 text-primary bg-primary/5',
    gradient: 'from-primary/5 to-primary/10 border-primary/20',
    icon: 'bg-primary/10 text-primary',
  },
  pro_max: {
    badge: 'border border-purple-500/30 text-purple-400 bg-purple-500/5',
    gradient: 'from-purple-500/5 to-purple-500/10 border-purple-500/20',
    icon: 'bg-purple-500/10 text-purple-400',
  },
  ultra: {
    badge: 'border border-yellow-500/30 text-yellow-400 bg-yellow-500/5',
    gradient: 'from-yellow-500/5 to-yellow-500/10 border-yellow-500/20',
    icon: 'bg-yellow-500/10 text-yellow-400',
  },
}

// 套餐描述映射
export const PLAN_DESCRIPTION_MAP: Record<PlanType, string> = {
  trial: '',
  pro: '',
  pro_max: '',
  ultra: '',
}

// 兑换码格式化函数
export function formatGiftCardCode(value: string): string {
  const cleaned = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  const parts = cleaned.match(/.{1,4}/g) || []
  return parts.join('-').slice(0, 14)
}

// 验证兑换码格式
export function isValidGiftCardCode(value: string): boolean {
  return /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(value)
}

// 用户ID脱敏显示
export function maskUserId(userId: string): string {
  if (userId.length <= 8) {
    return `****${userId.slice(-4)}`
  }
  return `${userId.slice(0, 4)}****${userId.slice(-4)}`
}
