export function youtubeEmbedUrl(url: string): string | null {
  const id = extractVideoId(url);
  return id ? `https://www.youtube.com/embed/${id}` : null;
}

export function extractVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) {
      return u.pathname.replace(/^\/+/, '').split('/')[0] || null;
    }
    const v = u.searchParams.get('v');
    if (v) return v;
    const m = u.pathname.match(/^\/embed\/([^/?#]+)/);
    if (m) return m[1];
    return null;
  } catch {
    return null;
  }
}
