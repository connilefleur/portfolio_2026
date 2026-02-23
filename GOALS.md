# Goals

## Project slide scroll (achieved)

When viewing a project (e.g. after clicking "Project 1" from the landing page), the user can **pan/scroll vertically** to move from one project slide to the next.

### Requirements

| Input | Expected behavior |
|-------|-------------------|
| **Mouse wheel** | Scroll up/down moves to previous/next project slide |
| **Touch swipe** | Swipe up/down pans to previous/next project slide |
| **Arrow keys** | Works via `scrollIntoView` |

### UX

- One project per viewport height (full-screen slides)
- Snap to each slide (`scroll-snap-type: y mandatory`)
- Smooth transitions
- Swipe-back (horizontal) remains functional

### Solution

**Project tiles are rendered outside the absolute-position grid.** In project mode, `CanvasEngine` renders a separate scroll container (via portal) with only project tiles. They use `position: relative` and stack vertically. This separation from the grid’s `position: absolute` layout is what makes scrolling work.
