/**
 * Clickable Commands Utilities
 * 
 * Handles parsing and managing clickable commands and links in terminal output
 */

// Map display text -> command to execute (allows different display vs execution)
export const clickableCommands = new Map<string, string>();
// Map display text -> URL for external links
export const clickableLinks = new Map<string, string>();
// Track disabled command text (for re-render persistence)
export const disabledCommands = new Set<string>();
// Track which specific command instances are persistent (from initial welcome lines)
// Format: "command-text:line-number" or just track by a unique identifier
export const persistentCommandInstances = new Set<string>();

/**
 * Parse [cmd:xxx] or [cmd:display|command] patterns and return display text
 * [cmd:help] -> displays "help", executes "help"
 * [cmd:example-project|project example-project] -> displays "example-project", executes "project example-project"
 * Also parse [link:url|text] and [mailto:email|text] for external links
 */
export function parseClickableCommands(text: string): string {
  // Parse external links: [link:url|text] or [mailto:email|text]
  text = text.replace(/\[(link|mailto):([^\|]+)\|([^\]]+)\]/g, (_match, type, urlOrEmail, displayText) => {
    let url: string;
    if (type === 'mailto') {
      url = `mailto:${urlOrEmail}`;
    } else {
      url = urlOrEmail;
    }
    
    // Register this link as clickable
    clickableLinks.set(displayText, url);
    // Style: cyan + underline
    return `\x1b[36m\x1b[4m${displayText}\x1b[0m`;
  });
  
  // Parse commands: [cmd:xxx] or [cmd:display|command]
  text = text.replace(/\[cmd:([^\]]+)\]/g, (_match, content) => {
    let displayText: string;
    let command: string;
    
    if (content.includes('|')) {
      // Format: display|command
      const parts = content.split('|');
      displayText = parts[0];
      command = parts[1];
    } else {
      // Format: command (display same as command)
      displayText = content;
      command = content;
    }
    
    // Register this command as clickable
    clickableCommands.set(displayText, command);
    // Style: cyan + underline
    return `\x1b[36m\x1b[4m${displayText}\x1b[0m`;
  });
  
  return text;
}

/**
 * Apply disabled styling to an element
 */
export function applyDisabledStyle(el: HTMLElement) {
  el.style.setProperty('text-decoration', 'none', 'important');
  el.style.setProperty('color', 'inherit', 'important');
  el.style.setProperty('cursor', 'text', 'important');
}

/**
 * Clear all clickable commands and links
 */
export function clearClickableCommands() {
  clickableCommands.clear();
  clickableLinks.clear();
  disabledCommands.clear();
  // Don't clear persistentCommandInstances - they should persist across clears
}

/**
 * Clear only active clickable commands and links (keep disabled commands)
 */
export function clearActiveClickableCommands() {
  clickableCommands.clear();
  clickableLinks.clear();
}
