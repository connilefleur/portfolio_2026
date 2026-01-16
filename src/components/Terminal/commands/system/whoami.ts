import { CommandHandler } from '../../../../types/terminal';
import { getConnilefleurArt } from '../../ansi';

export const whoami: CommandHandler = {
  name: 'whoami',
  description: 'Who are you?',
  execute: () => ({ output: getConnilefleurArt() })
};
