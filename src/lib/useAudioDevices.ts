"use client";
import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "gf-audio-input-device";

/**
 * Shared hook for audio input device enumeration and selection.
 * Persists selection in localStorage so user picks their Helix once.
 * Re-enumerates on device change (plug/unplug).
 */
export function useAudioDevices() {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");

  const enumerate = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      const inputs = all.filter(d => d.kind === "audioinput" && d.deviceId);
      setDevices(inputs);

      // Restore saved preference
      const saved = localStorage.getItem(STORAGE_KEY);
      const savedStillExists = saved && inputs.some(d => d.deviceId === saved);
      if (savedStillExists) {
        setSelectedDeviceId(saved!);
      } else if (inputs.length > 0) {
        // No saved or saved device gone — pick first (system default)
        setSelectedDeviceId(inputs[0].deviceId);
      }
    } catch {
      // Permission denied or not available — devices list stays empty
    }
  }, []);

  useEffect(() => {
    // Initial enumeration — need a temporary getUserMedia to unlock device labels
    (async () => {
      try {
        // Request mic briefly to get labeled device list
        const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        tempStream.getTracks().forEach(t => t.stop());
      } catch {
        // If denied, enumerateDevices will show unlabeled entries
      }
      await enumerate();
    })();

    // Re-enumerate when devices change (plug/unplug)
    const handler = () => { enumerate(); };
    navigator.mediaDevices?.addEventListener("devicechange", handler);
    return () => {
      navigator.mediaDevices?.removeEventListener("devicechange", handler);
    };
  }, [enumerate]);

  const selectDevice = useCallback((deviceId: string) => {
    setSelectedDeviceId(deviceId);
    localStorage.setItem(STORAGE_KEY, deviceId);
  }, []);

  return { devices, selectedDeviceId, selectDevice };
}

/**
 * Build getUserMedia audio constraints with the selected device.
 * Disables all browser audio processing for transparent recording.
 */
export function buildAudioConstraints(deviceId?: string): MediaStreamConstraints {
  const audioConstraints: MediaTrackConstraints = {
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
    channelCount: { ideal: 2 },
    sampleRate: { ideal: 48000 },
    sampleSize: { ideal: 24 },
  };
  if (deviceId) {
    audioConstraints.deviceId = { exact: deviceId };
  }
  return { audio: audioConstraints };
}
