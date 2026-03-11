export function Title({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-2">
      <h1
        className="text-lg font-semibold tracking-tight leading-tight"
        style={{ color: 'var(--text-primary)' }}
      >
        {title}
      </h1>
      {description && (
        <p className="mt-0.5 text-xs leading-snug" style={{ color: 'var(--text-muted)' }}>
          {description}
        </p>
      )}
    </div>
  )
}
