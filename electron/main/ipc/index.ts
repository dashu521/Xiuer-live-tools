import { setupAIChatIpcHandlers } from './aichat'
import { setupAppIpcHandlers } from './app'
import { setupAuthHandlers } from './auth'
import { setupAutoMessageIpcHandlers } from './autoMessage'
import { setupAutoPopUpIpcHandlers } from './autoPopUp'
import { setupBrowserIpcHandlers } from './browser'
import { setupAutoReplyIpcHandlers } from './commentListener'
import { setupLiveControlIpcHandlers } from './connection'
import { setupDiagnosticsIpcHandlers } from './diagnostics'
import { setupGiftCardIpcHandlers } from './giftCard'
import { setupLiveStatsIpcHandlers } from './liveStats'
import { setupPinCommentIpcHandler } from './pinComment'
import { setupSubAccountIpcHandlers } from './subAccount'
import { setupUpdateIpcHandlers } from './update'

setupDiagnosticsIpcHandlers()
setupLiveControlIpcHandlers()
setupAIChatIpcHandlers()
setupAutoPopUpIpcHandlers()
setupAutoReplyIpcHandlers()
setupAutoMessageIpcHandlers()
setupBrowserIpcHandlers()
setupAppIpcHandlers()
setupUpdateIpcHandlers()
setupPinCommentIpcHandler()
setupAuthHandlers()
setupLiveStatsIpcHandlers()
setupSubAccountIpcHandlers()
setupGiftCardIpcHandlers()
