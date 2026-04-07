import { describe, expect, it } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import meta, * as notFoundStories from './NotFoundFallbackPreview.stories'
import NotFoundFallbackPreview from './NotFoundFallbackPreview'

describe('NotFoundFallbackPreview Storybook proofs', () => {
  it('exposes light and dark theme stories for the 404 fallback', () => {
    expect(meta).toMatchObject({
      title: 'Support/Pages/NotFoundFallback',
      tags: ['autodocs'],
    })

    expect(notFoundStories.LightTheme).toMatchObject({
      globals: { themeMode: 'light' },
    })
    expect(notFoundStories.DarkTheme).toMatchObject({
      globals: { themeMode: 'dark' },
    })
  })

  it('renders the shared 404 fallback markup with the requested path', () => {
    const markup = renderToStaticMarkup(
      createElement(NotFoundFallbackPreview, {
        originalPath: '/accounts?view=dark',
        returnHref: '/',
      }),
    )

    expect(markup).toContain('not-found-page-body')
    expect(markup).toContain('Page not found')
    expect(markup).toContain('/accounts?view=dark')
    expect(markup).toContain('Return to dashboard')
    expect(markup).toContain('Error reference: 404')
  })
})
