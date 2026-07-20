// Next.js shows this as a Suspense fallback while any page under (app)
// resolves its server-side data fetching — previously there was nothing
// here, so slow queries just left a blank screen with no feedback.
export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 bg-slate-200 rounded" />
      <div className="h-24 bg-slate-100 rounded-xl border border-slate-200" />
      <div className="h-64 bg-slate-100 rounded-xl border border-slate-200" />
    </div>
  )
}
