/**
 * Judo grades, lowest to highest: the kyu (coloured) belts, then the dan grades. `value` is what is
 * saved on the student (and printed on the hall ticket); the plain colours keep the values used
 * before ("White", "Yellow", …) so existing students still match.
 */
export interface Belt {
  value: string;
  label: string;
  /** Main colour of the belt */
  color: string;
  /** A red bar on the left end (the "with red bar" kyu grades) */
  redBar?: boolean;
  /** Alternating red and white panels (6th–8th dan) */
  striped?: boolean;
  group: "Kyu grades" | "Dan grades";
}

const WHITE = "#ffffff";
const YELLOW = "#f5d327";
const ORANGE = "#f08a24";
const GREEN = "#1f8f45";
const BLUE = "#2563c9";
const BROWN = "#7c4520";
const BLACK = "#111111";
export const RED = "#d62828";

const kyu = (value: string, color: string, redBar = false): Belt => ({
  value, label: `${value} Belt`.replace(" with Red Bar Belt", " Belt with Red Bar"), color, redBar, group: "Kyu grades",
});
const dan = (n: number, name: string, color: string, striped = false): Belt => {
  const ordinal = `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`;
  return { value: `${ordinal} Dan (${name})`, label: `${ordinal} Dan — ${name}`, color, striped, group: "Dan grades" };
};

export const BELTS: Belt[] = [
  kyu("White", WHITE),
  kyu("Yellow", YELLOW),
  kyu("Yellow with Red Bar", YELLOW, true),
  kyu("Orange", ORANGE),
  kyu("Orange with Red Bar", ORANGE, true),
  kyu("Green", GREEN),
  kyu("Green with Red Bar", GREEN, true),
  kyu("Blue", BLUE),
  kyu("Blue with Red Bar", BLUE, true),
  kyu("Brown", BROWN),
  kyu("Brown with Red Bar", BROWN, true),
  dan(1, "Shodan", BLACK),
  dan(2, "Nidan", BLACK),
  dan(3, "Sandan", BLACK),
  dan(4, "Yondan", BLACK),
  dan(5, "Godan", BLACK),
  dan(6, "Rokudan", RED, true),
  dan(7, "Shichidan", RED, true),
  dan(8, "Hachidan", RED, true),
  dan(9, "Kudan", RED),
  dan(10, "Judan", RED),
];

/** The belt for a saved value; "Black" (saved before dan grades were listed) shows as a plain black belt. */
export function findBelt(value: string): Belt | null {
  if (!value) return null;
  const known = BELTS.find((b) => b.value.toLowerCase() === value.trim().toLowerCase());
  if (known) return known;
  if (/^black$/i.test(value.trim())) return { value, label: "Black Belt", color: BLACK, group: "Dan grades" };
  return null;
}
