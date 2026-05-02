export function PageSkeleton() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      <div className="space-y-2">
        <div className="h-7 w-48 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        <div className="h-4 w-72 bg-gray-100 dark:bg-gray-800 rounded" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 bg-gray-100 dark:bg-gray-800 rounded-xl" />
        ))}
      </div>
      <div className="h-64 bg-gray-100 dark:bg-gray-800 rounded-xl" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 bg-gray-100 dark:bg-gray-800 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export function TableSkeleton() {
  return (
    <div className="p-6 space-y-4 animate-pulse">
      <div className="space-y-2">
        <div className="h-7 w-48 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        <div className="h-4 w-64 bg-gray-100 dark:bg-gray-800 rounded" />
      </div>
      <div className="h-10 bg-gray-100 dark:bg-gray-800 rounded-lg" />
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-14 bg-gray-100 dark:bg-gray-800 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export function ReportSkeleton() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-48 bg-gray-200 dark:bg-gray-700 rounded-lg" />
          <div className="h-4 w-56 bg-gray-100 dark:bg-gray-800 rounded" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-24 bg-gray-100 dark:bg-gray-800 rounded-lg" />
          <div className="h-9 w-24 bg-gray-100 dark:bg-gray-800 rounded-lg" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="h-72 bg-gray-100 dark:bg-gray-800 rounded-xl" />
        <div className="h-72 bg-gray-100 dark:bg-gray-800 rounded-xl" />
      </div>
      <div className="h-48 bg-gray-100 dark:bg-gray-800 rounded-xl" />
    </div>
  );
}
