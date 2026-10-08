/**
 * Grouping chord/lyric pairs into words, so a narrow screen breaks a line
 * between words instead of inside one.
 *
 * A chord can land mid-word ("Ad[G]orerò"), which splits that word into two
 * pairs. Each pair renders as its own unbreakable column, so without this
 * grouping the line is free to wrap between them and the reader gets
 * "Loderò, con la f / orza che ho".
 */

export type Pair = { chord: string | null; lyric: string };

/**
 * A run of pairs with no whitespace between them — one unbreakable unit.
 * The space that followed a word stays on that word's last pair, so the gap
 * survives on screen and disappears when the line wraps there.
 */
export type Word = Pair[];

export function groupIntoWords(pairs: Pair[]): Word[] {
  const words: Word[] = [];
  let current: Word = [];

  for (const pair of pairs) {
    // A bare chord (an instrumental stab) is its own unit: there is no word to
    // attach it to, and it may wrap freely.
    if (pair.chord && !/\S/.test(pair.lyric)) {
      if (current.length > 0) {
        words.push(current);
        current = [];
      }
      words.push([pair]);
      continue;
    }

    // Split on whitespace, keeping it: "con la f" -> ["con", " ", "la", " ", "f"]
    const segments = pair.lyric.split(/(\s+)/).filter((seg) => seg !== '');
    let chordUsed = false;

    for (const segment of segments) {
      if (/^\s+$/.test(segment)) {
        // Trailing space closes the word it followed.
        if (current.length > 0) {
          current[current.length - 1] = {
            ...current[current.length - 1],
            lyric: current[current.length - 1].lyric + segment,
          };
          words.push(current);
          current = [];
        } else {
          words.push([{ chord: chordUsed ? null : pair.chord, lyric: segment }]);
          chordUsed = true;
        }
        continue;
      }
      // The chord belongs to the first segment only; the rest of the pair's
      // text carries no chord of its own.
      current.push({ chord: chordUsed ? null : pair.chord, lyric: segment });
      chordUsed = true;
    }

    // An empty lyric with a chord already left via the branch above; an empty
    // lyric without one contributes nothing.
  }

  if (current.length > 0) words.push(current);
  return words;
}
