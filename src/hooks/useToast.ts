'use client'

// Inspired by react-hot-toast library
import * as React from 'react'
import type { ToastProps } from '@/components/ui/toast'
import { TOAST } from '@/constants'

type ToasterToast = Omit<ToastProps, 'title'> & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  dedupeKey?: string
  priority?: number
  createdAt?: number
}

type ToastLevel = 'success' | 'error' | 'info' | 'warning'

type ToastInput =
  | string
  | {
      title?: React.ReactNode
      description?: React.ReactNode
      action?: React.ReactNode
      duration?: number
      dedupeKey?: string
      priority?: number
    }

// eslint-disable-next-line unused-imports/no-unused-vars
const actionTypes = {
  ADD_TOAST: 'ADD_TOAST',
  UPDATE_TOAST: 'UPDATE_TOAST',
  DISMISS_TOAST: 'DISMISS_TOAST',
  REMOVE_TOAST: 'REMOVE_TOAST',
} as const

let count = 0

function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER
  return count.toString()
}

type ActionType = typeof actionTypes

type Action =
  | {
      type: ActionType['ADD_TOAST']
      toast: ToasterToast
    }
  | {
      type: ActionType['UPDATE_TOAST']
      toast: Partial<ToasterToast>
    }
  | {
      type: ActionType['DISMISS_TOAST']
      toastId?: ToasterToast['id']
    }
  | {
      type: ActionType['REMOVE_TOAST']
      toastId?: ToasterToast['id']
    }

interface State {
  toasts: ToasterToast[]
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

function addToRemoveQueue(toastId: string) {
  if (toastTimeouts.has(toastId)) {
    return
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId)
    dispatch({
      type: 'REMOVE_TOAST',
      toastId,
    })
  }, TOAST.REMOVE_DELAY)

  toastTimeouts.set(toastId, timeout)
}

function sortToasts(toasts: ToasterToast[]) {
  return [...toasts].sort(
    (a, b) => (b.priority ?? 0) - (a.priority ?? 0) || (b.createdAt ?? 0) - (a.createdAt ?? 0),
  )
}

function upsertToast(state: State, nextToast: ToasterToast): State {
  const duplicate = nextToast.dedupeKey
    ? state.toasts.find(toast => toast.dedupeKey === nextToast.dedupeKey)
    : undefined

  if (duplicate) {
    if ((duplicate.priority ?? 0) > (nextToast.priority ?? 0)) {
      return state
    }

    return {
      ...state,
      toasts: sortToasts(
        state.toasts.map(toast =>
          toast.id === duplicate.id
            ? {
                ...toast,
                ...nextToast,
                id: duplicate.id,
                createdAt: toast.createdAt,
                open: true,
              }
            : toast,
        ),
      ),
    }
  }

  return {
    ...state,
    toasts: sortToasts([nextToast, ...state.toasts]).slice(0, TOAST.LIMIT),
  }
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'ADD_TOAST':
      return upsertToast(state, action.toast)

    case 'UPDATE_TOAST':
      return {
        ...state,
        toasts: state.toasts.map(t => (t.id === action.toast.id ? { ...t, ...action.toast } : t)),
      }

    case 'DISMISS_TOAST': {
      const { toastId } = action

      // ! Side effects ! - This could be extracted into a dismissToast() action,
      // but I'll keep it here for simplicity
      if (toastId) {
        addToRemoveQueue(toastId)
      } else {
        for (const toast of state.toasts) {
          addToRemoveQueue(toast.id)
        }
      }

      return {
        ...state,
        toasts: state.toasts.map(t =>
          t.id === toastId || toastId === undefined
            ? {
                ...t,
                open: false,
              }
            : t,
        ),
      }
    }
    case 'REMOVE_TOAST':
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: [],
        }
      }
      return {
        ...state,
        toasts: state.toasts.filter(t => t.id !== action.toastId),
      }
  }
}

const listeners: Array<(state: State) => void> = []

let memoryState: State = { toasts: [] }

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action)
  for (const listener of listeners) {
    listener(memoryState)
  }
}

type Toast = Omit<ToasterToast, 'id'>

function toast({ ...props }: Toast) {
  const id = genId()

  const update = (props: ToasterToast) =>
    dispatch({
      type: 'UPDATE_TOAST',
      toast: { ...props, id },
    })
  const dismiss = () => dispatch({ type: 'DISMISS_TOAST', toastId: id })

  dispatch({
    type: 'ADD_TOAST',
    toast: {
      ...props,
      id,
      open: true,
      createdAt: Date.now(),
      onOpenChange: open => {
        if (!open) dismiss()
      },
    },
  })

  return {
    id,
    dismiss,
    update,
  }
}

function normalizeToastInput(
  level: ToastLevel,
  input: ToastInput,
): Omit<Toast, 'variant'> & { variant: NonNullable<ToastProps['variant']> } {
  const defaults = {
    success: { variant: 'success' as const, duration: 2000, priority: 2 },
    info: { variant: 'info' as const, duration: 2000, priority: 1 },
    warning: { variant: 'warning' as const, duration: 3000, priority: 3 },
    error: { variant: 'destructive' as const, duration: 4000, priority: 4 },
  }

  const base = defaults[level]
  if (typeof input === 'string') {
    return {
      ...base,
      description: input,
    }
  }

  return {
    ...base,
    ...input,
  }
}

const toasty = {
  success: (input: ToastInput) => toast(normalizeToastInput('success', input)),
  error: (input: ToastInput) => toast(normalizeToastInput('error', input)),
  info: (input: ToastInput) => toast(normalizeToastInput('info', input)),
  warning: (input: ToastInput) => toast(normalizeToastInput('warning', input)),
}

function useToasts() {
  const [state, setState] = React.useState<State>(memoryState)

  React.useEffect(() => {
    listeners.push(setState)
    return () => {
      const index = listeners.indexOf(setState)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }, [])

  return {
    ...state,
    dismiss: (toastId?: string) => dispatch({ type: 'DISMISS_TOAST', toastId }),
  }
}

function useToast() {
  return {
    toast: toasty,
  }
}

export { useToast, useToasts }
