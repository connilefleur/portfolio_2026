/**
 * Terminal Commands
 * 
 * All terminal commands are organized by functionality:
 * - core/: Essential commands (help, open, close, clear)
 * - navigation/: Navigation commands (contact, imprint)
 * - system/: System information commands (whoami, uname, neofetch)
 * - ansi/: ANSI art related commands
 * - games/: Terminal games (snake, tetris)
 */

import { CommandHandler, CommandResult, CommandContext } from '../../../types/terminal';

// Core commands
import { help } from './core/help';
import { open } from './core/open';
import { close } from './core/close';
import { clear } from './core/clear';

// Navigation commands
import { contact } from './navigation/contact';
import { imprint } from './navigation/imprint';

// System commands
import { whoami } from './system/whoami';
import { uname } from './system/uname';
import { neofetch } from './system/neofetch';

// ANSI commands
import { ansi } from './ansi/ansi';

// Game commands
import { snake } from './games/snake';
import { tetris } from './games/tetris';

// All commands registry
export const commands: Record<string, CommandHandler> = {
  help,
  open,
  close,
  contact,
  imprint,
  clear,
  whoami,
  uname,
  neofetch,
  ansi,
  snake,
  tetris,
};

/**
 * Parse and execute a command
 * Returns CommandResult or Promise<CommandResult> for async commands
 */
export function executeCommand(input: string, context: CommandContext): CommandResult | Promise<CommandResult> {
  const trimmed = input.trim();
  if (!trimmed) {
    return { output: '' };
  }

  const parts = trimmed.split(/\s+/);
  const cmdName = parts[0].toLowerCase();
  const args = parts.slice(1);

  // Check for ls alias
  if (cmdName === 'ls') {
    return commands.open.execute(args, context);
  }

  // Check for exit/quit
  if (cmdName === 'exit' || cmdName === 'quit') {
    return { output: "There's nowhere to go. You're already home." };
  }

  const handler = commands[cmdName];
  if (!handler) {
    return { 
      output: `Command not found: ${cmdName}\n\nType 'help' for available commands.`,
      isError: true 
    };
  }

  return handler.execute(args, context);
}
