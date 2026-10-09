/**
 * One-shot loader for the YouTube IFrame API. Returns the YT namespace so a
 * player can be constructed with `new YT.Player(...)`.
 */

export type YtPlayer = {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (sec: number, allowSeekAhead: boolean) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  mute: () => void;
  unMute: () => void;
  setVolume: (v: number) => void;
  destroy: () => void;
};

export type YtApi = {
  Player: new (
    el: Element | string,
    cfg: {
      videoId: string;
      width?: number | string;
      height?: number | string;
      playerVars?: Record<string, number | string>;
      events?: {
        onReady?: (e: { target: YtPlayer }) => void;
        onStateChange?: (e: { data: number; target: YtPlayer }) => void;
      };
    }
  ) => YtPlayer;
};

let apiPromise: Promise<YtApi> | null = null;

export function loadYouTubeApi(): Promise<YtApi> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('No window'));
  }
  const w = window as unknown as {
    YT?: YtApi;
    onYouTubeIframeAPIReady?: () => void;
  };
  if (w.YT?.Player) return Promise.resolve(w.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<YtApi>((resolve) => {
    const previous = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (w.YT) resolve(w.YT);
    };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.async = true;
    document.head.appendChild(s);
  });
  return apiPromise;
}
