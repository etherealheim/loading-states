"use client";

import type { DotState } from "@/utils/halftone";
import { DOT_FULL_SIZE, DOT_SPACING, LoaderDot } from "./LoaderDot";

interface Position {
  x: number;
  y: number;
}

// Grid sizing: 23 columns x 14 rows = 113px x 68px (3px dots + 2px spacing, no scaling needed)
const GRID_COLUMNS = 23;
const GRID_ROWS = 14;

const dotPalette = {
  full: "#1672EB",
  mid: "#D2D3D6",
  empty: "#D9D9D9",
};

interface ActorsRunCardProps {
  label: string;
  usageAmount: number;
  usageRange: string;
  usageLevel: number;
  usageTrend?: number;
  staggerAnimation?: boolean; // Enable column-by-column fade in
  format?: "currency" | "storage" | "decimal"; // Display format
}

function createUsagePositions(usageLevel: number, usageTrend: number): Position[] {
  const clamped = Math.max(0, Math.min(1, usageLevel));
  const trend = Math.max(-1, Math.min(1, usageTrend));
  const positions: Position[] = [];
  const heights: number[] = [];
  const maxHeight = GRID_ROWS - 1;
  const baseHeights = Array.from({ length: GRID_COLUMNS }, (_, column) => {
    const t = column / (GRID_COLUMNS - 1);
    const curve = t * t;
    const amplitude = clamped * (0.2 + 0.8 * curve);
    const trendOffset = trend * Math.pow(t, 1.4) * maxHeight * 0.9;
    const tailDrop =
      trend < 0 && t > 0.6
        ? Math.abs(trend) * ((t - 0.6) / 0.4) * maxHeight * 0.6
        : 0;
    return Math.round(amplitude * maxHeight + trendOffset - tailDrop);
  });

  const jitter = Math.max(2, Math.round(clamped * 4));
  let current = baseHeights[0] ?? 0;

  for (let column = 0; column < GRID_COLUMNS; column++) {
    const delta = Math.floor(Math.random() * (jitter * 2 + 1)) - jitter;
    const target = Math.min(
      maxHeight,
      Math.max(0, baseHeights[column] + delta)
    );
    const ease = 0.6;
    current = Math.round(current * (1 - ease) + target * ease);
    heights.push(current);
  }

  const smoothed = heights.map((value, index) => {
    const prev = heights[Math.max(0, index - 1)];
    const next = heights[Math.min(heights.length - 1, index + 1)];
    return Math.round((prev + value * 1.5 + next) / 3.5);
  });

  // Create positions and ensure connectivity by filling vertical gaps
  for (let column = 0; column < GRID_COLUMNS; column++) {
    const height = smoothed[column] ?? 0;
    const y = maxHeight - height;
    positions.push({ x: column, y });
    
    // Check if we need to fill vertical gap to connect to next column
    if (column < GRID_COLUMNS - 1) {
      const nextHeight = smoothed[column + 1] ?? 0;
      const nextY = maxHeight - nextHeight;
      const yDiff = nextY - y;
      
      // If vertical jump is more than 1, fill in the gap at current column
      if (Math.abs(yDiff) > 1) {
        const steps = Math.abs(yDiff) - 1;
        const yDir = yDiff > 0 ? 1 : -1;
        
        for (let step = 1; step <= steps; step++) {
          positions.push({ x: column, y: y + (yDir * step) });
        }
      }
    }
  }

  return positions;
}

function buildStateMap(positions: Position[], columns: number, rows: number) {
  const states = new Map<string, DotState>();
  const fullSet = new Set(positions.map((pos) => `${pos.x},${pos.y}`));

  positions.forEach(({ x, y }) => {
    if (x >= 0 && x < columns && y >= 0 && y < rows) {
      states.set(`${x},${y}`, "full");
    }
  });

  positions.forEach(({ x, y }) => {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= columns || ny < 0 || ny >= rows) continue;
        const key = `${nx},${ny}`;
        if (!fullSet.has(key)) {
          states.set(key, "mid");
        }
      }
    }
  });

  return states;
}

export function ActorsRunCard({
  label,
  usageAmount,
  usageRange,
  usageLevel,
  usageTrend = 0,
  staggerAnimation = false,
  format = "currency",
}: ActorsRunCardProps) {
  const dotStates = buildStateMap(
    createUsagePositions(usageLevel, usageTrend),
    GRID_COLUMNS,
    GRID_ROWS
  );

  const formatValue = (value: number): string => {
    switch (format) {
      case "currency":
        return `$${value.toFixed(2)}`;
      case "storage":
        if (value >= 1000) {
          return `${(value / 1000).toFixed(2)} GB`;
        }
        return `${value.toFixed(0)} MB`;
      case "decimal":
        return value.toFixed(3);
      default:
        return value.toString();
    }
  };

  return (
    <div className="h-[92px] w-[286px] rounded-[12px] bg-[#f4f4f5] p-[2px]">
      <div className="relative h-full w-full rounded-[11px] bg-white">
        <div className="absolute left-3 top-2">
          <p className="text-xs font-medium text-[#6d7178]">{label}</p>
          <p className="text-xs font-medium text-[#c9cbcf]">{usageRange}</p>
        </div>
        <p className="absolute left-3 top-9 text-[36px] font-bold leading-[44px] text-[#1f2123]">
          {formatValue(usageAmount)}
        </p>
        <div className="absolute right-3 top-[10px]">
          <DotGrid 
            key={`${usageAmount}-${usageLevel}-${usageTrend}`}
            dotStates={dotStates} 
            staggerAnimation={staggerAnimation} 
          />
        </div>
      </div>
    </div>
  );
}

function DotGrid({ dotStates, staggerAnimation }: { dotStates: Map<string, DotState>; staggerAnimation: boolean }) {
  return (
    <div className="overflow-hidden">
      <div
        className="flex"
        style={{
          gap: `${DOT_SPACING}px`,
        }}
      >
        {Array.from({ length: GRID_COLUMNS }).map((_, column) => (
          <div
            key={column}
            className="flex flex-col"
            style={{
              gap: `${DOT_SPACING}px`,
            }}
          >
            {Array.from({ length: GRID_ROWS }).map((_, row) => {
              const key = `${column},${row}`;
              const state = dotStates.get(key) ?? "empty";
              const staggerDelay = staggerAnimation ? column * 0.06 : 0;
              return (
                <LoaderDot 
                  key={key} 
                  state={state} 
                  palette={dotPalette}
                  staggerDelay={staggerDelay}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
