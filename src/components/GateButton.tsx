/**
 * Gate 按钮组件
 * 根据 Gate 状态自动禁用/启用按钮并显示提示
 */

import type React from 'react'
import type { LiveFeatureGate } from '@/hooks/useLiveFeatureGate'
import { Button } from './ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip'

export interface GateButtonProps {
  gate: LiveFeatureGate
  onClick: () => void
  children: React.ReactNode
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  className?: string
  disabled?: boolean
  [key: string]: unknown
}

/**
 * Gate 按钮组件
 *
 * @param props - GateButtonProps
 */
export function GateButton({
  gate,
  onClick,
  children,
  variant = 'default',
  size = 'default',
  className,
  disabled: externalDisabled,
  ...restProps
}: GateButtonProps) {
  const isDisabled = gate.disabled || externalDisabled || false

  const handleClick = () => {
    if (!isDisabled && gate.canUse) {
      onClick()
    }
  }

  const button = (
    <Button
      variant={variant}
      size={size}
      className={className}
      disabled={isDisabled}
      onClick={handleClick}
      {...restProps}
    >
      {children}
    </Button>
  )

  // 如果禁用且有提示信息，显示 Tooltip
  if (isDisabled && gate.message) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>{button}</span>
          </TooltipTrigger>
          <TooltipContent>
            <p>{gate.message}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return button
}
