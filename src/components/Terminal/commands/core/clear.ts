import { CommandHandler } from '../../../../types/terminal';

export const clear: CommandHandler = {
  name: 'clear',
  description: 'Clear the terminal',
  execute: () => ({
    output: '',
    action: { type: 'clear' }
  })
};
