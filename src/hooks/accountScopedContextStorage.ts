import { flushAllPersists, flushPersist, schedulePersist } from '@/utils/debouncedPersist'
import { storageManager } from '@/utils/storage/StorageManager'
import type { StorageDataType } from '@/utils/storage/types'
import { useAccounts } from './useAccounts'

interface AccountScopedStorageOptions<
  Context,
  Namespace extends StorageDataType,
  Persisted = Context,
> {
  namespace: Namespace
  userId: string | null
  accountId: string
  context: Context
  logPrefix: string
  serialize?: (context: Context) => Persisted
  immediate?: boolean
}

interface LoadAccountScopedContextsOptions<Context, Namespace extends StorageDataType> {
  namespace: Namespace
  userId: string
  restoreContext: (savedContext: Context, accountId: string) => Context
}

interface PersistAllAccountScopedContextsOptions<
  Context,
  Namespace extends StorageDataType,
  Persisted = Context,
> {
  namespace: Namespace
  userId: string | null
  contexts: Record<string, Context>
  logPrefix: string
  serialize?: (context: Context) => Persisted
}

export function removeAccountScopedContext(
  namespace: StorageDataType,
  userId: string | null,
  accountId: string,
  logPrefix: string,
): void {
  if (!userId) {
    return
  }

  try {
    flushPersist(`${namespace}:${userId}:${accountId}`)
    storageManager.remove(namespace, {
      level: 'account',
      userId,
      accountId,
    })
  } catch (error) {
    console.error(`${logPrefix} 删除存储失败:`, error)
  }
}

export function persistAccountScopedContext<
  Context,
  Namespace extends StorageDataType,
  Persisted = Context,
>({
  namespace,
  userId,
  accountId,
  context,
  logPrefix,
  serialize,
  immediate,
}: AccountScopedStorageOptions<Context, Namespace, Persisted>): void {
  if (!userId) {
    return
  }

  try {
    const persistKey = `${namespace}:${userId}:${accountId}`
    const payload = serialize ? serialize(context) : (context as unknown as Persisted)
    const write = () => {
      storageManager.set(namespace, payload, {
        level: 'account',
        userId,
        accountId,
      })
    }

    if (immediate) {
      flushPersist(persistKey)
      write()
      return
    }

    schedulePersist(persistKey, write, 250)
  } catch (error) {
    console.error(`${logPrefix} 保存到存储失败:`, error)
  }
}

export function loadAccountScopedContexts<Context, Namespace extends StorageDataType>({
  namespace,
  userId,
  restoreContext,
}: LoadAccountScopedContextsOptions<Context, Namespace>): Record<string, Context> {
  flushAllPersists()
  const { accounts } = useAccounts.getState()
  const contexts: Record<string, Context> = {}

  for (const account of accounts) {
    const savedContext = storageManager.get<Context>(namespace, {
      level: 'account',
      userId,
      accountId: account.id,
    })
    if (savedContext) {
      contexts[account.id] = restoreContext(savedContext, account.id)
    }
  }

  return contexts
}

export function persistAllAccountScopedContexts<
  Context,
  Namespace extends StorageDataType,
  Persisted = Context,
>({
  namespace,
  userId,
  contexts,
  logPrefix,
  serialize,
}: PersistAllAccountScopedContextsOptions<Context, Namespace, Persisted>): void {
  if (!userId) {
    return
  }

  flushAllPersists()
  for (const [accountId, context] of Object.entries(contexts)) {
    persistAccountScopedContext({
      namespace,
      userId,
      accountId,
      context,
      logPrefix,
      serialize,
      immediate: true,
    })
  }
}

export function runWhenAccountsReady(loadContexts: () => void): void {
  const { accounts } = useAccounts.getState()
  if (accounts.length > 0) {
    loadContexts()
    return
  }

  const unsubscribe = useAccounts.subscribe(state => {
    if (state.accounts.length > 0) {
      unsubscribe()
      loadContexts()
    }
  })
}
