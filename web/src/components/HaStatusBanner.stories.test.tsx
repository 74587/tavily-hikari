import { describe, expect, it } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import meta, * as stories from './HaStatusBanner.stories'
import { ThemeProvider } from '../theme'

describe('HaStatusBanner Storybook proofs', () => {
  it('keeps the HA node list story and local promote entry available', () => {
    expect(meta).toMatchObject({
      title: 'Components/HaStatusBanner',
    })
    expect(stories.NodeListGallery).toBeDefined()
    expect(stories.StandbyAdmin).toBeDefined()
  })

  it('renders service node rows with the master switch action', () => {
    const renderStory = meta.render as ((args: typeof stories.StandbyAdmin.args) => JSX.Element) | undefined
    expect(renderStory).toBeDefined()

    const markup = renderToStaticMarkup(
      createElement(
        ThemeProvider,
        null,
        renderStory?.({
          ...(meta.args ?? {}),
          ...(stories.StandbyAdmin.args ?? {}),
        }),
      ),
    )

    expect(markup).toContain('HA service nodes')
    expect(markup).toContain('Node inventory')
    expect(markup).toContain('node-b')
    expect(markup).toContain('configured-peer')
    expect(markup).toContain('Promote to master')
  })

  it('renders compact admin attention without node inventory actions', () => {
    const renderStory = meta.render as ((args: typeof stories.StandbyAdmin.args) => JSX.Element) | undefined
    expect(renderStory).toBeDefined()

    const markup = renderToStaticMarkup(
      createElement(
        ThemeProvider,
        null,
        renderStory?.({
          ...(meta.args ?? {}),
          ...(stories.StandbyAdmin.args ?? {}),
          adminVariant: 'compact',
          compactHref: '/admin/system-settings/ha',
          compactTitle: 'High availability needs attention',
          compactDescription: 'Open HA settings for details.',
          compactActionLabel: 'View HA settings',
        }),
      ),
    )

    expect(markup).toContain('High availability needs attention')
    expect(markup).toContain('View HA settings')
    expect(markup).not.toContain('Node inventory')
    expect(markup).not.toContain('Promote to master')
  })
})
