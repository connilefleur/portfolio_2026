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
    
    // Calculate responsive width based on screen size
    // Try to get terminal width from global context, or estimate from screen
    let maxWidth: number | undefined;
    if (typeof window !== 'undefined') {
      // Try to get terminal reference to get actual cols
      const terminal = window.__terminalRef;
      if (terminal && terminal.cols) {
        maxWidth = Math.floor(terminal.cols * 0.95);
      } else {
        // Fallback: estimate based on screen width and font size
        const fontSize = window.innerWidth < 768 ? 16 : 14;
        const charsPerScreen = Math.floor(window.innerWidth / (fontSize * 0.6));
        maxWidth = Math.floor(charsPerScreen * 0.95);
      }
      // Ensure minimum width for readability
      maxWidth = Math.max(40, maxWidth);
    }
    
    const art = generateAnsiArt(text, '\x1b[36m', maxWidth);
    return { output: art };
  }
};
