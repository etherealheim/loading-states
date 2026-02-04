"use client";

import { useEffect, useState, useRef, useMemo, memo } from "react";
import { Slider } from "./ui/slider";
import { ActorsRunCard } from "./ActorsRunCard";
import { generateHalftoneStates, HalftoneStrategy, type Position as HalftonePosition, type DotState as HalftoneDotState } from "@/utils/halftone";
import { DOT_SPACING, LoaderDot } from "./LoaderDot";

type DotState = HalftoneDotState;

interface Position {
  x: number;
  y: number;
}

interface GridDot {
  state: DotState;
}

const GRID_SIZE = 5;
const MINI_GRID_SIZE = 3;
const MINI_DOT_SIZE = 4;
const MINI_DOT_SPACING = 0;
interface LoaderProps {
  shape: Position[];
  title: string;
  animated?: boolean;
  animationPath?: Position[][];
  speed?: number;
  customStates?: Map<string, DotState>;
  halftone?: {
    strategy: HalftoneStrategy;
    enabled?: boolean; // Default true if halftone provided
  };
}

const ACTORS_RUN_RANGES = [
  "Jan 24 - Feb 24",
  "Feb 24 - Mar 24",
  "Mar 24 - Apr 24",
  "Apr 24 - May 24",
  "May 24 - Jun 24",
];

function createMockActorsRunData() {
  const amount = Math.round(Math.random() * 12000) / 100;
  const range = ACTORS_RUN_RANGES[Math.floor(Math.random() * ACTORS_RUN_RANGES.length)];
  const level = Math.min(1, Math.max(0, amount / 120));
  let trend = Math.random() * 2 - 1;
  if (level < 0.35) {
    trend -= (0.35 - level) * 1.5;
  }
  trend = Math.max(-1, Math.min(1, trend));
  return { amount, range, level, trend };
}

function createMockComputeUnitsData() {
  const amount = Math.round(Math.random() * 9000) / 1000000; // 0 to 0.009
  const range = ACTORS_RUN_RANGES[Math.floor(Math.random() * ACTORS_RUN_RANGES.length)];
  const level = amount / 0.009; // Normalize to 0-1
  let trend = Math.random() * 2 - 1;
  if (level < 0.35) {
    trend -= (0.35 - level) * 1.5;
  }
  trend = Math.max(-1, Math.min(1, trend));
  return { amount, range, level, trend };
}

function createMockStorageData() {
  const amount = Math.round(Math.random() * 5000); // 0 to 5000 MB (0-5 GB)
  const range = ACTORS_RUN_RANGES[Math.floor(Math.random() * ACTORS_RUN_RANGES.length)];
  const level = Math.min(1, Math.max(0, amount / 5000));
  let trend = Math.random() * 2 - 1;
  if (level < 0.35) {
    trend -= (0.35 - level) * 1.5;
  }
  trend = Math.max(-1, Math.min(1, trend));
  return { amount, range, level, trend };
}

const Loader = memo(function Loader({ shape, title, animated = false, animationPath, speed = 400, customStates, halftone }: LoaderProps) {
  const [grid, setGrid] = useState<GridDot[][]>(
    Array(GRID_SIZE)
      .fill(null)
      .map(() =>
        Array(GRID_SIZE)
          .fill(null)
          .map(() => ({ state: "empty" as DotState }))
      )
  );
  const [currentShapeIndex, setCurrentShapeIndex] = useState(0);

  // Frame history for trail strategy - use ref to avoid dependency cycles
  const frameHistoryRef = useRef<Position[][]>([]);

  // Halftone cache - use Map for better performance
  const halftoneCache = useRef<Map<string, Map<string, DotState>>>(new Map());

  // Memoize halftone strategy key to avoid JSON.stringify on every render
  const halftoneKey = useMemo(() => {
    if (!halftone) return null;
    return `${halftone.strategy.type}-${JSON.stringify(halftone.strategy)}`;
  }, [halftone]);

  const getNeighbors = (x: number, y: number): Position[] => {
    const neighbors: Position[] = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) {
          neighbors.push({ x: nx, y: ny });
        }
      }
    }
    return neighbors;
  };

  useEffect(() => {
    const currentShape = animated && animationPath ? animationPath[currentShapeIndex] : shape;

    // Safety check - ensure currentShape is a valid array (but allow empty arrays)
    if (!Array.isArray(currentShape)) {
      return;
    }

    // Update frame history for trail strategy using ref
    if (halftone?.strategy.type === "trail") {
      const maxLength = Math.min(halftone.strategy.length, 10); // Cap at 10 frames max
      const newHistory = [currentShape, ...frameHistoryRef.current];
      frameHistoryRef.current = newHistory.slice(0, maxLength);
    }

    let finalStates: Map<string, DotState>;

    // Priority 1: Custom states (for static halftone showcase)
    if (customStates) {
      finalStates = customStates;
    }
    // Priority 2: Halftone strategy
    else if (halftone && halftone.enabled !== false && halftoneKey) {
      const cacheKey = `${currentShapeIndex}-${halftoneKey}`;

      if (halftoneCache.current.has(cacheKey)) {
        finalStates = halftoneCache.current.get(cacheKey)!;
      } else {
        finalStates = generateHalftoneStates(
          currentShape,
          halftone.strategy,
          GRID_SIZE,
          frameHistoryRef.current // For trail strategy
        );
        halftoneCache.current.set(cacheKey, finalStates);

        // Limit cache size to prevent memory leaks
        if (halftoneCache.current.size > 100) {
          const firstKey = halftoneCache.current.keys().next().value;
          if (firstKey) {
            halftoneCache.current.delete(firstKey);
          }
        }
      }
    }
    // Priority 3: Default (only full dots)
    else {
      finalStates = new Map();
      currentShape.forEach(({ x, y }) => {
        if (x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE) {
          finalStates.set(`${x},${y}`, "full");
        }
      });
    }

    // Build grid from final states
    const newGrid = Array(GRID_SIZE)
      .fill(null)
      .map(() => Array(GRID_SIZE).fill(null).map(() => ({ state: "empty" as DotState })));

    finalStates.forEach((state, key) => {
      const [x, y] = key.split(",").map(Number);
      if (y >= 0 && y < GRID_SIZE && x >= 0 && x < GRID_SIZE) {
        newGrid[y][x].state = state;
      }
    });

    setGrid(newGrid);
  }, [shape, animated, animationPath, currentShapeIndex, customStates, halftone, halftoneKey]);

  useEffect(() => {
    if (animated && animationPath) {
      const interval = setInterval(() => {
        setCurrentShapeIndex((prev) => (prev + 1) % animationPath.length);
      }, speed);
      return () => clearInterval(interval);
    }
  }, [animated, animationPath, speed]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${GRID_SIZE}, auto)`,
          gridTemplateRows: `repeat(${GRID_SIZE}, auto)`,
          gap: `${DOT_SPACING}px`,
        }}
      >
        {grid.map((row, y) =>
          row.map((dot, x) => (
            <LoaderDot key={`${x}-${y}`} state={dot.state} />
          ))
        )}
      </div>
      <div className="text-xs text-gray-600 font-medium">{title}</div>
    </div>
  );
});

interface MiniLoaderProps {
  title: string;
  animationPath: Position[][];
  speed?: number;
  fadeOutMs?: number;
  lightColor?: string;
  darkColor?: string;
}

type MiniTheme = "light" | "dark";
interface DelayAnimation {
  title: string;
  delays: number[];
}

const MiniLoader = memo(function MiniLoader({
  title,
  animationPath,
  speed = 400,
  fadeOutMs = 200,
  lightColor = "#1d4ed8",
  darkColor = "#f8fafc",
}: MiniLoaderProps) {
  const [currentShapeIndex, setCurrentShapeIndex] = useState(0);
  const [previousPositions, setPreviousPositions] = useState<Position[]>([]);
  const [previousKey, setPreviousKey] = useState(0);

  useEffect(() => {
    setCurrentShapeIndex(0);
    setPreviousPositions([]);
    setPreviousKey(0);
  }, [animationPath]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentShapeIndex((prev) => {
        const currentPositions = animationPath[prev] ?? [];
        setPreviousPositions(currentPositions);
        setPreviousKey((key) => key + 1);
        return (prev + 1) % animationPath.length;
      });
    }, speed);
    return () => clearInterval(interval);
  }, [animationPath, speed]);

  const currentPositions = animationPath[currentShapeIndex] ?? [];
  const currentSet = new Set(currentPositions.map((pos) => `${pos.x},${pos.y}`));
  const previousFiltered = previousPositions.filter((pos) => !currentSet.has(`${pos.x},${pos.y}`));

  const getActivePositions = (positions: Position[]): Position[] =>
    positions.filter(
      (pos) => pos.x >= 0 && pos.x < MINI_GRID_SIZE && pos.y >= 0 && pos.y < MINI_GRID_SIZE
    );

  const getDotColor = (theme: MiniTheme) => (theme === "light" ? lightColor : darkColor);

  const renderBloom = (positions: Position[], theme: MiniTheme, animationKey?: string) => {
    const activePositions = getActivePositions(positions);
    if (activePositions.length === 0) return null;

    const glowColor = theme === "light" ? lightColor : darkColor;
    const softGlowColor = theme === "light" ? lightColor : darkColor;
    const animationStyle = animationKey
      ? { animation: `miniFadeOut ${fadeOutMs}ms ease-out forwards` }
      : undefined;

    return (
      <div
        key={animationKey}
        className="absolute inset-0 pointer-events-none"
        style={animationStyle}
      >
        <div
          className="absolute inset-0"
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${MINI_GRID_SIZE}, ${MINI_DOT_SIZE}px)`,
            gridTemplateRows: `repeat(${MINI_GRID_SIZE}, ${MINI_DOT_SIZE}px)`,
            gap: `${MINI_DOT_SPACING}px`,
            filter: theme === "light"
              ? "blur(10px) brightness(1.8) saturate(1.6)"
              : "blur(14px) brightness(2.1) saturate(1.7)",
            opacity: theme === "light" ? 1 : 1,
            pointerEvents: "none",
            mixBlendMode: "screen",
          }}
        >
          {activePositions.map((pos) => (
            <div
              key={`glow-soft-${theme}-${pos.x}-${pos.y}`}
              style={{
                gridColumnStart: pos.x + 1,
                gridRowStart: pos.y + 1,
                width: MINI_DOT_SIZE,
                height: MINI_DOT_SIZE,
                backgroundColor: softGlowColor,
              }}
            />
          ))}
        </div>
        <div
          className="absolute inset-0"
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${MINI_GRID_SIZE}, ${MINI_DOT_SIZE}px)`,
            gridTemplateRows: `repeat(${MINI_GRID_SIZE}, ${MINI_DOT_SIZE}px)`,
            gap: `${MINI_DOT_SPACING}px`,
            filter: theme === "light"
              ? "blur(6px) brightness(1.4) saturate(1.3)"
              : "blur(9px) brightness(1.6) saturate(1.4)",
            opacity: theme === "light" ? 1 : 1,
            pointerEvents: "none",
            mixBlendMode: "screen",
          }}
        >
          {activePositions.map((pos) => (
            <div
              key={`glow-${theme}-${pos.x}-${pos.y}`}
              style={{
                gridColumnStart: pos.x + 1,
                gridRowStart: pos.y + 1,
                width: MINI_DOT_SIZE,
                height: MINI_DOT_SIZE,
                backgroundColor: glowColor,
              }}
            />
          ))}
        </div>
        <div
          className="absolute inset-0"
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${MINI_GRID_SIZE}, ${MINI_DOT_SIZE}px)`,
            gridTemplateRows: `repeat(${MINI_GRID_SIZE}, ${MINI_DOT_SIZE}px)`,
            gap: `${MINI_DOT_SPACING}px`,
            filter: theme === "light"
              ? "blur(22px) brightness(2.3) saturate(1.9)"
              : "blur(28px) brightness(2.6) saturate(2)",
            opacity: theme === "light" ? 0.75 : 0.9,
            pointerEvents: "none",
            mixBlendMode: "screen",
          }}
        >
          {activePositions.map((pos) => (
            <div
              key={`glow-wide-${theme}-${pos.x}-${pos.y}`}
              style={{
                gridColumnStart: pos.x + 1,
                gridRowStart: pos.y + 1,
                width: MINI_DOT_SIZE,
                height: MINI_DOT_SIZE,
                backgroundColor: softGlowColor,
              }}
            />
          ))}
        </div>
      </div>
    );
  };

  const renderFadingDots = (positions: Position[], theme: MiniTheme, animationKey: string) => {
    const activePositions = getActivePositions(positions);
    if (activePositions.length === 0) return null;
    const color = getDotColor(theme);

    return (
      <div
        key={animationKey}
        className="absolute inset-0"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${MINI_GRID_SIZE}, ${MINI_DOT_SIZE}px)`,
          gridTemplateRows: `repeat(${MINI_GRID_SIZE}, ${MINI_DOT_SIZE}px)`,
          gap: `${MINI_DOT_SPACING}px`,
          animation: `miniFadeOut ${fadeOutMs}ms ease-out forwards`,
          pointerEvents: "none",
        }}
      >
        {activePositions.map((pos) => (
          <div
            key={`prev-dot-${theme}-${pos.x}-${pos.y}`}
            style={{
              gridColumnStart: pos.x + 1,
              gridRowStart: pos.y + 1,
              width: MINI_DOT_SIZE,
              height: MINI_DOT_SIZE,
              backgroundColor: color,
            }}
          />
        ))}
      </div>
    );
  };

  const renderGrid = (theme: MiniTheme) => {
    return (
    <div
      className="rounded-md p-2"
      style={{
        backgroundColor: theme === "dark" ? "#161718" : "#ffffff",
        border: theme === "light" ? "1px solid #e5e7eb" : "1px solid transparent",
      }}
    >
      <div
        className="relative grid"
        style={{
          gridTemplateColumns: `repeat(${MINI_GRID_SIZE}, ${MINI_DOT_SIZE}px)`,
          gridTemplateRows: `repeat(${MINI_GRID_SIZE}, ${MINI_DOT_SIZE}px)`,
          gap: `${MINI_DOT_SPACING}px`,
        }}
      >
        <style>{`@keyframes miniFadeOut { from { opacity: 1; } to { opacity: 0; } }`}</style>
        {renderBloom(currentPositions, theme)}
        {renderBloom(previousFiltered, theme, `prev-bloom-${previousKey}-${theme}`)}
        {renderFadingDots(previousFiltered, theme, `prev-dots-${previousKey}-${theme}`)}
        {Array.from({ length: MINI_GRID_SIZE }).map((_, y) =>
          Array.from({ length: MINI_GRID_SIZE }).map((_, x) => (
            <MiniLoaderDot
              key={`${theme}-${x}-${y}`}
              isActive={currentSet.has(`${x},${y}`)}
              theme={theme}
              lightColor={lightColor}
              darkColor={darkColor}
            />
          ))
        )}
      </div>
    </div>
    );
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-3">
        {renderGrid("light")}
        {renderGrid("dark")}
      </div>
      <div className="text-xs text-gray-600 font-medium">{title}</div>
    </div>
  );
});

interface MiniDelayLoaderProps {
  title: string;
  delays: number[];
  durationMs: number;
  lightColor: string;
  darkColor: string;
  bloomIntensity: number;
  bloomOpacity: number;
}

function MiniDelayLoader({
  title,
  delays,
  durationMs,
  lightColor,
  darkColor,
  bloomIntensity,
  bloomOpacity,
}: MiniDelayLoaderProps) {
  const getDelayAt = (x: number, y: number) => delays[y * MINI_GRID_SIZE + x] ?? 0;
  const animationStyle = (delay: number) => ({
    animation: `miniOpacityPulse ${durationMs}ms ease-in-out ${delay}ms infinite`,
  });

  const renderDelayGrid = (theme: MiniTheme) => {
    const activeColor = theme === "light" ? lightColor : darkColor;
    const blendMode = theme === "light" ? "multiply" : "screen";
    const glowLayers = theme === "light"
      ? [
          { filter: `blur(${6 * bloomIntensity}px) brightness(${0.7 - bloomIntensity * 0.15}) saturate(${1.4 + bloomIntensity * 0.3})`, opacity: 0.4 * bloomOpacity },
          { filter: `blur(${12 * bloomIntensity}px) brightness(${0.65 - bloomIntensity * 0.15}) saturate(${1.5 + bloomIntensity * 0.4})`, opacity: 0.35 * bloomOpacity },
          { filter: `blur(${22 * bloomIntensity}px) brightness(${0.6 - bloomIntensity * 0.15}) saturate(${1.6 + bloomIntensity * 0.5})`, opacity: 0.25 * bloomOpacity },
        ]
      : [
          { filter: `blur(${8 * bloomIntensity}px) brightness(${1.5 + bloomIntensity * 0.6}) saturate(${1.3 + bloomIntensity * 0.4})`, opacity: 1 * bloomOpacity },
          { filter: `blur(${16 * bloomIntensity}px) brightness(${1.9 + bloomIntensity * 0.8}) saturate(${1.6 + bloomIntensity * 0.6})`, opacity: 0.9 * bloomOpacity },
          { filter: `blur(${28 * bloomIntensity}px) brightness(${2.4 + bloomIntensity * 1.0}) saturate(${2.0 + bloomIntensity * 0.7})`, opacity: 0.8 * bloomOpacity },
        ];
    return (
      <div
        className="rounded-md p-2"
        style={{
          backgroundColor: theme === "dark" ? "#161718" : "#ffffff",
          border: theme === "light" ? "1px solid #e5e7eb" : "1px solid transparent",
          overflow: "hidden",
        }}
      >
        <div
          className="relative grid"
          style={{
            gridTemplateColumns: `repeat(${MINI_GRID_SIZE}, ${MINI_DOT_SIZE}px)`,
            gridTemplateRows: `repeat(${MINI_GRID_SIZE}, ${MINI_DOT_SIZE}px)`,
            gap: `${MINI_DOT_SPACING}px`,
          }}
        >
          <style>{`
            @keyframes miniOpacityPulse { 0%, 100% { opacity: 0; } 50% { opacity: var(--max-opacity, 1); } }
          `}</style>
          {bloomIntensity > 0 && glowLayers.map((layer, layerIndex) => {
            return (
              <div
                key={`${theme}-glow-${layerIndex}`}
                className="absolute inset-0"
                style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${MINI_GRID_SIZE}, ${MINI_DOT_SIZE}px)`,
                  gridTemplateRows: `repeat(${MINI_GRID_SIZE}, ${MINI_DOT_SIZE}px)`,
                  gap: `${MINI_DOT_SPACING}px`,
                  filter: layer.filter,
                  pointerEvents: "none",
                  mixBlendMode: blendMode,
                }}
              >
                {Array.from({ length: MINI_GRID_SIZE }).map((_, y) =>
                  Array.from({ length: MINI_GRID_SIZE }).map((_, x) => {
                    const delay = getDelayAt(x, y);
                    return (
                      <div
                        key={`${theme}-glow-${layerIndex}-${x}-${y}`}
                        style={{
                          gridColumnStart: x + 1,
                          gridRowStart: y + 1,
                          width: MINI_DOT_SIZE,
                          height: MINI_DOT_SIZE,
                          backgroundColor: activeColor,
                          animation: `miniOpacityPulse ${durationMs}ms ease-in-out ${delay}ms infinite`,
                          ["--max-opacity" as string]: layer.opacity,
                        }}
                      />
                    );
                  })
                )}
              </div>
            );
          })}
          {Array.from({ length: MINI_GRID_SIZE }).map((_, y) =>
            Array.from({ length: MINI_GRID_SIZE }).map((_, x) => {
              const delay = getDelayAt(x, y);
              return (
                <div
                  key={`${theme}-dot-${x}-${y}`}
                  style={{
                    width: MINI_DOT_SIZE,
                    height: MINI_DOT_SIZE,
                    backgroundColor: activeColor,
                    position: "relative",
                    zIndex: 1,
                    ...animationStyle(delay),
                  }}
                />
              );
            })
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-3">
        {renderDelayGrid("light")}
        {renderDelayGrid("dark")}
      </div>
      <div className="text-xs text-gray-600 font-medium">{title}</div>
    </div>
  );
}

function MiniLoaderDot({
  isActive,
  theme,
  lightColor,
  darkColor,
}: {
  isActive: boolean;
  theme: MiniTheme;
  lightColor: string;
  darkColor: string;
}) {
  const activeColor = theme === "light" ? lightColor : darkColor;
  const backgroundColor = activeColor;
  const opacity = isActive ? 1 : 0;

  return (
    <div
      style={{
        width: MINI_DOT_SIZE,
        height: MINI_DOT_SIZE,
        backgroundColor,
        opacity,
      }}
    />
  );
}

// Shape definitions
const shapes = {
  arrowRight: [
    { x: 2, y: 0 },
    { x: 3, y: 1 },
    { x: 0, y: 2 },
    { x: 1, y: 2 },
    { x: 2, y: 2 },
    { x: 3, y: 2 },
    { x: 4, y: 2 },
    { x: 3, y: 3 },
    { x: 2, y: 4 },
  ],
  arrowLeft: [
    { x: 2, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 2 },
    { x: 1, y: 2 },
    { x: 2, y: 2 },
    { x: 3, y: 2 },
    { x: 4, y: 2 },
    { x: 1, y: 3 },
    { x: 2, y: 4 },
  ],
  arrowUp: [
    { x: 0, y: 2 },
    { x: 1, y: 1 },
    { x: 2, y: 0 },
    { x: 2, y: 1 },
    { x: 2, y: 2 },
    { x: 2, y: 3 },
    { x: 2, y: 4 },
    { x: 3, y: 1 },
    { x: 4, y: 2 },
  ],
  arrowDown: [
    { x: 0, y: 2 },
    { x: 1, y: 3 },
    { x: 2, y: 0 },
    { x: 2, y: 1 },
    { x: 2, y: 2 },
    { x: 2, y: 3 },
    { x: 2, y: 4 },
    { x: 3, y: 3 },
    { x: 4, y: 2 },
  ],
  circle: [
    { x: 1, y: 1 },
    { x: 2, y: 1 },
    { x: 3, y: 1 },
    { x: 1, y: 2 },
    { x: 3, y: 2 },
    { x: 1, y: 3 },
    { x: 2, y: 3 },
    { x: 3, y: 3 },
  ],
  plus: [
    { x: 2, y: 0 },
    { x: 2, y: 1 },
    { x: 0, y: 2 },
    { x: 1, y: 2 },
    { x: 2, y: 2 },
    { x: 3, y: 2 },
    { x: 4, y: 2 },
    { x: 2, y: 3 },
    { x: 2, y: 4 },
  ],
  cross: [
    { x: 0, y: 0 },
    { x: 1, y: 1 },
    { x: 2, y: 2 },
    { x: 3, y: 3 },
    { x: 4, y: 4 },
    { x: 0, y: 4 },
    { x: 1, y: 3 },
    { x: 3, y: 1 },
    { x: 4, y: 0 },
  ],
  diamond: [
    { x: 2, y: 0 },
    { x: 1, y: 1 },
    { x: 3, y: 1 },
    { x: 0, y: 2 },
    { x: 2, y: 2 },
    { x: 4, y: 2 },
    { x: 1, y: 3 },
    { x: 3, y: 3 },
    { x: 2, y: 4 },
  ],
  horizontalLine: [
    { x: 0, y: 2 },
    { x: 1, y: 2 },
    { x: 2, y: 2 },
    { x: 3, y: 2 },
    { x: 4, y: 2 },
  ],
  verticalLine: [
    { x: 2, y: 0 },
    { x: 2, y: 1 },
    { x: 2, y: 2 },
    { x: 2, y: 3 },
    { x: 2, y: 4 },
  ],
  square: [
    { x: 1, y: 1 },
    { x: 2, y: 1 },
    { x: 3, y: 1 },
    { x: 1, y: 2 },
    { x: 2, y: 2 },
    { x: 3, y: 2 },
    { x: 1, y: 3 },
    { x: 2, y: 3 },
    { x: 3, y: 3 },
  ],
  corners: [
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 0, y: 4 },
    { x: 4, y: 4 },
  ],
  halftone: [],
};

// Halftone pattern with custom states
const halftoneStates = new Map<string, DotState>([
  // Center dot full
  ["2,2", "full"],
  // Surrounding dots with border
  ["1,1", "mid"],
  ["2,1", "mid"],
  ["3,1", "mid"],
  ["1,2", "mid"],
  ["3,2", "mid"],
  ["1,3", "mid"],
  ["2,3", "mid"],
  ["3,3", "mid"],
]);

// Animation paths - traveling arrow with consistent tip position
const createArrowAtOffset = (offset: number): Position[] => {
  const arrow: Position[] = [];
  // Tips
  if (offset + 2 >= 0 && offset + 2 < 5) arrow.push({ x: offset + 2, y: 0 });
  if (offset + 2 >= 0 && offset + 2 < 5) arrow.push({ x: offset + 2, y: 4 });
  // Arms
  if (offset + 3 >= 0 && offset + 3 < 5) arrow.push({ x: offset + 3, y: 1 });
  if (offset + 3 >= 0 && offset + 3 < 5) arrow.push({ x: offset + 3, y: 3 });
  // Middle line
  for (let i = 0; i <= 4; i++) {
    if (offset + i >= 0 && offset + i < 5) {
      arrow.push({ x: offset + i, y: 2 });
    }
  }
  return arrow;
};

const travelingArrow = [
  createArrowAtOffset(-4), // Entering from left
  createArrowAtOffset(-3),
  createArrowAtOffset(-2),
  createArrowAtOffset(-1),
  createArrowAtOffset(0),  // Fully visible at left
  createArrowAtOffset(1),  // Moving right
  createArrowAtOffset(2),  // Exiting right
  createArrowAtOffset(3),
  createArrowAtOffset(4),
];

const pulsingDot = [
  [{ x: 2, y: 2 }],
  [{ x: 2, y: 2 }, { x: 1, y: 2 }, { x: 3, y: 2 }, { x: 2, y: 1 }, { x: 2, y: 3 }],
  shapes.plus,
  [{ x: 2, y: 2 }, { x: 1, y: 2 }, { x: 3, y: 2 }, { x: 2, y: 1 }, { x: 2, y: 3 }],
];

const scanningLine = [
  [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 0, y: 3 }, { x: 0, y: 4 }],
  [{ x: 1, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 2 }, { x: 1, y: 3 }, { x: 1, y: 4 }],
  [{ x: 2, y: 0 }, { x: 2, y: 1 }, { x: 2, y: 2 }, { x: 2, y: 3 }, { x: 2, y: 4 }],
  [{ x: 3, y: 0 }, { x: 3, y: 1 }, { x: 3, y: 2 }, { x: 3, y: 3 }, { x: 3, y: 4 }],
  [{ x: 4, y: 0 }, { x: 4, y: 1 }, { x: 4, y: 2 }, { x: 4, y: 3 }, { x: 4, y: 4 }],
];

const expandingSquare = [
  [{ x: 2, y: 2 }],
  [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }, { x: 1, y: 2 }, { x: 3, y: 2 }, { x: 1, y: 3 }, { x: 2, y: 3 }, { x: 3, y: 3 }],
  [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 1 }, { x: 4, y: 1 }, { x: 0, y: 2 }, { x: 4, y: 2 }, { x: 0, y: 3 }, { x: 4, y: 3 }, { x: 0, y: 4 }, { x: 1, y: 4 }, { x: 2, y: 4 }, { x: 3, y: 4 }, { x: 4, y: 4 }],
  [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }, { x: 1, y: 2 }, { x: 3, y: 2 }, { x: 1, y: 3 }, { x: 2, y: 3 }, { x: 3, y: 3 }],
];

// Generate bar chart wave pattern - simulate 30 columns, show 5 at a time
const generateBarChartWaves = () => {
  const totalColumns = 30;
  const visibleColumns = 5;

  // Generate smooth wave heights for 30 columns (0-4 scale, where 4 is tallest)
  const waveHeights = Array.from({ length: totalColumns }, (_, i) => {
    // Use sine wave for smooth pattern
    const wave = Math.sin((i / totalColumns) * Math.PI * 2) * 2 + 2;
    return Math.round(Math.max(0, Math.min(4, wave)));
  });

  // Create animation frames by sliding through the 30-column chart
  const frames: Position[][] = [];
  for (let offset = 0; offset < totalColumns; offset++) {
    const frame: Position[] = [];

    for (let col = 0; col < visibleColumns; col++) {
      const columnIndex = (offset + col) % totalColumns;
      const height = waveHeights[columnIndex];

      // Fill from bottom up based on height
      // height 0 = no dots, height 4 = full column (all 5 rows)
      const startY = 4 - height; // Start row (4 means empty, 0 means start from top)
      for (let y = startY; y <= 4; y++) {
        frame.push({ x: col, y });
      }
    }

    frames.push(frame);
  }

  return frames;
};

const barChartWaves = generateBarChartWaves();

const bouncingDots = [
  // All dots at rest position (y=3)
  [
    { x: 0, y: 3 },
    { x: 1, y: 3 },
    { x: 2, y: 3 },
    { x: 3, y: 3 },
    { x: 4, y: 3 },
  ],
  // First dot bounces up
  [
    { x: 0, y: 2 },
    { x: 1, y: 3 },
    { x: 2, y: 3 },
    { x: 3, y: 3 },
    { x: 4, y: 3 },
  ],
  // First dot at peak, second starts
  [
    { x: 0, y: 1 },
    { x: 1, y: 2 },
    { x: 2, y: 3 },
    { x: 3, y: 3 },
    { x: 4, y: 3 },
  ],
  // First coming down, second at peak, third starts
  [
    { x: 0, y: 2 },
    { x: 1, y: 1 },
    { x: 2, y: 2 },
    { x: 3, y: 3 },
    { x: 4, y: 3 },
  ],
  // First at rest, second coming down, third at peak, fourth starts
  [
    { x: 0, y: 3 },
    { x: 1, y: 2 },
    { x: 2, y: 1 },
    { x: 3, y: 2 },
    { x: 4, y: 3 },
  ],
  // Second at rest, third coming down, fourth at peak, fifth starts
  [
    { x: 0, y: 3 },
    { x: 1, y: 3 },
    { x: 2, y: 2 },
    { x: 3, y: 1 },
    { x: 4, y: 2 },
  ],
  // Third at rest, fourth coming down, fifth at peak
  [
    { x: 0, y: 3 },
    { x: 1, y: 3 },
    { x: 2, y: 3 },
    { x: 3, y: 2 },
    { x: 4, y: 1 },
  ],
  // Fourth at rest, fifth coming down
  [
    { x: 0, y: 3 },
    { x: 1, y: 3 },
    { x: 2, y: 3 },
    { x: 3, y: 3 },
    { x: 4, y: 2 },
  ],
];

const rotatingSquare = [
  // Square horizontal
  [
    { x: 1, y: 2 },
    { x: 2, y: 2 },
    { x: 3, y: 2 },
  ],
  // Rotating - small square
  [
    { x: 2, y: 1 },
    { x: 2, y: 2 },
    { x: 2, y: 3 },
  ],
  // Square vertical
  [
    { x: 2, y: 1 },
    { x: 2, y: 2 },
    { x: 2, y: 3 },
  ],
  // Expanding
  [
    { x: 1, y: 1 },
    { x: 2, y: 1 },
    { x: 3, y: 1 },
    { x: 1, y: 2 },
    { x: 3, y: 2 },
    { x: 1, y: 3 },
    { x: 2, y: 3 },
    { x: 3, y: 3 },
  ],
  // Large square
  [
    { x: 0, y: 1 },
    { x: 1, y: 1 },
    { x: 2, y: 1 },
    { x: 3, y: 1 },
    { x: 4, y: 1 },
    { x: 0, y: 2 },
    { x: 4, y: 2 },
    { x: 0, y: 3 },
    { x: 1, y: 3 },
    { x: 2, y: 3 },
    { x: 3, y: 3 },
    { x: 4, y: 3 },
  ],
  // Contracting
  [
    { x: 1, y: 1 },
    { x: 2, y: 1 },
    { x: 3, y: 1 },
    { x: 1, y: 2 },
    { x: 3, y: 2 },
    { x: 1, y: 3 },
    { x: 2, y: 3 },
    { x: 3, y: 3 },
  ],
];

const wavePattern = [
  [
    { x: 0, y: 2 },
    { x: 1, y: 3 },
    { x: 2, y: 4 },
    { x: 3, y: 3 },
    { x: 4, y: 2 },
  ],
  [
    { x: 0, y: 1 },
    { x: 1, y: 2 },
    { x: 2, y: 3 },
    { x: 3, y: 2 },
    { x: 4, y: 1 },
  ],
  [
    { x: 0, y: 2 },
    { x: 1, y: 1 },
    { x: 2, y: 2 },
    { x: 3, y: 1 },
    { x: 4, y: 2 },
  ],
  [
    { x: 0, y: 3 },
    { x: 1, y: 2 },
    { x: 2, y: 1 },
    { x: 3, y: 2 },
    { x: 4, y: 3 },
  ],
  [
    { x: 0, y: 2 },
    { x: 1, y: 3 },
    { x: 2, y: 2 },
    { x: 3, y: 3 },
    { x: 4, y: 2 },
  ],
  [
    { x: 0, y: 1 },
    { x: 1, y: 2 },
    { x: 2, y: 3 },
    { x: 3, y: 2 },
    { x: 4, y: 1 },
  ],
];

const cornersSpin = [
  [
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 0, y: 4 },
    { x: 4, y: 4 },
  ],
  [
    { x: 1, y: 0 },
    { x: 4, y: 1 },
    { x: 0, y: 3 },
    { x: 3, y: 4 },
  ],
  [
    { x: 2, y: 0 },
    { x: 4, y: 2 },
    { x: 0, y: 2 },
    { x: 2, y: 4 },
  ],
  [
    { x: 3, y: 0 },
    { x: 4, y: 3 },
    { x: 1, y: 4 },
    { x: 0, y: 1 },
  ],
  [
    { x: 4, y: 0 },
    { x: 4, y: 4 },
    { x: 0, y: 4 },
    { x: 0, y: 0 },
  ],
  [
    { x: 4, y: 1 },
    { x: 3, y: 4 },
    { x: 0, y: 3 },
    { x: 1, y: 0 },
  ],
  [
    { x: 4, y: 2 },
    { x: 2, y: 4 },
    { x: 0, y: 2 },
    { x: 2, y: 0 },
  ],
  [
    { x: 4, y: 3 },
    { x: 1, y: 4 },
    { x: 0, y: 1 },
    { x: 3, y: 0 },
  ],
];

// DNA Helix - two dots rotating around center axis
const dnaHelix = [
  [{ x: 1, y: 2 }, { x: 3, y: 2 }],
  [{ x: 1, y: 1 }, { x: 3, y: 3 }],
  [{ x: 2, y: 0 }, { x: 2, y: 4 }],
  [{ x: 3, y: 1 }, { x: 1, y: 3 }],
  [{ x: 3, y: 2 }, { x: 1, y: 2 }],
  [{ x: 3, y: 3 }, { x: 1, y: 1 }],
  [{ x: 2, y: 4 }, { x: 2, y: 0 }],
  [{ x: 1, y: 3 }, { x: 3, y: 1 }],
];

// Spiral In - dots spiraling from outside to center
const spiralIn = [
  [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }],
  [{ x: 4, y: 1 }, { x: 4, y: 2 }, { x: 4, y: 3 }, { x: 4, y: 4 }],
  [{ x: 3, y: 4 }, { x: 2, y: 4 }, { x: 1, y: 4 }, { x: 0, y: 4 }],
  [{ x: 0, y: 3 }, { x: 0, y: 2 }, { x: 0, y: 1 }],
  [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }],
  [{ x: 3, y: 2 }, { x: 3, y: 3 }],
  [{ x: 2, y: 3 }, { x: 1, y: 3 }],
  [{ x: 1, y: 2 }],
  [{ x: 2, y: 2 }],
];

// Radar Sweep - rotating line from center
const radarSweep = [
  [{ x: 2, y: 2 }, { x: 2, y: 0 }, { x: 2, y: 1 }],
  [{ x: 2, y: 2 }, { x: 3, y: 0 }, { x: 3, y: 1 }],
  [{ x: 2, y: 2 }, { x: 4, y: 1 }, { x: 4, y: 2 }],
  [{ x: 2, y: 2 }, { x: 4, y: 3 }, { x: 3, y: 3 }],
  [{ x: 2, y: 2 }, { x: 2, y: 4 }, { x: 2, y: 3 }],
  [{ x: 2, y: 2 }, { x: 1, y: 4 }, { x: 1, y: 3 }],
  [{ x: 2, y: 2 }, { x: 0, y: 3 }, { x: 0, y: 2 }],
  [{ x: 2, y: 2 }, { x: 0, y: 1 }, { x: 1, y: 1 }],
];

// Meteor Shower - multiple dots falling at different rates
const meteorShower = [
  [{ x: 1, y: 0 }, { x: 3, y: 0 }],
  [{ x: 1, y: 1 }, { x: 3, y: 1 }, { x: 0, y: 0 }, { x: 4, y: 0 }],
  [{ x: 1, y: 2 }, { x: 3, y: 2 }, { x: 0, y: 1 }, { x: 4, y: 1 }],
  [{ x: 1, y: 3 }, { x: 3, y: 3 }, { x: 0, y: 2 }, { x: 4, y: 2 }, { x: 2, y: 0 }],
  [{ x: 1, y: 4 }, { x: 3, y: 4 }, { x: 0, y: 3 }, { x: 4, y: 3 }, { x: 2, y: 1 }],
  [{ x: 0, y: 4 }, { x: 4, y: 4 }, { x: 2, y: 2 }],
  [{ x: 2, y: 3 }],
  [{ x: 2, y: 4 }],
  [],
];

// Typewriter - fills grid left to right, top to bottom
const typewriter = [
  [{ x: 0, y: 0 }],
  [{ x: 0, y: 0 }, { x: 1, y: 0 }],
  [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }],
  [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }],
  [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }],
  [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 1 }],
  [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }],
  [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
  [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }],
  [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }, { x: 4, y: 1 }],
  [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }, { x: 4, y: 1 }, { x: 0, y: 2 }],
  [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }, { x: 4, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 2 }],
  [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }, { x: 4, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 2 }],
];

// Snake - snake moving through the grid
const snake = [
  [{ x: 0, y: 2 }, { x: 1, y: 2 }],
  [{ x: 1, y: 2 }, { x: 2, y: 2 }],
  [{ x: 2, y: 2 }, { x: 3, y: 2 }],
  [{ x: 3, y: 2 }, { x: 4, y: 2 }],
  [{ x: 4, y: 2 }, { x: 4, y: 1 }],
  [{ x: 4, y: 1 }, { x: 4, y: 0 }],
  [{ x: 4, y: 0 }, { x: 3, y: 0 }],
  [{ x: 3, y: 0 }, { x: 2, y: 0 }],
  [{ x: 2, y: 0 }, { x: 1, y: 0 }],
  [{ x: 1, y: 0 }, { x: 0, y: 0 }],
  [{ x: 0, y: 0 }, { x: 0, y: 1 }],
  [{ x: 0, y: 1 }, { x: 1, y: 1 }],
  [{ x: 1, y: 1 }, { x: 2, y: 1 }],
  [{ x: 2, y: 1 }, { x: 3, y: 1 }],
  [{ x: 3, y: 1 }, { x: 4, y: 1 }],
  [{ x: 4, y: 1 }, { x: 4, y: 2 }],
];

// Circular Wave - expanding circles from center
const circularWave = [
  [{ x: 2, y: 2 }],
  [{ x: 1, y: 2 }, { x: 3, y: 2 }, { x: 2, y: 1 }, { x: 2, y: 3 }],
  [{ x: 1, y: 1 }, { x: 3, y: 1 }, { x: 1, y: 3 }, { x: 3, y: 3 }, { x: 0, y: 2 }, { x: 4, y: 2 }, { x: 2, y: 0 }, { x: 2, y: 4 }],
  [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 4 }, { x: 4, y: 4 }, { x: 0, y: 1 }, { x: 4, y: 1 }, { x: 0, y: 3 }, { x: 4, y: 3 }, { x: 1, y: 0 }, { x: 3, y: 0 }, { x: 1, y: 4 }, { x: 3, y: 4 }],
  [],
];

// Diagonal Sweep - diagonal lines sweeping across
const diagonalSweep = [
  [{ x: 0, y: 4 }],
  [{ x: 0, y: 3 }, { x: 1, y: 4 }],
  [{ x: 0, y: 2 }, { x: 1, y: 3 }, { x: 2, y: 4 }],
  [{ x: 0, y: 1 }, { x: 1, y: 2 }, { x: 2, y: 3 }, { x: 3, y: 4 }],
  [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }, { x: 4, y: 4 }],
  [{ x: 1, y: 0 }, { x: 2, y: 1 }, { x: 3, y: 2 }, { x: 4, y: 3 }],
  [{ x: 2, y: 0 }, { x: 3, y: 1 }, { x: 4, y: 2 }],
  [{ x: 3, y: 0 }, { x: 4, y: 1 }],
  [{ x: 4, y: 0 }],
  [],
];

function createMiniOrbit(): Position[][] {
  return [
    [{ x: 1, y: 0 }],
    [{ x: 2, y: 0 }],
    [{ x: 2, y: 1 }],
    [{ x: 2, y: 2 }],
    [{ x: 1, y: 2 }],
    [{ x: 0, y: 2 }],
    [{ x: 0, y: 1 }],
    [{ x: 0, y: 0 }],
  ];
}

const miniPulse = [
  [{ x: 1, y: 1 }],
  [{ x: 1, y: 1 }, { x: 0, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 0 }, { x: 1, y: 2 }],
  [{ x: 1, y: 1 }, { x: 0, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 2 }, { x: 2, y: 2 }],
  [{ x: 1, y: 1 }],
];

const miniRowSweep = [
  [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }],
  [{ x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
  [{ x: 0, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 2 }],
];

const miniColumnSweep = [
  [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }],
  [{ x: 1, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 2 }],
  [{ x: 2, y: 0 }, { x: 2, y: 1 }, { x: 2, y: 2 }],
];

const miniCorners = [
  [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 2 }, { x: 2, y: 2 }],
  [{ x: 1, y: 0 }, { x: 2, y: 1 }, { x: 1, y: 2 }, { x: 0, y: 1 }],
  [{ x: 1, y: 1 }],
];

const miniDiagonal = [
  [{ x: 0, y: 0 }],
  [{ x: 0, y: 0 }, { x: 1, y: 1 }],
  [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }],
  [{ x: 2, y: 0 }, { x: 1, y: 1 }],
  [{ x: 2, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 2 }],
  [{ x: 2, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 2 }],
];

const miniOrbit = createMiniOrbit();

function createDelayGrid(getDelay: (x: number, y: number) => number): number[] {
  return Array.from({ length: MINI_GRID_SIZE * MINI_GRID_SIZE }).map((_, index) => {
    const x = index % MINI_GRID_SIZE;
    const y = Math.floor(index / MINI_GRID_SIZE);
    return getDelay(x, y);
  });
}

const delayAnimations: DelayAnimation[] = [
  {
    title: "Wave L→R",
    delays: createDelayGrid((x) => x * 100),
  },
  {
    title: "Wave R→L",
    delays: createDelayGrid((x) => (MINI_GRID_SIZE - 1 - x) * 100),
  },
  {
    title: "Wave T→B",
    delays: createDelayGrid((_, y) => y * 100),
  },
  {
    title: "Diagonal ↘",
    delays: createDelayGrid((x, y) => (x + y) * 80),
  },
  {
    title: "Diagonal ↙",
    delays: createDelayGrid((x, y) => ((MINI_GRID_SIZE - 1 - x) + y) * 80),
  },
  {
    title: "Checkerboard",
    delays: createDelayGrid((x, y) => ((x + y) % 2) * 180),
  },
  {
    title: "Center Out",
    delays: createDelayGrid((x, y) => {
      const distance = Math.abs(x - 1) + Math.abs(y - 1);
      return distance * 90;
    }),
  },
  {
    title: "Corners In",
    delays: createDelayGrid((x, y) => {
      const distanceFromCorner = Math.min(
        Math.abs(x - 0) + Math.abs(y - 0),
        Math.abs(x - 2) + Math.abs(y - 0),
        Math.abs(x - 0) + Math.abs(y - 2),
        Math.abs(x - 2) + Math.abs(y - 2)
      );
      return (4 - distanceFromCorner) * 80;
    }),
  },
  {
    title: "Spiral CW",
    delays: [0, 80, 160, 560, 640, 240, 480, 400, 320],
  },
  {
    title: "Zig Zag",
    delays: createDelayGrid((x, y) => {
      const rowReversed = y % 2 === 0 ? x : (MINI_GRID_SIZE - 1 - x);
      return (y * MINI_GRID_SIZE + rowReversed) * 60;
    }),
  },
  {
    title: "Ring Pulse",
    delays: createDelayGrid((x, y) => {
      const isEdge = x === 0 || x === MINI_GRID_SIZE - 1 || y === 0 || y === MINI_GRID_SIZE - 1;
      return isEdge ? 0 : 160;
    }),
  },
  {
    title: "Cross Burst",
    delays: createDelayGrid((x, y) => {
      const isCross = x === 1 || y === 1;
      return isCross ? 0 : (Math.abs(x - 1) + Math.abs(y - 1)) * 70;
    }),
  },
  {
    title: "Random Sparkle",
    delays: [120, 40, 180, 0, 200, 80, 160, 100, 60],
  },
  {
    title: "Wave Snake",
    delays: createDelayGrid((x, y) => {
      const snakeOrder = y * MINI_GRID_SIZE + (y % 2 === 0 ? x : MINI_GRID_SIZE - 1 - x);
      return snakeOrder * 50;
    }),
  },
  {
    title: "Quadrants",
    delays: createDelayGrid((x, y) => {
      const quadrant = (x < 1.5 ? 0 : 1) + (y < 1.5 ? 0 : 2);
      return quadrant * 120;
    }),
  },
];

// Check Success State - animated checkmark
const checkSuccess = [
  [{ x: 2, y: 2 }], // Start with center dot
  [{ x: 1, y: 3 }], // Move to start of check (bottom left)
  [{ x: 1, y: 3 }, { x: 2, y: 4 }], // Draw short stroke down-right
  [{ x: 1, y: 3 }, { x: 2, y: 4 }, { x: 2, y: 3 }], // Move up to middle pivot
  [{ x: 1, y: 3 }, { x: 2, y: 4 }, { x: 2, y: 3 }, { x: 3, y: 2 }], // Start long stroke up-right
  [{ x: 1, y: 3 }, { x: 2, y: 4 }, { x: 2, y: 3 }, { x: 3, y: 2 }, { x: 4, y: 1 }], // Continue up-right
  [{ x: 0, y: 3 }, { x: 1, y: 4 }, { x: 2, y: 3 }, { x: 3, y: 2 }, { x: 4, y: 1 }], // Complete checkmark (extend left end)
  [{ x: 0, y: 3 }, { x: 1, y: 4 }, { x: 2, y: 3 }, { x: 3, y: 2 }, { x: 4, y: 1 }],
  [{ x: 0, y: 3 }, { x: 1, y: 4 }, { x: 2, y: 3 }, { x: 3, y: 2 }, { x: 4, y: 1 }],
];

// Cross Error State - animated X mark (emerges symmetrically from center)
const crossError = [
  [{ x: 2, y: 2 }], // Start with center dot
  // Expand both diagonals simultaneously from center
  [{ x: 2, y: 2 }, { x: 1, y: 1 }, { x: 3, y: 3 }, { x: 3, y: 1 }, { x: 1, y: 3 }], // First ring around center
  [{ x: 2, y: 2 }, { x: 1, y: 1 }, { x: 3, y: 3 }, { x: 3, y: 1 }, { x: 1, y: 3 }, { x: 0, y: 0 }, { x: 4, y: 4 }, { x: 4, y: 0 }, { x: 0, y: 4 }], // All 4 corners at once
  // Final state - complete X
  [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }, { x: 4, y: 4 }, { x: 4, y: 0 }, { x: 3, y: 1 }, { x: 1, y: 3 }, { x: 0, y: 4 }],
  [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }, { x: 4, y: 4 }, { x: 4, y: 0 }, { x: 3, y: 1 }, { x: 1, y: 3 }, { x: 0, y: 4 }],
  [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }, { x: 4, y: 4 }, { x: 4, y: 0 }, { x: 3, y: 1 }, { x: 1, y: 3 }, { x: 0, y: 4 }],
];

// Hourglass - realistic sand falling effect, dots fall one by one from top to bottom
const hourglass = [
  // Start: Top hourglass filled (5 + 3 + 1 = 9 dots total)
  [
    { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 },
    { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 },
    { x: 2, y: 2 }
  ],
  // First dot falls from middle
  [
    { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 },
    { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 },
    { x: 2, y: 3 }
  ],
  [
    { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 },
    { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 },
    { x: 2, y: 4 }
  ],
  // Second dot falls (from row 1)
  [
    { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 },
    { x: 1, y: 1 }, { x: 3, y: 1 },
    { x: 2, y: 2 }, { x: 2, y: 4 }
  ],
  [
    { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 },
    { x: 1, y: 1 }, { x: 3, y: 1 },
    { x: 2, y: 3 }, { x: 2, y: 4 }
  ],
  [
    { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 },
    { x: 1, y: 1 }, { x: 3, y: 1 },
    { x: 1, y: 4 }, { x: 2, y: 4 }
  ],
  // Third dot falls
  [
    { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 },
    { x: 3, y: 1 },
    { x: 2, y: 2 }, { x: 1, y: 4 }, { x: 2, y: 4 }
  ],
  [
    { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 },
    { x: 3, y: 1 },
    { x: 2, y: 3 }, { x: 1, y: 4 }, { x: 2, y: 4 }
  ],
  [
    { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 },
    { x: 3, y: 1 },
    { x: 1, y: 4 }, { x: 2, y: 4 }, { x: 3, y: 4 }
  ],
  // Fourth dot falls (from row 1)
  [
    { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 },
    { x: 2, y: 2 }, { x: 1, y: 4 }, { x: 2, y: 4 }, { x: 3, y: 4 }
  ],
  [
    { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 },
    { x: 2, y: 3 }, { x: 1, y: 4 }, { x: 2, y: 4 }, { x: 3, y: 4 }
  ],
  [
    { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 },
    { x: 1, y: 4 }, { x: 2, y: 4 }, { x: 3, y: 4 }, { x: 0, y: 4 }
  ],
  // Fifth dot falls (from top row)
  [
    { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 },
    { x: 2, y: 1 }, { x: 0, y: 4 }, { x: 1, y: 4 }, { x: 2, y: 4 }, { x: 3, y: 4 }
  ],
  [
    { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 },
    { x: 2, y: 2 }, { x: 0, y: 4 }, { x: 1, y: 4 }, { x: 2, y: 4 }, { x: 3, y: 4 }
  ],
  [
    { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 },
    { x: 2, y: 3 }, { x: 0, y: 4 }, { x: 1, y: 4 }, { x: 2, y: 4 }, { x: 3, y: 4 }
  ],
  [
    { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 },
    { x: 0, y: 4 }, { x: 1, y: 4 }, { x: 2, y: 4 }, { x: 3, y: 4 }, { x: 4, y: 4 }
  ],
  // Sixth dot falls
  [
    { x: 0, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 },
    { x: 1, y: 1 }, { x: 0, y: 4 }, { x: 1, y: 4 }, { x: 2, y: 4 }, { x: 3, y: 4 }, { x: 4, y: 4 }
  ],
  [
    { x: 0, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 },
    { x: 2, y: 2 }, { x: 0, y: 4 }, { x: 1, y: 4 }, { x: 2, y: 4 }, { x: 3, y: 4 }, { x: 4, y: 4 }
  ],
  [
    { x: 0, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 },
    { x: 1, y: 3 }, { x: 0, y: 4 }, { x: 1, y: 4 }, { x: 2, y: 4 }, { x: 3, y: 4 }, { x: 4, y: 4 }
  ],
  [
    { x: 0, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 },
    { x: 0, y: 4 }, { x: 1, y: 4 }, { x: 2, y: 4 }, { x: 3, y: 4 }, { x: 4, y: 4 }, { x: 3, y: 3 }
  ],
  // Seventh dot falls
  [
    { x: 0, y: 0 }, { x: 4, y: 0 },
    { x: 3, y: 1 }, { x: 0, y: 4 }, { x: 1, y: 4 }, { x: 2, y: 4 }, { x: 3, y: 4 }, { x: 4, y: 4 }, { x: 3, y: 3 }
  ],
  [
    { x: 0, y: 0 }, { x: 4, y: 0 },
    { x: 2, y: 2 }, { x: 0, y: 4 }, { x: 1, y: 4 }, { x: 2, y: 4 }, { x: 3, y: 4 }, { x: 4, y: 4 }, { x: 3, y: 3 }
  ],
  [
    { x: 0, y: 0 }, { x: 4, y: 0 },
    { x: 0, y: 4 }, { x: 1, y: 4 }, { x: 2, y: 4 }, { x: 3, y: 4 }, { x: 4, y: 4 }, { x: 1, y: 3 }, { x: 3, y: 3 }
  ],
  // Eighth dot falls
  [
    { x: 4, y: 0 },
    { x: 0, y: 1 }, { x: 0, y: 4 }, { x: 1, y: 4 }, { x: 2, y: 4 }, { x: 3, y: 4 }, { x: 4, y: 4 }, { x: 1, y: 3 }, { x: 3, y: 3 }
  ],
  [
    { x: 4, y: 0 },
    { x: 2, y: 2 }, { x: 0, y: 4 }, { x: 1, y: 4 }, { x: 2, y: 4 }, { x: 3, y: 4 }, { x: 4, y: 4 }, { x: 1, y: 3 }, { x: 3, y: 3 }
  ],
  [
    { x: 4, y: 0 },
    { x: 0, y: 4 }, { x: 1, y: 4 }, { x: 2, y: 4 }, { x: 3, y: 4 }, { x: 4, y: 4 }, { x: 1, y: 3 }, { x: 2, y: 3 }, { x: 3, y: 3 }
  ],
  // Ninth dot falls
  [
    { x: 4, y: 1 }, { x: 0, y: 4 }, { x: 1, y: 4 }, { x: 2, y: 4 }, { x: 3, y: 4 }, { x: 4, y: 4 }, { x: 1, y: 3 }, { x: 2, y: 3 }, { x: 3, y: 3 }
  ],
  [
    { x: 2, y: 2 }, { x: 0, y: 4 }, { x: 1, y: 4 }, { x: 2, y: 4 }, { x: 3, y: 4 }, { x: 4, y: 4 }, { x: 1, y: 3 }, { x: 2, y: 3 }, { x: 3, y: 3 }
  ],
  [
    { x: 0, y: 4 }, { x: 1, y: 4 }, { x: 2, y: 4 }, { x: 3, y: 4 }, { x: 4, y: 4 }, { x: 1, y: 3 }, { x: 2, y: 3 }, { x: 3, y: 3 }, { x: 1, y: 1 }
  ],
  // Bottom completely filled (mirror of start)
  [
    { x: 0, y: 4 }, { x: 1, y: 4 }, { x: 2, y: 4 }, { x: 3, y: 4 }, { x: 4, y: 4 },
    { x: 1, y: 3 }, { x: 2, y: 3 }, { x: 3, y: 3 },
    { x: 2, y: 2 }
  ],
  [
    { x: 0, y: 4 }, { x: 1, y: 4 }, { x: 2, y: 4 }, { x: 3, y: 4 }, { x: 4, y: 4 },
    { x: 1, y: 3 }, { x: 2, y: 3 }, { x: 3, y: 3 },
    { x: 2, y: 2 }
  ],
];

export function LoaderShowcase() {
  const [speed, setSpeed] = useState(400);
  const [durationMs, setDurationMs] = useState(600);
  const [bloomIntensity, setBloomIntensity] = useState(0.1);
  const [bloomOpacity, setBloomOpacity] = useState(0.5);
  const [card1Data, setCard1Data] = useState(() => ({
    amount: 67.67,
    range: "Jan 24 - Feb 24",
    level: 0.56,
    trend: 0,
  }));
  const [card2Data, setCard2Data] = useState(() => createMockComputeUnitsData());
  const [card3Data, setCard3Data] = useState(() => createMockStorageData());

  const handleRandomizeAll = () => {
    setCard1Data(createMockActorsRunData());
    setCard2Data(createMockComputeUnitsData());
    setCard3Data(createMockStorageData());
  };

  return (
    <div className="min-h-screen bg-white p-12">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-4 text-gray-900">Loading States</h1>
        <ActorsRunShowcaseContent
          card1Data={card1Data}
          card2Data={card2Data}
          card3Data={card3Data}
          onRandomize={handleRandomizeAll}
        />
        <AnimatedLoaders5x5Showcase speed={speed} onSpeedChange={setSpeed} />
        <AnimatedLoaders3x3Showcase
          durationMs={durationMs}
          bloomIntensity={bloomIntensity}
          bloomOpacity={bloomOpacity}
          lightColor="color(display-p3 0.19 0.09 0.41)"
          darkColor="color(display-p3 0.91 0.90 0.98)"
        />
        <div className="mt-6">
          <FadeOutControl fadeOutMs={durationMs} onFadeOutChange={setDurationMs} />
          <BloomIntensityControl bloomIntensity={bloomIntensity} onBloomIntensityChange={setBloomIntensity} />
          <BloomOpacityControl bloomOpacity={bloomOpacity} onBloomOpacityChange={setBloomOpacity} />
        </div>
      </div>
    </div>
  );
}

interface ActorsRunShowcaseProps {
  card1Data: ReturnType<typeof createMockActorsRunData>;
  card2Data: ReturnType<typeof createMockComputeUnitsData>;
  card3Data: ReturnType<typeof createMockStorageData>;
  onRandomize: () => void;
}

function ActorsRunShowcaseContent({
  card1Data,
  card2Data,
  card3Data,
  onRandomize,
}: ActorsRunShowcaseProps) {
  return (
    <div className="mb-12">
      <h2 className="text-xl font-semibold mb-6 text-gray-700">Dashboard Cards</h2>
      <div className="flex flex-wrap items-start gap-4">
        <ActorsRunCard
          label="Usage"
          usageAmount={card1Data.amount}
          usageRange={card1Data.range}
          usageLevel={card1Data.level}
          usageTrend={card1Data.trend}
          staggerAnimation={true}
          format="currency"
        />
        <ActorsRunCard
          label="Compute Units"
          usageAmount={card2Data.amount}
          usageRange={card2Data.range}
          usageLevel={card2Data.level}
          usageTrend={card2Data.trend}
          staggerAnimation={true}
          format="decimal"
        />
        <ActorsRunCard
          label="Storage"
          usageAmount={card3Data.amount}
          usageRange={card3Data.range}
          usageLevel={card3Data.level}
          usageTrend={card3Data.trend}
          staggerAnimation={true}
          format="storage"
        />
      </div>
      <button
        type="button"
        onClick={onRandomize}
        className="mt-4 h-9 rounded-md border border-gray-200 px-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
      >
        Randomize all data
      </button>
    </div>
  );
}

export function ActorsRunShowcase() {
  const [card1Data, setCard1Data] = useState(() => ({
    amount: 67.67,
    range: "Jan 24 - Feb 24",
    level: 0.56,
    trend: 0,
  }));
  const [card2Data, setCard2Data] = useState(() => createMockComputeUnitsData());
  const [card3Data, setCard3Data] = useState(() => createMockStorageData());

  const handleRandomizeAll = () => {
    setCard1Data(createMockActorsRunData());
    setCard2Data(createMockComputeUnitsData());
    setCard3Data(createMockStorageData());
  };

  return (
    <ActorsRunShowcaseContent
      card1Data={card1Data}
      card2Data={card2Data}
      card3Data={card3Data}
      onRandomize={handleRandomizeAll}
    />
  );
}

interface AnimationSpeedControlProps {
  speed: number;
  onSpeedChange: (value: number) => void;
}

function AnimationSpeedControl({ speed, onSpeedChange }: AnimationSpeedControlProps) {
  return (
    <div className="mb-12 max-w-md">
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium text-gray-700 min-w-24">
          Animation Speed
        </label>
        <Slider
          value={[speed]}
          onValueChange={(value) => onSpeedChange(value[0])}
          min={100}
          max={1000}
          step={50}
          className="flex-1"
        />
        <span className="text-sm text-gray-600 min-w-16">{speed}ms</span>
      </div>
    </div>
  );
}

interface FadeOutControlProps {
  fadeOutMs: number;
  onFadeOutChange: (value: number) => void;
}

function FadeOutControl({ fadeOutMs, onFadeOutChange }: FadeOutControlProps) {
  return (
    <div className="mb-8 max-w-md">
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium text-gray-700 min-w-24">
          Duration
        </label>
        <Slider
          value={[fadeOutMs]}
          onValueChange={(value) => onFadeOutChange(value[0])}
          min={50}
          max={1200}
          step={50}
          className="flex-1"
        />
        <span className="text-sm text-gray-600 min-w-16">{fadeOutMs}ms</span>
      </div>
    </div>
  );
}

interface BloomIntensityControlProps {
  bloomIntensity: number;
  onBloomIntensityChange: (value: number) => void;
}

function BloomIntensityControl({ bloomIntensity, onBloomIntensityChange }: BloomIntensityControlProps) {
  return (
    <div className="mb-8 max-w-md">
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium text-gray-700 min-w-24">
          Bloom Intensity
        </label>
        <Slider
          value={[bloomIntensity]}
          onValueChange={(value) => onBloomIntensityChange(value[0])}
          min={0}
          max={3}
          step={0.1}
          className="flex-1"
        />
        <span className="text-sm text-gray-600 min-w-16">{bloomIntensity.toFixed(1)}x</span>
      </div>
    </div>
  );
}

interface BloomOpacityControlProps {
  bloomOpacity: number;
  onBloomOpacityChange: (value: number) => void;
}

function BloomOpacityControl({ bloomOpacity, onBloomOpacityChange }: BloomOpacityControlProps) {
  return (
    <div className="mb-8 max-w-md">
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium text-gray-700 min-w-24">
          Bloom Opacity
        </label>
        <Slider
          value={[bloomOpacity]}
          onValueChange={(value) => onBloomOpacityChange(value[0])}
          min={0}
          max={1}
          step={0.05}
          className="flex-1"
        />
        <span className="text-sm text-gray-600 min-w-16">{Math.round(bloomOpacity * 100)}%</span>
      </div>
    </div>
  );
}

interface AnimatedShowcaseProps {
  speed: number;
  onSpeedChange: (value: number) => void;
}

export function AnimatedLoaders5x5Showcase({ speed, onSpeedChange }: AnimatedShowcaseProps) {
  return (
    <div className="mb-12">
      <AnimationSpeedControl speed={speed} onSpeedChange={onSpeedChange} />
      <h2 className="text-xl font-semibold mb-6 text-gray-700">Animated Loaders 5x5</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8">
        <Loader shape={[]} title="Check Success" animated animationPath={checkSuccess} speed={speed} halftone={{ strategy: { type: "trail", length: 2 } }} />
        <Loader shape={[]} title="Cross Error" animated animationPath={crossError} speed={speed} halftone={{ strategy: { type: "trail", length: 2 } }} />
        <Loader shape={[]} title="Traveling Arrow" animated animationPath={travelingArrow} speed={speed} halftone={{ strategy: { type: "trail", length: 2 } }} />
        <Loader shape={[]} title="Pulsing Dot" animated animationPath={pulsingDot} speed={speed} halftone={{ strategy: { type: "trail", length: 2 } }} />
        <Loader shape={[]} title="Scanning Line" animated animationPath={scanningLine} speed={speed} halftone={{ strategy: { type: "trail", length: 2 } }} />
        <Loader shape={[]} title="Expanding Square" animated animationPath={expandingSquare} speed={speed} halftone={{ strategy: { type: "trail", length: 2 } }} />
        <Loader shape={[]} title="Bar Chart Waves" animated animationPath={barChartWaves} speed={speed} halftone={{ strategy: { type: "trail", length: 2 } }} />
        <Loader shape={[]} title="Bouncing Dots" animated animationPath={bouncingDots} speed={speed} halftone={{ strategy: { type: "trail", length: 2 } }} />
        <Loader shape={[]} title="Rotating Square" animated animationPath={rotatingSquare} speed={speed} halftone={{ strategy: { type: "trail", length: 2 } }} />
        <Loader shape={[]} title="Wave Pattern" animated animationPath={wavePattern} speed={speed} halftone={{ strategy: { type: "trail", length: 2 } }} />
        <Loader shape={[]} title="Corners Spin" animated animationPath={cornersSpin} speed={speed} halftone={{ strategy: { type: "trail", length: 2 } }} />
        <Loader shape={[]} title="DNA Helix" animated animationPath={dnaHelix} speed={speed} halftone={{ strategy: { type: "trail", length: 2 } }} />
        <Loader shape={[]} title="Spiral In" animated animationPath={spiralIn} speed={speed} halftone={{ strategy: { type: "trail", length: 2 } }} />
        <Loader shape={[]} title="Radar Sweep" animated animationPath={radarSweep} speed={speed} halftone={{ strategy: { type: "trail", length: 2 } }} />
        <Loader shape={[]} title="Meteor Shower" animated animationPath={meteorShower} speed={speed} halftone={{ strategy: { type: "trail", length: 2 } }} />
        <Loader shape={[]} title="Typewriter" animated animationPath={typewriter} speed={speed} halftone={{ strategy: { type: "trail", length: 2 } }} />
        <Loader shape={[]} title="Snake" animated animationPath={snake} speed={speed} halftone={{ strategy: { type: "trail", length: 2 } }} />
        <Loader shape={[]} title="Circular Wave" animated animationPath={circularWave} speed={speed} halftone={{ strategy: { type: "trail", length: 2 } }} />
        <Loader shape={[]} title="Diagonal Sweep" animated animationPath={diagonalSweep} speed={speed} halftone={{ strategy: { type: "trail", length: 2 } }} />
        <Loader shape={[]} title="Hourglass" animated animationPath={hourglass} speed={speed} />
      </div>
    </div>
  );
}

interface AnimatedLoaders3x3ShowcaseProps {
  durationMs: number;
  bloomIntensity: number;
  bloomOpacity: number;
  lightColor?: string;
  darkColor?: string;
}

export function AnimatedLoaders3x3Showcase({
  durationMs,
  bloomIntensity,
  bloomOpacity,
  lightColor = "#1d4ed8",
  darkColor = "#f8fafc",
}: AnimatedLoaders3x3ShowcaseProps) {
  return (
    <div className="mb-12">
      <h2 className="text-xl font-semibold mb-6 text-gray-700">Animated Loaders 3x3</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-8">
        {delayAnimations.map((animation) => (
          <MiniDelayLoader
            key={animation.title}
            title={animation.title}
            delays={animation.delays}
            durationMs={durationMs}
            lightColor={lightColor}
            darkColor={darkColor}
            bloomIntensity={bloomIntensity}
            bloomOpacity={bloomOpacity}
          />
        ))}
      </div>
    </div>
  );
}

export function AnimatedLoaders5x5Page() {
  const [speed, setSpeed] = useState(400);
  return (
    <AnimatedLoaders5x5Showcase speed={speed} onSpeedChange={setSpeed} />
  );
}

export function AnimatedLoaders3x3Page() {
  const [durationMs, setDurationMs] = useState(600);
  const [bloomIntensity, setBloomIntensity] = useState(0.1);
  const [bloomOpacity, setBloomOpacity] = useState(0.5);
  const colorPresets = [
    { id: "blue", name: "Blue", light: "color(display-p3 0.19 0.09 0.41)", dark: "color(display-p3 0.91 0.90 0.98)" },
    { id: "cyan", name: "Cyan", light: "color(display-p3 0.05 0.45 0.65)", dark: "color(display-p3 0.55 0.92 1)" },
    { id: "orange", name: "Orange", light: "color(display-p3 0.92 0.35 0.05)", dark: "color(display-p3 0.99 0.73 0.46)" },
    { id: "magenta", name: "Magenta", light: "color(display-p3 0.86 0.15 0.47)", dark: "color(display-p3 0.98 0.66 0.83)" },
    { id: "lime", name: "Lime", light: "color(display-p3 0.64 0.90 0.21)", dark: "color(display-p3 1 0.94 0.54)" },
    { id: "teal", name: "Teal", light: "color(display-p3 0.06 0.46 0.43)", dark: "color(display-p3 0.37 0.92 0.83)" },
  ];
  const [activePresetId, setActivePresetId] = useState(colorPresets[0]?.id ?? "blue");
  const activePreset = colorPresets.find((preset) => preset.id === activePresetId) ?? colorPresets[0];
  return (
    <>
      <div className="mb-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Color</h2>
            <p className="text-sm text-gray-500">Choose the glow color for 3x3 animations.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {colorPresets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => setActivePresetId(preset.id)}
                className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition ${
                  preset.id === activePresetId
                    ? "border-gray-900 text-gray-900"
                    : "border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
              >
                <span
                  className="inline-flex h-4 w-4 rounded-full"
                  style={{ backgroundColor: preset.light }}
                />
                {preset.name}
              </button>
            ))}
          </div>
        </div>
      </div>
      <FadeOutControl fadeOutMs={durationMs} onFadeOutChange={setDurationMs} />
      <BloomIntensityControl bloomIntensity={bloomIntensity} onBloomIntensityChange={setBloomIntensity} />
      <BloomOpacityControl bloomOpacity={bloomOpacity} onBloomOpacityChange={setBloomOpacity} />
      <AnimatedLoaders3x3Showcase
        durationMs={durationMs}
        bloomIntensity={bloomIntensity}
        bloomOpacity={bloomOpacity}
        lightColor={activePreset?.light}
        darkColor={activePreset?.dark}
      />
    </>
  );
}
