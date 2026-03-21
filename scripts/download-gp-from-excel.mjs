#!/usr/bin/env node
/**
 * GuitarForge — Guitar Pro Tabs Bulk Downloader
 *
 * Step 1: Scrapes all song URLs from artist pages (fast, no browser)
 * Step 2: Opens Edge once, downloads all files by clicking Download links
 *
 * Usage:
 *   node scripts/download-gp-from-excel.mjs          # All artists
 *   node scripts/download-gp-from-excel.mjs --test    # First 3 artists
 */

import { chromium } from 'playwright';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DOWNLOAD_DIR = 'C:\\Users\\User\\Downloads\\GuitarForge Library\\Songs GP';
const EXERCISES_DIR = 'C:\\Users\\User\\Downloads\\GuitarForge Library\\Exercises GP';
const PROGRESS_FILE = join(__dirname, 'gp-download-progress.json');
const LIST_FILE = join(__dirname, 'gp-artists-list.json');
const TEST_MODE = process.argv.includes('--test');

const data = JSON.parse(readFileSync(LIST_FILE, 'utf-8'));
const artists = TEST_MODE ? data.artists.slice(0, 3) : data.artists;
const exercises = TEST_MODE ? [] : (data.exercises || []);

let progress = {};
if (existsSync(PROGRESS_FILE)) progress = JSON.parse(readFileSync(PROGRESS_FILE, 'utf-8'));
function save() { writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2)); }
function sanitize(n) { return n.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, ' ').trim(); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// STEP 1: Scrape all song URLs using plain fetch (fast, no browser needed)
async function scrapeArtistSongs(artistUrl) {
  const songs = [];
  let pageNum = 1;
  while (true) {
    if (!artistUrl || typeof artistUrl !== 'string') break;
    const base = artistUrl.replace(/\/?\d*\/?$/, '');
    const url = `${base}/${pageNum}/`;
    try {
      const resp = await fetch(url);
      if (!resp.ok) break;
      const html = await resp.text();

      // Parse: <a href="URL"><span itemprop="name">Title</span></a> ... <td>.gp3</td> ... <span class="badge">12,345</span>
      const regex = /<a href="([^"]+)"[^>]*><span itemprop="name">([^<]+)<\/span><\/a>[\s\S]*?<td>(\.[^<]+)<\/td>\s*<td><span class="badge">([\d,]+)<\/span>/g;
      let match;
      let found = 0;
      while ((match = regex.exec(html)) !== null) {
        songs.push({
          url: match[1].startsWith('http') ? match[1] : `https://guitarprotabs.org${match[1]}`,
          title: match[2].trim(),
          format: match[3].trim(),
          downloads: parseInt(match[4].replace(/,/g, ''))
        });
        found++;
      }
      if (found === 0) break;
    } catch (e) { break; }
    pageNum++;
    await sleep(300);
  }
  return songs;
}

// STEP 2: Download files using Playwright (browser clicks)
async function downloadAll(allDownloads) {
  console.log(`\nOpening Edge browser for ${allDownloads.length} downloads...\n`);

  const browser = await chromium.launch({ channel: 'msedge', headless: false });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();

  // Accept cookies first
  await page.goto('https://guitarprotabs.org/', { waitUntil: 'domcontentloaded' });
  await page.click('text=Got it!').catch(() => {});
  await sleep(1000);

  let ok = 0, fail = 0;

  for (let i = 0; i < allDownloads.length; i++) {
    const item = allDownloads[i];
    const pKey = `${item.artist}::${item.title}`;
    if (progress[pKey] === 'ok') continue;

    try {
      // Go to song page
      await page.goto(item.url, { waitUntil: 'domcontentloaded', timeout: 10000 });

      // Get the download href from the page
      const dlHref = await page.evaluate(() => {
        const links = document.querySelectorAll('a');
        for (const a of links) {
          if (a.textContent.trim() === 'Download' && a.href.includes('/download/')) return a.href;
        }
        return null;
      });

      if (!dlHref) throw new Error('No download link found');

      // Use Playwright's download by navigating with download expectation
      const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
      await page.evaluate((href) => { window.location.href = href; }, dlHref);
      const download = await downloadPromise;

      const ext = download.suggestedFilename().split('.').pop() || 'gp';
      const dest = join(item.destDir, `${sanitize(item.title)}.${ext}`);
      await download.saveAs(dest);

      console.log(`[${i+1}/${allDownloads.length}] OK  ${item.artist} - ${item.title} (.${ext})`);
      progress[pKey] = 'ok';
      ok++;
    } catch (e) {
      console.log(`[${i+1}/${allDownloads.length}] ERR ${item.artist} - ${item.title}`);
      progress[pKey] = 'err';
      fail++;
    }

    // Save progress every 10 songs
    if (i % 10 === 0) save();
    await sleep(1500);
  }

  save();
  console.log(`\nDownloaded: ${ok} | Failed: ${fail}`);
  await browser.close();
}

async function main() {
  console.log(`=== GuitarForge GP Tab Downloader ===`);
  console.log(`${artists.length} artists + ${exercises.length} exercises`);
  console.log(`${TEST_MODE ? 'TEST MODE (3 artists)' : 'FULL MODE'}\n`);

  mkdirSync(DOWNLOAD_DIR, { recursive: true });
  mkdirSync(EXERCISES_DIR, { recursive: true });

  // STEP 1: Collect all song URLs (fast, no browser)
  const allDownloads = [];

  for (let i = 0; i < artists.length; i++) {
    const artist = artists[i];
    const name = artist.clean_name || artist.site_name;

    // Skip if all songs already downloaded
    if (progress[`artist_done::${name}`]) {
      console.log(`[${i+1}/${artists.length}] SKIP ${name} (done)`);
      continue;
    }

    let artistUrl = artist.url;
    if (!artistUrl || artistUrl === 'None') {
      const slug = (artist.site_name || name).toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, '_');
      artistUrl = `https://guitarprotabs.org/${slug.charAt(0)}/${slug}/1/`;
    }

    console.log(`[${i+1}/${artists.length}] Scanning ${name}...`);
    const songs = await scrapeArtistSongs(artistUrl);
    console.log(`  Found ${songs.length} tabs`);

    const artistDir = join(DOWNLOAD_DIR, sanitize(name));
    mkdirSync(artistDir, { recursive: true });

    for (const song of songs) {
      const pKey = `${name}::${song.title}`;
      if (progress[pKey] === 'ok') continue;
      allDownloads.push({ artist: name, title: song.title, url: song.url, destDir: artistDir });
    }
  }

  // Exercises
  for (let i = 0; i < exercises.length; i++) {
    const ex = exercises[i];
    if (!ex.url || ex.url === 'None') continue;
    if (progress[`artist_done::ex_${ex.name}`]) continue;

    console.log(`[Exercise ${i+1}/${exercises.length}] Scanning ${ex.name}...`);
    const songs = await scrapeArtistSongs(ex.url);
    console.log(`  Found ${songs.length} tabs`);

    const exDir = join(EXERCISES_DIR, sanitize(ex.name));
    mkdirSync(exDir, { recursive: true });

    for (const song of songs) {
      const pKey = `ex_${ex.name}::${song.title}`;
      if (progress[pKey] === 'ok') continue;
      allDownloads.push({ artist: ex.name, title: song.title, url: song.url, destDir: exDir });
    }
  }

  console.log(`\n=== Total to download: ${allDownloads.length} files ===`);

  if (allDownloads.length > 0) {
    await downloadAll(allDownloads);
  } else {
    console.log('Nothing new to download!');
  }

  console.log('\nDONE!');
}

main().catch(e => { console.error('FATAL:', e.message); save(); process.exit(1); });
