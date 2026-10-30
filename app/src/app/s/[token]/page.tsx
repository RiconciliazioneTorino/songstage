import { randomUUID } from 'node:crypto';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { ViewConsole } from '@/app/churches/[slug]/sets/[setId]/view/view';
import type { Slide } from '@/app/churches/[slug]/sets/[setId]/master/master';

type PublicItem = {
  itemId: string;
  songId: string;
  variationId: string | null;
  title: string;
  artist: string | null;
  originalKey: string | null;
  songTempo: number | null;
  songTimeSignature: string | null;
  isCanonical: boolean;
  transpose: number;
  body: string;
};

type PublicSet = { setId: string; setName: string; items: PublicItem[] };

export const metadata: Metadata = {
  title: 'SongStage',
  // A link pasted in a group chat shouldn't be crawled or indexed.
  robots: { index: false, follow: false },
};

/** The token is the only credential: resolved by a definer function that
 *  returns the set's lyrics and nothing else, or null once it expires. */
async function resolve(token: string): Promise<PublicSet | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc('public_set_by_token', { p_token: token });
  return (data as PublicSet | null) ?? null;
}

export default async function PublicSetPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const set = await resolve(token);

  if (!set) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-sm text-center space-y-3">
          <h1 className="text-lg">Link non più valido</h1>
          <p className="text-sm text-zinc-400">
            Questo link di condivisione è scaduto o è stato revocato. Chiedi al
            responsabile del set di inviarne uno nuovo.
          </p>
        </div>
      </main>
    );
  }

  const slides: Slide[] = set.items.map((i) => ({
    itemId: i.itemId,
    songId: i.songId,
    variationId: i.variationId,
    title: i.title,
    artist: i.artist,
    originalKey: i.originalKey,
    songTempo: i.songTempo,
    songTimeSignature: i.songTimeSignature,
    youtubeUrl: null,
    isCanonical: i.isCanonical,
    transpose: i.transpose,
    baseBody: '',
    availableVariations: [],
    variationBodies: {},
    body: i.body,
  }));

  return (
    <ViewConsole
      slug=""
      setId={set.setId}
      setName={set.setName}
      slides={slides}
      canBeMaster={false}
      // Presence key only: a guest has no account to identify.
      currentUserId={randomUUID()}
      currentUserEmail="ospite"
      liveMasterIsFresh={false}
      publicMode
    />
  );
}
