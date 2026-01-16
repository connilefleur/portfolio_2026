import { CommandHandler } from '../../../../types/terminal';

export const contact: CommandHandler = {
  name: 'contact',
  description: 'Show contact information',
  execute: async () => {
    try {
      const response = await fetch('./content/contact.md');
      if (response.ok) {
        const markdown = await response.text();
        // Convert markdown to plain text for terminal with clickable links
        const text = markdown
          .replace(/^### (.+)$/gm, '$1')
          .replace(/^## (.+)$/gm, '$1')
          .replace(/^# (.+)$/gm, '$1')
          // Convert Instagram mentions to clickable links (before removing bold)
          .replace(/\*\*Instagram:\*\*\s*([a-zA-Z0-9._]+)/g, (_match, username) => {
            return `Instagram: [link:https://www.instagram.com/${username}/|@${username}]`;
          })
          .replace(/\*\*(.+?)\*\*/g, '$1')
          .replace(/\*(.+?)\*/g, '$1')
          // Convert email addresses to clickable mailto links
          .replace(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, (_match, email) => {
            return `[mailto:${email}|${email}]`;
          })
          // Convert other markdown links to clickable terminal links
          .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, linkText, url) => {
            // Check if it's already a mailto or http link
            if (url.startsWith('mailto:')) {
              return `[mailto:${url.replace('mailto:', '')}|${linkText}]`;
            } else if (url.startsWith('http://') || url.startsWith('https://')) {
              return `[link:${url}|${linkText}]`;
            }
            return `${linkText} (${url})`;
          })
          .replace(/^- (.+)$/gm, '  • $1')
          .replace(/\n\n\n+/g, '\n\n')
          .trim();
        return { output: text };
      }
    } catch (error) {
      // Ignore errors
    }
    return { 
      output: 'Unable to load contact information.',
      isError: true 
    };
  }
};
