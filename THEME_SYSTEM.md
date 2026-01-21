# Theme System Guide

The theme system has been refactored to support easy theme switching, dynamic themes, and future randomization features.

## Quick Start

### Enable Random Theme on Load

To randomize the theme each time the page loads, edit `src/index.tsx`:

```tsx
<ThemeProvider randomizeOnLoad={true}>
  <App />
</ThemeProvider>
```

### Switch Theme Programmatically

In any component, use the theme context:

```tsx
import { useThemeContext } from '../contexts/ThemeContext';
import { THEME_NAMES } from '../config/theme';

function MyComponent() {
  const { currentTheme, setTheme, setThemeByName, setRandomTheme } = useThemeContext();
  
  // Switch to a specific theme by name
  const switchToCoolMinimal = () => {
    setThemeByName('coolMinimal');
  };
  
  // Switch to a random theme
  const randomizeTheme = () => {
    setRandomTheme();
  };
  
  // Use a custom theme object
  const useCustomTheme = () => {
    setTheme(myCustomTheme);
  };
  
  return (
    <div>
      <button onClick={switchToCoolMinimal}>Cool Minimal</button>
      <button onClick={setRandomTheme}>Random Theme</button>
    </div>
  );
}
```

## Adding a New Theme

1. **Create the theme object** in `src/config/theme.ts`:

```tsx
export const themeMyNewTheme: ThemeColors = {
  background: '#1a1a1a',
  backgroundSecondary: '#2a2a2a',
  // ... all other required colors
  terminal: {
    // ... terminal colors
  },
};
```

2. **Add it to the themes array**:

```tsx
export const themes: ThemeColors[] = [
  themeCoolMinimal,
  themeMutedEarth,
  themeWarmMuted,
  themeMyNewTheme, // Add here
];
```

3. **Add it to the theme map** (optional, for name-based switching):

```tsx
export const THEME_NAMES = {
  coolMinimal: 'Cool Minimal',
  mutedEarth: 'Muted Earth Tones',
  warmMuted: 'Warm Muted',
  myNewTheme: 'My New Theme', // Add here
} as const;

export const themeMap: Record<ThemeName, ThemeColors> = {
  coolMinimal: themeCoolMinimal,
  mutedEarth: themeMutedEarth,
  warmMuted: themeWarmMuted,
  myNewTheme: themeMyNewTheme, // Add here
};
```

That's it! The new theme is now available for switching.

## Available Themes

- **coolMinimal** (default): Cool Minimal Palette - dark blue-grey with muted teal accents
- **mutedEarth**: Muted Earth Tones - charcoal with sage green accents
- **warmMuted**: Warm Muted - warm dark with olive accents

## API Reference

### ThemeProvider Props

- `initialTheme?: ThemeColors` - Theme to use initially (defaults to `defaultTheme`)
- `randomizeOnLoad?: boolean` - If true, randomizes theme on each page load (default: `false`)

### useThemeContext Hook

Returns:
- `currentTheme: ThemeColors` - The currently active theme
- `setTheme(theme: ThemeColors)` - Set theme using a theme object
- `setThemeByName(name: ThemeName)` - Set theme by name (e.g., 'coolMinimal')
- `setRandomTheme()` - Switch to a random theme

### Theme Functions

- `getRandomTheme(): ThemeColors` - Get a random theme from available themes
- `getThemeByName(name: ThemeName): ThemeColors` - Get theme by name
- `getThemeByIndex(index: number): ThemeColors` - Get theme by index
- `themes: ThemeColors[]` - Array of all available themes
- `THEME_NAMES` - Object mapping theme names to display names

## Example: Theme Switcher Component

```tsx
import { useThemeContext } from '../contexts/ThemeContext';
import { THEME_NAMES, ThemeName } from '../config/theme';

export function ThemeSwitcher() {
  const { currentTheme, setThemeByName, setRandomTheme } = useThemeContext();
  
  return (
    <div>
      <h3>Select Theme</h3>
      {Object.entries(THEME_NAMES).map(([key, name]) => (
        <button 
          key={key}
          onClick={() => setThemeByName(key as ThemeName)}
        >
          {name}
        </button>
      ))}
      <button onClick={setRandomTheme}>Random</button>
    </div>
  );
}
```

## How It Works

1. **ThemeProvider** wraps the app and manages the active theme state
2. **CSS Variables** are automatically updated when the theme changes
3. **Terminal colors** are updated when the theme changes (terminal re-initializes)
4. **All components** automatically use the new theme via CSS variables

## Future Enhancements

The system is ready for:
- ✅ Random theme on page load
- ✅ Theme switcher UI component
- ✅ Theme persistence (localStorage)
- ✅ Theme preview/selection
- ✅ Custom theme creation

To add theme persistence, you could extend `ThemeProvider` to save/load from localStorage:

```tsx
// In ThemeProvider
useEffect(() => {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) {
    setThemeByName(savedTheme as ThemeName);
  }
}, []);

useEffect(() => {
  localStorage.setItem('theme', currentThemeName);
}, [currentTheme]);
```
