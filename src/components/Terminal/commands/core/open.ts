import { CommandHandler, CommandContext } from '../../../../types/terminal';

/** Normalize for matching: lowercase, trim, Unicode NFC */
function normalize(s: string): string {
  return s.trim().toLowerCase().normalize('NFC');
}

/** Slug-like form for loose matching (e.g. ß -> ss) */
function slugify(s: string): string {
  return normalize(s).replace(/\s+/g, '-').replace(/ß/g, 'ss');
}

export const open: CommandHandler = {
  name: 'open',
  description: 'Open a project',
  usage: 'open <project_name>',
  execute: (args, context: CommandContext) => {
    if (context.projects.length === 0) {
      return { output: 'No projects found.\n\nAdd projects to /public/projects/ and rebuild.' };
    }

    if (args.length === 0) {
      const list = context.projects.map(p => {
        const displayName = p.title || p.id;
        return `  [cmd:${displayName}|open ${p.id}]`;
      }).join('\n');
      return { output: `open <project_name>\n\n${list}` };
    }

    const raw = args[0].trim();
    const searchTerm = normalize(raw);
    const searchSlug = slugify(raw);

    const found = context.projects.find(p => {
      const idN = normalize(p.id);
      const titleN = normalize(p.title || '');
      const folderN = p._folder ? normalize(p._folder) : '';
      const idSlug = slugify(p.id);
      const titleSlug = slugify(p.title || '');
      return (
        idN === searchTerm ||
        idN === searchSlug ||
        idN.includes(searchTerm) ||
        titleN === searchTerm ||
        titleN.includes(searchTerm) ||
        folderN === searchTerm ||
        folderN === searchSlug ||
        idSlug === searchSlug ||
        titleSlug === searchSlug
      );
    });

    if (!found) {
      const suggestions = context.projects
        .filter(p => {
          const id = normalize(p.id);
          const title = normalize(p.title || '');
          const folder = (p._folder || '').toLowerCase();
          return id.includes(searchTerm) || searchTerm.includes(id) ||
                 title.includes(searchTerm) || folder.includes(searchTerm);
        })
        .map(p => p.id);
      let output = `Project '${raw}' not found.`;
      if (suggestions.length > 0) output += `\n\nDid you mean: ${suggestions.join(', ')}?`;
      output += "\n\nType 'open' to list available projects.";
      return { output, isError: true };
    }

    return {
      output: `Opening ${found.title}...`,
      action: { type: 'open-viewer', projectId: found.id }
    };
  }
};
