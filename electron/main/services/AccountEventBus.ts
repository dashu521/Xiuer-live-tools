import type { AccountEventPayload } from 'shared/accountEvents'
import { IPC_CHANNELS } from 'shared/ipcChannels'
import windowManager from '#/windowManager'

export function emitAccountEvent(event: AccountEventPayload): void {
  windowManager.send(IPC_CHANNELS.account.event, event)
}
