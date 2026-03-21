"use client";

import { createClient } from "./supabase";

interface SyncableData {
  [key: string]: unknown;
  _syncTs?: number;
}

// Upload local data to Supabase
export async function uploadSettings(userId: string, settings: SyncableData): Promise<void> {
  const supabase = createClient();
  const payload = { ...settings, _syncTs: Date.now() };
  const { error } = await supabase
    .from("user_settings")
    .upsert({
      user_id: userId,
      settings: payload,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
  if (error) throw error;
}

// Download settings from Supabase
export async function downloadSettings(userId: string): Promise<SyncableData | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("user_settings")
    .select("settings, updated_at")
    .eq("user_id", userId)
    .single();
  if (error && error.code === "PGRST116") return null; // no row
  if (error) throw error;
  return data?.settings as SyncableData | null;
}

// Sync logic: merge local + cloud (latest timestamp wins)
export async function syncData(userId: string, localData: SyncableData): Promise<SyncableData> {
  const cloud = await downloadSettings(userId);

  // No cloud data — upload local and return it
  if (!cloud) {
    await uploadSettings(userId, localData);
    return localData;
  }

  const localTs = (localData._syncTs as number) || 0;
  const cloudTs = (cloud._syncTs as number) || 0;

  // Cloud is newer — use cloud data
  if (cloudTs > localTs) {
    return cloud;
  }

  // Local is newer or same — upload local
  await uploadSettings(userId, localData);
  return localData;
}
