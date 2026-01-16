# Project Status Summary

## Repository
**GitHub:** https://github.com/connilefleur/portfolio_2026

Always pull latest before working:
```bash
git pull origin main
```

Push changes after completing work:
```bash
git add . && git commit -m "message" && git push
```

---

## What's Working
1. ✅ Terminal renders and accepts input
2. ✅ Commands execute when typed (`help`, `open`, `contact`, `imprint`, etc.)
3. ✅ Command output displays correctly
4. ✅ Clickable commands in terminal output (cyan underlined text)
5. ✅ Clickable external links (email, Instagram) in terminal
6. ✅ Hint bar at bottom works (buttons execute commands)
7. ✅ ESC key closes overlays/viewers globally
8. ✅ ESC button in hint bar (desktop and mobile)
9. ✅ Responsive layout with text wrapping
10. ✅ Project viewer works for images/video/3D/image stacks
11. ✅ ANSI art generator with responsive wrapping
12. ✅ Terminal games (Snake, Tetris) with mobile controls
13. ✅ Command history with arrow keys
14. ✅ Tab completion
15. ✅ Build process works
16. ✅ Static deployment ready
17. ✅ Contact and imprint display in terminal (no overlays)
18. ✅ Logo and welcome message only on initial page load
19. ✅ Terminal history preserved when exiting games

## What's Not Working
1. ❌ Game exit doesn't properly restore terminal to pre-game state
   - Issue: When exiting a game with ESC, terminal should return to the state before game started
   - Current: Terminal either clears everything or leaves game output visible
   - See: `.debug-state/CURRENT_ISSUE.md`

---

## Files Modified
- `src/components/Terminal/Terminal.tsx` - Main terminal component
- `src/components/Terminal/commands/` - All command implementations
- `src/components/Terminal/HintBar.tsx` - ESC button handling
- `src/components/Viewer/` - Viewer components (no click-to-close)
- `src/utils/ansi/generator.ts` - ANSI art generation
- `src/styles/global.css` - Responsive styles

## Original Requirements (from Description.txt)
- Terminal-first UI
- Clickable commands for ease of use
- Projects open via terminal into viewers
- Static deployment

## Last Updated
January 2025
