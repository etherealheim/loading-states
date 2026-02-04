export type DotState = "full" | "mid" | "empty";

export interface Position {
  x: number;
  y: number;
}

export type HalftoneStrategy =
  | { type: "neighbors"; orthogonalOnly?: boolean; distance?: number }
  | { type: "trail"; length: number }
  | { type: "distance"; radius: number }
  | { type: "gradient"; direction: "outward" | "inward" };

/**
 * Main function that converts Position[] to state map
 */
export function generateHalftoneStates(
  fullPositions: Position[],
  strategy: HalftoneStrategy,
  gridSize: number = 5,
  frameHistory?: Position[][] // For trail strategy
): Map<string, DotState> {
  const stateMap = new Map<string, DotState>();

  // Set all full positions
  fullPositions.forEach(({ x, y }) => {
    if (x >= 0 && x < gridSize && y >= 0 && y < gridSize) {
      stateMap.set(`${x},${y}`, "full");
    }
  });

  // Apply halftone strategy to get mid positions
  let midPositions: Position[] = [];

  switch (strategy.type) {
    case "neighbors":
      midPositions = applyNeighborHalftones(
        fullPositions,
        gridSize,
        strategy.orthogonalOnly ?? false,
        strategy.distance ?? 1
      );
      break;
    case "trail":
      midPositions = applyTrailHalftones(
        fullPositions,
        frameHistory ?? [],
        strategy.length
      );
      break;
    case "distance":
      midPositions = applyDistanceHalftones(
        fullPositions,
        strategy.radius,
        gridSize
      );
      break;
    case "gradient":
      midPositions = applyGradientHalftones(
        fullPositions,
        strategy.direction,
        gridSize
      );
      break;
  }

  // Set mid positions (only if not already full)
  midPositions.forEach(({ x, y }) => {
    const key = `${x},${y}`;
    if (!stateMap.has(key) && x >= 0 && x < gridSize && y >= 0 && y < gridSize) {
      stateMap.set(key, "mid");
    }
  });

  return stateMap;
}

/**
 * Neighbors strategy - applies anti-aliasing effect
 */
export function applyNeighborHalftones(
  positions: Position[],
  gridSize: number,
  orthogonalOnly: boolean = false,
  distance: number = 1
): Position[] {
  const midPositions: Position[] = [];
  const fullSet = new Set(positions.map(p => `${p.x},${p.y}`));

  positions.forEach(({ x, y }) => {
    const neighbors = getNeighbors(x, y, gridSize, distance, orthogonalOnly);

    neighbors.forEach(neighbor => {
      const key = `${neighbor.x},${neighbor.y}`;
      if (!fullSet.has(key)) {
        midPositions.push(neighbor);
      }
    });
  });

  // Deduplicate
  const uniqueSet = new Set(midPositions.map(p => `${p.x},${p.y}`));
  return Array.from(uniqueSet).map(key => {
    const [x, y] = key.split(",").map(Number);
    return { x, y };
  });
}

/**
 * Trail strategy - creates motion blur effect
 */
export function applyTrailHalftones(
  currentPositions: Position[],
  previousFrames: Position[][],
  length: number
): Position[] {
  const fullSet = new Set(currentPositions.map(p => `${p.x},${p.y}`));
  const trailPositions: Position[] = [];

  // Take up to 'length' previous frames
  const frames = previousFrames.slice(0, length);

  frames.forEach(frame => {
    frame.forEach(pos => {
      const key = `${pos.x},${pos.y}`;
      if (!fullSet.has(key)) {
        trailPositions.push(pos);
      }
    });
  });

  // Deduplicate
  const uniqueSet = new Set(trailPositions.map(p => `${p.x},${p.y}`));
  return Array.from(uniqueSet).map(key => {
    const [x, y] = key.split(",").map(Number);
    return { x, y };
  });
}

/**
 * Distance strategy - creates glow effect
 */
export function applyDistanceHalftones(
  positions: Position[],
  radius: number,
  gridSize: number
): Position[] {
  const fullSet = new Set(positions.map(p => `${p.x},${p.y}`));
  const midPositions: Position[] = [];

  // Check every grid position
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const key = `${x},${y}`;
      if (fullSet.has(key)) continue; // Skip full positions

      // Check if within radius of any full position
      const withinRadius = positions.some(full => {
        const dist = euclideanDistance({ x, y }, full);
        return dist <= radius && dist > 0;
      });

      if (withinRadius) {
        midPositions.push({ x, y });
      }
    }
  }

  return midPositions;
}

/**
 * Gradient strategy - creates directional halftone effect
 */
export function applyGradientHalftones(
  positions: Position[],
  direction: "outward" | "inward",
  gridSize: number
): Position[] {
  const fullSet = new Set(positions.map(p => `${p.x},${p.y}`));
  const centroid = getCentroid(positions);
  const midPositions: Position[] = [];

  // Get neighbors of all full positions
  const neighbors = applyNeighborHalftones(positions, gridSize, false, 1);

  neighbors.forEach(neighbor => {
    const distFromCenter = euclideanDistance(neighbor, centroid);

    // Check if any full position is closer/farther from center
    const hasFullInDirection = positions.some(full => {
      const fullDist = euclideanDistance(full, centroid);
      if (direction === "outward") {
        return fullDist < distFromCenter;
      } else {
        return fullDist > distFromCenter;
      }
    });

    if (hasFullInDirection) {
      midPositions.push(neighbor);
    }
  });

  return midPositions;
}

/**
 * Helper: Get neighbors of a position
 */
function getNeighbors(
  x: number,
  y: number,
  gridSize: number,
  distance: number = 1,
  orthogonalOnly: boolean = false
): Position[] {
  const neighbors: Position[] = [];

  for (let dx = -distance; dx <= distance; dx++) {
    for (let dy = -distance; dy <= distance; dy++) {
      // Skip self
      if (dx === 0 && dy === 0) continue;

      // Skip diagonals if orthogonalOnly
      if (orthogonalOnly && dx !== 0 && dy !== 0) continue;

      const nx = x + dx;
      const ny = y + dy;

      // Check bounds
      if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize) {
        neighbors.push({ x: nx, y: ny });
      }
    }
  }

  return neighbors;
}

/**
 * Helper: Calculate Euclidean distance between two positions
 */
function euclideanDistance(p1: Position, p2: Position): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Helper: Calculate centroid of positions
 */
function getCentroid(positions: Position[]): { x: number; y: number } {
  if (positions.length === 0) {
    return { x: 0, y: 0 };
  }

  const sum = positions.reduce(
    (acc, pos) => ({ x: acc.x + pos.x, y: acc.y + pos.y }),
    { x: 0, y: 0 }
  );

  return {
    x: sum.x / positions.length,
    y: sum.y / positions.length,
  };
}
