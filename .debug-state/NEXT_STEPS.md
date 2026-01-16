# Next Steps for Debugging Clickable Commands

## Priority Order

### 1. Verify Event Handlers Are Firing
Add console.log at the start of `handleClick` and `handleMouseMove` in `Terminal.tsx`:
```typescript
const handleClick = (e: MouseEvent) => {
  console.log('=== CLICK EVENT ===');
  console.log('e.target:', e.target);
  console.log('e.target.classList:', (e.target as HTMLElement).classList);
  // ... rest of handler
};
```

### 2. Check xterm's Event Interception
xterm.js may be capturing mouse events before they bubble. Try:
- Using `{ capture: true }` when adding event listeners
- Adding listeners to the xterm viewport element directly

### 3. Alternative DOM Query Approach
Instead of using `e.target.closest()`, query all matching spans:
```typescript
const spans = containerRef.current?.querySelectorAll('.xterm-underline-1');
// Check if click coordinates fall within any span's bounding rect
```

### 4. Consider xterm.js registerDecoration API
This is a newer API that might work better for interactive elements:
```typescript
const marker = terminal.registerMarker(0);
const decoration = terminal.registerDecoration({ marker });
decoration.element?.addEventListener('click', handler);
```

### 5. Fallback: Custom Terminal UI
If xterm.js continues to block click detection, consider:
- Building a simpler React-based terminal component
- Using a different terminal library (react-terminal-ui, etc.)
- Keeping xterm for input only, render output in custom elements

## Debugging Commands

```bash
# Start dev server with hot reload
npm run dev

# Open browser dev tools
# Console tab → check for our debug logs
# Elements tab → inspect the underlined span elements
```

## Key Questions to Answer
1. Is `handleClick` being called when clicking on terminal?
2. What does `e.target` return - the span, a parent, or the canvas?
3. Are class names `xterm-underline-1` and `xterm-fg-6` present?
4. Is the click position within the visible terminal area?
