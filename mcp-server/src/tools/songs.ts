import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { parseSongs, appendSong, getNextSongId } from "../utils/parser.js";

export function registerSongTools(server: McpServer): void {
  // gf_list_songs
  server.registerTool(
    "gf_list_songs",
    {
      title: "List Songs",
      description: `List all songs from GuitarForge's song library, optionally filtered by search, genre, or difficulty.

Args:
  - search (string, optional): Search in title and artist
  - genre (string, optional): Filter by genre
  - difficulty (string, optional): Filter by difficulty level ("Beginner", "Intermediate", "Advanced")

Returns: Array of song entries with all fields.`,
      inputSchema: {
        search: z.string().optional().describe("Search query for title and artist"),
        genre: z.string().optional().describe("Filter by genre"),
        difficulty: z.enum(["Beginner", "Intermediate", "Advanced"]).optional().describe("Filter by difficulty"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ search, genre, difficulty }) => {
      try {
        let songs = parseSongs();

        if (search) {
          const q = search.toLowerCase();
          songs = songs.filter(s =>
            s.title.toLowerCase().includes(q) ||
            s.artist.toLowerCase().includes(q)
          );
        }
        if (genre) {
          const g = genre.toLowerCase();
          songs = songs.filter(s => s.genre?.toLowerCase().includes(g));
        }
        if (difficulty) {
          songs = songs.filter(s => s.difficulty === difficulty);
        }

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ total: songs.length, songs }, null, 2),
          }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: `Error listing songs: ${error instanceof Error ? error.message : String(error)}` }],
        };
      }
    }
  );

  // gf_add_song
  server.registerTool(
    "gf_add_song",
    {
      title: "Add Song",
      description: `Add a new song to GuitarForge's song library (songs-data.ts).

The ID is auto-assigned.

Args:
  - title (string): Song title
  - artist (string): Artist name
  - album (string, optional): Album name
  - year (number, optional): Release year
  - genre (string, optional): Genre
  - difficulty (string, optional): "Beginner", "Intermediate", or "Advanced"
  - tuning (string, optional): Guitar tuning (e.g. "Standard", "Drop D")
  - tempo (number, optional): BPM
  - key (string, optional): Musical key (e.g. "Em", "Am")
  - songsterrUrl (string, optional): Songsterr tab URL

Returns: { success, id, message }`,
      inputSchema: {
        title: z.string().min(1).max(200).describe("Song title"),
        artist: z.string().min(1).max(200).describe("Artist name"),
        album: z.string().optional().describe("Album name"),
        year: z.number().int().min(1900).max(2100).optional().describe("Release year"),
        genre: z.string().optional().describe("Genre"),
        difficulty: z.enum(["Beginner", "Intermediate", "Advanced"]).optional().describe("Difficulty level"),
        tuning: z.string().optional().describe("Guitar tuning"),
        tempo: z.number().int().min(20).max(400).optional().describe("BPM"),
        key: z.string().optional().describe("Musical key"),
        songsterrUrl: z.string().url().optional().describe("Songsterr tab URL"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ title, artist, album, year, genre, difficulty, tuning, tempo, key, songsterrUrl }) => {
      try {
        const newId = getNextSongId();

        appendSong({
          id: newId,
          title,
          artist,
          album,
          year,
          genre,
          difficulty,
          tuning,
          tempo,
          key,
          songsterrUrl,
        });

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              id: newId,
              message: `Song "${title}" by ${artist} added with ID ${newId}.`,
            }, null, 2),
          }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: `Error adding song: ${error instanceof Error ? error.message : String(error)}` }],
        };
      }
    }
  );
}
