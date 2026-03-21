#!/usr/bin/env node
/**
 * Upload Guitar Pro files to Supabase Storage (gp-tabs bucket).
 *
 * Usage:
 *   node scripts/upload-gp-to-supabase.mjs --key <SERVICE_ROLE_KEY>
 *
 * Options:
 *   --key         Supabase service_role key (required)
 *   --dry-run     List files without uploading
 *   --concurrency Max parallel uploads (default: 3)
 *   --songs-only  Upload only song files
 *   --exercises-only  Upload only exercise files
 */

import fs from "fs";
import path from "path";
import { createReadStream, statSync } from "fs";

// ── Config ──────────────────────────────────────────────────────────────────
const SUPABASE_URL = "https://rmwaezujumikbukbirpt.supabase.co";
const BUCKET = "gp-tabs";

const SONGS_DIR = "C:\\Users\\User\\Downloads\\GuitarForge Library\\Songs GP";
const EXERCISES_DIR =
  "C:\\Users\\User\\Downloads\\GuitarForge Library\\Exercises GP";

const PROGRESS_FILE = path.resolve("scripts/.upload-progress.json");

const GP_EXTENSIONS = new Set([".gp3", ".gp4", ".gp5", ".gpx", ".gp"]);

// ── Args ────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(name) {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1) return undefined;
  return args[idx + 1];
}
const hasFlag = (name) => args.includes(`--${name}`);

const SERVICE_ROLE_KEY = getArg("key");
const DRY_RUN = hasFlag("dry-run");
const CONCURRENCY = parseInt(getArg("concurrency") || "3", 10);
const SONGS_ONLY = hasFlag("songs-only");
const EXERCISES_ONLY = hasFlag("exercises-only");

if (!SERVICE_ROLE_KEY && !DRY_RUN) {
  console.error("Error: --key <SERVICE_ROLE_KEY> is required (or use --dry-run)");
  process.exit(1);
}

// ── MIME types ──────────────────────────────────────────────────────────────
function mimeForExt(ext) {
  return "application/octet-stream";
}

// ── Slugify ─────────────────────────────────────────────────────────────────
function slugify(name) {
  return name
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ── Collect files ───────────────────────────────────────────────────────────
function collectFiles(baseDir, storagePrefix) {
  const entries = [];
  if (!fs.existsSync(baseDir)) {
    console.warn(`Warning: directory not found: ${baseDir}`);
    return entries;
  }

  const folders = fs.readdirSync(baseDir, { withFileTypes: true });
  for (const folder of folders) {
    if (!folder.isDirectory()) continue;
    const folderPath = path.join(baseDir, folder.name);
    const slug = slugify(folder.name);

    const files = fs.readdirSync(folderPath);
    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (!GP_EXTENSIONS.has(ext)) continue;

      const fullPath = path.join(folderPath, file);
      const storagePath = `${storagePrefix}/${slug}/${file}`;
      const size = statSync(fullPath).size;

      entries.push({ fullPath, storagePath, size, folder: folder.name, file });
    }
  }
  return entries;
}

// ── Progress tracking ───────────────────────────────────────────────────────
function loadProgress() {
  try {
    return JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf-8"));
  } catch {
    return { uploaded: [], failed: [], startedAt: new Date().toISOString() };
  }
}

function saveProgress(progress) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// ── Upload single file ─────────────────────────────────────────────────────
async function uploadFile(entry, key) {
  const url = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${encodeURIComponent(entry.storagePath).replace(/%2F/g, "/")}`;

  const fileBuffer = fs.readFileSync(entry.fullPath);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
      "Content-Type": mimeForExt(path.extname(entry.file)),
      "x-upsert": "false", // skip if exists
    },
    body: fileBuffer,
  });

  if (res.status === 409) {
    // Already exists
    return { status: "skipped", storagePath: entry.storagePath };
  }

  if (!res.ok) {
    const body = await res.text();
    return {
      status: "error",
      storagePath: entry.storagePath,
      code: res.status,
      body,
    };
  }

  return { status: "uploaded", storagePath: entry.storagePath };
}

// ── Rate-limited parallel upload ────────────────────────────────────────────
async function uploadBatch(entries, key, progress) {
  let uploaded = 0;
  let skipped = 0;
  let failed = 0;
  const total = entries.length;
  const alreadyDone = new Set(progress.uploaded);

  // Filter out already-uploaded
  const pending = entries.filter((e) => !alreadyDone.has(e.storagePath));
  console.log(
    `\nTotal: ${total} | Already uploaded: ${total - pending.length} | Pending: ${pending.length}\n`
  );

  if (pending.length === 0) {
    console.log("Nothing to upload. All files already done.");
    return;
  }

  let idx = 0;

  async function worker() {
    while (idx < pending.length) {
      const i = idx++;
      const entry = pending[i];
      const num = i + 1;

      try {
        const result = await uploadFile(entry, key);

        if (result.status === "uploaded") {
          uploaded++;
          progress.uploaded.push(entry.storagePath);
          console.log(
            `[${num}/${pending.length}] UPLOADED ${entry.storagePath} (${(entry.size / 1024).toFixed(1)}KB)`
          );
        } else if (result.status === "skipped") {
          skipped++;
          progress.uploaded.push(entry.storagePath);
          console.log(`[${num}/${pending.length}] SKIPPED  ${entry.storagePath} (already exists)`);
        } else {
          failed++;
          progress.failed.push({
            path: entry.storagePath,
            code: result.code,
            error: result.body,
          });
          console.error(
            `[${num}/${pending.length}] FAILED   ${entry.storagePath} (${result.code}: ${result.body})`
          );
        }

        // Save progress every 50 files
        if (num % 50 === 0) {
          saveProgress(progress);
        }

        // Rate limit: 100ms delay between requests per worker
        await new Promise((r) => setTimeout(r, 100));
      } catch (err) {
        failed++;
        progress.failed.push({
          path: entry.storagePath,
          error: err.message,
        });
        console.error(`[${num}/${pending.length}] ERROR    ${entry.storagePath}: ${err.message}`);
      }
    }
  }

  // Launch workers
  const workers = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.all(workers);

  // Final save
  saveProgress(progress);

  console.log(`\n--- Upload Complete ---`);
  console.log(`Uploaded: ${uploaded}`);
  console.log(`Skipped:  ${skipped}`);
  console.log(`Failed:   ${failed}`);
  console.log(`Progress saved to: ${PROGRESS_FILE}`);
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log("GuitarForge GP File Uploader");
  console.log("===========================\n");

  let allFiles = [];

  if (!EXERCISES_ONLY) {
    console.log(`Scanning songs: ${SONGS_DIR}`);
    const songs = collectFiles(SONGS_DIR, "songs");
    console.log(`  Found ${songs.length} song GP files`);
    allFiles.push(...songs);
  }

  if (!SONGS_ONLY) {
    console.log(`Scanning exercises: ${EXERCISES_DIR}`);
    const exercises = collectFiles(EXERCISES_DIR, "exercises");
    console.log(`  Found ${exercises.length} exercise GP files`);
    allFiles.push(...exercises);
  }

  const totalSize = allFiles.reduce((sum, f) => sum + f.size, 0);
  console.log(
    `\nTotal: ${allFiles.length} files, ${(totalSize / 1024 / 1024).toFixed(1)}MB`
  );

  if (DRY_RUN) {
    console.log("\n--- DRY RUN (not uploading) ---\n");
    for (const f of allFiles.slice(0, 30)) {
      console.log(`  ${f.storagePath} (${(f.size / 1024).toFixed(1)}KB)`);
    }
    if (allFiles.length > 30) {
      console.log(`  ... and ${allFiles.length - 30} more`);
    }
    return;
  }

  const progress = loadProgress();
  await uploadBatch(allFiles, SERVICE_ROLE_KEY, progress);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
