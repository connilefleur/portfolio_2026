import { CommandHandler } from '../../../../types/terminal';
import { generateAnsiArt } from '../../../../utils/ansi';

export const ansi: CommandHandler = {
  name: 'ansi',
  description: 'Generate ANSI art from text',
  usage: 'ansi <text>',
  execute: (args) => {
    if (args.length === 0) {
      return { 
        output: 'Usage: ansi <text>\n\nExample: ansi hello',
        isError: true 
      };
    }
    
    const text = args.join(' ');
    if (text.length > 20) {
      return { 
        output: 'Text too long. Maximum 20 characters.',
        isError: true 
      };
    }
    
    const art = generateAnsiArt(text);
    return { output: art };
  }
};
