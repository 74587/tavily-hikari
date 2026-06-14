import '../../test/happydom'

import { afterEach, describe, expect, it } from 'bun:test'
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'

import meta, * as stories from './HaStatusBanner.stories'
import { LanguageProvider, translations } from '../i18n'
import { ThemeProvider } from '../theme'

async function flushEffects(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
  })
}

afterEach(() => {
  document.body.innerHTML = ''
})

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
        LanguageProvider,
        { initialLanguage: 'zh' },
        createElement(
          ThemeProvider,
          null,
          renderStory?.({
            ...(meta.args ?? {}),
            ...(stories.StandbyAdmin.args ?? {}),
          }),
        ),
      ),
    )

    expect(markup).toContain(translations.zh.admin.systemSettings.ha.panelTitle)
    expect(markup).toContain(translations.zh.admin.systemSettings.ha.nodeInventoryTitle)
    expect(markup).toContain('node-b')
    expect(markup).toContain('configured-peer')
    expect(markup).toContain(translations.zh.admin.systemSettings.ha.promoteToMaster)
  })

  it('renders compact admin attention without node inventory actions', () => {
    const renderStory = meta.render as ((args: typeof stories.StandbyAdmin.args) => JSX.Element) | undefined
    expect(renderStory).toBeDefined()

    const markup = renderToStaticMarkup(
      createElement(
        LanguageProvider,
        { initialLanguage: 'zh' },
        createElement(
          ThemeProvider,
          null,
          renderStory?.({
            ...(meta.args ?? {}),
            ...(stories.StandbyAdmin.args ?? {}),
            adminVariant: 'compact',
            compactHref: '/admin/system-settings/ha',
            compactTitle: translations.zh.admin.systemSettings.ha.compactTitle,
            compactDescription: translations.zh.admin.systemSettings.ha.compactDescription,
            compactActionLabel: translations.zh.admin.systemSettings.ha.viewSettings,
          }),
        ),
      ),
    )

    expect(markup).toContain(translations.zh.admin.systemSettings.ha.compactTitle)
    expect(markup).toContain(translations.zh.admin.systemSettings.ha.viewSettings)
    expect(markup).not.toContain(translations.zh.admin.systemSettings.ha.nodeInventoryTitle)
    expect(markup).not.toContain(translations.zh.admin.systemSettings.ha.promoteToMaster)
  })

  it('keeps the origin group source settings dialog story available', () => {
    expect(stories.OriginGroupSourceDialog).toBeDefined()
    expect(stories.OriginGroupSourceDialog.render).toBeDefined()

    const renderStory = stories.OriginGroupSourceDialog.render as (() => JSX.Element) | undefined
    const markup = renderToStaticMarkup(
      createElement(
        LanguageProvider,
        { initialLanguage: 'zh' },
        createElement(ThemeProvider, null, renderStory?.()),
      ),
    )

    expect(markup).toContain(translations.zh.admin.systemSettings.ha.configureSource)
    expect(markup).toContain(translations.zh.admin.systemSettings.ha.sourceKindOriginGroup)
  })

  it('keeps the direct source settings dialog story available', () => {
    expect(stories.DirectSourceDialog).toBeDefined()
    expect(stories.DirectSourceDialog.render).toBeDefined()

    const renderStory = stories.DirectSourceDialog.render as (() => JSX.Element) | undefined
    const markup = renderToStaticMarkup(
      createElement(
        LanguageProvider,
        { initialLanguage: 'zh' },
        createElement(ThemeProvider, null, renderStory?.()),
      ),
    )

    expect(markup).toContain(translations.zh.admin.systemSettings.ha.sourceKindDirect)
    expect(markup).toContain('203.0.113.9:58087')
  })

  it('renders the direct source selection summary inside the dialog portal', async () => {
    const renderStory = stories.DirectSourceDialog.render as (() => JSX.Element) | undefined
    expect(renderStory).toBeDefined()

    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(
        createElement(
          LanguageProvider,
          { initialLanguage: 'zh' },
          createElement(ThemeProvider, null, renderStory?.()),
        ),
      )
    })
    await flushEffects()

    const text = document.body.textContent ?? ''
    expect(text).toContain(translations.zh.admin.systemSettings.ha.sourceSelectedDirectLabel)
    expect(text).toContain('HTTPS · 203.0.113.9:58087')

    await act(async () => root.unmount())
  })

  it('renders the standby source dialog without the EdgeOne switch action', async () => {
    const renderStory = stories.StandbySourceDialog.render as (() => JSX.Element) | undefined
    expect(renderStory).toBeDefined()

    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(
        createElement(
          LanguageProvider,
          { initialLanguage: 'zh' },
          createElement(ThemeProvider, null, renderStory?.()),
        ),
      )
    })
    await flushEffects()

    const text = document.body.textContent ?? ''
    expect(text).toContain(translations.zh.admin.systemSettings.ha.roleStandby)
    expect(text).toContain(translations.zh.admin.systemSettings.ha.sourceSave)
    expect(text).not.toContain(translations.zh.admin.systemSettings.ha.sourceSaveAndApply)

    await act(async () => root.unmount())
  })
})
