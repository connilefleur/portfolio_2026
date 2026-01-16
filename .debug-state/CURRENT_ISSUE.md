# Current Issue: Game Exit Terminal State Restoration

## Problem Summary
When exiting a game with ESC (keyboard or button), the terminal should return to the state it was in before the game was launched. Currently, the terminal either:
1. Clears everything (like the `clear` command), losing all history
2. Leaves game output visible, requiring manual scrolling to see previous history

## Expected Behavior
1. User runs a game command (e.g., `snake` or `tetris`)
2. Game starts and takes over the terminal screen
3. User presses ESC to exit the game
4. Terminal should:
   - Remove all game output from the visible screen
   - Restore the terminal to show the history that was visible before the game started
   - Display a prompt ready for new input
   - Keep the game command in history (so user can use arrow keys to recall it)

## Current Implementation
- Game start: Saves scroll position (`scrollPositionBeforeGameRef.current = terminal.buffer.active.baseY`), then clears screen
- Game exit: Attempts to restore scroll position using `terminal.scrollLines()`, but this doesn't properly restore the previous state

## Technical Details
- Using xterm.js v5.5.0
- Terminal has scrollback buffer (1000 lines)
- `terminal.clear()` clears visible screen but keeps scrollback
- `terminal.buffer.active.baseY` tracks scroll position
- `terminal.scrollLines(delta)` scrolls the viewport

## Potential Solutions
1. Save terminal buffer content before game starts and restore it on exit
2. Use xterm.js buffer API to save/restore terminal state
3. Don't clear terminal when starting game, just render game over existing content
4. Use a different approach to hide/show game content without clearing

## Files Involved
- `src/components/Terminal/Terminal.tsx` - Game start/exit logic (lines ~256-290, ~172-199)
