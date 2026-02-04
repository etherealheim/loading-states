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
  const [cardAnimated, setCardAnimated] = useState(false);
  const [actorsRunData, setActorsRunData] = useState(() => ({
    amount: 67.67,
    range: "Jan 24 - Feb 24",
    level: 0.56,
    trend: 0,
  }));

  return (
    <div className="min-h-screen bg-white p-12">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-4 text-gray-900">Loading States</h1>

        <div className="mb-12">
          <h2 className="text-xl font-semibold mb-6 text-gray-700">Dashboard Card</h2>
          <div className="flex flex-wrap items-center gap-4">
            <ActorsRunCard
              usageAmount={actorsRunData.amount}
              usageRange={actorsRunData.range}
              usageLevel={actorsRunData.level}
              usageTrend={actorsRunData.trend}
              animated={cardAnimated}
              animationSpeed={200}
            />
            <button
              type="button"
              onClick={() => setActorsRunData(createMockActorsRunData())}
              className="h-9 rounded-md border border-gray-200 px-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Randomize data
            </button>
            <button
              type="button"
              onClick={() => setCardAnimated(!cardAnimated)}
              className="h-9 rounded-md border border-gray-200 px-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              {cardAnimated ? "Disable" : "Enable"} animation
            </button>
          </div>
        </div>

        <div className="mb-12 max-w-md">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700 min-w-24">
              Animation Speed
            </label>
            <Slider
              value={[speed]}
              onValueChange={(value) => setSpeed(value[0])}
              min={100}
              max={1000}
              step={50}
              className="flex-1"
            />
            <span className="text-sm text-gray-600 min-w-16">{speed}ms</span>
          </div>
        </div>

        <div className="mb-12">
          <h2 className="text-xl font-semibold mb-6 text-gray-700">Static Shapes</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-8">
            <Loader shape={shapes.arrowRight} title="Arrow Right" />
            <Loader shape={shapes.arrowLeft} title="Arrow Left" />
            <Loader shape={shapes.arrowUp} title="Arrow Up" />
            <Loader shape={shapes.arrowDown} title="Arrow Down" />
            <Loader shape={shapes.circle} title="Circle" />
            <Loader shape={shapes.plus} title="Plus" />
            <Loader shape={shapes.cross} title="Cross" />
            <Loader shape={shapes.diamond} title="Diamond" />
            <Loader shape={shapes.horizontalLine} title="Horizontal" />
            <Loader shape={shapes.verticalLine} title="Vertical" />
            <Loader shape={shapes.square} title="Square" />
            <Loader shape={shapes.corners} title="Corners" />
            <Loader shape={shapes.halftone} title="Halftone" customStates={halftoneStates} />
          </div>
        </div>

        <div className="mb-12">
          <h2 className="text-xl font-semibold mb-6 text-gray-700">Animated Loaders</h2>
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

      </div>
    </div>
  );
}
