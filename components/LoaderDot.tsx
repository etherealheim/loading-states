"use client";

import { motion } from "framer-motion";
import type { DotState } from "@/utils/halftone";

export const DOT_FULL_SIZE = 3;
export const DOT_EMPTY_SIZE = 1.5;
export const DOT_SPACING = 2;

const DEFAULT_PALETTE = {
  full: "#1F2123",
  mid: "#D2D3D6",
  empty: "#D2D3D6",
};

interface LoaderDotProps {
  state: DotState;
  palette?: {
    full: string;
    mid: string;
    empty: string;
  };
  staggerDelay?: number; // Delay in seconds for stagger animation
}

export function LoaderDot({ state, palette = DEFAULT_PALETTE, staggerDelay = 0 }: LoaderDotProps) {
  const getStyles = () => {
    switch (state) {
      case "full":
        return {
          width: DOT_FULL_SIZE,
          height: DOT_FULL_SIZE,
          backgroundColor: palette.full,
        };
      case "mid":
        return {
          width: DOT_FULL_SIZE,
          height: DOT_FULL_SIZE,
          backgroundColor: palette.mid,
        };
      case "empty":
        return {
          width: DOT_EMPTY_SIZE,
          height: DOT_EMPTY_SIZE,
          backgroundColor: palette.empty,
        };
    }
  };

  const styles = getStyles();
  
  // Only stagger full and mid states, empty appears instantly
  const shouldStagger = staggerDelay > 0 && (state === "full" || state === "mid");

  return (
    <div
      className="flex items-center justify-center"
      style={{ width: DOT_FULL_SIZE, height: DOT_FULL_SIZE }}
    >
      <motion.div
        initial={shouldStagger ? { opacity: 0, width: styles.width, height: styles.height, backgroundColor: styles.backgroundColor } : undefined}
        animate={{
          opacity: 1,
          width: styles.width,
          height: styles.height,
          backgroundColor: styles.backgroundColor,
        }}
        transition={{
          duration: 0,
          delay: shouldStagger ? staggerDelay : 0,
        }}
      />
    </div>
  );
}
