import { useEffect } from 'react';
import { theme, themeToCSSVars } from '../config/theme';

/**
 * Hook for applying theme colors
 */
export function useTheme() {
  // Apply theme to document
  useEffect(() => {
    const cssVars = themeToCSSVars(theme);
    
    // Apply CSS variables to root
    const root = document.documentElement;
    Object.entries(cssVars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
  }, []);

  return {
    themeColors: theme,
  };
}
