import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const PROJECT_ROOT = resolve(import.meta.dirname, "..", "..", "..");
const EXERCISES_PATH = resolve(PROJECT_ROOT, "src", "lib", "exercises.ts");
const SONGS_PATH = resolve(PROJECT_ROOT, "src", "lib", "songs-data.ts");
export function readExercisesFile() {
    return readFileSync(EXERCISES_PATH, "utf-8");
}
export function writeExercisesFile(content) {
    writeFileSync(EXERCISES_PATH, content, "utf-8");
}
export function readSongsFile() {
    return readFileSync(SONGS_PATH, "utf-8");
}
export function writeSongsFile(content) {
    writeFileSync(SONGS_PATH, content, "utf-8");
}
export { EXERCISES_PATH, SONGS_PATH, PROJECT_ROOT };
//# sourceMappingURL=file-ops.js.map