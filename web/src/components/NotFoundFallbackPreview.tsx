interface NotFoundFallbackPreviewProps {
  originalPath?: string
  returnHref?: string
}

export default function NotFoundFallbackPreview({
  originalPath = '/accounts',
  returnHref = '/',
}: NotFoundFallbackPreviewProps): JSX.Element {
  return (
    <div className="not-found-page-body">
      <main className="not-found-shell" role="main">
        <span className="not-found-badge" aria-hidden="true">Tavily Hikari Proxy</span>
        <p className="not-found-code">404</p>
        <h1 className="not-found-title">Page not found</h1>
        <p className="not-found-description">
          The page you’re trying to visit, <code>{originalPath}</code>, isn’t available right now.
        </p>
        <div className="not-found-actions">
          <a href={returnHref} className="not-found-primary" aria-label="Back to dashboard">
            Return to dashboard
          </a>
        </div>
        <p className="not-found-footer">Error reference: 404</p>
      </main>
    </div>
  )
}
