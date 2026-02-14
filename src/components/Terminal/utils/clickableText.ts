/**
 * Resolve full clickable text from a click target in xterm.
 * xterm often renders each character in its own span, so we must collect the
 * contiguous underlined run in the row that contains the clicked element.
 */

/**
 * Get the full text of the clickable run that contains the given element.
 * Returns the combined text of all underlined nodes in the same contiguous run
 * (same link/command) in the row, or the element's own text if we can't determine the row.
 */
export function getFullClickableText(clickedElement: HTMLElement): string {
  const underlined = clickedElement.classList.toString().includes('xterm-underline')
    ? clickedElement
    : clickedElement.closest('[class*="xterm-underline"]') as HTMLElement | null;
  if (!underlined) return '';

  const row = underlined.closest('.xterm-rows > *');
  if (!row) {
    return (underlined.textContent ?? '').trim();
  }

  const allUnderlined = Array.from(row.querySelectorAll('[class*="xterm-underline"]')) as HTMLElement[];
  if (allUnderlined.length === 0) return (underlined.textContent ?? '').trim();

  // Sort by document position
  allUnderlined.sort((a, b) => {
    const pos = a.compareDocumentPosition(b);
    if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
    if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
    return 0;
  });

  // Group into contiguous runs: consecutive elements that are adjacent (no gap)
  const runs: HTMLElement[][] = [];
  let currentRun: HTMLElement[] = [allUnderlined[0]];

  for (let i = 1; i < allUnderlined.length; i++) {
    const prev = allUnderlined[i - 1];
    const curr = allUnderlined[i];
    const prevRect = prev.getBoundingClientRect();
    const currRect = curr.getBoundingClientRect();
    const sameLine = Math.abs(prevRect.top - currRect.top) < 2;
    const adjacentX = currRect.left - (prevRect.left + prevRect.width) < 4;
    if (sameLine && adjacentX) {
      currentRun.push(curr);
    } else {
      runs.push(currentRun);
      currentRun = [curr];
    }
  }
  runs.push(currentRun);

  const runContainingTarget = runs.find(run => run.some(el => el.contains(underlined) || el === underlined));
  if (!runContainingTarget) return (underlined.textContent ?? '').trim();

  return runContainingTarget.map(el => el.textContent ?? '').join('').trim();
}
