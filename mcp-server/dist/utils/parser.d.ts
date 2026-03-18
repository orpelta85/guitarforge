export interface ExerciseData {
    id: number;
    c: string;
    n: string;
    m: number;
    b: string;
    d: string;
    yt: string;
    t: string;
    f: string;
    bt: boolean;
    tex?: string;
    styles?: string[];
    ss?: boolean;
    songId?: number;
    songName?: string;
    songUrl?: string;
    stageIdx?: number;
}
export interface SongEntryData {
    id: number;
    title: string;
    artist: string;
    album?: string;
    year?: number;
    genre?: string;
    difficulty?: "Beginner" | "Intermediate" | "Advanced";
    tuning?: string;
    tempo?: number;
    key?: string;
    songsterrUrl?: string;
    gpFileName?: string;
    ytTutorial?: string;
}
/**
 * Parse exercises from the TypeScript source file.
 * Uses Function constructor to evaluate the array literal safely.
 */
export declare function parseExercises(): ExerciseData[];
/**
 * Parse songs from the TypeScript source file.
 */
export declare function parseSongs(): SongEntryData[];
/**
 * Append a new exercise to exercises.ts
 */
export declare function appendExercise(ex: ExerciseData): void;
/**
 * Update the tex field of an exercise by ID in exercises.ts
 */
export declare function updateExerciseTex(exerciseId: number, tex: string): boolean;
/**
 * Append a new song to songs-data.ts
 */
export declare function appendSong(song: SongEntryData): void;
/**
 * Get the next available ID for exercises or songs.
 */
export declare function getNextExerciseId(): number;
export declare function getNextSongId(): number;
