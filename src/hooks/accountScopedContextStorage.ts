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
}: AccountScopedStorageOptions<Context, Namespace, Persisted>): void {
  if (!userId) {
    return
  }

  try {
    storageManager.set(
      namespace,
      serialize ? serialize(context) : (context as unknown as Persisted),
      {
        level: 'account',
        userId,
        accountId,
      },
    )
  } catch (error) {
    console.error(`${logPrefix} 保存到存储失败:`, error)
  }
}

export function loadAccountScopedContexts<Context, Namespace extends StorageDataType>({
  namespace,
  userId,
  restoreContext,
}: LoadAccountScopedContextsOptions<Context, Namespace>): Record<string, Context> {
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

  for (const [accountId, context] of Object.entries(contexts)) {
    persistAccountScopedContext({
      namespace,
      userId,
      accountId,
      context,
      logPrefix,
      serialize,
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
