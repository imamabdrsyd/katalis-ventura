import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ businessId: string; memberId: string }> }
) {
  try {
    const { businessId, memberId } = await params;

    // Verify the user is the creator of the business
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is the creator
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('created_by')
      .eq('id', businessId)
      .single();

    if (businessError || !business || business.created_by !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Check if member exists
    const { data: member, error: memberError } = await supabase
      .from('user_business_roles')
      .select('id, is_creator')
      .eq('business_id', businessId)
      .eq('user_id', memberId)
      .single();

    if (memberError || !member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Cannot kick the creator
    if (member.is_creator) {
      return NextResponse.json({ error: 'Cannot remove the creator' }, { status: 400 });
    }

    // Remove the member
    const { error: deleteError } = await supabase
      .from('user_business_roles')
      .delete()
      .eq('business_id', businessId)
      .eq('user_id', memberId);

    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing member:', error);
    return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 });
  }
}
