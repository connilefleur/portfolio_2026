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
        // Format: [cmd:displayText|commandToExecute] - display just project name, execute "open <id>"
        return `  [cmd:${p.id}|open ${p.id}]`;
      }).join('\n');

      return { output: `open <project_name>\n\n${list}` };
    }

    // Open specific project
    const projectId = args[0];
    const found = context.projects.find(p => p.id === projectId);

    if (!found) {
      const suggestions = context.projects
        .filter(p => p.id.includes(projectId) || projectId.includes(p.id))
        .map(p => p.id);
      
      let output = `Project '${projectId}' not found.`;
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
