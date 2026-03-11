import { useEffect, useRef } from 'react'
import type { IpcChannels } from 'shared/electron-api'

const api = typeof window !== 'undefined' ? window.ipcRenderer : undefined

/** 监听 IPC 事件；Channel 限定为 IpcChannels 的 key，回调参数与主进程发送的 payload 一致 */
export function useIpcListener<Channel extends keyof IpcChannels>(
  channel: Channel,
  callback: (...args: Parameters<IpcChannels[Channel]>) => void,
) {
  const callbackRef = useRef(callback)

  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  useEffect(() => {
    if (!api?.on) return

    const listener = (...args: Parameters<IpcChannels[Channel]>) => {
      callbackRef.current(...args)
    }

    const removeListener = api.on(channel, listener)

    return () => {
      removeListener()
    }
  }, [channel])
}

// export function useIpcRenderer() {
//   const ipcInvoke = useMemoizedFn(
//     <Channel extends Parameters<typeof api.invoke>[0]>(
//       ...args: Parameters<typeof api.invoke<Channel>>
//     ) => {
//       const [channel, ...params] = args
//       return api.invoke(channel, ...params)
//     },
//   )

//   const ipcSend = useMemoizedFn(
//     <Channel extends Parameters<typeof api.send>[0]>(
//       ...args: Parameters<typeof api.send<Channel>>
//     ) => {
//       const [channel, ...params] = args
//       return api.send(channel, ...params)
//     },
//   )

//   return { ipcInvoke, ipcSend }
// }
