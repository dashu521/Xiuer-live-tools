import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react'
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from '@/components/ui/toast'
import { useToasts } from '@/hooks/useToast'

const TOAST_ICONS = {
  default: Info,
  info: Info,
  success: CheckCircle2,
  warning: TriangleAlert,
  destructive: AlertCircle,
} as const

export function Toaster() {
  const { toasts } = useToasts()

  return (
    <ToastProvider>
      {toasts.map(({ id, title, description, action, ...props }) => {
        const Icon = TOAST_ICONS[props.variant ?? 'default'] ?? Info

        return (
          <Toast key={id} {...props}>
            <div className="flex min-w-0 flex-1 items-start gap-3 pr-6">
              <Icon className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="grid min-w-0 gap-1">
                {title && <ToastTitle>{title}</ToastTitle>}
                {description && <ToastDescription>{description}</ToastDescription>}
              </div>
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
