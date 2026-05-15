import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getAuthenticatedUser } from '@/lib/supabase-server';
import { createBusinessSchema } from '@/lib/validations';
import { serverError, unauthorized, validationError } from '@/lib/api/server/responses';
import { normalizeRole } from '@/lib/roles';

const VALID_BANK_CODE = '1100'; // Cash account
const OWNERS_CAPITAL_CODE = '3100';
const OWNERS_CAPITAL_PARENT = '3000';

/**
 * POST /api/businesses
 * Create a new business, assign creator as manager, provision default accounts,
 * and optionally record initial capital investment as a double-entry transaction.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return unauthorized();

    const body = await request.json();
    const parsed = createBusinessSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const supabase = await createServerClient();

    const { data: profile } = await supabase
      .from('profiles')
      .select('default_role')
      .eq('id', user.id)
      .maybeSingle();
    const creatorRole = normalizeRole(profile?.default_role) === 'superadmin'
      ? 'superadmin'
      : 'business_manager';

    const { data: business, error: bizErr } = await supabase
      .from('businesses')
      .insert({
        ...parsed.data,
        capital_investment: parsed.data.capital_investment ?? 0,
        created_by: user.id,
      })
      .select()
      .single();

    if (bizErr || !business) return serverError(bizErr ?? new Error('Failed to create business'));

    // Assign creator role
    const { error: roleErr } = await supabase
      .from('user_business_roles')
      .insert({ user_id: user.id, business_id: business.id, role: creatorRole });

    if (roleErr) {
      // Rollback: delete the business so the user can retry cleanly.
      await supabase.from('businesses').delete().eq('id', business.id);
      return serverError(roleErr);
    }

    // Provision default chart of accounts (non-fatal if it fails)
    const { error: accErr } = await supabase.rpc('create_default_accounts', {
      p_business_id: business.id,
    });
    if (accErr) console.warn('Failed to create default accounts:', accErr);

    // Ensure Owner's Capital sub-account exists
    const { data: existing3100 } = await supabase
      .from('accounts')
      .select('id')
      .eq('business_id', business.id)
      .eq('account_code', OWNERS_CAPITAL_CODE)
      .maybeSingle();

    let ownersCapitalId = existing3100?.id ?? null;
    if (!ownersCapitalId) {
      const { data: parent } = await supabase
        .from('accounts')
        .select('id')
        .eq('business_id', business.id)
        .eq('account_code', OWNERS_CAPITAL_PARENT)
        .maybeSingle();

      if (parent) {
        const { data: created } = await supabase
          .from('accounts')
          .insert({
            business_id: business.id,
            account_code: OWNERS_CAPITAL_CODE,
            account_name: "Owner's Capital",
            account_type: 'EQUITY',
            parent_account_id: parent.id,
            normal_balance: 'CREDIT',
            is_system: true,
            sort_order: 3100,
            description: 'Modal pemilik',
            default_category: 'FIN',
            is_stock: true,
          })
          .select('id')
          .single();
        ownersCapitalId = created?.id ?? null;
      }
    }

    // Create initial capital injection transaction (Dr Cash / Cr Equity)
    const initialCapital = parsed.data.capital_investment ?? 0;
    if (initialCapital > 0 && ownersCapitalId) {
      const { data: cashAcc } = await supabase
        .from('accounts')
        .select('id')
        .eq('business_id', business.id)
        .eq('account_code', VALID_BANK_CODE)
        .maybeSingle();

      if (cashAcc) {
        await supabase.from('transactions').insert({
          business_id: business.id,
          date: new Date().toISOString().split('T')[0],
          category: 'FIN',
          name: 'Modal Investasi Awal',
          description: 'Setoran modal investasi awal dari pemilik',
          amount: initialCapital,
          account: 'Cash',
          created_by: user.id,
          debit_account_id: cashAcc.id,
          credit_account_id: ownersCapitalId,
          is_double_entry: true,
          status: 'posted',
          posted_at: new Date().toISOString(),
          notes: 'Transaksi modal investasi awal dibuat otomatis saat pembuatan bisnis',
        });
      }
    }

    return NextResponse.json({ data: business }, { status: 201 });
  } catch (err) {
    return serverError(err);
  }
}
