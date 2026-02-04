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
}

export function LoaderDot({ state, palette = DEFAULT_PALETTE }: LoaderDotProps) {
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

  return (
    <div
      className="flex items-center justify-center"
      style={{ width: DOT_FULL_SIZE, height: DOT_FULL_SIZE }}
    >
      <motion.div
        animate={{
          width: styles.width,
          height: styles.height,
          backgroundColor: styles.backgroundColor,
        }}
        transition={{
          duration: 0,
        }}
      />
    </div>
  );
}
