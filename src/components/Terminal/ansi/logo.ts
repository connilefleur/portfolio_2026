/**
 * Connilefleur Logo - ANSI Art
 * Uses the ANSI art generator for a simpler, smaller logo
 */

import { generateAnsiArt } from '../../../utils/ansi';

export const getConnilefleurArt = (terminalCols?: number): string => {
  // Calculate max width: use terminal width or estimate from screen
  let maxWidth: number | undefined;
  
  if (typeof window !== 'undefined') {
    const isMobile = window.innerWidth < 768;
    
    if (terminalCols && terminalCols > 0) {
      // Use terminal columns if available
      // On mobile, use a higher percentage since font is larger and we need more space
      const percentage = isMobile ? 0.90 : 0.85;
      maxWidth = Math.floor(terminalCols * percentage);
    } else {
      // Fallback: estimate based on screen width and font size
      const fontSize = isMobile ? 16 : 14;
      // More accurate calculation: terminal chars are roughly 0.6 * font size in pixels
      // On mobile, account for larger font and potential scaling issues
      const charWidth = isMobile ? fontSize * 0.55 : fontSize * 0.6;
      const charsPerScreen = Math.floor(window.innerWidth / charWidth);
      const percentage = isMobile ? 0.90 : 0.85;
      maxWidth = Math.floor(charsPerScreen * percentage);
    }
    
    // Ensure reasonable width - allow wrapping on very small screens
    // "connilefleur" is 12 chars, so we want to wrap if screen is narrow
    maxWidth = Math.max(15, maxWidth);
  }
  
  const logo = generateAnsiArt('connilefleur', '\x1b[36m', maxWidth);
  const tagline = '\x1b[33m  Creative Developer & Digital Artist\x1b[0m';
  const subtitle = '\x1b[90m  Building beautiful digital experiences\x1b[0m';
  
  return `${logo}\n${tagline}\n${subtitle}`;
};
