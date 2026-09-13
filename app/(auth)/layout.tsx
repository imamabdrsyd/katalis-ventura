export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center p-6 gap-4">
      {children}
      <p className="text-xs text-gray-400 dark:text-gray-600">
        ©  2026 AXION Accounting Engine by Imam Abdurasyid 
      </p>
    </div>
  );
}
