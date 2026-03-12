import { type FocusEvent, type MouseEvent, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

import { selectAllReadonlyText } from '../lib/clipboard'
import { cn } from '../lib/utils'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'

type BubblePlacement = 'top' | 'bottom'

interface BubblePosition {
  top: number
  left: number
  placement: BubblePlacement
  arrowLeft: number
}

export interface ManualCopyBubbleProps {
  open: boolean
  anchorEl: HTMLElement | null
  title: string
  description: string
  fieldLabel: string
  value: string
  closeLabel: string
  multiline?: boolean
  className?: string
  onClose: () => void
}

const VIEWPORT_MARGIN = 12
const ANCHOR_GAP = 10
const ARROW_MARGIN = 18

export default function ManualCopyBubble({
  open,
  anchorEl,
  title,
  description,
  fieldLabel,
  value,
  closeLabel,
  multiline = false,
  className,
  onClose,
}: ManualCopyBubbleProps): JSX.Element | null {
  const bubbleRef = useRef<HTMLDivElement | null>(null)
  const fieldRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)
  const [position, setPosition] = useState<BubblePosition | null>(null)

  useLayoutEffect(() => {
    if (!open || !anchorEl || typeof window === 'undefined') {
      setPosition(null)
      return
    }

    const updatePosition = () => {
      const bubble = bubbleRef.current
      if (!bubble || !anchorEl.isConnected) {
        setPosition(null)
        return
      }

      const anchorRect = anchorEl.getBoundingClientRect()
      const bubbleRect = bubble.getBoundingClientRect()

      let top = anchorRect.bottom + ANCHOR_GAP
      let placement: BubblePlacement = 'bottom'

      if (top + bubbleRect.height > window.innerHeight - VIEWPORT_MARGIN) {
        const nextTop = anchorRect.top - bubbleRect.height - ANCHOR_GAP
        if (nextTop >= VIEWPORT_MARGIN) {
          top = nextTop
          placement = 'top'
        }
      }

      top = Math.max(VIEWPORT_MARGIN, Math.min(top, window.innerHeight - bubbleRect.height - VIEWPORT_MARGIN))

      let left = anchorRect.left + (anchorRect.width / 2) - (bubbleRect.width / 2)
      left = Math.max(VIEWPORT_MARGIN, Math.min(left, window.innerWidth - bubbleRect.width - VIEWPORT_MARGIN))

      const arrowLeft = Math.max(
        ARROW_MARGIN,
        Math.min(anchorRect.left + (anchorRect.width / 2) - left, bubbleRect.width - ARROW_MARGIN),
      )

      setPosition({ top, left, placement, arrowLeft })
    }

    updatePosition()

    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updatePosition) : null
    resizeObserver?.observe(anchorEl)
    if (bubbleRef.current) {
      resizeObserver?.observe(bubbleRef.current)
    }

    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)

    return () => {
      resizeObserver?.disconnect()
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [anchorEl, open])

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: PointerEvent) => {
      const bubble = bubbleRef.current
      const target = event.target as Node | null
      if (!target) return
      if (bubble?.contains(target)) return
      if (anchorEl?.contains(target)) return
      onClose()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [anchorEl, onClose, open])

  useEffect(() => {
    if (!open) return
    const frame = window.requestAnimationFrame(() => {
      selectAllReadonlyText(fieldRef.current)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [open, value])

  if (!open || !anchorEl || typeof document === 'undefined') {
    return null
  }

  const fieldProps = {
    readOnly: true,
    spellCheck: false,
    value,
    onClick: (event: MouseEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      selectAllReadonlyText(event.currentTarget)
    },
    onFocus: (event: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      selectAllReadonlyText(event.currentTarget)
    },
    className: 'manual-copy-bubble-field',
  }

  return createPortal(
    <div
      ref={bubbleRef}
      className={cn('manual-copy-bubble', className)}
      role="dialog"
      aria-modal="false"
      style={{
        top: `${position?.top ?? 0}px`,
        left: `${position?.left ?? 0}px`,
        visibility: position ? 'visible' : 'hidden',
        pointerEvents: position ? 'auto' : 'none',
        ['--manual-copy-arrow-left' as string]: `${position?.arrowLeft ?? 40}px`,
      }}
      data-placement={position?.placement ?? 'bottom'}
    >
      <div className="manual-copy-bubble-header">
        <div className="manual-copy-bubble-copy">
          <strong className="manual-copy-bubble-title">{title}</strong>
          <p className="manual-copy-bubble-description">{description}</p>
        </div>
        <button type="button" className="manual-copy-bubble-close" onClick={onClose} aria-label={closeLabel}>
          <X className="h-4 w-4" />
        </button>
      </div>
      <label className="manual-copy-bubble-label">{fieldLabel}</label>
      {multiline ? (
        <Textarea
          {...fieldProps}
          ref={(node) => {
            fieldRef.current = node
          }}
          rows={4}
        />
      ) : (
        <Input
          {...fieldProps}
          ref={(node) => {
            fieldRef.current = node
          }}
          type="text"
        />
      )}
      <div className="manual-copy-bubble-actions">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          {closeLabel}
        </Button>
      </div>
    </div>,
    document.body,
  )
}
