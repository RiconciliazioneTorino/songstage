import './style.css';
import { parseOnSong } from './onsong';
import { renderSong } from './render';
import { SAMPLE_SONGS } from './sample';
import { SessionBus, DEFAULT_STATE, type SessionState } from './sync';

const songs = SAMPLE_SONGS.map(parseOnSong);
const bus = new SessionBus();
let state: SessionState = { ...DEFAULT_STATE };

const root = document.querySelector<HTMLDivElement>('#app')!;
root.innerHTML = `
  <div class="app">
    <div class="toolbar">
      <div class="group">
        <button id="prev">◀ Prev</button>
        <select id="song"></select>
        <button id="next">Next ▶</button>
      </div>
      <div class="group">
        <span class="label">Transpose</span>
        <button id="t-down">−</button>
        <span id="t-val" class="pill">0</span>
        <button id="t-up">+</button>
        <button id="t-reset">Reset</button>
      </div>
      <div class="group">
        <span class="label">Font</span>
        <button id="f-down">A−</button>
        <button id="f-up">A+</button>
      </div>
      <div class="group">
        <label class="label"><input type="checkbox" id="chords" checked /> chords</label>
      </div>
      <div class="spacer"></div>
      <a href="/projector.html" target="_blank" class="pill" style="text-decoration:none;color:var(--accent);border-color:var(--accent);">Open Projector ↗</a>
    </div>
    <div class="viewport" id="viewport"></div>
  </div>
`;

const songSel = root.querySelector<HTMLSelectElement>('#song')!;
songs.forEach((s, i) => {
  const opt = document.createElement('option');
  opt.value = String(i);
  opt.textContent = s.meta.title ?? `Song ${i + 1}`;
  songSel.appendChild(opt);
});

const viewport = root.querySelector<HTMLDivElement>('#viewport')!;
const tVal = root.querySelector<HTMLSpanElement>('#t-val')!;
const chordsCb = root.querySelector<HTMLInputElement>('#chords')!;

function render() {
  songSel.value = String(state.songIndex);
  tVal.textContent = (state.semitones >= 0 ? '+' : '') + state.semitones;
  chordsCb.checked = state.showChords;
  viewport.innerHTML = '';
  viewport.appendChild(renderSong(songs[state.songIndex], {
    semitones: state.semitones,
    fontScale: state.fontScale,
    showChords: state.showChords,
  }));
}

function update(patch: Partial<SessionState>) {
  state = { ...state, ...patch };
  render();
  bus.publish(state);
}

root.querySelector('#prev')!.addEventListener('click', () => {
  if (state.songIndex > 0) update({ songIndex: state.songIndex - 1, semitones: 0 });
});
root.querySelector('#next')!.addEventListener('click', () => {
  if (state.songIndex < songs.length - 1) update({ songIndex: state.songIndex + 1, semitones: 0 });
});
songSel.addEventListener('change', () => update({ songIndex: Number(songSel.value), semitones: 0 }));

root.querySelector('#t-down')!.addEventListener('click', () => update({ semitones: state.semitones - 1 }));
root.querySelector('#t-up')!.addEventListener('click', () => update({ semitones: state.semitones + 1 }));
root.querySelector('#t-reset')!.addEventListener('click', () => update({ semitones: 0 }));

root.querySelector('#f-down')!.addEventListener('click', () => update({ fontScale: Math.max(0.6, state.fontScale - 0.1) }));
root.querySelector('#f-up')!.addEventListener('click', () => update({ fontScale: Math.min(3, state.fontScale + 0.1) }));

chordsCb.addEventListener('change', () => update({ showChords: chordsCb.checked }));

document.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
  if (e.key === 'ArrowRight' || e.key === 'PageDown') {
    if (state.songIndex < songs.length - 1) update({ songIndex: state.songIndex + 1, semitones: 0 });
  } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
    if (state.songIndex > 0) update({ songIndex: state.songIndex - 1, semitones: 0 });
  } else if (e.key === '+' || e.key === '=') {
    update({ semitones: state.semitones + 1 });
  } else if (e.key === '-' || e.key === '_') {
    update({ semitones: state.semitones - 1 });
  } else if (e.key === '0') {
    update({ semitones: 0 });
  }
});

bus.onRequestState(() => bus.publish(state));

viewport.addEventListener('scroll', () => {
  const max = viewport.scrollHeight - viewport.clientHeight;
  const pct = max > 0 ? viewport.scrollTop / max : 0;
  state.scrollPercent = pct;
  bus.publish(state);
});

render();
bus.publish(state);
