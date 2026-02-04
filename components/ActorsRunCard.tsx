"use client";

import { useEffect, useState } from "react";
import type { DotState } from "@/utils/halftone";
import { DOT_FULL_SIZE, DOT_SPACING, LoaderDot } from "./LoaderDot";

interface Position {
  x: number;
  y: number;
}

// Grid sizing: 21 columns x 13 rows = 105px x 65px (3px dots + 2px spacing, no scaling needed)
const GRID_COLUMNS = 21;
const GRID_ROWS = 13;

const dotPalette = {
  full: "#1672EB",
  mid: "#D2D3D6",
  empty: "#D9D9D9",
};

interface ActorsRunCardProps {
  usageAmount: number;
  usageRange: string;
  usageLevel: number;
  usageTrend?: number;
  animated?: boolean;
  animationSpeed?: number; // ms per step
  staggerAnimation?: boolean; // Enable column-by-column fade in
}

// Generate spike pattern - quick jumps simulating usage activity
function generateSpikePattern(targetAmount: number, steps: number = 30): number[] {
  const pattern: number[] = [0];
  let current = 0;
  const stepSize = targetAmount / steps;
  
  for (let i = 1; i <= steps; i++) {
    // Add random spikes (20% chance)
    if (Math.random() < 0.2) {
      const spike = stepSize * (1 + Math.random() * 2);
      current = Math.min(targetAmount, current + spike);
    } else {
      // Gradual increase
      current = Math.min(targetAmount, current + stepSize * (0.5 + Math.random()));
    }
    pattern.push(current);
  }
  
  // Ensure we reach the target at the end
  pattern[pattern.length - 1] = targetAmount;
  return pattern;
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

  const jitter = Math.max(1, Math.round(clamped * 2));
  let current = baseHeights[0] ?? 0;

  for (let column = 0; column < GRID_COLUMNS; column++) {
    const delta = Math.floor(Math.random() * (jitter * 2 + 1)) - jitter;
    const target = Math.min(
      maxHeight,
      Math.max(0, baseHeights[column] + delta)
    );
    const ease = 0.45;
    current = Math.round(current * (1 - ease) + target * ease);
    heights.push(current);
  }

  const smoothed = heights.map((value, index) => {
    const prev = heights[Math.max(0, index - 1)];
    const next = heights[Math.min(heights.length - 1, index + 1)];
    return Math.round((prev + value * 2 + next) / 4);
  });

  for (let column = 0; column < GRID_COLUMNS; column++) {
    const height = smoothed[column] ?? 0;
    const y = maxHeight - height;
    positions.push({ x: column, y });
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
  usageAmount,
  usageRange,
  usageLevel,
  usageTrend = 0,
  animated = false,
  animationSpeed = 200,
  staggerAnimation = false,
}: ActorsRunCardProps) {
  const [currentAmount, setCurrentAmount] = useState(animated ? 0 : usageAmount);
  const [currentLevel, setCurrentLevel] = useState(animated ? 0 : usageLevel);

  useEffect(() => {
    if (!animated) {
      setCurrentAmount(usageAmount);
      setCurrentLevel(usageLevel);
      return;
    }

    // Generate spike pattern
    const pattern = generateSpikePattern(usageAmount, 30);
    let step = 0;

    const interval = setInterval(() => {
      if (step >= pattern.length - 1) {
        clearInterval(interval);
        setCurrentAmount(usageAmount);
        setCurrentLevel(usageLevel);
        return;
      }

      const amount = pattern[step];
      const level = amount / 120; // Assuming max is $120
      setCurrentAmount(amount);
      setCurrentLevel(level);
      step++;
    }, animationSpeed);

    return () => clearInterval(interval);
  }, [usageAmount, usageLevel, animated, animationSpeed]);

  const dotStates = buildStateMap(
    createUsagePositions(currentLevel, usageTrend),
    GRID_COLUMNS,
    GRID_ROWS
  );

  return (
    <div className="h-[92px] w-[286px] rounded-[12px] bg-[#f4f4f5] p-[2px]">
      <div className="relative h-full w-full rounded-[11px] bg-white">
        <p className="absolute left-3 top-2 text-xs font-medium text-[#6d7178]">
          Usage <span className="text-[#c9cbcf]">{usageRange}</span>
        </p>
        <p className="absolute left-3 top-9 text-[36px] font-bold leading-[44px] text-[#1f2123]">
          ${currentAmount.toFixed(2)}
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
