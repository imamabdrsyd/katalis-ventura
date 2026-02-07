'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';

const BUSINESS_TYPES = [
  { value: 'agribusiness', label: 'Agribusiness' },
  { value: 'personal_care', label: 'Personal Care' },
  { value: 'accommodation', label: 'Accommodation' },
  { value: 'creative_agency', label: 'Creative Agency' },
  { value: 'food_and_beverage', label: 'F&B' },
  { value: 'other', label: 'Lainnya (Custom)' },
];

export default function SetupBusinessPage() {
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('agribusiness');
  const [customType, setCustomType] = useState('');
  const [propertyAddress, setPropertyAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  const router = useRouter();
  const supabase = createClient();

  // Check authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        
        if (!user) {
          router.push('/login');
        } else {
          setIsCheckingAuth(false);
        }
      } catch (err) {
        console.error('Auth check error:', err);
        router.push('/login');
      }
    };

    checkAuth();
  }, [router, supabase]);

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Determine final business type
      const finalBusinessType = businessType === 'other' ? customType.trim() : businessType;

      // Create business
      const { data: business, error: businessError } = await supabase
        .from('businesses')
        .insert({
          business_name: businessName,
          business_type: finalBusinessType,
          capital_investment: 0, // Set to 0, modal akan diinput via transaksi CAPEX
          property_address: propertyAddress,
          created_by: user.id,
        })
        .select()
        .single();

      if (businessError) throw businessError;

      // Assign user as business manager
      const { error: roleError } = await supabase.from('user_business_roles').insert({
        user_id: user.id,
        business_id: business.id,
        role: 'business_manager',
      });

      if (roleError) throw roleError;

      // Redirect to dashboard
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'An error occurred during business setup');
    } finally {
      setLoading(false);
    }
  };

  // Show nothing while checking authentication
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">Checking authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl mx-auto mb-4 flex items-center justify-center text-white text-2xl">
            🏢
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Setup Your Business</h1>
          <p className="text-gray-500 text-sm mt-2">
            Let's get your business registered in the system
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <form onSubmit={handleSetup} className="space-y-6">
          <div>
            <label className="label">Business Name *</label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="e.g., Katalis Studio"
              className="input"
              required
            />
          </div>

          <div>
            <label className="label">Tipe Bisnis</label>
            <select
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
              className="input"
            >
              {BUSINESS_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            {businessType === 'other' && (
              <input
                type="text"
                value={customType}
                onChange={(e) => setCustomType(e.target.value)}
                className="input mt-2"
                placeholder="Masukkan tipe bisnis custom"
                required
              />
            )}
          </div>

          <div>
            <label className="label">Property Address</label>
            <textarea
              value={propertyAddress}
              onChange={(e) => setPropertyAddress(e.target.value)}
              placeholder="Galeri Ciumbuleuit Apartment 2, Bandung, West Java"
              rows={3}
              className="input"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="btn-secondary flex-1 py-3"
              disabled={loading}
            >
              Back
            </button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 py-3">
              {loading ? 'Creating...' : 'Create Business & Continue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}