declare const PROJECT_ROOT: string;
declare const EXERCISES_PATH: string;
declare const SONGS_PATH: string;
export declare function readExercisesFile(): string;
export declare function writeExercisesFile(content: string): void;
export declare function readSongsFile(): string;
export declare function writeSongsFile(content: string): void;
export { EXERCISES_PATH, SONGS_PATH, PROJECT_ROOT };
