"use client";
import { useEffect, useState } from "react";
import { loadBackingCountIn, saveBackingCountIn } from "@/lib/metronomeAudio";

interface Props {
  className?: string;
  beats?: number;
}

/** Small on/off toggle button — persists globally to localStorage `gf-backing-countin`. */
export default function CountInToggle({ className, beats = 4 }: Props) {
  const [on, setOn] = useState(false);
  useEffect(() => { setOn(loadBackingCountIn()); }, []);
  const toggle = () => {
    const next = !on;
    setOn(next);
    saveBackingCountIn(next);
  };
  return (
    <button
      type="button"
      onClick={toggle}
      title={on ? `Count-in enabled: ${beats} clicks before play` : "Count-in disabled"}
      className={`font-label text-[9px] px-2 py-1 rounded cursor-pointer border transition-colors ${
        on
          ? "border-[#D4A843] text-[#D4A843] bg-[#D4A843]/10"
          : "border-[#222] text-[#555] hover:text-[#888]"
      } ${className ?? ""}`}
    >
      Count-in {beats}
    </button>
  );
}
