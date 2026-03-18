import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { parseExercises } from "../utils/parser.js";

const CATS = [
  "Warm-Up", "Shred", "Legato", "Bends", "Tapping", "Sweep",
  "Rhythm", "Fretboard", "Ear Training", "Improv", "Riffs", "Phrasing",
  "Modes", "Composition", "Songs", "Dynamics",
  "Chords", "Harmonics", "Picking", "Arpeggios", "Slide", "Tunings", "Keys"
];

const COL: Record<string, string> = {
  "Warm-Up": "#f59e0b", "Shred": "#ef4444", "Legato": "#8b5cf6",
  "Bends": "#ec4899", "Tapping": "#06b6d4", "Sweep": "#14b8a6",
  "Rhythm": "#f97316", "Fretboard": "#84cc16", "Ear Training": "#6366f1",
  "Improv": "#22d3ee", "Riffs": "#e11d48", "Phrasing": "#d946ef",
  "Modes": "#0ea5e9", "Composition": "#facc15", "Songs": "#10b981",
  "Dynamics": "#a855f7", "Chords": "#f472b6", "Harmonics": "#38bdf8",
  "Picking": "#fb923c", "Arpeggios": "#4ade80", "Slide": "#c084fc",
  "Tunings": "#fbbf24", "Keys": "#818cf8",
};

const MODES = [
  "Aeolian", "Dorian", "Phrygian", "Lydian", "Mixolydian",
  "Ionian", "Locrian", "Harmonic Minor", "Phrygian Dominant",
  "Minor Pentatonic", "Minor Blues", "Whole Tone",
  "Melodic Minor", "Major Pentatonic", "Lydian Dominant", "Hungarian Minor"
];

const SCALES = [
  "C", "Cm", "C#/Db", "C#/Dbm", "D", "Dm", "D#/Eb", "D#/Ebm",
  "E", "Em", "F", "Fm", "F#/Gb", "F#/Gbm", "G", "Gm",
  "G#/Ab", "G#/Abm", "A", "Am", "A#/Bb", "A#/Bbm", "B", "Bm"
];

const STYLES = [
  "Metal", "Hard Rock", "Classic Rock", "Blues", "Jazz",
  "Grunge", "Stoner Rock", "Punk Rock", "Neo-Classical",
  "Funk", "Country", "Flamenco", "Acoustic",
  "Progressive Metal", "Djent", "Death Metal", "Fusion"
];

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function registerConstantTools(server: McpServer): void {
  // gf_list_categories
  server.registerTool(
    "gf_list_categories",
    {
      title: "List Categories",
      description: `List all exercise categories with exercise counts and assigned colors.

Returns: Array of { name, count, color }`,
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
        const counts: Record<string, number> = {};
        for (const ex of exercises) {
          counts[ex.c] = (counts[ex.c] || 0) + 1;
        }

        const categories = CATS.map(name => ({
          name,
          count: counts[name] || 0,
          color: COL[name] || "#888",
        }));

        return {
          content: [{ type: "text" as const, text: JSON.stringify({ categories }, null, 2) }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: `Error listing categories: ${error instanceof Error ? error.message : String(error)}` }],
        };
      }
    }
  );

  // gf_list_constants
  server.registerTool(
    "gf_list_constants",
    {
      title: "List Constants",
      description: `Get GuitarForge constants: modes, scales, styles, or days.

Args:
  - type (string): One of "modes", "scales", "styles", "days"

Returns: Array of strings`,
      inputSchema: {
        type: z.enum(["modes", "scales", "styles", "days"]).describe("Type of constants to retrieve"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ type }) => {
      const map: Record<string, string[]> = {
        modes: MODES,
        scales: SCALES,
        styles: STYLES,
        days: DAYS,
      };

      const values = map[type];
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ type, count: values.length, values }, null, 2),
        }],
      };
    }
  );
}
