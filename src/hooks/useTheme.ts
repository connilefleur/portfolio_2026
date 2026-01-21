import { useThemeContext } from '../contexts/ThemeContext';

/**
 * Hook for accessing theme colors
 * 
 * @deprecated Use useThemeContext() instead for full theme control
 * This hook is kept for backward compatibility
 */
export function useTheme() {
  const { currentTheme } = useThemeContext();
  
  return {
    themeColors: currentTheme,
  };
}
