export interface CommandResult {
  output: string;
  isError?: boolean;
  action?: CommandAction;
}

export type CommandAction = 
  | { type: 'open-viewer'; projectId: string; mediaIndex?: number }
  | { type: 'close-viewer' }
  | { type: 'clear' }
  | { type: 'start-game'; gameId: string; gameHandler: GameHandler; gameName?: string };

export interface CommandHandler {
  name: string;
  description: string;
  usage?: string;
  execute: (args: string[], context: CommandContext) => CommandResult | Promise<CommandResult>;
}

export interface CommandContext {
  projects: import('./projects').Project[];
  currentViewer: ViewerState | null;
}

export interface ViewerState {
  projectId: string;
  mediaIndex: number;
}

export interface GameHandler {
  onKey: (key: string, ev: KeyboardEvent) => void;
  onExit: () => void;
  onClick?: () => void; // Click/tap to start/pause
  render: (terminal: import('@xterm/xterm').Terminal) => void;
}
