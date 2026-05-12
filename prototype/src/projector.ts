import './style.css';
import { parseOnSong } from './onsong';
import { renderSong } from './render';
import { SAMPLE_SONGS } from './sample';
import { SessionBus, DEFAULT_STATE, type SessionState } from './sync';

const songs = SAMPLE_SONGS.map(parseOnSong);
const bus = new SessionBus();
let state: SessionState = { ...DEFAULT_STATE };

document.body.classList.add('projector');
const root = document.querySelector<HTMLDivElement>('#app')!;
root.innerHTML = `<div class="app"><div class="viewport" id="viewport"></div></div>`;
const viewport = root.querySelector<HTMLDivElement>('#viewport')!;

function render() {
  viewport.innerHTML = '';
  viewport.appendChild(renderSong(songs[state.songIndex], {
    semitones: state.semitones,
    fontScale: state.fontScale,
    showChords: state.showChords,
  }));
  const max = viewport.scrollHeight - viewport.clientHeight;
  viewport.scrollTop = max * state.scrollPercent;
}

bus.onState((s) => {
  state = s;
  render();
});

bus.requestState();
render();
