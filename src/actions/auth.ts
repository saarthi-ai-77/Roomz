'use server';

import { getSupabaseServer } from '@/lib/supabase.server';
import { redirect } from 'next/navigation';
import type { Profile, Household, HouseholdMember } from '@/types/database';

export interface AuthState {
  error?: string;
  success?: boolean;
}

export async function signInAction(prevState: AuthState | null, formData: FormData): Promise<AuthState> {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  if (!email || !password) {
    return { error: 'Please enter both email and password.' };
  }

  const supabase = await getSupabaseServer();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  redirect('/dashboard');
}

export async function signUpAction(prevState: AuthState | null, formData: FormData): Promise<AuthState> {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const fullName = formData.get('fullName') as string;

  if (!email || !password || !fullName) {
    return { error: 'All fields are required.' };
  }

  if (password.length < 6) {
    return { error: 'Password must be at least 6 characters long.' };
  }

  const supabase = await getSupabaseServer();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  // Ensure profile row exists
  if (data.user) {
    await supabase.from('profiles').upsert({
      id: data.user.id,
      auth_uid: data.user.id,
      email: data.user.email,
      full_name: fullName,
    });
  }

  redirect('/onboarding');
}

export async function signOutAction(): Promise<void> {
  const supabase = await getSupabaseServer();
  await supabase.auth.signOut();
  redirect('/login');
}

export async function getCurrentUserAndHousehold(): Promise<{
  user: { id: string; email: string } | null;
  profile: Profile | null;
  household: Household | null;
  members: HouseholdMember[];
  role: 'owner' | 'member' | null;
}> {
  try {
    const supabase = await getSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { user: null, profile: null, household: null, members: [], role: null };
    }

    // Fetch or ensure profile
    let { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('auth_uid', user.id)
      .single();

    if (!profile) {
      // Create profile fallback
      const { data: newProfile } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          auth_uid: user.id,
          email: user.email ?? '',
          full_name: user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? 'Roommate',
        })
        .select('*')
        .single();
      profile = newProfile;
    }

    if (!profile) {
      return {
        user: { id: user.id, email: user.email ?? '' },
        profile: null,
        household: null,
        members: [],
        role: null,
      };
    }

    // Find household membership
    const { data: membership } = await supabase
      .from('household_members')
      .select('*, household:households(*)')
      .eq('profile_id', profile.id)
      .limit(1)
      .single();

    if (!membership || !membership.household) {
      return {
        user: { id: user.id, email: user.email ?? '' },
        profile,
        household: null,
        members: [],
        role: null,
      };
    }

    const household = membership.household as unknown as Household;
    const role = membership.role as 'owner' | 'member';

    // Fetch all members of this household with profiles
    const { data: rawMembers } = await supabase
      .from('household_members')
      .select('*, profile:profiles(*)')
      .eq('household_id', household.id);

    const members: HouseholdMember[] = (rawMembers || []).map((m: unknown) => {
      const item = m as HouseholdMember & { profile: Profile };
      return {
        id: item.id,
        household_id: item.household_id,
        profile_id: item.profile_id,
        role: item.role,
        joined_at: item.joined_at,
        profile: item.profile,
      };
    });

    return {
      user: { id: user.id, email: user.email ?? '' },
      profile,
      household,
      members,
      role,
    };
  } catch (err) {
    console.error('Error fetching current user & household:', err);
    return { user: null, profile: null, household: null, members: [], role: null };
  }
}
