import {
  type ButtonHTMLAttributes,
  type FocusEvent,
  type MouseEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'

import { useAnchoredFloatingLayer } from '../../lib/useAnchoredFloatingLayer'
import { cn } from '../../lib/utils'

export interface AnchoredInfoDisclosureProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  bubbleContent: ReactNode
  children: ReactNode
  bubbleClassName?: string
}

export function AnchoredInfoDisclosure({
  bubbleContent,
  children,
  className,
  bubbleClassName,
  onBlur,
  onClick,
  onFocus,
  onMouseEnter,
  onMouseLeave,
  type = 'button',
  ...buttonProps
}: AnchoredInfoDisclosureProps): JSX.Element {
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const pointerHoverRef = useRef(false)
  const pinnedRef = useRef(false)
  const suppressFocusOpenRef = useRef(false)
  const bubbleId = useId()
  const [open, setOpen] = useState(false)
  const { layerRef: bubbleRef, position } = useAnchoredFloatingLayer<HTMLDivElement>({
    open,
    anchorEl: triggerRef.current,
    placement: 'top',
    align: 'center',
    offset: 10,
    viewportMargin: 12,
    arrowPadding: 18,
  })

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (!target) return
      if (triggerRef.current?.contains(target)) return
      if (bubbleRef.current?.contains(target)) return
      pinnedRef.current = false
      setOpen(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      // Capture before modal primitives so Escape dismisses this disclosure first.
      event.preventDefault()
      event.stopPropagation()
      pinnedRef.current = false
      setOpen(false)
      suppressFocusOpenRef.current = true
      triggerRef.current?.focus()
      if (document.activeElement === triggerRef.current) {
        suppressFocusOpenRef.current = false
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [bubbleRef, open])

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    onClick?.(event)
    if (event.defaultPrevented) return
    if (event.detail === 0) {
      pinnedRef.current = true
      setOpen(true)
      return
    }
    if (pointerHoverRef.current) {
      pinnedRef.current = true
      setOpen(true)
      return
    }
    setOpen((currentOpen) => {
      const nextOpen = !currentOpen
      pinnedRef.current = nextOpen
      return nextOpen
    })
  }

  const handleFocus = (event: FocusEvent<HTMLButtonElement>) => {
    onFocus?.(event)
    if (event.defaultPrevented) return
    if (suppressFocusOpenRef.current) {
      suppressFocusOpenRef.current = false
      return
    }
    if (event.currentTarget.matches(':focus-visible')) {
      setOpen(true)
    }
  }

  const handleBlur = (event: FocusEvent<HTMLButtonElement>) => {
    onBlur?.(event)
    if (event.defaultPrevented) return
    const nextFocusedNode = event.relatedTarget as Node | null
    if (nextFocusedNode && (triggerRef.current?.contains(nextFocusedNode) || bubbleRef.current?.contains(nextFocusedNode))) {
      return
    }
    if (pinnedRef.current) return
    setOpen(false)
  }

  const handleMouseEnter = (event: MouseEvent<HTMLButtonElement>) => {
    onMouseEnter?.(event)
    if (event.defaultPrevented) return
    pointerHoverRef.current = true
    setOpen(true)
  }

  const handleMouseLeave = (event: MouseEvent<HTMLButtonElement>) => {
    onMouseLeave?.(event)
    if (event.defaultPrevented) return
    pointerHoverRef.current = false
    if (pinnedRef.current) return
    if (document.activeElement === triggerRef.current) return
    setOpen(false)
  }

  return (
    <>
      <button
        {...buttonProps}
        ref={triggerRef}
        type={type}
        className={className}
        aria-describedby={open ? bubbleId : undefined}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={handleClick}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {children}
      </button>
      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={bubbleRef}
              id={bubbleId}
              className={cn('anchored-info-disclosure-bubble layer-popover', bubbleClassName)}
              role="tooltip"
              data-placement={position?.placement ?? 'top'}
              style={{
                top: `${position?.top ?? 0}px`,
                left: `${position?.left ?? 0}px`,
                visibility: position ? 'visible' : 'hidden',
                pointerEvents: position ? 'auto' : 'none',
                ['--anchored-info-disclosure-arrow-offset' as string]: `${position?.arrowOffset ?? 24}px`,
              }}
            >
              {bubbleContent}
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
