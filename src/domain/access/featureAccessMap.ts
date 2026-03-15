import type { AuthFeature } from 'shared/authFeatureRules'

export type CapabilityFeatureType =
  | 'connectLiveControl'
  | 'aiAssistant'
  | 'autoReply'
  | 'autoMessage'
  | 'autoPopUp'

export const CAPABILITY_FEATURE_TO_AUTH_FEATURE: Record<CapabilityFeatureType, AuthFeature> = {
  connectLiveControl: 'live_control',
  aiAssistant: 'ai_chat',
  autoReply: 'auto_reply',
  autoMessage: 'auto_message',
  autoPopUp: 'auto_popup',
}

export function getAuthFeatureForCapabilityFeature(feature: CapabilityFeatureType): AuthFeature {
  return CAPABILITY_FEATURE_TO_AUTH_FEATURE[feature]
}
