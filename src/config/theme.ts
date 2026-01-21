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
 * Theme Registry
 * 
 * All available themes are exported here. To add a new theme:
 * 1. Create a new ThemeColors object
 * 2. Add it to the themes array below
 * 3. Optionally add it to the THEME_NAMES object for easy reference
 */

/**
 * Cool Minimal Palette
 * 
 * Base: #0f1419 (dark blue-grey)
 * Surface: #1a2332 (slate)
 * Accent: #5a7a7a (muted teal)
 * Highlight: #7a9a9a (lighter teal)
 */
export const themeCoolMinimal: ThemeColors = {
  // Background colors
  background: '#0f1419', // Base - dark blue-grey
  backgroundSecondary: '#1a2332', // Surface - slate
  backgroundTertiary: '#1f2a3a', // Slightly lighter slate for tertiary surfaces
  
  // Text colors
  text: '#e0e0e0', // Light grey for primary text
  textSecondary: '#b0b0b0', // Medium grey for secondary text
  textTertiary: '#808080', // Darker grey for tertiary text
  
  // Border colors
  border: '#2a3441', // Subtle border using slate tones
  borderSecondary: '#3a4555', // Lighter border
  borderHover: '#5a7a7a', // Accent color for hover states
  
  // Accent colors
  accent: '#5a7a7a', // Muted teal - primary accent
  accentSecondary: '#7a9a9a', // Lighter teal - highlight
  accentTertiary: '#4a6a6a', // Darker teal for subtle accents
  
  // Button colors
  buttonBackground: 'transparent',
  buttonBackgroundHover: '#1f2a3a', // Tertiary background
  buttonBorder: '#2a3441', // Border color
  buttonText: '#e0e0e0', // Primary text
  buttonTextHover: '#7a9a9a', // Highlight color on hover
  
  // Overlay colors
  overlayBackground: 'rgba(15, 20, 25, 0.95)', // Base color with transparency
  overlayText: '#e0e0e0', // Primary text
  
  // Terminal colors - Light text on black background
  terminal: {
    background: '#000000', // Black background
    foreground: '#e0e0e0', // Light text for visibility on black background
    cursor: '#5a7a7a', // Accent color (teal)
    cursorAccent: '#000000', // Black cursor accent
    selectionBackground: 'rgba(90, 122, 122, 0.3)', // Semi-transparent teal selection
    black: '#000000', // Black base
    red: '#c04040', // Muted red
    green: '#4a6a6a', // Muted teal
    yellow: '#8a7a50', // Muted yellow
    blue: '#506080', // Muted blue
    magenta: '#805080', // Muted magenta
    cyan: '#5a8a8a', // Muted teal
    white: '#e0e0e0', // Light text
    brightBlack: '#3a3a3a', // Dark grey
    brightRed: '#d05050', // Brighter red
    brightGreen: '#5a7a7a', // Accent teal
    brightYellow: '#9a8a60', // Brighter yellow
    brightBlue: '#6070a0', // Brighter blue
    brightMagenta: '#906090', // Brighter magenta
    brightCyan: '#6a9a9a', // Brighter teal
    brightWhite: '#ffffff', // White text
  },
};

/**
 * Muted Earth Tones Palette
 * Base: #1a1a1a, Surface: #2a2a2a, Accent: #6b8e6b, Highlight: #9db89d
 */
export const themeMutedEarth: ThemeColors = {
  background: '#1a1a1a',
  backgroundSecondary: '#2a2a2a',
  backgroundTertiary: '#333333',
  text: '#e0e0e0',
  textSecondary: '#b0b0b0',
  textTertiary: '#808080',
  border: '#3a3a3a',
  borderSecondary: '#4a4a4a',
  borderHover: '#6b8e6b',
  accent: '#6b8e6b',
  accentSecondary: '#9db89d',
  accentTertiary: '#5a7a5a',
  buttonBackground: 'transparent',
  buttonBackgroundHover: '#333333',
  buttonBorder: '#3a3a3a',
  buttonText: '#e0e0e0',
  buttonTextHover: '#9db89d',
  overlayBackground: 'rgba(26, 26, 26, 0.95)',
  overlayText: '#e0e0e0',
  terminal: {
    background: '#1a1a1a',
    foreground: '#e0e0e0',
    cursor: '#6b8e6b',
    cursorAccent: '#1a1a1a',
    selectionBackground: '#3a3a3a',
    black: '#1a1a1a',
    red: '#d87070',
    green: '#6b8e6b',
    yellow: '#b0a070',
    blue: '#7080a0',
    magenta: '#a080a0',
    cyan: '#9db89d',
    white: '#e0e0e0',
    brightBlack: '#4a4a4a',
    brightRed: '#e89090',
    brightGreen: '#9db89d',
    brightYellow: '#c0b080',
    brightBlue: '#90a0c0',
    brightMagenta: '#b090b0',
    brightCyan: '#b0d0b0',
    brightWhite: '#f0f0f0',
  },
};

/**
 * Warm Muted Palette
 * Base: #1e1e1e, Surface: #2d2d2d, Accent: #7a8a7a, Highlight: #a0b0a0
 */
export const themeWarmMuted: ThemeColors = {
  background: '#1e1e1e',
  backgroundSecondary: '#2d2d2d',
  backgroundTertiary: '#363636',
  text: '#e0e0e0',
  textSecondary: '#b0b0b0',
  textTertiary: '#808080',
  border: '#3d3d3d',
  borderSecondary: '#4d4d4d',
  borderHover: '#7a8a7a',
  accent: '#7a8a7a',
  accentSecondary: '#a0b0a0',
  accentTertiary: '#6a7a6a',
  buttonBackground: 'transparent',
  buttonBackgroundHover: '#363636',
  buttonBorder: '#3d3d3d',
  buttonText: '#e0e0e0',
  buttonTextHover: '#a0b0a0',
  overlayBackground: 'rgba(30, 30, 30, 0.95)',
  overlayText: '#e0e0e0',
  terminal: {
    background: '#1e1e1e',
    foreground: '#e0e0e0',
    cursor: '#7a8a7a',
    cursorAccent: '#1e1e1e',
    selectionBackground: '#3d3d3d',
    black: '#1e1e1e',
    red: '#d87070',
    green: '#7a8a7a',
    yellow: '#b0a070',
    blue: '#7080a0',
    magenta: '#a080a0',
    cyan: '#a0b0a0',
    white: '#e0e0e0',
    brightBlack: '#4d4d4d',
    brightRed: '#e89090',
    brightGreen: '#a0b0a0',
    brightYellow: '#c0b080',
    brightBlue: '#90a0c0',
    brightMagenta: '#b090b0',
    brightCyan: '#b0c0b0',
    brightWhite: '#f0f0f0',
  },
};

/**
 * Theme Registry
 * 
 * Add all themes here to make them available for switching.
 * To add a new theme, create it above and add it to this array.
 */
export const themes: ThemeColors[] = [
  themeCoolMinimal,
  themeMutedEarth,
  themeWarmMuted,
];

/**
 * Theme Names (for easy reference and UI)
 */
export const THEME_NAMES = {
  coolMinimal: 'Cool Minimal',
  mutedEarth: 'Muted Earth Tones',
  warmMuted: 'Warm Muted',
} as const;

export type ThemeName = keyof typeof THEME_NAMES;

/**
 * Theme Map (for easy lookup by name)
 */
export const themeMap: Record<ThemeName, ThemeColors> = {
  coolMinimal: themeCoolMinimal,
  mutedEarth: themeMutedEarth,
  warmMuted: themeWarmMuted,
};

/**
 * Default theme (currently Cool Minimal)
 * This is used as fallback and initial theme
 */
export const defaultTheme: ThemeColors = themeCoolMinimal;

/**
 * Get a random theme from the available themes
 * Useful for randomization on page load
 */
export function getRandomTheme(): ThemeColors {
  const randomIndex = Math.floor(Math.random() * themes.length);
  return themes[randomIndex];
}

/**
 * Get theme by name
 */
export function getThemeByName(name: ThemeName): ThemeColors {
  return themeMap[name] || defaultTheme;
}

/**
 * Get theme by index
 */
export function getThemeByIndex(index: number): ThemeColors {
  return themes[index] || defaultTheme;
}

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
