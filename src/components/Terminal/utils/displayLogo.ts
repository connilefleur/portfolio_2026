/**
 * Display Logo and Welcome Message Utility
 *
 * Handles displaying the ANSI art logo and welcome message in the terminal.
 * Uses measured DOM dimensions for column count so the logo fits on all display sizes.
 */

import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { getConnilefleurArt } from '../ansi';
import { parseClickableCommands, persistentCommandInstances, persistentCommandMappings } from './clickableCommands';

export interface DisplayLogoParams {
  terminal: XTerm;
  fitAddon: FitAddon | null;
  container: HTMLElement | null;
  writeLine: (line: string) => void;
  writePrompt: () => void;
  initialLineCountRef: React.MutableRefObject<number>;
}

const MIN_COLS = 20;
const FALLBACK_COLS_DESKTOP = 80;
const FALLBACK_COLS_MOBILE = 40;

/**
 * Get column count from actual DOM measurements so the logo width matches
 * what the terminal will display (avoids terminal.cols being wrong before layout settles).
 */
function getColsFromDOM(container: HTMLElement): number | null {
  const viewport = container.querySelector('.xterm-viewport') as HTMLElement | null;
  const rows = container.querySelector('.xterm-rows') as HTMLElement | null;
  if (!viewport || !rows || !rows.firstElementChild) return null;
  const firstRow = rows.firstElementChild as HTMLElement;
  const firstCell = firstRow.firstElementChild as HTMLElement | null;
  if (!firstCell || firstCell.offsetWidth <= 0) return null;
  const viewportWidth = viewport.clientWidth;
  if (viewportWidth <= 0) return null;
  const cellWidth = firstCell.offsetWidth;
  const cols = Math.floor(viewportWidth / cellWidth);
  return cols >= MIN_COLS ? cols : null;
}

export function displayLogoAndWelcome({
  terminal,
  fitAddon,
  container,
  writeLine,
  writePrompt,
  initialLineCountRef,
}: DisplayLogoParams) {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const doWriteLogo = (cols: number): number => {
    const safeCols = cols < MIN_COLS ? (isMobile ? FALLBACK_COLS_MOBILE : FALLBACK_COLS_DESKTOP) : cols;
    const logo = getConnilefleurArt(safeCols);
    const logoLinesArray = logo.split('\n');
    logoLinesArray.forEach((line) => writeLine(line));
    return logoLinesArray.length;
  };

  if (fitAddon) {
    try {
      fitAddon.fit();
    } catch (e) {
      console.warn('FitAddon error in displayLogoAndWelcome:', e);
    }
  }

  let originalFontSize: string | null = null;
  if (isMobile && container) {
    const xtermElement = container.querySelector('.xterm') as HTMLElement;
    if (xtermElement) {
      originalFontSize = window.getComputedStyle(xtermElement).fontSize;
      xtermElement.style.fontSize = '8px';
    }
    if (fitAddon) {
      try {
        fitAddon.fit();
      } catch {
        // ignore
      }
    }
  }

  const cols =
    (container && getColsFromDOM(container)) ??
    terminal.cols ??
    (isMobile ? FALLBACK_COLS_MOBILE : FALLBACK_COLS_DESKTOP);

  const logoLineCount = doWriteLogo(cols);

  if (isMobile && container && originalFontSize) {
    const xtermElement = container.querySelector('.xterm') as HTMLElement;
    if (xtermElement) xtermElement.style.fontSize = originalFontSize;
    if (fitAddon) {
      try {
        fitAddon.fit();
      } catch {
        // ignore
      }
    }
  }

  writeLine('');
  writeLine("Welcome! Click the highlighted commands below, or type your own.");
  writeLine('');
  writeLine(parseClickableCommands("→ [cmd:open] to browse projects"));
  persistentCommandInstances.add('open:initial');
  persistentCommandMappings.set('open', 'open');
  writeLine(parseClickableCommands("→ [cmd:help] for more commands"));
  persistentCommandInstances.add('help:initial');
  persistentCommandMappings.set('help', 'help');
  writeLine("→ Press ESC or browser back button to close overlays");
  writeLine('');
  writePrompt();
  initialLineCountRef.current =
    logoLineCount + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1;
}
