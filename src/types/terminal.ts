export interface CommandResult {
  output: string;
  isError?: boolean;
  action?: CommandAction;
}

export type CommandAction = 
  | { type: 'open-viewer'; projectId: string; mediaIndex?: number }
  | { type: 'close-viewer' }
  | { type: 'show-overlay'; overlay: 'contact' | 'imprint' }
  | { type: 'close-overlay' }
  | { type: 'clear' };

export interface CommandHandler {
  name: string;
  description: string;
  usage?: string;
  execute: (args: string[], context: CommandContext) => CommandResult;
}

export interface CommandContext {
  projects: import('./projects').Project[];
  currentViewer: ViewerState | null;
}

export interface ViewerState {
  projectId: string;
  mediaIndex: number;
}
