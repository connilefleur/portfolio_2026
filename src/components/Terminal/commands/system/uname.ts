import { CommandHandler } from '../../../../types/terminal';

export const uname: CommandHandler = {
  name: 'uname',
  description: 'System information',
  execute: (args) => {
    if (args.includes('-a')) {
      return { output: 'Portfolio 1.0.0 Web Browser JavaScript' };
    }
    return { output: 'Portfolio' };
  }
};
