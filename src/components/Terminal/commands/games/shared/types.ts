/**
 * Shared Game Types
 * 
 * Common types and interfaces for terminal games
 */

export interface Point {
  x: number;
  y: number;
}

export interface GameDimensions {
  width: number;
  height: number;
}

/**
 * Calculate responsive game dimensions
 */
export function calculateGameDimensions(
  cols: number,
  rows: number,
  isMobile: boolean,
  maxWidth: number = 30
): GameDimensions {
  if (isMobile) {
    // Use full width on mobile: (cols - 2 for border) / 2 for cell width
    const width = Math.floor((cols - 2) / 2);
    // Use about 40% of screen height for game area
    const height = Math.max(10, Math.min(Math.floor(rows * 0.4), 15));
    return { width, height };
  } else {
    // Desktop: use specified max width
    const width = Math.max(10, Math.min(maxWidth, Math.floor((cols - 4) / 2)));
    const height = Math.max(10, Math.min(20, rows - 5));
    return { width, height };
  }
}
