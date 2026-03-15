// Auth store module - re-export from main store for backward compatibility
export {
  useAuth,
  useAuthCheckDone,
  useAuthError,
  useAuthLoading,
  useAuthStore,
  useIsAuthenticated,
  useIsOffline,
  useUser,
} from '../authStore'
export type {
  AuthStore,
  AuthStoreActions,
  AuthStoreState,
  LoginResponseExtended,
  RegisterResponseExtended,
} from './types'
export {
  backendUserToSafeUser,
  extractErrorMessage,
  generateRequestId,
  getEffectivePlan,
  normalizePlan,
  safeUserFromUsername,
} from './utils'
