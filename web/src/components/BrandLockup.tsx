import { cn } from '../lib/utils'

export type BrandLockupVariant = 'full' | 'compact' | 'responsive'

interface BrandLockupProps {
  title?: string
  variant?: BrandLockupVariant
  className?: string
  markClassName?: string
}

export default function BrandLockup({
  title = 'Tavily Hikari',
  variant = 'full',
  className,
  markClassName,
}: BrandLockupProps): JSX.Element {
  const isCompact = variant === 'compact'
  const isResponsive = variant === 'responsive'
  const renderAssetSet = (assetStem: string, assetKind: 'full' | 'compact'): JSX.Element => (
    <span className={`brand-lockup-assets brand-lockup-assets-${assetKind}`} aria-hidden="true">
      {(['light', 'dark'] as const).map((theme) => (
        <img
          key={theme}
          src={`/assets/${assetStem}-${theme}.svg`}
          alt=""
          className={cn(
            'brand-lockup-image',
            `brand-lockup-image-${theme}`,
            `brand-lockup-image-${assetKind}`,
            markClassName,
          )}
          loading="eager"
          decoding="async"
        />
      ))}
    </span>
  )

  return (
    <span className={cn('brand-lockup', `brand-lockup-${variant}`, className)} role="img" aria-label={title}>
      {isCompact
        ? renderAssetSet('relay-mesh-mobile-logo', 'compact')
        : renderAssetSet('relay-mesh-lockup', 'full')}
      {isResponsive ? renderAssetSet('relay-mesh-mobile-logo', 'compact') : null}
    </span>
  )
}
