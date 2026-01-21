/**
 * Connilefleur Logo - ANSI Art
 * Uses the ANSI art generator for a simpler, smaller logo
 */

import { generateAnsiArt } from '../../../utils/ansi';

export const getConnilefleurArt = (terminalCols?: number): string => {
  // Use full terminal width - let it wrap naturally when needed
  // Don't restrict width, let ANSI art use full width and wrap when necessary
  const maxWidth = terminalCols || undefined;
  
  // On mobile, we want the ANSI art to be half the size
  // We'll pass a flag to the generator to use smaller spacing
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  
  // Generate logo - use cyan for logo art
  const logo = generateAnsiArt('connilefleur', '\x1b[36m', maxWidth);
  
  // On mobile, use shorter text that wraps better
  // All text aligns to left edge (no leading spaces) to match ANSI art
  // Name in slight orange color (RGB: 255, 180, 80)
  const name = '\x1b[38;2;255;180;80mConrad Loeffler\x1b[0m';
  
  if (isMobile) {
    // Mobile-friendly shorter versions that break at better points
    // Plain text - no colors (only logo and name are colored)
    const tagline = 'Creative Developer\n& Digital Artist';
    const subtitle = 'Building beautiful\ndigital experiences';
    return `${logo}\n\n${name}\n${tagline}\n${subtitle}`;
  } else {
    // Desktop version - full text on one line
    // Plain text - no colors (only logo and name are colored)
    const tagline = 'Creative Developer & Digital Artist';
    const subtitle = 'Building beautiful digital experiences';
    return `${logo}\n\n${name}\n${tagline}\n${subtitle}`;
  }
};
