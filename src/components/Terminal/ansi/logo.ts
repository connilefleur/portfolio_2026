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
  
  // Generate logo - on mobile, we'll use CSS to scale it down
  const logo = generateAnsiArt('connilefleur', '\x1b[36m', maxWidth);
  
  // On mobile, use shorter text that wraps better
  // All text aligns to left edge (no leading spaces) to match ANSI art
  if (isMobile) {
    // Mobile-friendly shorter versions that break at better points
    const tagline = '\x1b[33mCreative Developer\n& Digital Artist\x1b[0m';
    const subtitle = '\x1b[90mBuilding beautiful\ndigital experiences\x1b[0m';
    return `${logo}\n${tagline}\n${subtitle}`;
  } else {
    // Desktop version - full text on one line
    const tagline = '\x1b[33mCreative Developer & Digital Artist\x1b[0m';
    const subtitle = '\x1b[90mBuilding beautiful digital experiences\x1b[0m';
    return `${logo}\n${tagline}\n${subtitle}`;
  }
};
