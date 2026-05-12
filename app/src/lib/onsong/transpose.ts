const SHARP_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_NOTES  = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

const NOTE_TO_INDEX: Record<string, number> = {
  'C': 0, 'B#': 0,
  'C#': 1, 'Db': 1,
  'D': 2,
  'D#': 3, 'Eb': 3,
  'E': 4, 'Fb': 4,
  'F': 5, 'E#': 5,
  'F#': 6, 'Gb': 6,
  'G': 7,
  'G#': 8, 'Ab': 8,
  'A': 9,
  'A#': 10, 'Bb': 10,
  'B': 11, 'Cb': 11,
};

const FLAT_KEYS = new Set(['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm', 'Abm']);

function preferFlats(targetKey: string): boolean {
  return FLAT_KEYS.has(targetKey.replace(/\s+/g, ''));
}

function parseRoot(s: string): { index: number; rest: string } | null {
  if (s.length >= 2 && (s[1] === '#' || s[1] === 'b')) {
    const root = s.slice(0, 2);
    if (root in NOTE_TO_INDEX) return { index: NOTE_TO_INDEX[root], rest: s.slice(2) };
  }
  if (s.length >= 1 && s[0] in NOTE_TO_INDEX) {
    return { index: NOTE_TO_INDEX[s[0]], rest: s.slice(1) };
  }
  return null;
}

export function transposeChord(chord: string, semitones: number, targetKey: string): string {
  if (semitones === 0) return chord;
  const trimmed = chord.trim();
  if (!trimmed) return chord;

  const slashIdx = trimmed.indexOf('/');
  const main = slashIdx === -1 ? trimmed : trimmed.slice(0, slashIdx);
  const bass = slashIdx === -1 ? '' : trimmed.slice(slashIdx + 1);

  const mainParsed = parseRoot(main);
  if (!mainParsed) return chord;

  const useFlats = preferFlats(targetKey);
  const noteSet = useFlats ? FLAT_NOTES : SHARP_NOTES;

  const newMainIdx = ((mainParsed.index + semitones) % 12 + 12) % 12;
  let result = noteSet[newMainIdx] + mainParsed.rest;

  if (bass) {
    const bassParsed = parseRoot(bass);
    if (bassParsed) {
      const newBassIdx = ((bassParsed.index + semitones) % 12 + 12) % 12;
      result += '/' + noteSet[newBassIdx] + bassParsed.rest;
    } else {
      result += '/' + bass;
    }
  }

  return result;
}

export function transposeKey(originalKey: string, semitones: number): string {
  if (!originalKey) return originalKey;
  const minor = originalKey.endsWith('m') && !originalKey.endsWith('dim') && !originalKey.endsWith('sus');
  const root = minor ? originalKey.slice(0, -1) : originalKey;
  const parsed = parseRoot(root);
  if (!parsed) return originalKey;
  const newIdx = ((parsed.index + semitones) % 12 + 12) % 12;
  const target = (minor ? FLAT_NOTES : SHARP_NOTES)[newIdx];
  return target + (minor ? 'm' : '');
}
