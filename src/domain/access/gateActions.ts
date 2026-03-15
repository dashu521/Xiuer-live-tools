import type { FeatureType } from './AccessControl'

export type GateActionName =
  | 'connect-live-control'
  | 'ai-assistant'
  | 'auto-reply'
  | 'auto-message'
  | 'auto-popup'
  | 'add-live-account'

export const GATE_ACTIONS = {
  CONNECT_LIVE_CONTROL: 'connect-live-control',
  AI_ASSISTANT: 'ai-assistant',
  AUTO_REPLY: 'auto-reply',
  AUTO_MESSAGE: 'auto-message',
  AUTO_POPUP: 'auto-popup',
  ADD_LIVE_ACCOUNT: 'add-live-account',
} as const satisfies Record<string, GateActionName>

export const GATE_ACTION_TO_FEATURE: Record<GateActionName, FeatureType> = {
  [GATE_ACTIONS.CONNECT_LIVE_CONTROL]: 'connectLiveControl',
  [GATE_ACTIONS.AI_ASSISTANT]: 'aiAssistant',
  [GATE_ACTIONS.AUTO_REPLY]: 'autoReply',
  [GATE_ACTIONS.AUTO_MESSAGE]: 'autoMessage',
  [GATE_ACTIONS.AUTO_POPUP]: 'autoPopUp',
  [GATE_ACTIONS.ADD_LIVE_ACCOUNT]: 'addLiveAccount',
}

export function isGateActionName(actionName: string): actionName is GateActionName {
  return actionName in GATE_ACTION_TO_FEATURE
}

export function getFeatureTypeForGateAction(actionName: string): FeatureType {
  if (isGateActionName(actionName)) {
    return GATE_ACTION_TO_FEATURE[actionName]
  }
  return 'connectLiveControl'
}
