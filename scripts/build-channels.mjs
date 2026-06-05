// Build a clean, deduped, country+genre-grouped channel catalog from channels.txt
// Usage:  node scripts/build-channels.mjs            -> writes public/channels.json + prints summary
//         node scripts/build-channels.mjs --summary  -> prints summary only (no write)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SRC = resolve(ROOT, 'channels.txt');
const OUT = resolve(ROOT, 'public/channels.json');
const summaryOnly = process.argv.includes('--summary');

// ── Country blocks: the file is a sequence of country/provider blocks.
// Each entry is the category-index where that country's block STARTS.
// A category inherits the country of the most recent block start <= its index.
// third element = ISO 3166-1 alpha-2 code for flag-icons (empty = generic region)
const BLOCKS = [
  [0,   'Featured 4K',     ''],
  [27,  'United Kingdom',  'gb'],
  [145, 'Germany',         'de'],
  [199, 'Austria',         'at'],
  [204, 'Netherlands',     'nl'],
  [245, 'Belgium',         'be'],
  [254, 'Italy',           'it'],
  [273, 'France',          'fr'],
  [318, 'Spain',           'es'],
  [403, 'Portugal',        'pt'],
  [416, 'Switzerland',     'ch'],
  [421, 'Poland',          'pl'],
  [441, 'Greece',          'gr'],
  [457, 'Cyprus',          'cy'],
  [463, 'Sweden',          'se'],
  [491, 'Denmark',         'dk'],
  [504, 'Norway',          'no'],
  [516, 'Finland',         'fi'],
  [527, 'Romania',         'ro'],
  [529, 'Albania',         'al'],
  [549, 'Ukraine',         'ua'],
  [550, 'Israel',          'il'],
  [556, 'Australia',       'au'],
  [563, 'New Zealand',     'nz'],
  [566, 'Malta',           'mt'],
  [567, 'Czech Republic',  'cz'],
  [577, 'Serbia',          'rs'],
  [578, 'Bosnia',          'ba'],
  [579, 'Croatia',         'hr'],
  [580, 'Macedonia',       'mk'],
  [582, 'Slovenia',        'si'],
  [583, 'Montenegro',      'me'],
  [585, 'Bulgaria',        'bg'],
  [586, 'Turkey',          'tr'],
  [608, 'Kurdistan',       ''],
  [615, 'Iran',            'ir'],
  [617, 'Afghanistan',     'af'],
  [618, 'Somalia',         'so'],
  [621, 'Africa',          ''],
  [628, 'Pakistan',        'pk'],
  [630, 'India',           'in'],
  [648, 'Canada',          'ca'],
  [672, 'United States',   'us'],
  [770, 'Brazil',          'br'],
  [786, 'Argentina',       'ar'],
  [789, 'Ecuador',         'ec'],
  [790, 'Bolivia',         'bo'],
  [791, 'Puerto Rico',     'pr'],
  [792, 'Caribbean',       ''],
  [795, 'Japan',           'jp'],
  [796, 'Taiwan',          'tw'],
  [797, 'Philippines',     'ph'],
  [798, 'Georgia',         'ge'],
  [799, 'Azerbaijan',      'az'],
  [800, 'Uzbekistan',      'uz'],
  [801, 'Armenia',         'am'],
  [802, 'Venezuela',       've'],
  [803, 'Hong Kong',       'hk'],
  [804, 'China',           'cn'],
  [805, 'Vietnam',         'vn'],
  [806, 'Malaysia',        'my'],
  [807, 'Indonesia',       'id'],
  [810, 'South Korea',     'kr'],
  [812, 'Cambodia',        'kh'],
  [813, 'Kazakhstan',      'kz'],
  [814, 'Lithuania',       'lt'],
  [815, '__ADULT__',       ''],   // excluded
  [816, 'Arabic',          ''],
];

// Intro region (indices 2..26) are one-off per-country categories.
const INTRO = [
  ['UNITED KINGDOM','United Kingdom','gb'], ['SINGAPORE','Singapore','sg'],
  ['NEW ZEALAND','New Zealand','nz'], ['GERMANY','Germany','de'],
  ['ITALY','Italy','it'], ['POLAND','Poland','pl'], ['FINLAND','Finland','fi'],
  ['LATVIA','Latvia','lv'], ['CHILE','Chile','cl'], ['HEBREW','Israel','il'],
  ['SPAIN','Spain','es'], ['SWITZERLAND','Switzerland','ch'],
  ['NETHERLAND','Netherlands','nl'], ['FRANCE','France','fr'],
  ['AFRICA','Africa',''], ['GREECE','Greece','gr'], ['ALBANIA','Albania','al'],
  ['SERBIA','Serbia','rs'], ['BOSNIA','Bosnia','ba'], ['CROATIA','Croatia','hr'],
  ['SLOVENIA','Slovenia','si'], ['MACEDONIA','Macedonia','mk'],
  ['ROMANIA','Romania','ro'], ['BULGARIA','Bulgaria','bg'],
];

function countryFor(catIndex, name) {
  if (catIndex <= 1) return ['Featured 4K', ''];
  if (catIndex >= 2 && catIndex <= 26) {
    const up = name.toUpperCase();
    for (const [kw, c, f] of INTRO) if (up.includes(kw)) return [c, f];
    return ['Featured 4K', ''];
  }
  let chosen = BLOCKS[0];
  for (const b of BLOCKS) { if (catIndex >= b[0]) chosen = b; else break; }
  return [chosen[1], chosen[2]];
}

// ── Genre detection (checked in priority order)
const GENRE_RULES = [
  ['Radio',       /\bRADIO\b/i],
  ['Kids',        /KIDS|\bKID\b|ÇOCUK|COCUK|ENFANT|BAMBINI|CRIANCAS|DZIECI|KINDER|INFANTIL|CARTOON|FEMIJ|ΠΑΙΔΙ|NIÑOS|NINOS|DLA DZIECI/i],
  ['News',        /\bNEWS\b|HABER|LAJME|NOTICIAS|INFORMACYJNE|NACHRICHTEN|ΕΙΔΗΣ|HABER/i],
  ['Documentary', /DOCUMENT|DOKUMENT|DISCOVERY|ΝΤΟΚΙΜΑΝΤΕΡ|DOCUMENTAIRE|DOCUMENTARIO|DOKUMENTAR|BELGESEL/i],
  ['Music',       /MUSIC|MUSIQUE|MUSICA|MUZIK|MÜZİK|MUZYCZNE|MUZIEK|ΜΟΥΣΙΚΗ|MUZIKË|SPOTIFY/i],
  ['Religion',    /ISLAMIC|QURAN|MUSLIM|CHRIST|FETARE|ISLAM|اسلام|QURAN|RELIGI/i],
  ['Sports',      /SPORT|SP⚽RT|\bSPOR\b|DESPORTO|ΑΘΛΗΤ|FOOTBALL|SOCCER|\bLIGA\b|LEAGUE|BUNDESLIGA|SERIE A|SERIEA|LIGUE\s?1|LIGUE1|UEFA|\bDAZN\b|BEIN|\bNFL\b|\bNBA\b|\bMLB\b|\bNHL\b|NCAAF|NCAAB|WNBA|\bF1\b|FORMULA|MOTOGP|MXGP|RALLY|TENNIS|\bGOLF\b|\bUFC\b|RUGBY|CRICKET|HORSE|RACING|\bGAA\b|\bEPL\b|SPFL|\bNRL\b|\bAFL\b|HOCKEY|VOLLEY|DARTS|SPORTOWE|DEPORTES|GAME PASS|MATCHROOM|SUPERCROSS|\bTSN\b|SPORTSNET|OPTUS|EUROSPORT|DIRECT.?SPORT|VIAPLAY|FANATIZ|\bPPV\b|REPLAY|FORMULA 1|ROLAND GARROS|GLORY|WALKI|SETANTA|CLUBBER|MONO MAX/i],
  ['Movies',      /CINEMA|CINÉ|\bCINE\b|FILM|FILME|FILMA|FILMER|FIMLER|FILMOWE|MOVIE|MOVIES|\bFILMS\b|BOX OFFICE|CINEMANIA|LUXPLAY|\bOCS\b|STARZ|PREMIUM PLAY|ΣΙΝΕΜΑ|MARVEL|HIGHLIGHTS/i],
  ['Series',      /SERIES|SERIE\b|SERIALE|DIZILER|\bDRAMA\b|REALITY|\bSHOWS?\b|NETFLIX|HULU|APPLE TV|PRIME VIDEO|DISNEY|PEACOCK|TV SHOWS|ON DEMAND|24\/7|TOP SERIES|SHAHID|WEYYAK|SHOOF|TUBI|ROKU|VIX|COUPANG/i],
];
function genreFor(name) {
  for (const [g, re] of GENRE_RULES) if (re.test(name)) return g;
  return 'Entertainment';
}

// ── Name cleaning
const QUALITY_RE = /\b(4K|8K|UHD|FHD|HD|SD|LQ|HEVC|RAW|3840P|2160P|1080P|720P|50\s?FPS|60\s?FPS)\b/gi;
function extractQuality(s) {
  const q = new Set();
  const up = s.toUpperCase();
  if (/8K/.test(up)) q.add('8K');
  if (/4K|UHD|3840P|2160P/.test(up)) q.add('4K');
  if (/\bFHD\b|1080P/.test(up)) q.add('FHD');
  if (/\bHD\b|720P/.test(up)) q.add('HD');
  return [...q];
}
function cleanName(raw) {
  let s = raw;
  // map football emoji used inside beIN SP⚽RTS etc.
  s = s.replace(/⚽/g, 'O');
  // strip leading prefix codes:  4K:  RX:  8K:  AR:  TR|  ES|  GR|  CY|  IR|  etc.
  s = s.replace(/^\s*[A-Za-z0-9]{1,4}\s*[:|]\s*/,'');
  // remove all non basic-Latin glyphs (superscripts, flags, arrows, symbols)
  s = s.replace(/[^\x20-\x7EÀ-ÿ]/g, ' ');
  // remove parenthetical tags  (EVENT) (LIVE-EVENT) (BK) (NA) etc.
  s = s.replace(/\([^)]*\)/g, ' ');
  // remove quality / codec words
  s = s.replace(QUALITY_RE, ' ');
  // remove leftover noise tokens
  s = s.replace(/\b(NM|FM|SS|GOLD|VIP|ULTRA|ONLINE|PLAYER|REPLAY|EVENT|LIVE|DIRECT)\b/gi, ' ');
  s = s.replace(/\+\d+H/gi, ' ');
  s = s.replace(/[|◉◆◇◈★▶☾♚•]/g, ' ');
  // collapse separators / whitespace
  s = s.replace(/[_]+/g, ' ').replace(/\s{2,}/g, ' ').replace(/\s*[:\-–]\s*$/,'').trim();
  s = s.replace(/^[:\-–]\s*/,'').trim();
  return s;
}
const normKey = (s) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');

// ── Skip rules for whole categories & individual channels
function skipCategory(name) {
  return /LOW INTERNET|\+6H|EVENT\s*$|PPV EVENT|⁽ᴮᴷ⁾|\(BK\)/i.test(name);
}
function skipChannel(clean) {
  if (clean.length < 3) return true;
  if (/^[\d\s.+-]+$/.test(clean)) return true;               // pure numbers / dashes
  if (/^(EVENT|MATCH|GAME|PPV|TBD|VS|N\/?A|NO|YES|FROM|TEAM|LIVE|CHANNEL|TEST)$/i.test(clean)) return true;
  if (/^\d{1,3}\s*[-–]/.test(clean)) return true;            // "01 - ..." numbered event slot
  if (/\b\d{1,2}:\d{2}\b/.test(clean)) return true;          // has a clock time -> event
  if (/@/.test(clean)) return true;                          // "@ Mar 22 17:00"
  if (/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b[\s.]*\d{1,2}/i.test(clean)) return true; // date
  if (/\b(bracket|matchday|round\s*\d|game\s*\d|leg\s*\d|week\s*\d|day\s*\d)\b/i.test(clean)) return true;
  if (/\bPPV\b/i.test(clean)) return true;                   // PPV token => event slot, not a channel
  if (/\b20\d\d\b/.test(clean)) return true;                 // a year => event listing
  if (/\s+vs?\s+/i.test(clean)) return true;                 // "X v Y" fixture
  if (/\b(singles|doubles|quarterfinal|semifinal|roland garros|wimbledon)\b/i.test(clean)) return true;
  return false;
}

// ── Parse
const lines = readFileSync(SRC, 'utf8').split(/\r?\n/);
const catBuckets = new Map();   // country -> Map(genre -> Map(normKey -> {name, quality:Set}))
const countryMeta = new Map();  // country -> flag
let catIndex = -1;
let curCountry = 'Featured 4K', curCc = '', curGenre = 'Entertainment', curSkip = false;
let totalRaw = 0;

for (const raw of lines) {
  const l = raw.replace(/﻿/g, '').trim();
  if (!l) continue;
  if (/^#{2,}/.test(l)) {
    catIndex++;
    const catName = l.replace(/#/g, '').trim();
    [curCountry, curCc] = countryFor(catIndex, catName);
    curGenre = genreFor(catName);
    curSkip = curCountry === '__ADULT__' || skipCategory(catName);
    continue;
  }
  // channel line
  totalRaw++;
  if (curSkip) continue;
  const clean = cleanName(l);
  if (skipChannel(clean)) continue;
  const quals = extractQuality(l);
  if (!countryMeta.has(curCountry)) countryMeta.set(curCountry, curCc);
  if (!catBuckets.has(curCountry)) catBuckets.set(curCountry, new Map());
  const genres = catBuckets.get(curCountry);
  if (!genres.has(curGenre)) genres.set(curGenre, new Map());
  const chans = genres.get(curGenre);
  const key = normKey(clean);
  if (!chans.has(key)) chans.set(key, { name: clean, quality: new Set(quals) });
  else for (const q of quals) chans.get(key).quality.add(q);
}

// ── Assemble output
const GENRE_ORDER = ['Sports','Movies','Series','Entertainment','News','Documentary','Kids','Music','Religion','Radio'];
const countries = [];
for (const [country, genres] of catBuckets) {
  if (country === '__ADULT__') continue;
  const genreArr = [];
  let total = 0;
  for (const g of GENRE_ORDER) {
    if (!genres.has(g)) continue;
    const chans = [...genres.get(g).values()].map(c => ({
      name: c.name,
      q: [...c.quality].sort((a,b)=>['8K','4K','FHD','HD'].indexOf(a)-['8K','4K','FHD','HD'].indexOf(b)),
    })).sort((a,b)=>a.name.localeCompare(b.name));
    if (!chans.length) continue;
    genreArr.push({ name: g, count: chans.length, channels: chans });
    total += chans.length;
  }
  if (!total) continue;
  countries.push({ name: country, cc: countryMeta.get(country) || '', total, genres: genreArr });
}
// biggest catalogs first
countries.sort((a,b)=>b.total-a.total);

const grandTotal = countries.reduce((s,c)=>s+c.total,0);
const out = { generated: 'build-channels', countryCount: countries.length, channelCount: grandTotal, countries };

// ── Summary
console.log(`RAW channel lines:        ${totalRaw}`);
console.log(`CLEAN deduped channels:   ${grandTotal}`);
console.log(`Countries/regions:        ${countries.length}`);
console.log('');
console.log('COUNTRY'.padEnd(20), 'TOTAL'.padStart(7), '  GENRES (count)');
for (const c of countries) {
  const g = c.genres.map(x=>`${x.name}:${x.count}`).join(' ');
  console.log(`[${c.cc||'··'}] ${c.name}`.padEnd(22), String(c.total).padStart(7), '  '+g);
}
// sample cleaned names from a few big countries
console.log('\n── SAMPLE cleaned names ──');
for (const cn of ['United Kingdom','France','Arabic','United States']) {
  const c = countries.find(x=>x.name===cn); if (!c) continue;
  const sp = c.genres.find(g=>g.name==='Sports') || c.genres[0];
  console.log(`\n${cn} / ${sp.name}:`);
  console.log('  ' + sp.channels.slice(0,12).map(x=>x.name + (x.q.length?` [${x.q.join('/')}]`:'')).join('\n  '));
}

if (!summaryOnly) {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(out));
  console.log(`\nWROTE ${OUT}  (${(JSON.stringify(out).length/1024/1024).toFixed(2)} MB)`);
}
