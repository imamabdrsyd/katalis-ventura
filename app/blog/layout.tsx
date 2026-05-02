import Link from 'next/link';
import Image from 'next/image';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 flex flex-col">
      <header className="sticky top-0 z-50 bg-white/90 dark:bg-gray-900/90 backdrop-blur border-b border-gray-200 dark:border-gray-800">
        <nav className="container mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/images/axion.png"
              alt="AXION"
              width={100}
              height={32}
              className="object-contain dark:hidden"
            />
            <Image
              src="/images/axion-dark.png"
              alt="AXION"
              width={100}
              height={32}
              className="object-contain hidden dark:block"
            />
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/blog"
              className="text-sm font-semibold text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            >
              Blog
            </Link>
            <Link
              href="/login"
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Masuk AXION
            </Link>
            <ThemeToggle />
          </div>
        </nav>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="bg-indigo-600 mt-16">
        <div className="container mx-auto px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-indigo-100">
          <p>&copy; 2026 PT Imam Katalis Ventura. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:text-white transition-colors">
              Beranda
            </Link>
            <Link href="/blog" className="hover:text-white transition-colors">
              Blog
            </Link>
            <Link href="/login" className="hover:text-white transition-colors">
              Masuk
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
