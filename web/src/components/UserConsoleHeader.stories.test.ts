import { describe, expect, it } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'

import { LanguageProvider } from '../i18n'
import { ThemeProvider } from '../theme'
import meta, * as headerStories from './UserConsoleHeader.stories'

function renderStory(story: {
  render?: ((args: Record<string, unknown>) => JSX.Element) | undefined
  args?: Record<string, unknown>
  globals?: { language?: 'en' | 'zh' }
}): string {
  const args = {
    ...((meta as { args?: Record<string, unknown> }).args ?? {}),
    ...(story.args ?? {}),
  }
  const render = story.render
    ?? (meta.render as ((args: Record<string, unknown>) => JSX.Element) | undefined)
    ?? ((resolvedArgs) => createElement(meta.component, resolvedArgs))

  return renderToStaticMarkup(
    createElement(
      LanguageProvider,
      { initialLanguage: story.globals?.language ?? 'en' },
      createElement(ThemeProvider, null, render(args)),
    ),
  )
}

describe('UserConsoleHeader Storybook proofs', () => {
  it('keeps header-facing text styles free of ellipsis truncation', () => {
    const css = readFileSync(new URL('../styles/public.css', import.meta.url), 'utf8')
    const headerCss = css.slice(css.indexOf('.user-console-header'), css.indexOf('.user-badge'))

    expect(headerCss).not.toContain('text-overflow: ellipsis')
  })

  it('keeps the desktop, token-detail, and mobile collapsed stories available', () => {
    expect(meta).toMatchObject({
      title: 'Console/UserConsoleHeader',
      tags: ['autodocs'],
    })

    expect(headerStories.DesktopLanding).toMatchObject({
      name: 'storybook_canvas / desktop-landing',
    })
    expect(headerStories.TokenDetail).toMatchObject({
      name: 'storybook_canvas / token-detail',
    })
    expect(headerStories.MobileCollapsedActions).toMatchObject({
      name: 'storybook_canvas / mobile-collapsed-actions',
    })
    expect(headerStories.LongChineseSummary).toMatchObject({
      name: '中文摘要',
    })
  })

  it('renders the desktop landing proof with the shared skeleton and desktop actions', () => {
    const markup = renderStory(headerStories.DesktopLanding)

    expect(markup).toContain('Your account dashboard and token management')
    expect(markup).not.toContain('Tavily Hikari User Console')
    expect(markup).not.toContain('Overview')
    expect(markup).toContain('user-console-header-actions-desktop')
    expect(markup).toContain('user-console-header-actions-compact')
  })

  it('renders the token detail proof with the same header shell but token-specific context', () => {
    const markup = renderStory(headerStories.TokenDetail)

    expect(markup).toContain('Your account dashboard and token management')
    expect(markup).not.toContain('Token Detail')
    expect(markup).not.toContain('Inspect recent requests and quota windows.')
    expect(markup).not.toContain('user-console-header-inline-chip-view')
  })

  it('renders the mobile collapsed-actions proof with Chinese utility copy', () => {
    const markup = renderStory(headerStories.MobileCollapsedActions)

    expect(markup).not.toContain('用户控制台')
    expect(markup).toContain('/assets/relay-mesh-mobile-logo-light.svg')
    expect(markup).toContain('/assets/relay-mesh-mobile-logo-dark.svg')
    expect(markup).not.toContain('/relay-mesh-mobile-brand-light.png')
    expect(markup).not.toContain('/relay-mesh-mobile-brand-dark.png')
    expect(markup).toContain('偏好')
    expect(markup).toContain('打开通知')
    expect(markup).toContain('当前账户: Ivan')
    expect(markup).toContain('user-console-header-compact-tools')
    expect(markup).toContain('user-console-header-compact-account')
  })
})
