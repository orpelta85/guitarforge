"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { COL } from "@/lib/constants";

/* ─── Skill Node Definition ─── */
interface SkillNode {
  id: string;
  name: string;
  category: string;
  description: string;
  exerciseIds: number[];
  requires: string[];      // prerequisite node IDs
  branch: string;
  tier: number;            // 0=root, 1,2,3... deeper
  masteryThreshold?: number; // times needed for mastery (default 5)
}

type NodeState = "locked" | "available" | "completed" | "mastered";

/* ─── All 38 Skill Nodes ─── */
const SKILL_NODES: SkillNode[] = [
  // ── Picking Branch ──
  { id: "pick-alt", name: "Alternate Picking", category: "Shred", description: "Build foundational alternate picking speed and accuracy across all strings.", exerciseIds: [6], requires: [], branch: "Picking", tier: 0 },
  { id: "pick-econ", name: "Economy Picking", category: "Picking", description: "Fluid direction changes combining alternate and sweep motion.", exerciseIds: [81, 10], requires: ["pick-alt"], branch: "Picking", tier: 1 },
  { id: "pick-speed", name: "Speed Building", category: "Shred", description: "Push past plateaus with burst picking and sextuplet patterns.", exerciseIds: [7, 9], requires: ["pick-econ"], branch: "Picking", tier: 2 },
  { id: "pick-burst", name: "Burst Picking", category: "Shred", description: "Controlled explosions — short bursts at maximum speed with precision.", exerciseIds: [9, 112], requires: ["pick-speed"], branch: "Picking", tier: 3 },
  { id: "pick-master", name: "Shred Master", category: "Shred", description: "Full command of picking at extreme tempos. Sextuplets at 160+ BPM.", exerciseIds: [8, 11, 112], requires: ["pick-burst"], branch: "Picking", tier: 4 },

  // ── Legato Branch ──
  { id: "leg-basic", name: "Hammer & Pull-Off", category: "Legato", description: "Clean hammer-ons and pull-offs across the pentatonic scale.", exerciseIds: [12], requires: [], branch: "Legato", tier: 0 },
  { id: "leg-roll", name: "Legato Roll", category: "Legato", description: "Infinite legato rolls with the 1-2-4 finger pattern.", exerciseIds: [13], requires: ["leg-basic"], branch: "Legato", tier: 1 },
  { id: "leg-cross", name: "Cross-String Legato", category: "Legato", description: "Slides and legato across multiple strings, Holdsworth-inspired.", exerciseIds: [14], requires: ["leg-roll"], branch: "Legato", tier: 2 },
  { id: "leg-hybrid", name: "Legato + Pick Hybrid", category: "Legato", description: "Combine legato with picked notes for dynamic phrasing.", exerciseIds: [16, 15], requires: ["leg-cross"], branch: "Legato", tier: 3 },
  { id: "leg-satriani", name: "Satriani Runs", category: "Legato", description: "Full legato scale runs at speed — fluid, seamless, musical.", exerciseIds: [118], requires: ["leg-hybrid"], branch: "Legato", tier: 4 },

  // ── Bends & Vibrato Branch ──
  { id: "bend-half", name: "Half-Step Bends", category: "Bends", description: "Accurate half-step bends with proper pitch targeting.", exerciseIds: [17], requires: [], branch: "Bends", tier: 0 },
  { id: "bend-whole", name: "Whole-Step Bends", category: "Bends", description: "Full step bends — the foundation of blues and rock expression.", exerciseIds: [18], requires: ["bend-half"], branch: "Bends", tier: 1 },
  { id: "bend-unison", name: "Unison Bends", category: "Bends", description: "Hendrix-style double-stop unison bends for thick tone.", exerciseIds: [20], requires: ["bend-whole"], branch: "Bends", tier: 2 },
  { id: "bend-multi", name: "Multi-Step Bends", category: "Bends", description: "1.5 and 2 whole-tone bends — extreme expression.", exerciseIds: [119], requires: ["bend-unison"], branch: "Bends", tier: 3 },
  { id: "bend-vibmaster", name: "Vibrato Master", category: "Bends", description: "Full control of vibrato speed and width. Gilmour / BB King caliber.", exerciseIds: [19, 21], requires: ["bend-multi"], branch: "Bends", tier: 4 },

  // ── Tapping Branch ──
  { id: "tap-basic", name: "Basic Tapping", category: "Tapping", description: "One-hand tap arpeggios — Am shape, Van Halen fundamentals.", exerciseIds: [22], requires: [], branch: "Tapping", tier: 0 },
  { id: "tap-two", name: "Two-Hand Tapping", category: "Tapping", description: "Extended range tapping with both hands across the fretboard.", exerciseIds: [23, 101], requires: ["tap-basic"], branch: "Tapping", tier: 1 },
  { id: "tap-arp", name: "Tapping Arpeggios", category: "Tapping", description: "Tapping arpeggios over chord changes for harmonic depth.", exerciseIds: [24], requires: ["tap-two"], branch: "Tapping", tier: 2 },
  { id: "tap-multi", name: "Multi-Finger Tapping", category: "Tapping", description: "3-finger tapping for complex patterns and wider intervals.", exerciseIds: [102], requires: ["tap-arp"], branch: "Tapping", tier: 3 },

  // ── Sweep Branch ──
  { id: "swp-3str", name: "3-String Sweep", category: "Sweep", description: "Clean 3-string arpeggio sweeps with proper muting and pivot.", exerciseIds: [25], requires: [], branch: "Sweep", tier: 0 },
  { id: "swp-5str", name: "5-String Sweep", category: "Sweep", description: "Full 5-string major and minor arpeggio sweeps.", exerciseIds: [26, 103], requires: ["swp-3str"], branch: "Sweep", tier: 1 },
  { id: "swp-tap", name: "Sweep + Tap", category: "Sweep", description: "Combine sweep picking with a tap at the top. Yngwie / Becker peak.", exerciseIds: [27], requires: ["swp-5str"], branch: "Sweep", tier: 2 },
  { id: "swp-econ", name: "Economy + Sweep Combo", category: "Sweep", description: "Blend economy picking and sweep arpeggios into flowing lines.", exerciseIds: [104], requires: ["swp-tap"], branch: "Sweep", tier: 3 },

  // ── Rhythm Branch ──
  { id: "rhy-down", name: "Downpicking Power", category: "Rhythm", description: "Hetfield-level downpicking endurance and precision.", exerciseIds: [28], requires: [], branch: "Rhythm", tier: 0 },
  { id: "rhy-palm", name: "Palm Mute Control", category: "Rhythm", description: "Dynamic palm muting — tight and controlled for heavy riffs.", exerciseIds: [29], requires: ["rhy-down"], branch: "Rhythm", tier: 1 },
  { id: "rhy-gallop", name: "Gallop Patterns", category: "Rhythm", description: "Iron Maiden galloping rhythm — D-U-D patterns at speed.", exerciseIds: [30], requires: ["rhy-palm"], branch: "Rhythm", tier: 2 },
  { id: "rhy-odd", name: "Odd Time Mastery", category: "Rhythm", description: "Progressive time signatures — 7/8, 5/4, and mixed meter.", exerciseIds: [31, 32], requires: ["rhy-gallop"], branch: "Rhythm", tier: 3 },

  // ── Fretboard Branch ──
  { id: "fb-caged", name: "CAGED System", category: "Fretboard", description: "5 shapes, one fretboard — complete neck visualization.", exerciseIds: [33], requires: [], branch: "Fretboard", tier: 0 },
  { id: "fb-notes", name: "Note Recognition", category: "Fretboard", description: "Instant mental map — name any note on any fret.", exerciseIds: [34], requires: ["fb-caged"], branch: "Fretboard", tier: 1 },
  { id: "fb-pos", name: "Position Shifting", category: "Fretboard", description: "Seamless movement between the 5 pentatonic positions.", exerciseIds: [35], requires: ["fb-notes"], branch: "Fretboard", tier: 2 },
  { id: "fb-triads", name: "Triad Mastery", category: "Fretboard", description: "Major and minor triads in all inversions across string groups.", exerciseIds: [36], requires: ["fb-pos"], branch: "Fretboard", tier: 3 },

  // ── Ear Training Branch ──
  { id: "ear-int", name: "Interval Recognition", category: "Ear Training", description: "Identify all intervals by ear — the foundation of musicianship.", exerciseIds: [37], requires: [], branch: "Ear", tier: 0 },
  { id: "ear-chord", name: "Chord Recognition", category: "Ear Training", description: "Identify chord quality by ear — major, minor, diminished, seventh.", exerciseIds: [38], requires: ["ear-int"], branch: "Ear", tier: 1 },
  { id: "ear-mode", name: "Mode Identification", category: "Ear Training", description: "Hear and name the mode being played. Develop modal awareness.", exerciseIds: [40], requires: ["ear-chord"], branch: "Ear", tier: 2 },
  { id: "ear-trans", name: "Transcription", category: "Ear Training", description: "Transcribe 8 bars by ear with no tab. The ultimate ear test.", exerciseIds: [41], requires: ["ear-mode"], branch: "Ear", tier: 3 },

  // ── Theory / Modes Branch ──
  { id: "th-blues", name: "Blues Scale", category: "Modes", description: "5 positions of the blues scale with the blue note bend.", exerciseIds: [58], requires: [], branch: "Theory", tier: 0 },
  { id: "th-modal", name: "Modal Awareness", category: "Modes", description: "Mode of the week — learn 3 positions and the unique color.", exerciseIds: [57], requires: ["th-blues"], branch: "Theory", tier: 1 },
  { id: "th-phrygian", name: "Phrygian Mastery", category: "Modes", description: "Dark descent — the b2 interval and its metal applications.", exerciseIds: [56, 105], requires: ["th-modal"], branch: "Theory", tier: 2 },
  { id: "th-lydian", name: "Lydian Floating", category: "Modes", description: "The #4 creates a floating, dreamlike quality. Satriani territory.", exerciseIds: [106], requires: ["th-modal"], branch: "Theory", tier: 3 },
];

/* ─── Branch Layout Config ─── */
const BRANCHES = [
  { id: "Picking", label: "Picking", y: 0 },
  { id: "Legato", label: "Legato", y: 1 },
  { id: "Bends", label: "Bends", y: 2 },
  { id: "Tapping", label: "Tapping", y: 3 },
  { id: "Sweep", label: "Sweep", y: 4 },
  { id: "Rhythm", label: "Rhythm", y: 5 },
  { id: "Fretboard", label: "Fretboard", y: 6 },
  { id: "Ear", label: "Ear Training", y: 7 },
  { id: "Theory", label: "Theory", y: 8 },
];

const NODE_R = 22;
const COL_W = 130;
const ROW_H = 90;
const PAD_X = 80;
const PAD_Y = 60;

function getNodePos(node: SkillNode) {
  const branchIdx = BRANCHES.findIndex(b => b.id === node.branch);
  return {
    x: PAD_X + node.tier * COL_W,
    y: PAD_Y + branchIdx * ROW_H,
  };
}

/* ─── Main Component ─── */
export default function SkillTreePage() {
  const [doneMap, setDoneMap] = useState<Record<string, boolean>>({});
  const [calendarData, setCalendarData] = useState<Record<string, { exercisesDone: number }>>({});
  const [selectedNode, setSelectedNode] = useState<SkillNode | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load data from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem("gf30");
      if (raw) {
        const d = JSON.parse(raw);
        if (d.doneMap) setDoneMap(d.doneMap);
      }
    } catch {}
    try {
      const cr = localStorage.getItem("gf-calendar");
      if (cr) setCalendarData(JSON.parse(cr));
    } catch {}
  }, []);

  // Count how many times an exercise has been completed (across all weeks/days)
  const exerciseCompletionCount = useMemo(() => {
    const counts: Record<number, number> = {};
    Object.entries(doneMap).forEach(([key, val]) => {
      if (!val) return;
      // key format: "week-day-exerciseId"
      const parts = key.split("-");
      const exId = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(exId)) counts[exId] = (counts[exId] || 0) + 1;
    });
    // Also count from calendar data (total practice days as a proxy)
    return counts;
  }, [doneMap]);

  // Determine if exercise IDs have been done
  const isExerciseDone = useCallback((exId: number): boolean => {
    return (exerciseCompletionCount[exId] || 0) > 0;
  }, [exerciseCompletionCount]);

  const getExerciseCount = useCallback((exId: number): number => {
    return exerciseCompletionCount[exId] || 0;
  }, [exerciseCompletionCount]);

  // Get node state
  const getNodeState = useCallback((node: SkillNode): NodeState => {
    const allDone = node.exerciseIds.every(id => isExerciseDone(id));
    const totalCount = node.exerciseIds.reduce((sum, id) => sum + getExerciseCount(id), 0);
    const threshold = node.masteryThreshold || 5;

    if (allDone && totalCount >= threshold * node.exerciseIds.length) return "mastered";
    if (allDone) return "completed";

    // Check prerequisites
    const prereqsMet = node.requires.every(reqId => {
      const reqNode = SKILL_NODES.find(n => n.id === reqId);
      if (!reqNode) return true;
      return reqNode.exerciseIds.every(id => isExerciseDone(id));
    });

    if (node.requires.length === 0 || prereqsMet) return "available";
    return "locked";
  }, [isExerciseDone, getExerciseCount]);

  // Stats
  const stats = useMemo(() => {
    let completed = 0;
    let mastered = 0;
    SKILL_NODES.forEach(n => {
      const s = getNodeState(n);
      if (s === "completed" || s === "mastered") completed++;
      if (s === "mastered") mastered++;
    });
    return { total: SKILL_NODES.length, completed, mastered };
  }, [getNodeState]);

  // SVG dimensions
  const maxTier = Math.max(...SKILL_NODES.map(n => n.tier));
  const svgW = PAD_X * 2 + maxTier * COL_W;
  const svgH = PAD_Y * 2 + (BRANCHES.length - 1) * ROW_H;

  // Pan handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest(".node-interactive")) return;
    setDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setPanStart({ x: pan.x, y: pan.y });
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    setPan({
      x: panStart.x + (e.clientX - dragStart.x),
      y: panStart.y + (e.clientY - dragStart.y),
    });
  };
  const handlePointerUp = () => setDragging(false);

  // Get color for node
  const getNodeColor = (node: SkillNode): string => COL[node.category] || "#D4A843";

  // Connection path between two nodes
  const renderConnection = (from: SkillNode, to: SkillNode) => {
    const p1 = getNodePos(from);
    const p2 = getNodePos(to);
    const fromState = getNodeState(from);
    const toState = getNodeState(to);
    const isActive = fromState === "completed" || fromState === "mastered";
    const bothDone = isActive && (toState === "completed" || toState === "mastered");

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const mx = p1.x + dx * 0.5;

    return (
      <path
        key={`${from.id}-${to.id}`}
        d={`M${p1.x},${p1.y} C${mx},${p1.y} ${mx},${p2.y} ${p2.x},${p2.y}`}
        stroke={bothDone ? "#D4A843" : isActive ? "rgba(212,168,67,0.4)" : "rgba(255,255,255,0.1)"}
        strokeWidth={bothDone ? 2.5 : 1.5}
        fill="none"
        strokeDasharray={bothDone ? "none" : isActive ? "6 3" : "4 4"}
        className={bothDone ? "connection-glow" : ""}
      />
    );
  };

  // Render a single node
  const renderNode = (node: SkillNode) => {
    const pos = getNodePos(node);
    const state = getNodeState(node);
    const color = getNodeColor(node);
    const isSelected = selectedNode?.id === node.id;

    let fill = "#1a1a1a";
    let stroke = "rgba(255,255,255,0.15)";
    let strokeW = 1.5;
    let opacity = 0.5;
    let glowFilter = "";
    let icon = "lock";

    switch (state) {
      case "available":
        stroke = color;
        strokeW = 2;
        opacity = 0.8;
        icon = "dot";
        break;
      case "completed":
        fill = color + "30";
        stroke = color;
        strokeW = 2.5;
        opacity = 1;
        glowFilter = `url(#glow-${node.branch})`;
        icon = "check";
        break;
      case "mastered":
        fill = color + "50";
        stroke = "#22c55e";
        strokeW = 3;
        opacity = 1;
        glowFilter = "url(#glow-mastery)";
        icon = "star";
        break;
      default: // locked
        icon = "lock";
    }

    return (
      <g
        key={node.id}
        className="node-interactive cursor-pointer"
        onClick={() => setSelectedNode(isSelected ? null : node)}
        style={{ opacity }}
      >
        {glowFilter && (
          <circle cx={pos.x} cy={pos.y} r={NODE_R + 6} fill="none" stroke={state === "mastered" ? "#22c55e" : color} strokeWidth={1} opacity={0.3}>
            <animate attributeName="r" values={`${NODE_R + 4};${NODE_R + 8};${NODE_R + 4}`} dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.3;0.1;0.3" dur="2s" repeatCount="indefinite" />
          </circle>
        )}
        <circle
          cx={pos.x}
          cy={pos.y}
          r={NODE_R}
          fill={fill}
          stroke={isSelected ? "#fff" : stroke}
          strokeWidth={isSelected ? 3 : strokeW}
          filter={glowFilter}
          className="transition-all duration-300"
        />
        {/* Icon */}
        {icon === "lock" && (
          <g transform={`translate(${pos.x - 6},${pos.y - 7})`}>
            <rect x="1" y="5" width="10" height="8" rx="1" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.2" />
            <path d="M3 5V3.5a3 3 0 016 0V5" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.2" />
          </g>
        )}
        {icon === "dot" && (
          <circle cx={pos.x} cy={pos.y} r={4} fill={color} opacity={0.7}>
            <animate attributeName="opacity" values="0.5;1;0.5" dur="1.5s" repeatCount="indefinite" />
          </circle>
        )}
        {icon === "check" && (
          <path d={`M${pos.x - 6},${pos.y} l4,4 l8,-8`} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        )}
        {icon === "star" && (
          <polygon
            points={starPoints(pos.x, pos.y, 9, 4.5)}
            fill="#22c55e"
            stroke="#22c55e"
            strokeWidth="0.5"
          />
        )}
        {/* Label below */}
        <text
          x={pos.x}
          y={pos.y + NODE_R + 14}
          textAnchor="middle"
          fill={state === "locked" ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.8)"}
          fontSize="10"
          fontFamily="system-ui, sans-serif"
          fontWeight="500"
        >
          {node.name}
        </text>
      </g>
    );
  };

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "Oswald, system-ui, sans-serif", color: "#D4A843" }}>
            Skill Tree
          </h1>
          <p className="text-sm text-neutral-400 mt-1">Track your guitar mastery across {BRANCHES.length} skill branches</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="amp-panel px-3 py-1.5 rounded text-sm flex items-center gap-2">
            <span className="text-neutral-400">Skills:</span>
            <span className="font-semibold" style={{ color: "#D4A843" }}>{stats.completed}/{stats.total}</span>
          </div>
          {stats.mastered > 0 && (
            <div className="amp-panel px-3 py-1.5 rounded text-sm flex items-center gap-2">
              <span className="text-neutral-400">Mastered:</span>
              <span className="font-semibold text-green-400">{stats.mastered}</span>
            </div>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="amp-panel rounded-lg p-3 mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-neutral-400">Overall Progress</span>
          <span className="text-xs font-medium" style={{ color: "#D4A843" }}>{Math.round((stats.completed / stats.total) * 100)}%</span>
        </div>
        <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${(stats.completed / stats.total) * 100}%`,
              background: "linear-gradient(90deg, #D4A843, #22c55e)",
            }}
          />
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-3 text-xs text-neutral-400">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full border border-neutral-600 bg-neutral-800 inline-block" /> Locked</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full border-2 inline-block" style={{ borderColor: "#D4A843" }} /> Available</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full inline-block" style={{ background: "#D4A843" }} /> Completed</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full inline-block" style={{ background: "#22c55e", boxShadow: "0 0 6px #22c55e" }} /> Mastered</span>
      </div>

      {/* Tree Canvas */}
      <div
        ref={containerRef}
        className="amp-panel rounded-lg overflow-hidden relative select-none"
        style={{ touchAction: "none" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <div className="overflow-auto" style={{ maxHeight: "calc(100vh - 320px)", minHeight: 400 }}>
          <svg
            ref={svgRef}
            width={svgW}
            height={svgH}
            viewBox={`${-pan.x / 1} ${-pan.y / 1} ${svgW} ${svgH}`}
            className="w-full"
            style={{ minWidth: svgW, minHeight: svgH, background: "rgba(10,10,10,0.6)" }}
          >
            {/* Defs: glow filters */}
            <defs>
              {BRANCHES.map(b => {
                const branchNodes = SKILL_NODES.filter(n => n.branch === b.id);
                const color = branchNodes[0] ? getNodeColor(branchNodes[0]) : "#D4A843";
                return (
                  <filter key={b.id} id={`glow-${b.id}`} x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feFlood floodColor={color} floodOpacity="0.4" result="color" />
                    <feComposite in="color" in2="blur" operator="in" result="glow" />
                    <feMerge>
                      <feMergeNode in="glow" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                );
              })}
              <filter id="glow-mastery" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feFlood floodColor="#22c55e" floodOpacity="0.5" result="color" />
                <feComposite in="color" in2="blur" operator="in" result="glow" />
                <feMerge>
                  <feMergeNode in="glow" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Branch labels */}
            {BRANCHES.map(b => (
              <text
                key={b.id}
                x={12}
                y={PAD_Y + b.y * ROW_H + 4}
                fill="rgba(255,255,255,0.25)"
                fontSize="11"
                fontWeight="600"
                fontFamily="Oswald, system-ui, sans-serif"
                textAnchor="start"
              >
                {b.label}
              </text>
            ))}

            {/* Connections */}
            {SKILL_NODES.map(node =>
              node.requires.map(reqId => {
                const from = SKILL_NODES.find(n => n.id === reqId);
                if (!from) return null;
                return renderConnection(from, node);
              })
            )}

            {/* Nodes */}
            {SKILL_NODES.map(renderNode)}
          </svg>
        </div>
      </div>

      {/* Node Detail Panel */}
      {selectedNode && (
        <NodeDetailPanel
          node={selectedNode}
          state={getNodeState(selectedNode)}
          exerciseCompletionCount={exerciseCompletionCount}
          onClose={() => setSelectedNode(null)}
        />
      )}

      {/* Branch Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
        {BRANCHES.map(b => {
          const branchNodes = SKILL_NODES.filter(n => n.branch === b.id);
          const done = branchNodes.filter(n => {
            const s = getNodeState(n);
            return s === "completed" || s === "mastered";
          }).length;
          const color = branchNodes[0] ? getNodeColor(branchNodes[0]) : "#D4A843";
          return (
            <div key={b.id} className="amp-panel rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold" style={{ color }}>{b.label}</span>
                <span className="text-xs text-neutral-400">{done}/{branchNodes.length}</span>
              </div>
              <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${branchNodes.length > 0 ? (done / branchNodes.length) * 100 : 0}%`, background: color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Node Detail Panel ─── */
function NodeDetailPanel({
  node,
  state,
  exerciseCompletionCount,
  onClose,
}: {
  node: SkillNode;
  state: NodeState;
  exerciseCompletionCount: Record<number, number>;
  onClose: () => void;
}) {
  // Import exercises dynamically to avoid circular deps
  const [exercises, setExercises] = useState<{ id: number; n: string; c: string; b: string; d: string }[]>([]);
  useEffect(() => {
    import("@/lib/exercises").then(mod => {
      setExercises(mod.EXERCISES.filter((e: { id: number }) => node.exerciseIds.includes(e.id)));
    });
  }, [node.exerciseIds]);

  const color = COL[node.category] || "#D4A843";

  const stateLabel = {
    locked: "Locked",
    available: "Available",
    completed: "Completed",
    mastered: "Mastered",
  }[state];

  const stateColor = {
    locked: "#6b7280",
    available: "#D4A843",
    completed: "#D4A843",
    mastered: "#22c55e",
  }[state];

  return (
    <div className="amp-panel rounded-lg p-4 mt-4 border" style={{ borderColor: color + "40" }}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-lg font-bold" style={{ fontFamily: "Oswald, system-ui, sans-serif", color }}>
            {node.name}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: color + "20", color }}>
              {node.category}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: stateColor + "20", color: stateColor }}>
              {stateLabel}
            </span>
          </div>
        </div>
        <button onClick={onClose} className="text-neutral-500 hover:text-white transition-colors p-1">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <p className="text-sm text-neutral-300 mb-3">{node.description}</p>

      {node.requires.length > 0 && (
        <div className="mb-3">
          <span className="text-xs text-neutral-500 uppercase tracking-wider">Requires</span>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {node.requires.map(reqId => {
              const req = SKILL_NODES.find(n => n.id === reqId);
              return req ? (
                <span key={reqId} className="text-xs px-2 py-0.5 bg-neutral-800 rounded text-neutral-300">
                  {req.name}
                </span>
              ) : null;
            })}
          </div>
        </div>
      )}

      <div>
        <span className="text-xs text-neutral-500 uppercase tracking-wider">Linked Exercises</span>
        <div className="mt-1.5 space-y-1.5">
          {exercises.map(ex => {
            const count = exerciseCompletionCount[ex.id] || 0;
            const done = count > 0;
            return (
              <div key={ex.id} className="flex items-center justify-between p-2 rounded bg-neutral-800/50">
                <div className="flex items-center gap-2">
                  {done ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5">
                      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2">
                      <circle cx="12" cy="12" r="9" />
                    </svg>
                  )}
                  <span className={`text-sm ${done ? "text-neutral-200" : "text-neutral-500"}`}>{ex.n}</span>
                </div>
                <span className="text-xs text-neutral-500">{count > 0 ? `${count}x` : "—"}</span>
              </div>
            );
          })}
        </div>
      </div>

      {state === "completed" && (
        <div className="mt-3 p-2 rounded bg-amber-900/20 border border-amber-800/30 text-xs text-amber-300">
          Complete linked exercises {(node.masteryThreshold || 5) * node.exerciseIds.length} total times to achieve Mastery.
        </div>
      )}
    </div>
  );
}

/* ─── Helper: Star polygon points ─── */
function starPoints(cx: number, cy: number, outer: number, inner: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 5; i++) {
    const aOuter = (Math.PI / 2) + (i * 2 * Math.PI / 5);
    const aInner = aOuter + Math.PI / 5;
    pts.push(`${cx + outer * Math.cos(aOuter)},${cy - outer * Math.sin(aOuter)}`);
    pts.push(`${cx + inner * Math.cos(aInner)},${cy - inner * Math.sin(aInner)}`);
  }
  return pts.join(" ");
}
