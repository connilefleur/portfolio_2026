import { CommandHandler } from '../../../../types/terminal';

export const contact: CommandHandler = {
  name: 'contact',
  description: 'Show contact information',
  execute: () => ({
    output: 'Opening contact...',
    action: { type: 'show-overlay', overlay: 'contact' }
  })
};
