/**
 * Display Logo and Welcome Message Utility
 * 
 * Handles displaying the ANSI art logo and welcome message in the terminal
 */

import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { getConnilefleurArt } from '../ansi';
import { parseClickableCommands, persistentCommandInstances, persistentCommandMappings } from './clickableCommands';
import { PROMPT } from '../constants';

export interface DisplayLogoParams {
  terminal: XTerm;
  fitAddon: FitAddon | null;
  container: HTMLElement | null;
  writeLine: (line: string) => void;
  writePrompt: () => void;
  initialLineCountRef: React.MutableRefObject<number>;
}

export function displayLogoAndWelcome({
  terminal,
  fitAddon,
  container,
  writeLine,
  writePrompt,
  initialLineCountRef,
}: DisplayLogoParams) {
  // Ensure terminal is fitted before getting cols
  if (fitAddon) {
    try {
      fitAddon.fit();
    } catch (e) {
      console.warn('FitAddon error in displayLogoAndWelcome:', e);
    }
  }

  // On mobile, temporarily reduce font size to make ANSI art half size
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  let originalFontSize: string | null = null;
  
  if (isMobile && container) {
    const xtermElement = container.querySelector('.xterm') as HTMLElement;
    if (xtermElement) {
      // Save original font size
      originalFontSize = window.getComputedStyle(xtermElement).fontSize;
      // Set to half size for ANSI art
      xtermElement.style.fontSize = '8px'; // Half of 16px
    }
  }
  
  const logo = getConnilefleurArt(terminal.cols);
  const logoLinesArray = logo.split('\n');
  logoLinesArray.forEach((line) => {
    writeLine(line);
  });
  
  // Restore original font size after logo
  if (isMobile && container && originalFontSize) {
    setTimeout(() => {
      const xtermElement = container.querySelector('.xterm') as HTMLElement;
      if (xtermElement) {
        xtermElement.style.fontSize = originalFontSize;
      }
    }, 10);
  }

  // Welcome message with clickable commands
  // Align to left edge (no leading spaces) to match ANSI art and tagline/subtitle
  writeLine('');
  // More monochrome welcome message - plain text, no special styling
  writeLine("Welcome! Click the highlighted commands below, or type your own.");
  writeLine('');
  
  const openLine = parseClickableCommands("→ [cmd:open] to browse projects");
  writeLine(openLine);
  // Mark the "open" command in this line as persistent (from initial welcome)
  persistentCommandInstances.add('open:initial');
  // Store the mapping so it can be re-added after clearing
  persistentCommandMappings.set('open', 'open');
  
  const helpLine = parseClickableCommands("→ [cmd:help] for more commands");
  writeLine(helpLine);
  // Mark the "help" command in this line as persistent (from initial welcome)
  persistentCommandInstances.add('help:initial');
  // Store the mapping so it can be re-added after clearing
  persistentCommandMappings.set('help', 'help');
  
  const escLine = "→ Press ESC or browser back button to close overlays";
  writeLine(escLine);
  writeLine('');
  writePrompt();
  
  // Track initial line count for limited history mode
  // Count: logo lines + empty + name + tagline + subtitle + empty + welcomeIntro + empty + open + help + esc + empty
  // (prompt is written separately, so we don't count it as "initial")
  // Note: logo includes an empty line between logo and name
  initialLineCountRef.current = logoLinesArray.length + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1; // logo (includes empty line) + name + tagline + subtitle + empty + welcomeIntro + empty + open + help + esc + empty
}
