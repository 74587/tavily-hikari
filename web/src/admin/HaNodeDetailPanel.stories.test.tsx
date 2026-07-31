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
    expect(stories.BaselineRequired).toBeDefined()
    expect(stories.Stalled).toBeDefined()
    expect(stories.Mobile).toBeDefined()
  })
})
