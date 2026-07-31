import { useLang } from '@rspress/runtime'
import DefaultTheme, { Layout as BasicLayout } from '@rspress/theme-default'

import './styles.css'

const docsBase = process.env.RSPRESS_DOCS_BASE || '/'

function assetPath(fileName: string): string {
  return `${docsBase === '/' ? '/' : docsBase}assets/${fileName}`
}

function DocsNavTitle(): JSX.Element {
  const lang = useLang()
  const label = lang === 'zh' ? 'Tavily Hikari 文档' : 'Tavily Hikari Docs'
  const homeHref = lang === 'zh' ? `${docsBase}zh/` : docsBase

  const renderAssetSet = (assetStem: string, assetKind: 'full' | 'compact'): JSX.Element => (
    <span className={`docs-brand-assets docs-brand-assets-${assetKind}`} aria-hidden="true">
      {(['light', 'dark'] as const).map((theme) => (
        <img
          key={theme}
          src={assetPath(`${assetStem}-${theme}.svg`)}
          alt=""
          className={`docs-brand-image docs-brand-image-${theme} docs-brand-image-${assetKind}`}
        />
      ))}
    </span>
  )

  return (
    <a className="docs-brand-lockup" href={homeHref} aria-label={label}>
      {renderAssetSet('relay-mesh-lockup', 'full')}
      {renderAssetSet('relay-mesh-mobile-logo', 'compact')}
    </a>
  )
}

export function Layout(): JSX.Element {
  return <BasicLayout navTitle={<DocsNavTitle />} />
}

export * from '@rspress/theme-default'

export default {
  ...DefaultTheme,
  Layout,
}
