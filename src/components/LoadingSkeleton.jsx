export default function LoadingSkeleton({ count = 3 }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-[var(--radius-video)] bg-bg-page">
          <div className="aspect-video w-full animate-skeleton bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100" />
          <div className="p-3 space-y-2">
            <div className="h-3.5 w-full rounded-full animate-skeleton bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100" />
            <div className="h-3.5 w-2/3 rounded-full animate-skeleton bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100" />
            <div className="flex items-center gap-3 pt-1">
              <div className="h-3 w-12 rounded-full animate-skeleton bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100" />
              <div className="h-3 w-16 rounded-full animate-skeleton bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
