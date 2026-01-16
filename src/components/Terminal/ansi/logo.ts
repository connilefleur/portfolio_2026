/**
 * Connilefleur Logo - ANSI Art
 * Uses the ANSI art generator for a simpler, smaller logo
 */

import { generateAnsiArt } from '../../../utils/ansi';

export const getConnilefleurArt = (): string => {
  const logo = generateAnsiArt('connilefleur', '\x1b[36m');
  const tagline = '\x1b[33m  Creative Developer & Digital Artist\x1b[0m';
  const subtitle = '\x1b[90m  Building beautiful digital experiences\x1b[0m';
  
  return `${logo}\n${tagline}\n${subtitle}`;
};
