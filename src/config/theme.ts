/**
 * Theme Configuration
 * 
 * All colors for the website are defined here.
 * Change colors below to update the entire site's appearance.
 */

export interface ThemeColors {
  // Background colors
  background: string;
  backgroundSecondary: string;
  backgroundTertiary: string;
  
  // Text colors
  text: string;
  textSecondary: string;
  textTertiary: string;
  
  // Border colors
  border: string;
  borderSecondary: string;
  borderHover: string;
  
  // Accent colors (for links, highlights, etc.)
  accent: string;
  accentSecondary: string;
  accentTertiary: string;
  
  // Button colors
  buttonBackground: string;
  buttonBackgroundHover: string;
  buttonBorder: string;
  buttonText: string;
  buttonTextHover: string;
  
  // Overlay colors
  overlayBackground: string;
  overlayText: string;
  
  // Terminal colors (xterm.js)
  terminal: {
    background: string;
    foreground: string;
    cursor: string;
    cursorAccent: string;
    selectionBackground: string;
    black: string;
    red: string;
    green: string;
    yellow: string;
    blue: string;
    magenta: string;
    cyan: string;
    white: string;
    brightBlack: string;
    brightRed: string;
    brightGreen: string;
    brightYellow: string;
    brightBlue: string;
    brightMagenta: string;
    brightCyan: string;
    brightWhite: string;
  };
}

/**
 * Theme colors - change these values to customize appearance
 */
export const theme: ThemeColors = {
  // Background colors
  background: '#0d0d0d',
  backgroundSecondary: '#1a1a1a',
  backgroundTertiary: '#222222',
  
  // Text colors
  text: '#ffffff',
  textSecondary: '#ffffff',
  textTertiary: '#ffffff',
  
  // Border colors
  border: '#333333',
  borderSecondary: '#444444',
  borderHover: '#666666',
  
  // Accent colors
  accent: '#4ec9b0',
  accentSecondary: '#9cdcfe',
  accentTertiary: '#dcdcaa',
  
  // Button colors
  buttonBackground: 'transparent',
  buttonBackgroundHover: '#222222',
  buttonBorder: '#444444',
  buttonText: '#ffffff',
  buttonTextHover: '#ffffff',
  
  // Overlay colors
  overlayBackground: 'rgba(0, 0, 0, 0.95)',
  overlayText: '#ffffff',
  
  // Terminal colors
  terminal: {
    background: '#0d0d0d',
    foreground: '#e0e0e0',
    cursor: '#4ec9b0',
    cursorAccent: '#0d0d0d',
    selectionBackground: '#264f78',
    black: '#0d0d0d',
    red: '#f44747',
    green: '#4ec9b0',
    yellow: '#dcdcaa',
    blue: '#569cd6',
    magenta: '#c586c0',
    cyan: '#9cdcfe',
    white: '#e0e0e0',
    brightBlack: '#666666',
    brightRed: '#f44747',
    brightGreen: '#4ec9b0',
    brightYellow: '#dcdcaa',
    brightBlue: '#569cd6',
    brightMagenta: '#c586c0',
    brightCyan: '#9cdcfe',
    brightWhite: '#ffffff',
  },
};

/**
 * Convert theme colors to CSS variables
 */
export function themeToCSSVars(themeColors: ThemeColors): Record<string, string> {
  return {
    '--color-bg': themeColors.background,
    '--color-bg-secondary': themeColors.backgroundSecondary,
    '--color-bg-tertiary': themeColors.backgroundTertiary,
    '--color-text': themeColors.text,
    '--color-text-secondary': themeColors.textSecondary,
    '--color-text-tertiary': themeColors.textTertiary,
    '--color-border': themeColors.border,
    '--color-border-secondary': themeColors.borderSecondary,
    '--color-border-hover': themeColors.borderHover,
    '--color-accent': themeColors.accent,
    '--color-accent-secondary': themeColors.accentSecondary,
    '--color-accent-tertiary': themeColors.accentTertiary,
    '--color-button-bg': themeColors.buttonBackground,
    '--color-button-bg-hover': themeColors.buttonBackgroundHover,
    '--color-button-border': themeColors.buttonBorder,
    '--color-button-text': themeColors.buttonText,
    '--color-button-text-hover': themeColors.buttonTextHover,
    '--color-overlay-bg': themeColors.overlayBackground,
    '--color-overlay-text': themeColors.overlayText,
  };
}
