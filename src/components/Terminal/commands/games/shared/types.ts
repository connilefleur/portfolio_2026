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
    // Check if device is in landscape orientation
    const isLandscape = typeof window !== 'undefined' && window.innerWidth > window.innerHeight;
    
    if (isLandscape) {
      // Landscape: horizontal split - game on left, controls on right
      // Use about 60% of terminal width for game area
      const width = Math.floor((cols - 2) * 0.6 / 2);
      // Use most of the height (leave room for header/status)
      const height = Math.max(10, Math.min(Math.floor(rows * 0.8), 20));
      return { width, height };
    } else {
      // Portrait: vertical split - game on top, controls on bottom
      // Use full width on mobile: (cols - 2 for border) / 2 for cell width
      const width = Math.floor((cols - 2) / 2);
      // Use about 40% of screen height for game area
      const height = Math.max(10, Math.min(Math.floor(rows * 0.4), 15));
      return { width, height };
    }
  } else {
    // Desktop: use specified max width
    const width = Math.max(10, Math.min(maxWidth, Math.floor((cols - 4) / 2)));
    const height = Math.max(10, Math.min(20, rows - 5));
    return { width, height };
  }
}
