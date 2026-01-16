import { CommandHandler } from '../../../../types/terminal';

export const help: CommandHandler = {
  name: 'help',
  description: 'List available commands',
  execute: () => ({
    output: `Available commands (click to run):

  [cmd:help]              Show this help message
  [cmd:open]              List projects / open a project
  [cmd:contact]           Show contact information
  [cmd:imprint]           Show legal notice (Impressum)
  [cmd:clear]             Clear the terminal

  [cmd:whoami]            Who are you?
  [cmd:uname]             System information
  [cmd:neofetch]          System information with style
  [cmd:ansi]              Generate ANSI art from text

Press ESC to close any open viewer or overlay.`
  })
};
