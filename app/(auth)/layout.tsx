export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-100 via-indigo-50 to-blue-100 dark:from-gray-900 dark:via-indigo-950/50 dark:to-gray-900 flex flex-col items-center justify-center p-6 gap-4">
      {children}
      <p className="text-xs text-gray-400 dark:text-gray-600">
        © 2026 Imam Abdurasyid. All rights reserved.
      </p>
    </div>
  );
}
