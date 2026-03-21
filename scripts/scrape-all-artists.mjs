#!/usr/bin/env node
/**
 * Scrape ALL artists from guitarprotabs.org (A-Z)
 * Saves to CSV (Excel-compatible) with BOM for Hebrew/UTF-8 support
 *
 * Usage: node scripts/scrape-all-artists.mjs
 */

import { writeFileSync } from 'fs';
import { join } from 'path';

const BASE = 'https://guitarprotabs.org';
const DELAY_MS = 500;
const OUTPUT_PATH = join('C:', 'Users', 'User', 'Downloads', 'GuitarForge Library', 'All_Artists_GuitarProTabs.csv');

const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchPage(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    if (!res.ok) {
      if (res.status === 404) return null;
      console.warn(`  [WARN] ${url} returned ${res.status}`);
      return null;
    }
    return await res.text();
  } catch (err) {
    console.warn(`  [ERR] ${url}: ${err.message}`);
    return null;
  }
}

/**
 * Parse the total number of pages from pagination links.
 * Looks for patterns like href="../5/" or href="/a/5/" in pagination.
 * The highest number found is the last page.
 */
function parseMaxPage(html) {
  // Find all pagination page number links
  // Pattern: links that look like ../NUMBER/ or /letter/NUMBER/
  // We look for the pagination section - typically an <ul> with page links
  const pageNums = [];

  // Match href patterns like "../3/" or "/a/3/" where the number is a page
  // Also match direct patterns like href="https://guitarprotabs.org/a/3/"
  const linkRegex = /href=["'][^"']*?\/(\d+)\/["']/g;
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const num = parseInt(match[1], 10);
    // Page numbers are typically small (1-100), filter out noise
    if (num > 0 && num < 500) {
      pageNums.push(num);
    }
  }

  if (pageNums.length === 0) return 1;
  return Math.max(...pageNums);
}

/**
 * Extract artists from a page's HTML.
 * Artist links follow the pattern: href="https://guitarprotabs.org/{letter}/{slug}/1/"
 * Tab count appears near the artist entry.
 */
function parseArtists(html, letter) {
  const artists = [];
  const seen = new Set();

  // Actual HTML structure per row:
  // <tr itemscope itemtype="http://schema.org/MusicGroup">
  //   <td><a href="https://guitarprotabs.org/a/slug/1/" title="...">
  //     <span itemprop="name">Artist Name</span></a>
  //     <meta itemprop="url" content="..."></td>
  //   <td><span class="badge">42</span></td>
  // </tr>
  const rowRegex = new RegExp(
    `<tr[^>]*itemtype="http://schema\\.org/MusicGroup"[^>]*>[\\s\\S]*?` +
    `href="(https://guitarprotabs\\.org/${letter}/([^/]+)/1/)"[^>]*>` +
    `[\\s\\S]*?itemprop="name">([^<]+)</span>` +
    `[\\s\\S]*?class="badge">(\\d+)</span>` +
    `[\\s\\S]*?</tr>`,
    'gi'
  );

  let match;
  while ((match = rowRegex.exec(html)) !== null) {
    const url = match[1];
    const slug = match[2];
    const name = match[3].trim();
    const tabs = parseInt(match[4], 10);

    if (/^\d+$/.test(slug)) continue;
    if (seen.has(slug)) continue;
    seen.add(slug);

    artists.push({ name, url, slug, tabs });
  }

  return artists;
}

function escapeCSV(str) {
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

async function main() {
  console.log('=== GuitarProTabs.org Artist Scraper ===\n');
  const allArtists = [];
  const startTime = Date.now();

  for (const letter of LETTERS) {
    const upperLetter = letter.toUpperCase();
    console.log(`\n[${upperLetter}] Fetching page 1...`);

    const firstPageUrl = `${BASE}/${letter}/1/`;
    const firstHtml = await fetchPage(firstPageUrl);

    if (!firstHtml) {
      console.log(`[${upperLetter}] No results or page not found. Skipping.`);
      continue;
    }

    const maxPage = parseMaxPage(firstHtml);
    const artists1 = parseArtists(firstHtml, letter);
    allArtists.push(...artists1.map(a => ({ ...a, letter: upperLetter })));
    console.log(`[${upperLetter}] Page 1/${maxPage} - ${artists1.length} artists`);

    // Fetch remaining pages
    for (let page = 2; page <= maxPage; page++) {
      await sleep(DELAY_MS);
      const pageUrl = `${BASE}/${letter}/${page}/`;
      const html = await fetchPage(pageUrl);

      if (!html) {
        console.log(`[${upperLetter}] Page ${page}/${maxPage} - no data, stopping letter.`);
        break;
      }

      const pageArtists = parseArtists(html, letter);
      if (pageArtists.length === 0) {
        console.log(`[${upperLetter}] Page ${page}/${maxPage} - 0 artists, stopping letter.`);
        break;
      }

      allArtists.push(...pageArtists.map(a => ({ ...a, letter: upperLetter })));
      console.log(`[${upperLetter}] Page ${page}/${maxPage} - ${pageArtists.length} artists`);
    }

    await sleep(DELAY_MS);
  }

  // Sort by letter, then by name
  allArtists.sort((a, b) => {
    if (a.letter !== b.letter) return a.letter.localeCompare(b.letter);
    return a.name.localeCompare(b.name);
  });

  // Build CSV with BOM for Excel UTF-8 compatibility
  const BOM = '\uFEFF';
  const header = 'Artist Name,Number of Tabs,URL,First Letter,Download?';
  const rows = allArtists.map(a =>
    `${escapeCSV(a.name)},${a.tabs},${escapeCSV(a.url)},${a.letter},`
  );

  const csv = BOM + header + '\n' + rows.join('\n') + '\n';
  writeFileSync(OUTPUT_PATH, csv, 'utf8');

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n=== DONE ===`);
  console.log(`Total artists: ${allArtists.length}`);
  console.log(`Time: ${elapsed}s`);
  console.log(`Saved to: ${OUTPUT_PATH}`);

  // Print summary per letter
  console.log('\n--- Per Letter ---');
  const letterCounts = {};
  for (const a of allArtists) {
    letterCounts[a.letter] = (letterCounts[a.letter] || 0) + 1;
  }
  for (const l of LETTERS) {
    const u = l.toUpperCase();
    console.log(`  ${u}: ${letterCounts[u] || 0} artists`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
