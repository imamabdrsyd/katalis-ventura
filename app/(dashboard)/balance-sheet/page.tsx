'use client';

import Image from 'next/image';

export default function BalanceSheetPage() {
  return (
    <div className="flex items-center justify-center min-h-[80vh]">
      <div className="text-center">
        <Image
          src="/images/KV.png"
          alt="Katalis Ventura Logo"
          width={80}
          height={80}
          className="mx-auto mb-6 rounded-xl"
        />
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">Under Construction</h1>
        <p className="text-gray-500 dark:text-gray-400">Imam sedang mengembangkan fitur Balance Sheet</p>
      </div>
    </div>
  );
}
