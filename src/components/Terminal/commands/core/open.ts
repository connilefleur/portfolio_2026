import { CommandHandler, CommandContext } from '../../../../types/terminal';

export const open: CommandHandler = {
  name: 'open',
  description: 'Open a project',
  usage: 'open <project_name>',
  execute: (args, context: CommandContext) => {
    // If no arguments, show list of available projects
    if (args.length === 0) {
      if (context.projects.length === 0) {
        return { output: 'No projects found.\n\nAdd projects to /public/projects/ and rebuild.' };
      }

      const list = context.projects.map(p => {
        // Format: [cmd:displayText|commandToExecute] - display title, execute "open <id>"
        const displayName = p.title || p.id;
        return `  [cmd:${displayName}|open ${p.id}]`;
      }).join('\n');

      return { output: `open <project_name>\n\n${list}` };
    }

    // Open specific project - match by id, title, or folder name
    const searchTerm = args[0].toLowerCase();
    const found = context.projects.find(p => 
      p.id.toLowerCase() === searchTerm ||
      p.id.toLowerCase().includes(searchTerm) ||
      p.title.toLowerCase() === searchTerm ||
      p.title.toLowerCase().includes(searchTerm) ||
      (p._folder && p._folder.toLowerCase() === searchTerm)
    );

    if (!found) {
      // Try fuzzy matching
      const suggestions = context.projects
        .filter(p => {
          const id = p.id.toLowerCase();
          const title = p.title.toLowerCase();
          const folder = (p._folder || '').toLowerCase();
          return id.includes(searchTerm) || 
                 searchTerm.includes(id) ||
                 title.includes(searchTerm) ||
                 folder.includes(searchTerm);
        })
        .map(p => p.id);
      
      let output = `Project '${args[0]}' not found.`;
      if (suggestions.length > 0) {
        output += `\n\nDid you mean: ${suggestions.join(', ')}?`;
      }
      output += "\n\nType 'open' to list available projects.";
      
      return { output, isError: true };
    }

    return {
      output: `Opening ${found.title}...`,
      action: { type: 'open-viewer', projectId: found.id }
    };
  }
};
