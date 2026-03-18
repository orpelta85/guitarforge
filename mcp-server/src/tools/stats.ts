import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { parseExercises, parseSongs } from "../utils/parser.js";

const CATS = [
  "Warm-Up", "Shred", "Legato", "Bends", "Tapping", "Sweep",
  "Rhythm", "Fretboard", "Ear Training", "Improv", "Riffs", "Phrasing",
  "Modes", "Composition", "Songs", "Dynamics",
  "Chords", "Harmonics", "Picking", "Arpeggios", "Slide", "Tunings", "Keys"
];

const MODES = [
  "Aeolian", "Dorian", "Phrygian", "Lydian", "Mixolydian",
  "Ionian", "Locrian", "Harmonic Minor", "Phrygian Dominant",
  "Minor Pentatonic", "Minor Blues", "Whole Tone",
  "Melodic Minor", "Major Pentatonic", "Lydian Dominant", "Hungarian Minor"
];

const STYLES = [
  "Metal", "Hard Rock", "Classic Rock", "Blues", "Jazz",
  "Grunge", "Stoner Rock", "Punk Rock", "Neo-Classical",
  "Funk", "Country", "Flamenco", "Acoustic",
  "Progressive Metal", "Djent", "Death Metal", "Fusion"
];

export function registerStatsTools(server: McpServer): void {
  server.registerTool(
    "gf_project_stats",
    {
      title: "Project Statistics",
      description: `Get GuitarForge project statistics.

Returns counts of exercises, songs, categories, exercises with tabs, styles, and modes.`,
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      try {
        const exercises = parseExercises();
        const songs = parseSongs();

        const usedCategories = new Set(exercises.map(e => e.c));

        const stats = {
          exerciseCount: exercises.length,
          songCount: songs.length,
          categoriesCount: CATS.length,
          categoriesUsed: usedCategories.size,
          exercisesWithTabs: exercises.filter(e => !!e.tex).length,
          stylesCount: STYLES.length,
          modesCount: MODES.length,
          totalPracticeMins: exercises.reduce((sum, e) => sum + e.m, 0),
          exercisesPerCategory: Object.fromEntries(
            CATS.map(cat => [cat, exercises.filter(e => e.c === cat).length]).filter(([, count]) => (count as number) > 0)
          ),
        };

        return {
          content: [{ type: "text" as const, text: JSON.stringify(stats, null, 2) }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: `Error getting stats: ${error instanceof Error ? error.message : String(error)}` }],
        };
      }
    }
  );
}
