const artist = 'rvm makir';
const title = 'Dame Cuerpo';
function normalizeArtist(a) {
  return a.replace(/\s*\(.*\)\s*/g, '').replace(/feat\.?|ft\.?/gi, '').replace(/&/g, 'and').replace(/\s+/g, ' ').trim();
}
function normalizeTitle(t) {
  return t.replace(/\s*\(.*\)\s*/g, '').replace(/\s*\[.*\]\s*/g, '').replace(/\s+-\s+.*$/g, '').replace(/\s+/g, ' ').trim();
}
function simplifyArtist(a) {
  return a.split(/,|&|feat\.?|ft\.?/i)[0].trim();
}
function simplifyTitle(t) {
  return t.split(/\(|\[/)[0].replace(/\s+-\s+.*$/g, '').trim();
}
const candidates = [
  { artist, title },
  { artist: normalizeArtist(artist), title },
  { artist, title: normalizeTitle(title) },
  { artist: normalizeArtist(artist), title: normalizeTitle(title) },
  { artist: simplifyArtist(artist), title: simplifyTitle(title) },
];
const seen = new Set();
const unique = [];
for (const c of candidates) {
  const key = `${c.artist.toLowerCase()}|${c.title.toLowerCase()}`;
  if (!seen.has(key) && c.artist && c.title) {
    seen.add(key);
    unique.push(c);
  }
}
console.log(JSON.stringify(unique, null, 2));
console.log('count', unique.length);
