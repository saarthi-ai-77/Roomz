'use server';

import { getSupabaseServer } from '@/lib/supabase.server';
import { revalidatePath } from 'next/cache';
import type { Invitation } from '@/types/database';

export async function createHouseholdAction(name: string, timezone: string = 'Asia/Kolkata') {
  if (!name || name.trim().length === 0) {
    return { success: false, error: 'Household name is required.' };
  }

  const supabase = await getSupabaseServer();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (!user || userError) {
    return { success: false, error: 'Unauthorized. Please sign in.' };
  }

  // Try RPC create_household first
  const { data: householdId, error: rpcError } = await supabase.rpc('create_household', {
    p_name: name.trim(),
    p_timezone: timezone,
  });

  if (!rpcError && householdId) {
    revalidatePath('/dashboard');
    return { success: true, householdId };
  }

  // Fallback direct execution
  try {
    const { data: newHh, error: hhErr } = await supabase
      .from('households')
      .insert({
        name: name.trim(),
        timezone,
      })
      .select('id')
      .single();

    if (hhErr || !newHh) {
      return { success: false, error: hhErr?.message || 'Failed to create household.' };
    }

    // Add caller as owner
    await supabase.from('household_members').insert({
      household_id: newHh.id,
      profile_id: user.id,
      role: 'owner',
    });

    // Seed defaults if seed RPC exists
    await supabase.rpc('seed_household_defaults', { p_household_id: newHh.id });

    revalidatePath('/dashboard');
    return { success: true, householdId: newHh.id };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create household.';
    return { success: false, error: message };
  }
}

export async function joinHouseholdAction(token: string) {
  const cleanToken = token.trim();
  if (!cleanToken) {
    return { success: false, error: 'Invitation code is required.' };
  }

  const supabase = await getSupabaseServer();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (!user || userError) {
    return { success: false, error: 'Please sign in first to join a household.' };
  }

  // Try atomic RPC redeem_invitation
  const { data: hhId, error: rpcErr } = await supabase.rpc('redeem_invitation', {
    p_token: cleanToken,
    p_profile_id: user.id,
  });

  if (!rpcErr && hhId) {
    revalidatePath('/dashboard');
    return { success: true, householdId: hhId };
  }

  // Fallback transactional validation
  try {
    const { data: inv, error: invErr } = await supabase
      .from('invitations')
      .select('*')
      .eq('token', cleanToken)
      .single();

    if (invErr || !inv) {
      return { success: false, error: 'Invalid invitation code or link.' };
    }

    if (inv.revoked) {
      return { success: false, error: 'This invitation has been revoked.' };
    }

    if (new Date(inv.expires_at) < new Date()) {
      return { success: false, error: 'This invitation has expired.' };
    }

    if (inv.used >= inv.max_uses) {
      return { success: false, error: 'This invitation has already reached its usage limit.' };
    }

    // Check member count in household
    const { count, error: countErr } = await supabase
      .from('household_members')
      .select('*', { count: 'exact', head: true })
      .eq('household_id', inv.household_id);

    if (countErr) {
      return { success: false, error: 'Failed to verify household membership capacity.' };
    }

    if ((count ?? 0) >= 3) {
      return { success: false, error: 'This household already has the maximum of 3 members.' };
    }

    // Check if already a member
    const { data: existing } = await supabase
      .from('household_members')
      .select('id')
      .eq('household_id', inv.household_id)
      .eq('profile_id', user.id)
      .maybeSingle();

    if (existing) {
      return { success: true, householdId: inv.household_id };
    }

    // Add member
    const { error: joinErr } = await supabase.from('household_members').insert({
      household_id: inv.household_id,
      profile_id: user.id,
      role: 'member',
    });

    if (joinErr) {
      return { success: false, error: joinErr.message };
    }

    // Increment used
    await supabase
      .from('invitations')
      .update({ used: inv.used + 1 })
      .eq('id', inv.id);

    revalidatePath('/dashboard');
    return { success: true, householdId: inv.household_id };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error joining household.';
    return { success: false, error: message };
  }
}

export async function createInvitationAction(householdId: string) {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Unauthorized.' };
  }

  // Generate a random 8-character code and UUID token
  const randomChars = Math.random().toString(36).substring(2, 10).toUpperCase();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiration

  const { data: invitation, error } = await supabase
    .from('invitations')
    .insert({
      household_id: householdId,
      token: randomChars,
      created_by: user.id,
      expires_at: expiresAt.toISOString(),
      max_uses: 2, // for remaining 2 roommates
      used: 0,
      revoked: false,
    })
    .select('*')
    .single();

  if (error || !invitation) {
    return { success: false, error: error?.message || 'Failed to create invitation.' };
  }

  revalidatePath('/settings');
  return { success: true, invitation };
}

export async function getHouseholdInvitationsAction(householdId: string): Promise<Invitation[]> {
  const supabase = await getSupabaseServer();
  const { data } = await supabase
    .from('invitations')
    .select('*')
    .eq('household_id', householdId)
    .order('created_at', { ascending: false });

  return data || [];
}

export async function revokeInvitationAction(invitationId: string) {
  const supabase = await getSupabaseServer();
  const { error } = await supabase
    .from('invitations')
    .update({ revoked: true })
    .eq('id', invitationId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/settings');
  return { success: true };
}
