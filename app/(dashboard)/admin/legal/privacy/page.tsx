'use client';

import { LegalEditor } from '@/components/admin/LegalEditor';

export default function AdminPrivacyPage() {
  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <LegalEditor pageKey="privacy" />
    </div>
  );
}
