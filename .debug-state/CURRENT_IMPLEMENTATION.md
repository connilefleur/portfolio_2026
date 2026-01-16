# Current Implementation Details

## Key File: `src/components/Terminal/Terminal.tsx`

### Command Rendering
Commands in output are marked with `[cmd:xxx]` syntax:
```javascript
// In commands/index.ts
output: `  [cmd:help]              Show this help message`
```

### Parsing Function
```javascript
const clickableCommands = new Set<string>();

function parseClickableCommands(text: string): string {
  return text.replace(/\[cmd:([^\]]+)\]/g, (_match, cmd) => {
    clickableCommands.add(cmd);  // Store as valid clickable command
    return `\x1b[36m\x1b[4m${cmd}\x1b[0m`;  // Cyan + underline
  });
}
```

### Click Handler (Current Approach)
```javascript
const handleClick = (e: MouseEvent) => {
  const target = e.target as HTMLElement;
  
  // Check if clicked element has xterm-underline class
  const underlinedElement = target.closest(
    '.xterm-underline-1, .xterm-underline-2, .xterm-underline-3, [class*="xterm-underline"]'
  );
  
  if (underlinedElement) {
    const text = underlinedElement.textContent?.trim();
    if (text && clickableCommands.has(text)) {
      e.preventDefault();
      e.stopPropagation();
      injectCommandRef.current(text);
      return;
    }
  }
};
```

### Event Listener Attachment
```javascript
container.addEventListener('click', handleClick);
container.addEventListener('mousemove', handleMouseMove);
```

## Dependencies
```json
{
  "@xterm/xterm": "^5.5.0",
  "@xterm/addon-fit": "^0.10.0"
}
```

## xterm.js Configuration
```javascript
const options: ITerminalOptions = {
  theme: { /* dark theme colors */ },
  fontFamily: "'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace",
  fontSize: 14,
  lineHeight: 1.2,
  cursorBlink: true,
  cursorStyle: 'block',
  scrollback: 1000,
  allowProposedApi: true,
};
```
