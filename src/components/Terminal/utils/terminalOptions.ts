/**
 * Terminal Options
 *
 * Builds xterm.js options from theme and viewport. Keeps Terminal.tsx smaller.
 */

import type { ITerminalOptions } from '@xterm/xterm';
import type { ThemeColors } from '../../../config/theme';

export function getTerminalOptions(theme: ThemeColors): ITerminalOptions {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  return {
    theme: {
      background: theme.terminal.background,
      foreground: theme.terminal.foreground,
      cursor: theme.terminal.cursor,
      cursorAccent: theme.terminal.cursorAccent,
      selectionBackground: theme.terminal.selectionBackground,
      black: theme.terminal.black,
      red: theme.terminal.red,
      green: theme.terminal.green,
      yellow: theme.terminal.yellow,
      blue: theme.terminal.blue,
      magenta: theme.terminal.magenta,
      cyan: theme.terminal.cyan,
      white: theme.terminal.white,
      brightBlack: theme.terminal.brightBlack,
      brightRed: theme.terminal.brightRed,
      brightGreen: theme.terminal.brightGreen,
      brightYellow: theme.terminal.brightYellow,
      brightBlue: theme.terminal.brightBlue,
      brightMagenta: theme.terminal.brightMagenta,
      brightCyan: theme.terminal.brightCyan,
      brightWhite: theme.terminal.brightWhite,
    },
    fontFamily: "'Anonymous Pro', monospace",
    fontSize: isMobile ? 16 : 14,
    lineHeight: 1.2,
    cursorBlink: true,
    cursorStyle: 'block',
    scrollback: 1000,
    allowProposedApi: true,
  };
}
