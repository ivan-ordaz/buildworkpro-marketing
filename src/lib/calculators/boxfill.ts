// Box fill for one outlet, device or junction box under NEC 314.16: the volume
// the contents need, itemized by counting rule, against the box's volume plus
// any rings, and the smallest standard box that would work. Pure functions only;
// the page controller and the Playwright spec both import them, so the numbers
// on the page and in the tests come from one place.
//
// Sources (section numbers only; the code text is not reproduced):
//   Volume per conductor, 314.16(B) table, and standard metal box volumes,
//   Table 314.16(A): NEC tables as reprinted in the Steel City (Thomas & Betts,
//   now ABB) metallic box catalog, "NEC Reference", pages A-4 and A-5. Both
//   tables are unchanged through the 2023 edition.
//   Counting rules 314.16(B)(1) through (B)(5): same catalog reprint.
//   Equipment grounding conductors, 314.16(B)(5): the 2020 NEC changed the rule
//   to one allowance for up to four, plus a quarter allowance for each one after
//   four, and dropped the separate allowance for an isolated ground set under
//   250.146(D) (Leviton 2020 NEC change summary; electricallicenserenewal.com
//   2020 NEC text). The 2023 NEC kept that rule.
//   Terminal blocks, 314.16(B)(6): new in the 2023 NEC, one allowance per
//   terminal block assembly sized by the largest conductor terminated on it.
//   Free conductor length, 300.14: 6 in, so a loop counts twice at 12 in or more.
import { nonNeg } from './format';

export const TOOL = 'box-fill-calculator';

/** Conductor sizes 314.16 covers, in the order of the NEC table. 4 AWG and larger go to 314.28. */
export const SIZES = ['18', '16', '14', '12', '10', '8', '6'] as const;
export type Size = (typeof SIZES)[number];

/** Free space per conductor, cu in, 314.16(B). */
export const VOLUME_PER_CONDUCTOR: Record<Size, number> = {
  '18': 1.5,
  '16': 1.75,
  '14': 2.0,
  '12': 2.25,
  '10': 2.5,
  '8': 3.0,
  '6': 5.0,
};

export const EDITIONS = {
  '2023': '2023 NEC',
  '2020': '2020 NEC',
  '2017': '2017 NEC',
} as const;
export type Edition = keyof typeof EDITIONS;

/** Up to this many grounds share one allowance (2020 NEC and later). */
export const EGC_SHARED = 4;
/** Allowance for each ground after the first four (2020 NEC and later). */
export const EGC_EXTRA = 0.25;
/** Minimum free conductor at a box, in, 300.14. A loop at least twice this counts twice. */
export const FREE_LENGTH_IN = 6;

export const FAMILIES = {
  round: 'round or octagonal',
  square: 'square',
  device: 'device',
  masonry: 'masonry',
  fsfd: 'FS or FD',
} as const;
export type Family = keyof typeof FAMILIES;

type BoxSpec = { label: string; family: Family; volume: number };

/** Standard metal boxes and their volumes, cu in, Table 314.16(A). Masonry boxes are per gang. */
export const BOXES = {
  'r4-125': { label: '4 × 1¼ in round/octagonal', family: 'round', volume: 12.5 },
  'r4-15': { label: '4 × 1½ in round/octagonal', family: 'round', volume: 15.5 },
  'r4-218': { label: '4 × 2⅛ in round/octagonal', family: 'round', volume: 21.5 },
  's4-125': { label: '4 in square × 1¼ in', family: 'square', volume: 18.0 },
  's4-15': { label: '4 in square × 1½ in', family: 'square', volume: 21.0 },
  's4-218': { label: '4 in square × 2⅛ in', family: 'square', volume: 30.3 },
  's411-125': { label: '4-11/16 in square × 1¼ in', family: 'square', volume: 25.5 },
  's411-15': { label: '4-11/16 in square × 1½ in', family: 'square', volume: 29.5 },
  's411-218': { label: '4-11/16 in square × 2⅛ in', family: 'square', volume: 42.0 },
  'd3-15': { label: '3 × 2 × 1½ in device', family: 'device', volume: 7.5 },
  'd3-2': { label: '3 × 2 × 2 in device', family: 'device', volume: 10.0 },
  'd3-225': { label: '3 × 2 × 2¼ in device', family: 'device', volume: 10.5 },
  'd3-25': { label: '3 × 2 × 2½ in device', family: 'device', volume: 12.5 },
  'd3-275': { label: '3 × 2 × 2¾ in device', family: 'device', volume: 14.0 },
  'd3-35': { label: '3 × 2 × 3½ in device', family: 'device', volume: 18.0 },
  'd4-15': { label: '4 × 2⅛ × 1½ in device', family: 'device', volume: 10.3 },
  'd4-178': { label: '4 × 2⅛ × 1⅞ in device', family: 'device', volume: 13.0 },
  'd4-218': { label: '4 × 2⅛ × 2⅛ in device', family: 'device', volume: 14.5 },
  'm-25': { label: '3¾ × 2 × 2½ in masonry, per gang', family: 'masonry', volume: 14.0 },
  'm-35': { label: '3¾ × 2 × 3½ in masonry, per gang', family: 'masonry', volume: 21.0 },
  fs1: { label: 'FS single gang, 1¾ in deep', family: 'fsfd', volume: 13.5 },
  fd1: { label: 'FD single gang, 2⅜ in deep', family: 'fsfd', volume: 18.0 },
  fsm: { label: 'FS multiple gang, 1¾ in deep', family: 'fsfd', volume: 18.0 },
  fdm: { label: 'FD multiple gang, 2⅜ in deep', family: 'fsfd', volume: 24.0 },
} as const satisfies Record<string, BoxSpec>;
export type ListedBox = keyof typeof BOXES;
/** "other": a nonmetallic box, a box not in the table, or ganged sections, by entered volume. */
export type BoxChoice = ListedBox | 'other';

const BOX_KEYS = Object.keys(BOXES) as ListedBox[];

export type Counts = Record<Size, number>;

export type BoxFillInput = {
  edition: Edition;
  box: BoxChoice;
  /** Volume of an "other" box, cu in: the volume stamped on it, or ganged sections added up. */
  otherVolume: number;
  /** Plaster rings, extension rings and domed covers, cu in. */
  rings: number;
  /** Conductors entering the box by size, 314.16(B)(1). An unbroken loop of 12 in or more is entered as 2. */
  conductors: Counts;
  /** Device gangs by the largest conductor connected, 314.16(B)(4). One yoke is 1; a device two gangs wide is 2. */
  devices: Counts;
  grounds: number;
  groundSize: Size;
  /** Isolated equipment grounding conductors, 250.146(D). */
  isoGrounds: number;
  isoSize: Size;
  clamps: boolean;
  stud: boolean;
  hickey: boolean;
  /** Terminal block assemblies, 314.16(B)(6), counted under the 2023 NEC only. */
  blocks: number;
  blockSize: Size;
};

const zeros = (): Counts => ({ '18': 0, '16': 0, '14': 0, '12': 0, '10': 0, '8': 0, '6': 0 });

/** The example box: one receptacle fed by two 12/2 cables in a 3 × 2 × 3½ in metal device box with clamps. */
export const DEFAULT_INPUT: BoxFillInput = {
  edition: '2023',
  box: 'd3-35',
  otherVolume: 0,
  rings: 0,
  conductors: { ...zeros(), '12': 4 },
  devices: { ...zeros(), '12': 1 },
  grounds: 2,
  groundSize: '12',
  isoGrounds: 0,
  isoSize: '12',
  clamps: true,
  stud: false,
  hickey: false,
  blocks: 0,
  blockSize: '12',
};

export type ItemId = 'conductors' | 'clamps' | 'fittings' | 'devices' | 'grounds' | 'blocks';

export const ITEM_ROWS: { id: ItemId; label: string; source: string }[] = [
  { id: 'conductors', label: 'Conductors', source: '314.16(B)(1)' },
  { id: 'clamps', label: 'Internal cable clamps', source: '314.16(B)(2)' },
  { id: 'fittings', label: 'Fixture studs and hickeys', source: '314.16(B)(3)' },
  { id: 'devices', label: 'Device yokes', source: '314.16(B)(4)' },
  { id: 'grounds', label: 'Equipment grounds', source: '314.16(B)(5)' },
  { id: 'blocks', label: 'Terminal blocks', source: '314.16(B)(6), 2023 NEC' },
];

export type FillItem = {
  id: ItemId;
  /** Number of conductor allowances, e.g. 1.5 for six grounds under the 2020 NEC. */
  allowances: number;
  /** cu in */
  volume: number;
  detail: string;
};

export type Verdict = 'pass' | 'fail' | 'info';

export type BoxFillResult = {
  items: FillItem[];
  allowances: number;
  required: number;
  baseVolume: number;
  boxVolume: number;
  largest: Size | null;
  verdict: Verdict;
  /** Box volume less required volume; negative when overfilled. */
  spare: number;
  /** More conductors of the largest size present (14 AWG if none) that would still fit. */
  roomFor: number;
  roomSize: Size;
  /** Smallest listed box of the same type (common types for an other box) that works, rings included. */
  smallest: ListedBox | null;
};

const EPS = 1e-9;
const vol = (s: Size) => VOLUME_PER_CONDUCTOR[s];

/** cu in, two decimals: 2.25 → "2.25", 18 → "18.00". */
export const cuIn = (n: number) => n.toFixed(2);
/** Box volumes as the table prints them: 18 → "18.0", 30.3 → "30.3". */
export const boxCuIn = (n: number) => n.toFixed(1);
/** Allowance counts: 1.5 → "1.5", 2 → "2", 1.25 → "1.25". */
export const fmtCount = (n: number) => Number(n.toFixed(2)).toString();

/** Ground allowances under 314.16(B)(5) for the edition. */
export function groundAllowances(
  edition: Edition,
  grounds: number,
  isoGrounds: number
): { main: number; iso: number } {
  if (edition === '2017') {
    // One allowance for all grounds, plus one for an isolated ground set alongside them.
    return { main: grounds + isoGrounds > 0 ? 1 : 0, iso: grounds > 0 && isoGrounds > 0 ? 1 : 0 };
  }
  const n = grounds + isoGrounds;
  return { main: n > 0 ? 1 + Math.max(0, n - EGC_SHARED) * EGC_EXTRA : 0, iso: 0 };
}

function largerSize(a: Size | null, b: Size | null): Size | null {
  if (a == null) return b;
  if (b == null) return a;
  return vol(b) > vol(a) ? b : a;
}

const plural = (n: number, one: string, many: string) => `${fmtCount(n)} ${n === 1 ? one : many}`;

export function computeBoxFill(input: BoxFillInput): BoxFillResult {
  const blocksCount = input.edition === '2023';
  const egcSize =
    input.grounds > 0 && input.isoGrounds > 0
      ? largerSize(input.groundSize, input.isoSize)
      : input.grounds > 0
        ? input.groundSize
        : input.isoGrounds > 0
          ? input.isoSize
          : null;

  let largest: Size | null = egcSize;
  for (const s of SIZES)
    if (input.conductors[s] > 0 || input.devices[s] > 0) largest = largerSize(largest, s);
  if (blocksCount && input.blocks > 0) largest = largerSize(largest, input.blockSize);

  // (B)(1) conductors, each at its own size.
  const condParts = SIZES.filter((s) => input.conductors[s] > 0);
  const conductors: FillItem = {
    id: 'conductors',
    allowances: condParts.reduce((n, s) => n + input.conductors[s], 0),
    volume: condParts.reduce((v, s) => v + input.conductors[s] * vol(s), 0),
    detail: condParts.length
      ? condParts.map((s) => `${input.conductors[s]} × ${s} AWG at ${cuIn(vol(s))}`).join(', ')
      : 'None entered',
  };

  // (B)(2) one allowance for all internal clamps, at the largest conductor.
  const clamps: FillItem =
    input.clamps && largest
      ? {
          id: 'clamps',
          allowances: 1,
          volume: vol(largest),
          detail: `1 for all clamps, at ${largest} AWG, the largest conductor`,
        }
      : { id: 'clamps', allowances: 0, volume: 0, detail: input.clamps ? 'No conductors' : 'None' };

  // (B)(3) one allowance for each type of support fitting, at the largest conductor.
  const types = (input.stud ? 1 : 0) + (input.hickey ? 1 : 0);
  const fittings: FillItem =
    types && largest
      ? {
          id: 'fittings',
          allowances: types,
          volume: types * vol(largest),
          detail: `${[input.stud && 'Stud', input.hickey && 'hickey'].filter(Boolean).join(' and ')}: 1 each, at ${largest} AWG`,
        }
      : { id: 'fittings', allowances: 0, volume: 0, detail: types ? 'No conductors' : 'None' };

  // (B)(4) two allowances per gang of each yoke, at the largest conductor connected to it.
  const devParts = SIZES.filter((s) => input.devices[s] > 0);
  const devices: FillItem = {
    id: 'devices',
    allowances: devParts.reduce((n, s) => n + 2 * input.devices[s], 0),
    volume: devParts.reduce((v, s) => v + 2 * input.devices[s] * vol(s), 0),
    detail: devParts.length
      ? devParts
          .map((s) => `${plural(input.devices[s], 'gang', 'gangs')} × 2 at ${s} AWG`)
          .join(', ')
      : 'None',
  };

  // (B)(5) grounds, by edition.
  const g = groundAllowances(input.edition, input.grounds, input.isoGrounds);
  const totalGrounds = input.grounds + input.isoGrounds;
  let groundDetail = 'None';
  if (egcSize && input.edition === '2017') {
    groundDetail = `${plural(totalGrounds, 'ground', 'grounds')}: 1 at ${egcSize} AWG`;
    if (g.iso) groundDetail += `, plus 1 for the isolated ground set at ${input.isoSize} AWG`;
  } else if (egcSize) {
    const extra = Math.max(0, totalGrounds - EGC_SHARED);
    groundDetail =
      extra > 0
        ? `${totalGrounds} grounds: 1 for the first ${EGC_SHARED} + ${extra} × ¼ = ${fmtCount(g.main)}, at ${egcSize} AWG`
        : `${plural(totalGrounds, 'ground counts', 'grounds count')} as 1, at ${egcSize} AWG`;
  }
  const grounds: FillItem = {
    id: 'grounds',
    allowances: g.main + g.iso,
    volume: (egcSize ? g.main * vol(egcSize) : 0) + g.iso * vol(input.isoSize),
    detail: groundDetail,
  };

  // (B)(6) terminal blocks, 2023 NEC only: one per assembly at the largest conductor on it.
  const blocks: FillItem =
    blocksCount && input.blocks > 0
      ? {
          id: 'blocks',
          allowances: input.blocks,
          volume: input.blocks * vol(input.blockSize),
          detail: `${plural(input.blocks, 'block', 'blocks')} at ${input.blockSize} AWG`,
        }
      : {
          id: 'blocks',
          allowances: 0,
          volume: 0,
          detail: blocksCount ? 'None' : `Not counted under the ${EDITIONS[input.edition]}`,
        };

  const items = [conductors, clamps, fittings, devices, grounds, blocks];
  const required = items.reduce((v, i) => v + i.volume, 0);
  const allowances = items.reduce((n, i) => n + i.allowances, 0);
  const baseVolume = input.box === 'other' ? input.otherVolume : BOXES[input.box].volume;
  const boxVolume = baseVolume + input.rings;
  const spare = boxVolume - required;
  const roomSize: Size = largest ?? '14';
  return {
    items,
    allowances,
    required,
    baseVolume,
    boxVolume,
    largest,
    verdict: boxVolume <= 0 ? 'info' : spare >= -EPS ? 'pass' : 'fail',
    spare,
    roomFor: spare >= -EPS ? Math.floor(spare / vol(roomSize) + EPS) : 0,
    roomSize,
    smallest: smallestBox(
      required,
      input.rings,
      input.box === 'other' ? null : BOXES[input.box].family
    ),
  };
}

/** Box types searched when the box in hand is not a listed one: the everyday round, square and device boxes. */
export const COMMON_FAMILIES: Family[] = ['round', 'square', 'device'];

/**
 * Smallest listed box of one type (or, with no type, of the common types) whose
 * volume plus the rings holds `required`. Ties go to the earlier box in the table.
 */
export function smallestBox(
  required: number,
  rings = 0,
  family: Family | null = null
): ListedBox | null {
  const families = family ? [family] : COMMON_FAMILIES;
  const fits = BOX_KEYS.filter(
    (k) => families.includes(BOXES[k].family) && BOXES[k].volume + rings >= required - EPS
  );
  fits.sort((a, b) => BOXES[a].volume - BOXES[b].volume);
  return fits[0] ?? null;
}

/** Most conductors of one size that fit with `other` cu in already taken by clamps, devices and grounds. */
export function maxConductors(boxVolume: number, size: Size, other = 0): number {
  return Math.max(0, Math.floor((boxVolume - other) / vol(size) + EPS));
}

/** Inputs ↔ query string, so a result can be shared or reloaded. */
export const PARAM_KEYS = [
  'ed',
  'b',
  'v',
  'rv',
  ...SIZES.map((s) => `c${s}`),
  ...SIZES.map((s) => `d${s}`),
  'g',
  'gs',
  'ig',
  'igs',
  'cl',
  'st',
  'hk',
  'tb',
  'tbs',
] as const;

export function toParams(i: BoxFillInput): Record<string, string> {
  const out: Record<string, string> = {
    ed: i.edition,
    b: i.box,
    v: String(i.otherVolume),
    rv: String(i.rings),
  };
  for (const s of SIZES) out[`c${s}`] = String(i.conductors[s]);
  for (const s of SIZES) out[`d${s}`] = String(i.devices[s]);
  Object.assign(out, {
    g: String(i.grounds),
    gs: i.groundSize,
    ig: String(i.isoGrounds),
    igs: i.isoSize,
    cl: i.clamps ? '1' : '0',
    st: i.stud ? '1' : '0',
    hk: i.hickey ? '1' : '0',
    tb: String(i.blocks),
    tbs: i.blockSize,
  });
  return out;
}

export function fromParams(q: Record<string, string>): BoxFillInput {
  const d = DEFAULT_INPUT;
  // Missing from the URL → the example's value; present but blank or invalid → 0.
  const count = (v: string | undefined, fallback: number) =>
    v == null ? fallback : Math.min(Math.round(nonNeg(v, 0)), 99);
  const cubic = (v: string | undefined, fallback: number) =>
    v == null ? fallback : Math.min(nonNeg(v, 0), 1000);
  const size = (v: string | undefined, fallback: Size) =>
    (SIZES as readonly string[]).includes(v ?? '') ? (v as Size) : fallback;
  const flag = (v: string | undefined, fallback: boolean) => (v == null ? fallback : v !== '0');
  const conductors = zeros();
  const devices = zeros();
  for (const s of SIZES) {
    conductors[s] = count(q[`c${s}`], d.conductors[s]);
    devices[s] = count(q[`d${s}`], d.devices[s]);
  }
  return {
    edition: (Object.keys(EDITIONS) as string[]).includes(q.ed ?? '')
      ? (q.ed as Edition)
      : d.edition,
    box: q.b === 'other' || (BOX_KEYS as string[]).includes(q.b ?? '') ? (q.b as BoxChoice) : d.box,
    otherVolume: cubic(q.v, d.otherVolume),
    rings: cubic(q.rv, d.rings),
    conductors,
    devices,
    grounds: count(q.g, d.grounds),
    groundSize: size(q.gs, d.groundSize),
    isoGrounds: count(q.ig, d.isoGrounds),
    isoSize: size(q.igs, d.isoSize),
    clamps: flag(q.cl, d.clamps),
    stud: flag(q.st, d.stud),
    hickey: flag(q.hk, d.hickey),
    blocks: count(q.tb, d.blocks),
    blockSize: size(q.tbs, d.blockSize),
  };
}
