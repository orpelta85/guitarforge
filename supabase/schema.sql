-- GuitarForge Database Schema
-- Run this in Supabase SQL Editor after creating your project

-- ══════════════════════════════════════
-- PROFILES (extends Supabase Auth)
-- ══════════════════════════════════════
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ══════════════════════════════════════
-- USER SETTINGS
-- ══════════════════════════════════════
CREATE TABLE user_settings (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE PRIMARY KEY,
  current_week INT DEFAULT 1,
  mode TEXT DEFAULT 'Aeolian',
  scale TEXT DEFAULT 'Am',
  style TEXT DEFAULT 'Doom Metal',
  day_categories JSONB DEFAULT '{}',
  day_hours JSONB DEFAULT '{}',
  ai_mode_enabled BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════
-- EXERCISES (default library + user custom)
-- ══════════════════════════════════════
CREATE TABLE exercises (
  id SERIAL PRIMARY KEY,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  duration_min INT NOT NULL DEFAULT 10,
  bpm_range TEXT DEFAULT '',
  description TEXT DEFAULT '',
  youtube_query TEXT DEFAULT '',
  tips TEXT DEFAULT '',
  focus TEXT DEFAULT '',
  needs_backing BOOLEAN DEFAULT FALSE,
  needs_songsterr BOOLEAN DEFAULT FALSE,
  alphatex TEXT, -- AlphaTex notation for tab rendering
  gp_file_url TEXT, -- Supabase Storage URL
  is_default BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════
-- EXERCISE OVERRIDES (per-user customizations)
-- ══════════════════════════════════════
CREATE TABLE exercise_overrides (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  exercise_id INT REFERENCES exercises(id) ON DELETE CASCADE,
  name TEXT,
  duration_min INT,
  description TEXT,
  youtube_query TEXT,
  tips TEXT,
  personal_notes TEXT,
  gp_file_url TEXT,
  alphatex TEXT,
  PRIMARY KEY (user_id, exercise_id)
);

-- ══════════════════════════════════════
-- SONGS (user's learning queue)
-- ══════════════════════════════════════
CREATE TABLE songs (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  artist TEXT,
  songsterr_id INT,
  songsterr_url TEXT,
  gp_file_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════
-- SONG PROGRESS (stages per week)
-- ══════════════════════════════════════
CREATE TABLE song_progress (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  song_id INT REFERENCES songs(id) ON DELETE CASCADE,
  week INT NOT NULL,
  stage_index INT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  bpm_achieved TEXT,
  notes TEXT,
  completed_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, song_id, week, stage_index)
);

-- ══════════════════════════════════════
-- DAILY ROUTINES
-- ══════════════════════════════════════
CREATE TABLE daily_routines (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  week INT NOT NULL,
  day TEXT NOT NULL,
  exercises JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, week, day)
);

-- ══════════════════════════════════════
-- EXERCISE LOGS (completion + notes)
-- ══════════════════════════════════════
CREATE TABLE exercise_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  week INT NOT NULL,
  day TEXT NOT NULL,
  exercise_id TEXT NOT NULL, -- string to support song exercises
  completed BOOLEAN DEFAULT FALSE,
  bpm_achieved TEXT,
  notes TEXT,
  time_spent_sec INT,
  logged_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_exercise_logs_user_week ON exercise_logs(user_id, week);

-- ══════════════════════════════════════
-- RECORDINGS
-- ══════════════════════════════════════
CREATE TABLE recordings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  exercise_id TEXT,
  song_id INT REFERENCES songs(id) ON DELETE SET NULL,
  week INT,
  day TEXT,
  storage_path TEXT NOT NULL,
  duration_sec FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_recordings_user ON recordings(user_id, week);

-- ══════════════════════════════════════
-- AI BACKING TRACKS (Suno cache)
-- ══════════════════════════════════════
CREATE TABLE ai_tracks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  prompt_hash TEXT NOT NULL,
  prompt TEXT NOT NULL,
  mode TEXT,
  scale TEXT,
  style TEXT,
  bpm INT,
  storage_path TEXT NOT NULL,
  suno_clip_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(prompt_hash)
);

-- ══════════════════════════════════════
-- PRACTICE STATS (daily aggregates)
-- ══════════════════════════════════════
CREATE TABLE practice_stats (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  week INT NOT NULL,
  day TEXT NOT NULL,
  total_minutes INT DEFAULT 0,
  exercises_completed INT DEFAULT 0,
  exercises_total INT DEFAULT 0,
  PRIMARY KEY (user_id, week, day)
);

-- ══════════════════════════════════════
-- EAR TRAINING SCORES
-- ══════════════════════════════════════
CREATE TABLE ear_training_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  exercise_type TEXT NOT NULL, -- 'interval', 'chord', 'scale'
  difficulty TEXT,
  correct INT DEFAULT 0,
  total INT DEFAULT 0,
  played_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ear_scores_user ON ear_training_scores(user_id);

-- ══════════════════════════════════════
-- CACHE TABLES
-- ══════════════════════════════════════
CREATE TABLE youtube_cache (
  query TEXT PRIMARY KEY,
  results JSONB NOT NULL,
  cached_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE chord_cache (
  chord_key TEXT NOT NULL,
  suffix TEXT NOT NULL DEFAULT '',
  data JSONB NOT NULL,
  PRIMARY KEY (chord_key, suffix)
);

-- ══════════════════════════════════════
-- ROW LEVEL SECURITY
-- ══════════════════════════════════════
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE song_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE ear_training_scores ENABLE ROW LEVEL SECURITY;

-- Users can only read/write their own data
CREATE POLICY "own_data" ON profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "own_data" ON user_settings FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_data" ON exercise_overrides FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_data" ON songs FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_data" ON song_progress FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_data" ON daily_routines FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_data" ON exercise_logs FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_data" ON recordings FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_data" ON ai_tracks FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_data" ON practice_stats FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_data" ON ear_training_scores FOR ALL USING (auth.uid() = user_id);

-- Exercises: everyone can read defaults, users can read their own
CREATE POLICY "read_defaults" ON exercises FOR SELECT USING (is_default = TRUE OR created_by = auth.uid());
CREATE POLICY "create_own" ON exercises FOR INSERT WITH CHECK (created_by = auth.uid() AND is_default = FALSE);

-- Cache tables: public read/write
ALTER TABLE youtube_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE chord_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_cache" ON youtube_cache FOR ALL USING (TRUE);
CREATE POLICY "public_cache" ON chord_cache FOR ALL USING (TRUE);

-- ══════════════════════════════════════
-- STORAGE BUCKETS (run via Supabase dashboard or API)
-- ══════════════════════════════════════
-- INSERT INTO storage.buckets (id, name, public) VALUES ('recordings', 'recordings', FALSE);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('gpfiles', 'gpfiles', FALSE);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('ai-tracks', 'ai-tracks', FALSE);
