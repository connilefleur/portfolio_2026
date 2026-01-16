import { CommandHandler } from '../../../../types/terminal';

export const imprint: CommandHandler = {
  name: 'imprint',
  description: 'Show legal notice',
  execute: async () => {
    try {
      const response = await fetch('./content/impressum.md');
      if (response.ok) {
        const markdown = await response.text();
        // Convert markdown to plain text for terminal
        const text = markdown
          .replace(/^### (.+)$/gm, '$1')
          .replace(/^## (.+)$/gm, '$1')
          .replace(/^# (.+)$/gm, '$1')
          .replace(/\*\*(.+?)\*\*/g, '$1')
          .replace(/\*(.+?)\*/g, '$1')
          .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
          .replace(/^- (.+)$/gm, '  • $1')
          .replace(/\n\n\n+/g, '\n\n')
          .trim();
        return { output: text };
      }
    } catch (error) {
      // Ignore errors
    }
    return { 
      output: 'Unable to load imprint information.',
      isError: true 
    };
  }
};
