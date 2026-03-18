import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { parseExercises, appendExercise, updateExerciseTex, getNextExerciseId } from "../utils/parser.js";

const CATS = [
  "Warm-Up", "Shred", "Legato", "Bends", "Tapping", "Sweep",
  "Rhythm", "Fretboard", "Ear Training", "Improv", "Riffs", "Phrasing",
  "Modes", "Composition", "Songs", "Dynamics",
  "Chords", "Harmonics", "Picking", "Arpeggios", "Slide", "Tunings", "Keys"
];

export function registerExerciseTools(server: McpServer): void {
  // gf_list_exercises
  server.registerTool(
    "gf_list_exercises",
    {
      title: "List Exercises",
      description: `List all GuitarForge exercises, optionally filtered by category, style, or search query.

Returns an array of exercise summaries with id, name, category, bpm, duration, and whether they have AlphaTex notation.

Args:
  - category (string, optional): Filter by category (e.g. "Shred", "Warm-Up")
  - style (string, optional): Filter by music style (e.g. "Metal", "Blues")
  - search (string, optional): Search in name, description, focus, and tips
  - hasTab (boolean, optional): Filter exercises that have AlphaTex notation`,
      inputSchema: {
        category: z.string().optional().describe("Filter by category name"),
        style: z.string().optional().describe("Filter by music style"),
        search: z.string().optional().describe("Search query for name, description, focus, tips"),
        hasTab: z.boolean().optional().describe("Filter exercises with AlphaTex notation"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ category, style, search, hasTab }) => {
      try {
        let exercises = parseExercises();

        if (category) {
          const cat = category.toLowerCase();
          exercises = exercises.filter(e => e.c.toLowerCase() === cat);
        }
        if (style) {
          const s = style.toLowerCase();
          exercises = exercises.filter(e => e.styles?.some(st => st.toLowerCase().includes(s)));
        }
        if (search) {
          const q = search.toLowerCase();
          exercises = exercises.filter(e =>
            e.n.toLowerCase().includes(q) ||
            e.d.toLowerCase().includes(q) ||
            e.f.toLowerCase().includes(q) ||
            e.t.toLowerCase().includes(q)
          );
        }
        if (hasTab !== undefined) {
          exercises = exercises.filter(e => hasTab ? !!e.tex : !e.tex);
        }

        const summaries = exercises.map(e => ({
          id: e.id,
          name: e.n,
          category: e.c,
          bpm: e.b,
          duration: e.m,
          hasTex: !!e.tex,
        }));

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ total: summaries.length, exercises: summaries }, null, 2),
          }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: `Error listing exercises: ${error instanceof Error ? error.message : String(error)}` }],
        };
      }
    }
  );

  // gf_get_exercise
  server.registerTool(
    "gf_get_exercise",
    {
      title: "Get Exercise Details",
      description: `Get full details of a GuitarForge exercise by its ID.

Returns the complete exercise object including description, tips, focus areas, BPM, AlphaTex notation, styles, and all other fields.

Args:
  - id (number): The exercise ID`,
      inputSchema: {
        id: z.number().int().positive().describe("Exercise ID"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ id }) => {
      try {
        const exercises = parseExercises();
        const exercise = exercises.find(e => e.id === id);

        if (!exercise) {
          return {
            isError: true,
            content: [{
              type: "text" as const,
              text: `Exercise with ID ${id} not found. Use gf_list_exercises to see available IDs.`,
            }],
          };
        }

        const full = {
          id: exercise.id,
          category: exercise.c,
          name: exercise.n,
          duration: exercise.m,
          bpm: exercise.b,
          description: exercise.d,
          youtubeQuery: exercise.yt,
          tips: exercise.t,
          focus: exercise.f,
          needsBackingTrack: exercise.bt,
          tex: exercise.tex ?? null,
          styles: exercise.styles ?? [],
          needsSongsterr: exercise.ss ?? false,
          songId: exercise.songId ?? null,
          songName: exercise.songName ?? null,
          songUrl: exercise.songUrl ?? null,
          stageIdx: exercise.stageIdx ?? null,
        };

        return {
          content: [{ type: "text" as const, text: JSON.stringify(full, null, 2) }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: `Error getting exercise: ${error instanceof Error ? error.message : String(error)}` }],
        };
      }
    }
  );

  // gf_add_exercise
  server.registerTool(
    "gf_add_exercise",
    {
      title: "Add Exercise",
      description: `Add a new exercise to GuitarForge's exercises.ts file.

Appends a new exercise to the EXERCISES array. The ID is auto-assigned.

Args:
  - category (string): Exercise category (must be one of the valid categories)
  - name (string): Exercise name
  - duration (number): Duration in minutes
  - bpm (string): BPM range (e.g. "80-120" or "" if not applicable)
  - description (string): Detailed exercise description
  - tips (string): Practice tips
  - focus (string): Focus areas, comma-separated
  - youtubeQuery (string): YouTube search query for reference videos
  - backingTrack (boolean): Whether this exercise needs a backing track
  - styles (array of strings, optional): Applicable music styles
  - tex (string, optional): AlphaTex notation

Returns: { success, id, message }`,
      inputSchema: {
        category: z.enum(CATS as [string, ...string[]]).describe("Exercise category"),
        name: z.string().min(3).max(200).describe("Exercise name"),
        duration: z.number().int().min(1).max(60).describe("Duration in minutes"),
        bpm: z.string().describe("BPM range (e.g. '80-120') or empty string"),
        description: z.string().min(10).describe("Detailed exercise description"),
        tips: z.string().min(5).describe("Practice tips"),
        focus: z.string().min(3).describe("Focus areas, comma-separated"),
        youtubeQuery: z.string().describe("YouTube search query for reference"),
        backingTrack: z.boolean().describe("Whether exercise needs a backing track"),
        styles: z.array(z.string()).optional().describe("Applicable music styles"),
        tex: z.string().optional().describe("AlphaTex notation"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ category, name, duration, bpm, description, tips, focus, youtubeQuery, backingTrack, styles, tex }) => {
      try {
        const newId = getNextExerciseId();

        appendExercise({
          id: newId,
          c: category,
          n: name,
          m: duration,
          b: bpm,
          d: description,
          yt: youtubeQuery,
          t: tips,
          f: focus,
          bt: backingTrack,
          tex,
          styles,
        });

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              id: newId,
              message: `Exercise "${name}" added with ID ${newId} in category "${category}".`,
            }, null, 2),
          }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: `Error adding exercise: ${error instanceof Error ? error.message : String(error)}` }],
        };
      }
    }
  );

  // gf_write_alphatex
  server.registerTool(
    "gf_write_alphatex",
    {
      title: "Write AlphaTex",
      description: `Write or update AlphaTex notation for an existing exercise.

Updates the tex field of the specified exercise in exercises.ts.

Args:
  - exerciseId (number): The exercise ID to update
  - tex (string): AlphaTex notation string

Returns: { success, message }`,
      inputSchema: {
        exerciseId: z.number().int().positive().describe("Exercise ID to update"),
        tex: z.string().min(10).describe("AlphaTex notation string"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ exerciseId, tex }) => {
      try {
        const exercises = parseExercises();
        const exists = exercises.some(e => e.id === exerciseId);
        if (!exists) {
          return {
            isError: true,
            content: [{
              type: "text" as const,
              text: `Exercise with ID ${exerciseId} not found. Use gf_list_exercises to see available IDs.`,
            }],
          };
        }

        const updated = updateExerciseTex(exerciseId, tex);
        if (!updated) {
          return {
            isError: true,
            content: [{
              type: "text" as const,
              text: `Failed to update tex for exercise ${exerciseId}. The exercise object pattern may not be parseable.`,
            }],
          };
        }

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              message: `AlphaTex notation updated for exercise ${exerciseId}.`,
            }, null, 2),
          }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: `Error writing AlphaTex: ${error instanceof Error ? error.message : String(error)}` }],
        };
      }
    }
  );
}
