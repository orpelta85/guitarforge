/**
 * Guitar Pro Tab Search Test
 * Tests finding Guitar Pro tabs on guitarprotabs.org for 10 popular songs.
 *
 * Site structure:
 *   Artist listing: https://guitarprotabs.org/{letter}/{artist_slug}/{page}/
 *   Tab page: https://guitarprotabs.org/{letter}/{artist_slug}/{song_slug}_{id}/
 *   Tabs listed alphabetically, 20 per page. Pagination uses relative links (../N/).
 */

import { writeFileSync } from 'fs';

const SONGS = [
  { artist: 'Metallica', song: 'Enter Sandman' },
  { artist: 'Metallica', song: 'Master of Puppets' },
  { artist: 'AC/DC', song: 'Back in Black' },
  { artist: 'Black Sabbath', song: 'Iron Man' },
  { artist: "Guns N' Roses", song: 'Sweet Child O Mine' },
  { artist: 'Led Zeppelin', song: 'Stairway to Heaven' },
  { artist: 'Deep Purple', song: 'Smoke on the Water' },
  { artist: 'Nirvana', song: 'Smells Like Teen Spirit' },
  { artist: 'Pink Floyd', song: 'Comfortably Numb' },
  { artist: 'Iron Maiden', song: 'The Trooper' },
];

const BASE = 'https://guitarprotabs.org';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

function slugify(name) {
  return name.toLowerCase()
    .replace(/['']/g, '')
    .replace(/\//g, '_')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchHtml(url) {
  try {
    const resp = await fetch(url, { headers: HEADERS, redirect: 'follow' });
    if (!resp.ok) return { ok: false, status: resp.status, html: '' };
    return { ok: true, status: resp.status, html: await resp.text() };
  } catch (err) {
    return { ok: false, status: 0, html: '', error: err.message };
  }
}

function getArtistSlugs(artist) {
  const base = slugify(artist);
  const variants = [base];
  if (artist === 'AC/DC') variants.push('ac_dc', 'acdc');
  if (artist.includes("Guns")) variants.push('guns_n_roses', 'guns_n__roses');
  return [...new Set(variants)];
}

/** Extract tab entries from artist page HTML */
function extractTabEntries(html) {
  const entries = [];
  const rowRe = /<tr\s+itemprop="track"[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  while ((rowMatch = rowRe.exec(html)) !== null) {
    const row = rowMatch[1];
    const linkMatch = row.match(/<a\s+href="([^"]+)"[^>]*>[\s\S]*?<span\s+itemprop="name">([^<]+)<\/span>/i);
    const fmtMatch = row.match(/<td>\.(gp[345x]?|gpx)<\/td>/i);
    const dlMatch = row.match(/UserDownloads:([\d,]+)/);
    if (linkMatch) {
      entries.push({
        url: linkMatch[1],
        name: linkMatch[2].trim(),
        format: fmtMatch ? fmtMatch[1].toLowerCase() : null,
        downloads: dlMatch ? dlMatch[1] : null,
      });
    }
  }
  return entries;
}

/** Get total page count from pagination */
function getPageCount(html) {
  // Pagination: <li><a href='../N/'>N</a></li>
  const pageNums = [];
  const re = /href='\.\.\/(\d+)\/'/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    pageNums.push(parseInt(m[1]));
  }
  return pageNums.length > 0 ? Math.max(...pageNums) : 1;
}

function normalize(s) {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function songMatches(entryName, targetSong) {
  const a = normalize(entryName);
  const b = normalize(targetSong);
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  // Strip version suffixes like "(2)", "(3)", "(live)" etc and re-check
  const aBase = a.replace(/\s*\(.*?\)\s*/g, '').trim();
  if (aBase === b || aBase.includes(b) || b.includes(aBase)) return true;
  // Check all significant words
  const words = b.split(' ').filter(w => w.length > 2);
  const matched = words.filter(w => a.includes(w));
  return matched.length >= words.length;
}

// Cache fetched artist pages to avoid re-fetching for same artist
const artistCache = new Map();

async function getArtistData(artist) {
  if (artistCache.has(artist)) return artistCache.get(artist);

  const slugs = getArtistSlugs(artist);
  for (const slug of slugs) {
    const letter = slug.charAt(0);
    const url = `${BASE}/${letter}/${slug}/1/`;
    console.log(`  Trying: ${url}`);
    const result = await fetchHtml(url);
    if (result.ok && result.html.includes('itemprop="track"')) {
      const totalPages = getPageCount(result.html);
      const entries = extractTabEntries(result.html);
      const data = { slug, letter, totalPages, pageEntries: { 1: entries } };
      artistCache.set(artist, data);
      return data;
    }
    await delay(400);
  }
  artistCache.set(artist, null);
  return null;
}

async function fetchArtistPage(artistData, page) {
  if (artistData.pageEntries[page]) return artistData.pageEntries[page];
  const url = `${BASE}/${artistData.letter}/${artistData.slug}/${page}/`;
  console.log(`  Fetching page ${page}/${artistData.totalPages}: ${url}`);
  await delay(500);
  const result = await fetchHtml(url);
  if (result.ok) {
    const entries = extractTabEntries(result.html);
    artistData.pageEntries[page] = entries;
    return entries;
  }
  return [];
}

/** Binary-ish search: check pages until we find the right alphabetical range */
async function findSongInPages(artistData, songName) {
  const songLetter = normalize(songName).charAt(0);
  const totalPages = artistData.totalPages;

  // Strategy: scan pages sequentially since there are at most ~20 pages
  // and we need to be polite with requests anyway
  for (let page = 1; page <= totalPages; page++) {
    const entries = await fetchArtistPage(artistData, page);
    if (entries.length === 0) continue;

    // Check if any entry matches
    const matches = entries.filter(e => songMatches(e.name, songName));
    if (matches.length > 0) return matches;

    // Check if we've gone past alphabetically
    const lastEntryLetter = normalize(entries[entries.length - 1].name).charAt(0);
    const firstEntryLetter = normalize(entries[0].name).charAt(0);

    // If the entire page is past our target letter, stop
    if (firstEntryLetter > songLetter) {
      console.log(`  Page ${page} starts with "${firstEntryLetter}", past target "${songLetter}" - stopping`);
      break;
    }
  }
  return [];
}

async function searchSong(artist, songName) {
  console.log(`\n--- ${artist} - ${songName} ---`);

  const result = {
    artist,
    song: songName,
    found: false,
    artistPageUrl: null,
    tabPageUrl: null,
    downloadUrl: null,
    format: null,
    downloads: null,
    alternateVersions: 0,
    error: null,
  };

  // Step 1: Find artist
  const artistData = await getArtistData(artist);
  if (!artistData) {
    result.error = 'Artist page not found';
    console.log('  Artist NOT FOUND');
    return result;
  }
  result.artistPageUrl = `${BASE}/${artistData.letter}/${artistData.slug}/1/`;
  console.log(`  Artist: ${artistData.slug} (${artistData.totalPages} pages)`);

  // Step 2: Find song across pages
  const matches = await findSongInPages(artistData, songName);

  if (matches.length === 0) {
    result.error = 'Song not found in artist tab listings';
    console.log(`  Song NOT FOUND`);
    return result;
  }

  // Sort by downloads (highest first)
  matches.sort((a, b) => {
    const da = parseInt((a.downloads || '0').replace(/,/g, ''));
    const db = parseInt((b.downloads || '0').replace(/,/g, ''));
    return db - da;
  });

  const best = matches[0];
  result.found = true;
  result.tabPageUrl = best.url;
  result.format = best.format;
  result.downloads = best.downloads;
  result.alternateVersions = matches.length - 1;

  console.log(`  FOUND: "${best.name}" [${best.format}] (${best.downloads} downloads)`);
  if (matches.length > 1) {
    console.log(`  + ${matches.length - 1} alternate version(s)`);
    matches.slice(1, 4).forEach(m => console.log(`    - "${m.name}" [${m.format}] (${m.downloads} dl)`));
  }

  // Step 3: Visit tab page to find download link
  await delay(600);
  const tabPage = await fetchHtml(best.url);
  if (tabPage.ok) {
    // Try multiple patterns for download link
    const patterns = [
      /href="([^"]*\/download\/?)"/i,
      /href="([^"]*)"[^>]*>[^<]*[Dd]ownload/i,
      /<a[^>]*class="[^"]*btn[^"]*"[^>]*href="([^"]*download[^"]*)"/i,
    ];
    for (const pat of patterns) {
      const m = tabPage.html.match(pat);
      if (m) {
        result.downloadUrl = m[1].startsWith('http') ? m[1] : `${BASE}${m[1]}`;
        break;
      }
    }

    // Also try: look for the tab page URL + /download/
    if (!result.downloadUrl) {
      // Construct download URL from tab page URL pattern
      const dlUrl = best.url.replace(/\/$/, '') + '/download/';
      result.downloadUrl = dlUrl;
    }
    console.log(`  Download: ${result.downloadUrl}`);
  }

  return result;
}

async function main() {
  console.log('=== Guitar Pro Tab Search Test ===');
  console.log(`Testing ${SONGS.length} popular songs on guitarprotabs.org`);
  console.log(`Date: ${new Date().toISOString()}\n`);

  const results = [];
  for (const { artist, song } of SONGS) {
    const result = await searchSong(artist, song);
    results.push(result);
    await delay(500);
  }

  // Summary
  console.log('\n\n' + '='.repeat(60));
  console.log('RESULTS SUMMARY');
  console.log('='.repeat(60) + '\n');

  const found = results.filter(r => r.found).length;
  console.log(`Found: ${found}/${results.length}\n`);

  for (const r of results) {
    const status = r.found ? 'FOUND' : 'MISS ';
    const fmt = r.format ? `.${r.format}` : '';
    const dl = r.downloads ? `(${r.downloads} downloads)` : '';
    const alts = r.alternateVersions > 0 ? `[+${r.alternateVersions} versions]` : '';
    console.log(`[${status}] ${r.artist} - ${r.song} ${fmt} ${dl} ${alts}`);
    if (r.tabPageUrl) console.log(`        Tab: ${r.tabPageUrl}`);
    if (r.downloadUrl) console.log(`        DL:  ${r.downloadUrl}`);
    if (r.error) console.log(`        Err: ${r.error}`);
  }

  // Save to JSON
  const outPath = 'C:/Users/User/guitarforge/scripts/gp-test-results.json';
  writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`\nResults saved to ${outPath}`);
}

main().catch(console.error);
