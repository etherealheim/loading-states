"use client";

import { motion } from "framer-motion";
import { useEffect, useState, useRef } from "react";

type DotState = "full" | "mid" | "empty";

interface Position {
  x: number;
  y: number;
}

interface GridDot {
  state: DotState;
}

const GRID_SIZE = 5;
const DOT_SPACING = 2; // Space between dots

export function GridLoader() {
  const [grid, setGrid] = useState<GridDot[][]>(
    Array(GRID_SIZE)
      .fill(null)
      .map(() =>
        Array(GRID_SIZE)
          .fill(null)
          .map(() => ({ state: "empty" as DotState }))
      )
  );

  // Arrow shape pointing right
  const arrowShape: Position[] = [
    { x: 2, y: 0 }, // top row middle
    { x: 3, y: 1 }, // diagonal up
    { x: 0, y: 2 }, // middle row
    { x: 1, y: 2 },
    { x: 2, y: 2 },
    { x: 3, y: 2 },
    { x: 4, y: 2 },
    { x: 3, y: 3 }, // diagonal down
    { x: 2, y: 4 }, // bottom row middle
  ];

  // Calculate nearest neighbors
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

  // Update grid based on arrow shape
  useEffect(() => {
    const newGrid = Array(GRID_SIZE)
      .fill(null)
      .map(() =>
        Array(GRID_SIZE)
          .fill(null)
          .map(() => ({ state: "empty" as DotState }))
      );

    // Set all arrow positions to full
    arrowShape.forEach(({ x, y }) => {
      if (x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE) {
        newGrid[y][x].state = "full";
      }
    });

    // Collect all neighbors of arrow positions
    const neighborSet = new Set<string>();
    arrowShape.forEach(({ x, y }) => {
      const neighbors = getNeighbors(x, y);
      neighbors.forEach((neighbor) => {
        const key = `${neighbor.x},${neighbor.y}`;
        // Only add as neighbor if it's not part of the arrow itself
        const isPartOfArrow = arrowShape.some(
          (pos) => pos.x === neighbor.x && pos.y === neighbor.y
        );
        if (!isPartOfArrow) {
          neighborSet.add(key);
        }
      });
    });

    // Set neighbors to mid
    neighborSet.forEach((key) => {
      const [x, y] = key.split(",").map(Number);
      newGrid[y][x].state = "mid";
    });

    setGrid(newGrid);
  }, []);



  return (
    <div className="flex items-center justify-center min-h-screen bg-white">
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
            <Dot key={`${x}-${y}`} state={dot.state} />
          ))
        )}
      </div>
    </div>
  );
}

function Dot({ state }: { state: DotState }) {
  const getStyles = () => {
    switch (state) {
      case "full":
        return {
          width: 3,
          height: 3,
          backgroundColor: "#1F2123",
          border: "none",
        };
      case "mid":
      case "empty":
        return {
          width: 1.5,
          height: 1.5,
          backgroundColor: "#D2D3D6",
          border: "none",
        };
    }
  };

  const styles = getStyles();

  return (
    <div className="flex items-center justify-center" style={{ width: 3, height: 3 }}>
      <motion.div
        initial={{
          scale: 0,
          backgroundColor: styles.backgroundColor,
          border: styles.border,
        }}
        animate={{
          scale: 1,
          backgroundColor: styles.backgroundColor,
          border: styles.border,
        }}
        transition={{
          type: "spring",
          stiffness: 400,
          damping: 25,
        }}
        style={{
          width: styles.width,
          height: styles.height,
        }}
      />
    </div>
  );
}
