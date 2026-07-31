import { cn } from '../lib/utils'

interface BrandWordmarkProps {
  title?: string
  compact?: boolean
  className?: string
  markClassName?: string
}

export default function BrandLockup({
  title = 'Tavily Hikari',
  compact = false,
  className,
  markClassName,
}: BrandWordmarkProps): JSX.Element {
  const assetStem = compact ? 'relay-mesh-mobile-logo' : 'relay-mesh-lockup'

  return (
    <span className={cn('brand-lockup', compact && 'brand-lockup-compact', className)}>
      <img
        src={`/assets/${assetStem}-light.svg`}
        alt={title}
        className={cn(
          'brand-lockup-image',
          'brand-lockup-image-light',
          compact && 'brand-lockup-image-compact',
          markClassName,
        )}
        loading="eager"
        decoding="async"
      />
      <img
        src={`/assets/${assetStem}-dark.svg`}
        alt=""
        aria-hidden="true"
        className={cn(
          'brand-lockup-image',
          'brand-lockup-image-dark',
          compact && 'brand-lockup-image-compact',
          markClassName,
        )}
        loading="eager"
        decoding="async"
      />
    </span>
  )
}
