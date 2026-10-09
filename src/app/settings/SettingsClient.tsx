'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Copy,
  Check,
  UserPlus,
  LogOut,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatDate } from '@/lib/utils';
import { createInvitationAction, revokeInvitationAction } from '@/actions/households';
import { signOutAction } from '@/actions/auth';
import type {
  Household,
  HouseholdMember,
  Profile,
  Invitation,
} from '@/types/database';

interface SettingsClientProps {
  currentUserId: string;
  profile: Profile | null;
  household: Household;
  members: HouseholdMember[];
  invitations: Invitation[];
}

export function SettingsClient({
  currentUserId,
  profile,
  household,
  members,
  invitations,
}: SettingsClientProps) {
  const router = useRouter();
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCopy = (token: string) => {
    navigator.clipboard.writeText(token);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2500);
  };

  const handleCreateInvite = async () => {
    if (members.length >= 3) {
      setError('This household already has the maximum limit of 3 roommates.');
      return;
    }

    setIsGenerating(true);
    setError(null);
    const res = await createInvitationAction(household.id);
    setIsGenerating(false);

    if (res.success) {
      router.refresh();
    } else {
      setError(res.error || 'Failed to generate invitation.');
    }
  };

  const handleRevoke = async (id: string) => {
    setRevokingId(id);
    await revokeInvitationAction(id);
    setRevokingId(null);
    router.refresh();
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
          Household & Settings
        </h1>
        <p className="text-xs text-slate-500">
          Manage roommates, invitations, timezone, and your account.
        </p>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 p-3 text-xs font-medium text-rose-700 border border-rose-200">
          {error}
        </div>
      )}

      {/* Household Overview */}
      <Card className="p-5">
        <CardHeader className="p-0 pb-3">
          <CardTitle className="text-base font-bold">Household Profile</CardTitle>
          <CardDescription>General settings for this shared space</CardDescription>
        </CardHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-1">
          <div className="space-y-1">
            <span className="text-slate-500 font-medium">Household Name</span>
            <div className="font-semibold text-slate-900 text-sm">{household.name}</div>
          </div>
          <div className="space-y-1">
            <span className="text-slate-500 font-medium">Accounting Timezone</span>
            <div className="font-semibold text-slate-900 text-sm">
              {household.timezone} (Indian Standard Time)
            </div>
          </div>
        </div>
      </Card>

      {/* Roommates List */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold">Active Roommates</CardTitle>
            <CardDescription>
              Shared household members ({members.length} of 3 maximum)
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-xs">
            {3 - members.length} spots open
          </Badge>
        </div>

        <div className="divide-y divide-slate-100">
          {members.map((m) => {
            const prof = m.profile;
            if (!prof) return null;
            const isCurrentUser = prof.id === currentUserId;

            return (
              <div
                key={prof.id}
                className="py-3 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-100 text-sky-800 font-bold text-xs">
                    {prof.full_name?.charAt(0).toUpperCase() || 'R'}
                  </div>
                  <div>
                    <div className="font-semibold text-xs text-slate-900 flex items-center gap-1.5">
                      {prof.full_name || prof.email}
                      {isCurrentUser && (
                        <span className="text-[10px] text-sky-600 bg-sky-50 px-1.5 py-0.2 rounded font-normal">
                          You
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-500">{prof.email}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge
                    variant={m.role === 'owner' ? 'info' : 'default'}
                    className="text-[10px] capitalize"
                  >
                    {m.role}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Invitation Management */}
      <Card className="p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base font-bold">Roommate Invitations</CardTitle>
            <CardDescription>
              Generate secure invitation codes for your remaining roommates to join this room
            </CardDescription>
          </div>

          {members.length < 3 && (
            <Button
              size="sm"
              variant="primary"
              isLoading={isGenerating}
              onClick={handleCreateInvite}
              className="gap-2 text-xs font-semibold"
            >
              <UserPlus className="h-4 w-4" />
              Generate Invitation Code
            </Button>
          )}
        </div>

        <div className="divide-y divide-slate-100 mt-2">
          {invitations.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No invitation codes generated yet. Click &quot;Generate Invitation Code&quot; above to invite a roommate.
            </div>
          ) : (
            invitations.map((inv) => {
              const isExpired = new Date(inv.expires_at) < new Date();
              const isUsable = !inv.revoked && !isExpired && inv.used < inv.max_uses;

              return (
                <div
                  key={inv.id}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-slate-900 tracking-wider bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        {inv.token}
                      </span>
                      {inv.revoked ? (
                        <Badge variant="danger" className="text-[10px]">
                          Revoked
                        </Badge>
                      ) : isExpired ? (
                        <Badge variant="outline" className="text-[10px]">
                          Expired
                        </Badge>
                      ) : (
                        <Badge variant="success" className="text-[10px]">
                          Active ({inv.used}/{inv.max_uses} used)
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Expires {formatDate(inv.expires_at)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {isUsable && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopy(inv.token)}
                        className="text-xs gap-1.5"
                      >
                        {copiedToken === inv.token ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5 text-slate-400" />
                            <span>Copy Code</span>
                          </>
                        )}
                      </Button>
                    )}

                    {!inv.revoked && (
                      <Button
                        size="sm"
                        variant="ghost"
                        isLoading={revokingId === inv.id}
                        onClick={() => handleRevoke(inv.id)}
                        className="text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                      >
                        Revoke
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>

      {/* Account Profile & Sign Out */}
      <Card className="p-5 flex items-center justify-between">
        <div className="space-y-0.5">
          <span className="text-xs font-semibold text-slate-900 block">
            {profile?.full_name || 'Roommate'}
          </span>
          <span className="text-[11px] text-slate-500">{profile?.email}</span>
        </div>

        <form action={signOutAction}>
          <Button type="submit" variant="outline" size="sm" className="gap-2 text-xs text-rose-600 hover:bg-rose-50 border-rose-200">
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </Button>
        </form>
      </Card>
    </div>
  );
}
