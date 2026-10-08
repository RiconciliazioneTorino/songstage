import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AddMemberForm } from './add-member-form';
import { BandsSection } from './bands-section';
import { MemberRoleSelect } from './member-role-select';
import { RemoveMemberButton } from './remove-member-button';

export default async function ChurchPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: church } = await supabase
    .from('churches')
    .select('id, name, slug, created_at')
    .eq('slug', slug)
    .maybeSingle();
  if (!church) notFound();

  const { data: myMembership } = await supabase
    .from('church_members')
    .select('role')
    .eq('church_id', church.id)
    .eq('user_id', user.id)
    .maybeSingle();
  const myRole = myMembership?.role as 'admin' | 'director' | 'musico' | 'lector' | undefined;
  const isAdmin = myRole === 'admin';

  const { data: members } = await supabase
    .from('church_members')
    .select('role, joined_at, user:users(id, email, display_name)')
    .eq('church_id', church.id);

  const { data: bands } = await supabase
    .from('bands')
    .select('id, name, members:band_members(user_id)')
    .eq('church_id', church.id)
    .order('name');

  const canManageBands = myRole === 'admin' || myRole === 'director';

  const { data: invitations } = isAdmin
    ? await supabase
        .from('church_invitations')
        .select('id, email, role, created_at')
        .eq('church_id', church.id)
        .order('created_at', { ascending: false })
    : { data: [] };

  return (
    <main className="min-h-screen px-4 py-6 sm:p-8 max-w-3xl mx-auto">
      <Link href="/dashboard" className="text-sm text-zinc-400 hover:text-white">← Chiese</Link>
      <header className="mt-4 mb-8">
        <h1 className="text-3xl font-bold">{church.name}</h1>
        <p className="text-zinc-400 text-sm">/{church.slug} · il tuo ruolo: <span className="uppercase">{myRole}</span></p>
      </header>

      <section className="mb-8">
        <div className="grid grid-cols-2 gap-3">
          <Link
            href={`/churches/${church.slug}/songs`}
            className="rounded-lg border border-border bg-panel p-4 text-center hover:border-accent transition"
          >
            <div className="font-medium">Canzoni</div>
            <div className="text-xs text-zinc-500 mt-0.5">Repertorio della chiesa</div>
          </Link>
          <Link
            href={`/churches/${church.slug}/sets`}
            className="rounded-lg border border-border bg-panel p-4 text-center hover:border-accent transition"
          >
            <div className="font-medium">Set</div>
            <div className="text-xs text-zinc-500 mt-0.5">Scalette per gli eventi</div>
          </Link>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Membri</h2>
          <span className="text-xs text-zinc-500">{members?.length ?? 0}</span>
        </div>
        <div className="space-y-2">
          {(members ?? []).flatMap((m) => (m.user ? [{ ...m, user: m.user }] : [])).map((m) => (
            <div
              key={m.user.id}
              className="flex items-center justify-between rounded-md border border-border bg-panel px-3 py-2"
            >
              <div className="min-w-0">
                <div className="text-sm truncate">{m.user.display_name ?? m.user.email}</div>
                <div className="text-xs text-zinc-500 truncate">{m.user.email}</div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                {isAdmin ? (
                  <MemberRoleSelect
                    churchId={church.id}
                    userId={m.user.id}
                    role={m.role}
                  />
                ) : (
                  <span className="text-xs text-zinc-400 uppercase tracking-wide">{m.role}</span>
                )}
                {isAdmin && (
                  <RemoveMemberButton
                    churchId={church.id}
                    userId={m.user.id}
                    label={m.user.display_name ?? m.user.email}
                  />
                )}
              </div>
            </div>
          ))}
        </div>

        {isAdmin && (
          <AddMemberForm
            churchId={church.id}
            invitations={invitations ?? []}
          />
        )}
      </section>

      <section className="mt-10">
        <BandsSection
          churchSlug={church.slug}
          bands={bands ?? []}
          canManage={canManageBands}
        />
      </section>
    </main>
  );
}
