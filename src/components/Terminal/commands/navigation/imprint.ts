import { CommandHandler } from '../../../../types/terminal';

export const imprint: CommandHandler = {
  name: 'imprint',
  description: 'Show legal notice',
  execute: () => ({
    output: 'Opening imprint...',
    action: { type: 'show-overlay', overlay: 'imprint' }
  })
};
