export default function SettingsLoading() {
  return (
    <div className="min-h-full bg-card">
      <div className="flex min-h-[calc(100vh-3rem)] flex-col divide-y divide-border lg:flex-row lg:divide-x lg:divide-y-0">
        <aside className="shrink-0 lg:w-56 xl:w-60">
          <div className="border-b border-border px-4 py-5 lg:border-b-0">
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            <div className="mt-2 h-3 w-40 animate-pulse rounded bg-muted" />
          </div>
          <div className="hidden lg:block p-3 space-y-2">
            <div className="h-3 w-16 animate-pulse rounded bg-muted mx-3" />
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-muted/80 mx-1" />
            ))}
          </div>
          <div className="lg:hidden px-4 py-3">
            <div className="flex gap-2 min-w-max">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-11 w-24 shrink-0 animate-pulse rounded-lg bg-muted/80" />
              ))}
            </div>
          </div>
        </aside>
        <div className="min-w-0 flex-1">
          <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10 space-y-6">
            <div className="h-7 w-32 animate-pulse rounded bg-muted" />
            <div className="h-4 w-64 max-w-full animate-pulse rounded bg-muted" />
            <div className="h-14 w-14 animate-pulse rounded-lg bg-muted" />
            <div className="rounded-lg border border-border overflow-hidden">
              {[1, 2].map((i) => (
                <div key={i} className="flex gap-4 border-b border-border last:border-b-0 px-4 py-4">
                  <div className="h-4 w-28 shrink-0 animate-pulse rounded bg-muted" />
                  <div className="h-4 flex-1 animate-pulse rounded bg-muted" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
