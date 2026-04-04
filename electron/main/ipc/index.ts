import { setupAIChatIpcHandlers } from './aichat'
import { setupAppIpcHandlers } from './app'
import { setupAuthHandlers } from './auth'
import { setupAutoMessageIpcHandlers } from './autoMessage'
import { setupAutoPopUpIpcHandlers } from './autoPopUp'
import { setupAutoReplyIpcHandlers } from './autoReply'
import { setupBrowserIpcHandlers } from './browser'
import { setupCommentListenerIpcHandlers } from './commentListener'
import { setupLiveControlIpcHandlers } from './connection'
import { setupDiagnosticsIpcHandlers } from './diagnostics'
import { setupLiveStatsIpcHandlers } from './liveStats'
import { setupPinCommentIpcHandler } from './pinComment'
import { setupSubAccountIpcHandlers } from './subAccount'
import { setupUpdateIpcHandlers } from './update'

setupDiagnosticsIpcHandlers()
setupLiveControlIpcHandlers()
setupAIChatIpcHandlers()
setupAutoReplyIpcHandlers()
setupAutoPopUpIpcHandlers()
setupCommentListenerIpcHandlers()
setupAutoMessageIpcHandlers()
setupBrowserIpcHandlers()
setupAppIpcHandlers()
setupUpdateIpcHandlers()
setupPinCommentIpcHandler()
setupAuthHandlers()
setupLiveStatsIpcHandlers()
setupSubAccountIpcHandlers()
