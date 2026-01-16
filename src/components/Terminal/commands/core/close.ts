import { CommandHandler, CommandContext } from '../../../../types/terminal';

export const close: CommandHandler = {
  name: 'close',
  description: 'Close current viewer',
  execute: (_args, context: CommandContext) => {
    if (!context.currentViewer) {
      return { output: 'Nothing to close.' };
    }
    return {
      output: 'Viewer closed.',
      action: { type: 'close-viewer' }
    };
  }
};
