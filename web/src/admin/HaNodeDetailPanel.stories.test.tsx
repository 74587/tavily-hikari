import '../../test/happydom'

import { describe, expect, it } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import meta, * as stories from './HaNodeDetailPanel.stories'
import { LanguageProvider } from '../i18n'
import { ThemeProvider } from '../theme'

describe('HaNodeDetailPanel Storybook proofs', () => {
  it('keeps the node detail story available', () => {
    expect(meta).toMatchObject({
      title: 'Admin/HaNodeDetailPanel',
    })
    expect(stories.Default).toBeDefined()
  })

  it('keeps the selected peer detail free of current-node EdgeOne configuration', () => {
    const renderStory = meta.render as ((args: typeof stories.Default.args) => JSX.Element) | undefined

    const markup = renderToStaticMarkup(
      createElement(
        LanguageProvider,
        { initialLanguage: 'zh' },
        createElement(
          ThemeProvider,
          null,
          renderStory
            ? renderStory({
              ...(meta.args ?? {}),
              ...(stories.Default.args ?? {}),
            })
            : createElement((meta.component ?? (() => null)) as never, {
              ...(meta.args ?? {}),
              ...(stories.Default.args ?? {}),
            }),
        ),
      ),
    )

    expect(markup).toContain('查看 node-b 与当前节点 node-a')
    expect(markup).not.toContain('当前节点 EdgeOne 设置')
    expect(markup).not.toContain('配置源站')
    expect(markup).not.toContain('203.0.113.9:58087')
    expect(markup).not.toContain('运维上下文')
    expect(markup).toContain('复制 ACK 与 GC 健康')
    expect(markup).toContain('追赶中')
    expect(markup).toContain('存在过期积压')
    expect(markup).toContain('可执行')
    expect(markup).toContain('入流增量')
    expect(markup).toContain('净回收')
    expect(markup).toContain('+50')
    expect(markup).toContain('+250')
    expect(stories.Eligible).toBeDefined()
    expect(stories.Draining).toBeDefined()
    expect(stories.Deferred).toBeDefined()
    expect(stories.Recovering).toBeDefined()
    expect(stories.BaselineRequired).toBeDefined()
    expect(stories.Stalled).toBeDefined()
    expect(stories.Unknown).toBeDefined()
    expect(stories.Stale).toBeDefined()
    expect(stories.StateGallery).toBeDefined()
    expect(stories.Mobile393x852).toBeDefined()
    expect(stories.MobileStateGallery).toBeDefined()
    expect(stories.Mobile).toBeDefined()
  })

  it('renders stale and missing GC state as bilingual compatible states', () => {
    const staleMarkup = renderToStaticMarkup(
      createElement((meta.component ?? (() => null)) as never, {
        ...(meta.args ?? {}),
        ...(stories.Stale.args ?? {}),
      }),
    )
    const unknownMarkup = renderToStaticMarkup(
      createElement((meta.component ?? (() => null)) as never, {
        ...(meta.args ?? {}),
        ...(stories.Unknown.args ?? {}),
      }),
    )
    const legacyMarkup = renderToStaticMarkup(
      createElement((meta.component ?? (() => null)) as never, {
        ...(meta.args ?? {}),
        detail: {
          ...(stories.Default.args?.detail ?? meta.args?.detail),
          node: {
            ...(stories.Default.args?.detail ?? meta.args?.detail)?.node,
            channelHealth: (stories.Default.args?.detail ?? meta.args?.detail)?.node.channelHealth?.map((health) => ({
              ...health,
              gcState: '',
            })),
          },
        },
      }),
    )

    expect(staleMarkup).toContain('已过期')
    expect(unknownMarkup).toContain('未知')
    expect(staleMarkup).toMatch(/ha-node-panel-state[\s\S]*?已过期/)
    expect(legacyMarkup).toContain('未知')
  })
})
