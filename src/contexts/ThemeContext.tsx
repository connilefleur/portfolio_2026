import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ThemeColors, defaultTheme, getRandomTheme, getThemeByName, ThemeName } from '../config/theme';
import { themeToCSSVars } from '../config/theme';

interface ThemeContextType {
  currentTheme: ThemeColors;
  setTheme: (theme: ThemeColors) => void;
  setThemeByName: (name: ThemeName) => void;
  setRandomTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
  initialTheme?: ThemeColors;
  randomizeOnLoad?: boolean;
}

/**
 * Theme Provider
 * 
 * Provides theme context to all components.
 * 
 * Props:
 * - initialTheme: Theme to use initially (defaults to defaultTheme)
 * - randomizeOnLoad: If true, randomizes theme on each page load
 */
export function ThemeProvider({ 
  children, 
  initialTheme = defaultTheme,
  randomizeOnLoad = false 
}: ThemeProviderProps) {
  // Determine initial theme
  const getInitialTheme = () => {
    if (randomizeOnLoad) {
      return getRandomTheme();
    }
    return initialTheme;
  };

  const [currentTheme, setCurrentTheme] = useState<ThemeColors>(getInitialTheme);

  // Apply theme to CSS variables whenever theme changes
  useEffect(() => {
    const cssVars = themeToCSSVars(currentTheme);
    const root = document.documentElement;
    Object.entries(cssVars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
  }, [currentTheme]);

  const setTheme = (theme: ThemeColors) => {
    setCurrentTheme(theme);
  };

  const setThemeByName = (name: ThemeName) => {
    setCurrentTheme(getThemeByName(name));
  };

  const setRandomTheme = () => {
    setCurrentTheme(getRandomTheme());
  };

  return (
    <ThemeContext.Provider value={{ currentTheme, setTheme, setThemeByName, setRandomTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Hook to access theme context
 */
export function useThemeContext() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useThemeContext must be used within a ThemeProvider');
  }
  return context;
}
