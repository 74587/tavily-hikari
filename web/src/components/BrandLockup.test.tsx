import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import BrandLockup from './BrandLockup'

describe('BrandLockup', () => {
  it('renders the full lockup by default with one accessible label', () => {
    const markup = renderToStaticMarkup(<BrandLockup title="Tavily Hikari" />)

    expect(markup).toContain('src="/assets/relay-mesh-lockup-light.svg"')
    expect(markup).toContain('src="/assets/relay-mesh-lockup-dark.svg"')
    expect(markup).not.toContain('<source')
    expect(markup).toContain('role="img"')
    expect(markup.match(/aria-label="Tavily Hikari"/g)).toHaveLength(1)
    expect(markup).toContain('brand-lockup-assets-full')
  })

  it('renders compact assets without a full lockup fallback', () => {
    const markup = renderToStaticMarkup(<BrandLockup variant="compact" />)

    expect(markup).toContain('src="/assets/relay-mesh-mobile-logo-light.svg"')
    expect(markup).toContain('src="/assets/relay-mesh-mobile-logo-dark.svg"')
    expect(markup).not.toContain('relay-mesh-lockup-light.svg')
    expect(markup).toContain('brand-lockup-assets-compact')
  })

  it('renders both asset sets for container-query responsive selection', () => {
    const markup = renderToStaticMarkup(<BrandLockup variant="responsive" />)

    expect(markup).toContain('brand-lockup-assets-full')
    expect(markup).toContain('brand-lockup-assets-compact')
    expect(markup).toContain('relay-mesh-mobile-logo-light.svg')
    expect(markup).toContain('relay-mesh-mobile-logo-dark.svg')
    expect(markup).toContain('src="/assets/relay-mesh-lockup-light.svg"')
    expect(markup).toContain('src="/assets/relay-mesh-lockup-dark.svg"')
    expect(markup.match(/aria-label="Tavily Hikari"/g)).toHaveLength(1)
  })
})
