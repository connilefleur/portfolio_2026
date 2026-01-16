import { CommandHandler, CommandResult, CommandContext } from '../../../types/terminal';

// Help command - commands are formatted as [cmd:command] for clickability
const help: CommandHandler = {
  name: 'help',
  description: 'List available commands',
  execute: () => ({
    output: `Available commands (click to run):

  [cmd:help]              Show this help message
  [cmd:projects]          List all projects
  [cmd:project <name>]    Open a project viewer
  [cmd:close]             Close current viewer
  [cmd:contact]           Show contact information
  [cmd:imprint]           Show legal notice (Impressum)
  [cmd:clear]             Clear the terminal

  [cmd:whoami]            Who are you?
  [cmd:uname]             System information
  [cmd:neofetch]          System information with style

Type a command and press Enter, or click any command above.`
  })
};

// Projects command - project names are clickable
const projects: CommandHandler = {
  name: 'projects',
  description: 'List all projects',
  execute: (_args, context) => {
    if (context.projects.length === 0) {
      return { output: 'No projects found.\n\nAdd projects to /public/projects/ and rebuild.' };
    }

    const list = context.projects.map(p => {
      const year = p.year ? ` (${p.year})` : '';
      const desc = p.description ? `\n      ${p.description}` : '';
      return `  [cmd:project ${p.id}] ${p.title}${year}${desc}`;
    }).join('\n\n');

    return { output: `Projects (click to open):\n\n${list}` };
  }
};

// Project command
const project: CommandHandler = {
  name: 'project',
  description: 'Open a project viewer',
  usage: 'project <name>',
  execute: (args, context) => {
    if (args.length === 0) {
      return { 
        output: "Usage: project <name>\n\nUse 'projects' to list available projects.",
        isError: true 
      };
    }

    const projectId = args[0];
    const found = context.projects.find(p => p.id === projectId);

    if (!found) {
      const suggestions = context.projects
        .filter(p => p.id.includes(projectId) || projectId.includes(p.id))
        .map(p => p.id);
      
      let output = `Project '${projectId}' not found.`;
      if (suggestions.length > 0) {
        output += `\n\nDid you mean: ${suggestions.join(', ')}?`;
      }
      output += "\n\nUse 'projects' to list available projects.";
      
      return { output, isError: true };
    }

    return {
      output: `Opening ${found.title}...`,
      action: { type: 'open-viewer', projectId: found.id }
    };
  }
};

// Close command
const close: CommandHandler = {
  name: 'close',
  description: 'Close current viewer',
  execute: (_args, context) => {
    if (!context.currentViewer) {
      return { output: 'Nothing to close.' };
    }
    return {
      output: 'Viewer closed.',
      action: { type: 'close-viewer' }
    };
  }
};

// Contact command
const contact: CommandHandler = {
  name: 'contact',
  description: 'Show contact information',
  execute: () => ({
    output: 'Opening contact...',
    action: { type: 'show-overlay', overlay: 'contact' }
  })
};

// Imprint command
const imprint: CommandHandler = {
  name: 'imprint',
  description: 'Show legal notice',
  execute: () => ({
    output: 'Opening imprint...',
    action: { type: 'show-overlay', overlay: 'imprint' }
  })
};

// Clear command
const clear: CommandHandler = {
  name: 'clear',
  description: 'Clear the terminal',
  execute: () => ({
    output: '',
    action: { type: 'clear' }
  })
};

// Easter egg commands
const whoami: CommandHandler = {
  name: 'whoami',
  description: 'Who are you?',
  execute: () => ({ output: 'visitor' })
};

const uname: CommandHandler = {
  name: 'uname',
  description: 'System information',
  execute: (args) => {
    if (args.includes('-a')) {
      return { output: 'Portfolio 1.0.0 Web Browser JavaScript' };
    }
    return { output: 'Portfolio' };
  }
};

const neofetch: CommandHandler = {
  name: 'neofetch',
  description: 'System information with style',
  execute: () => ({
    output: `
       ████████╗
       ╚══██╔══╝   Portfolio Terminal
          ██║      ----------------
          ██║      OS: Web Browser
          ██║      Host: Your Device
          ╚═╝      Terminal: xterm.js
                   Theme: Dark
    `
  })
};

// All commands
export const commands: Record<string, CommandHandler> = {
  help,
  projects,
  project,
  close,
  contact,
  imprint,
  clear,
  whoami,
  uname,
  neofetch,
};

// Parse and execute a command
export function executeCommand(input: string, context: CommandContext): CommandResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return { output: '' };
  }

  const parts = trimmed.split(/\s+/);
  const cmdName = parts[0].toLowerCase();
  const args = parts.slice(1);

  // Check for ls alias
  if (cmdName === 'ls') {
    return commands.projects.execute(args, context);
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
