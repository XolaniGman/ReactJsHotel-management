const slugify = (s = '') =>
  String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// Frame-count convention lives in the strip filename:
//   {unit}.png      -> 16 frames  (built from a 360° video with
//                                   scripts/make-turntable-strip.ps1)
//   {unit}.{n}f.png -> n frames   (built from a composite grid with
//                                   scripts/composite-to-strip.py, e.g. ec-103.8f.png)
const parseStripFrames = (src = '') => {
  const m = String(src).match(/(\d+)f\.png$/i);
  return m ? Number(m[1]) : 16;
};

// Composite grids (3x3 -> 8 usable orbit frames) are tried in order after the
// plain 16-frame strip so the app finds whichever file actually exists.
const CANDIDATE_FRAMES = [8, 9, 12, 16, 24, 32];

const stripSlug = (vehicle) => slugify(vehicle?.unitNumber || vehicle?.name || 'vehicle');

// Ordered list of { src, frames } to probe: an explicit vehicle.strip wins, then
// {unit}.png (16f video strips) followed by known {unit}.{n}f.png suffixes.
export const stripCandidatesFor = (vehicle) => {
  const given = vehicle?.strip;
  if (given) {
    if (typeof given === 'object' && given != null) {
      return [{ src: given.src, frames: Number.isInteger(given.frames) ? given.frames : parseStripFrames(given.src) }];
    }
    return [{ src: given, frames: parseStripFrames(given) }];
  }
  const base = `/fleet-strips/${stripSlug(vehicle)}`;
  const plain = { src: `${base}.png`, frames: 16 };
  const suffixed = CANDIDATE_FRAMES.filter((f) => f !== 16).map((f) => ({ src: `${base}.${f}f.png`, frames: f }));
  return [plain, ...suffixed];
};

// Strip source + the number of frames the viewer must slice it into.
export const stripInfoFor = (vehicle) => stripCandidatesFor(vehicle)[0];

// Where a locally-built 360° sprite strip lives in the public folder.
// Drop a strip (16 frames stitched side-by-side with
// scripts/make-turntable-strip.ps1, or N frames with
// scripts/composite-to-strip.py) at /fleet-strips/{unit}.png to use it.
export const stripPathFor = (vehicle) => stripCandidatesFor(vehicle)[0].src;