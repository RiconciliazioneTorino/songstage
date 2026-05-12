export type SessionState = {
  songIndex: number;
  semitones: number;
  fontScale: number;
  showChords: boolean;
  scrollPercent: number;
};

export const DEFAULT_STATE: SessionState = {
  songIndex: 0,
  semitones: 0,
  fontScale: 1,
  showChords: true,
  scrollPercent: 0,
};

type Msg =
  | { type: 'state'; state: SessionState }
  | { type: 'request_state' };

const CHANNEL = 'songstage-projection';

export class SessionBus {
  private bc: BroadcastChannel;
  private listeners: Set<(s: SessionState) => void> = new Set();
  private requestListeners: Set<() => void> = new Set();

  constructor() {
    this.bc = new BroadcastChannel(CHANNEL);
    this.bc.onmessage = (ev: MessageEvent<Msg>) => {
      const msg = ev.data;
      if (msg.type === 'state') {
        this.listeners.forEach(l => l(msg.state));
      } else if (msg.type === 'request_state') {
        this.requestListeners.forEach(l => l());
      }
    };
  }

  publish(state: SessionState) {
    this.bc.postMessage({ type: 'state', state });
  }

  requestState() {
    this.bc.postMessage({ type: 'request_state' });
  }

  onState(cb: (s: SessionState) => void) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  onRequestState(cb: () => void) {
    this.requestListeners.add(cb);
    return () => this.requestListeners.delete(cb);
  }

  close() {
    this.bc.close();
  }
}
