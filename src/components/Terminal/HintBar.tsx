import { useState, useEffect } from 'react';

interface HintBarProps {
  hasViewer: boolean;
}

// Detect if device has touch capability
// If device has touch, show button UI. If not, show text hint with button.
function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  // Check for touch support - most reliable method
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

export function HintBar({ hasViewer }: HintBarProps) {
  const [hasTouch, setHasTouch] = useState(false);

  useEffect(() => {
    // Check touch capability once on mount
    // Touch capability doesn't change on resize, so we don't need to re-check
    setHasTouch(isTouchDevice());
  }, []);

  const inject = (cmd: string) => {
    const fn = (window as unknown as { injectCommand?: (cmd: string) => void }).injectCommand;
    if (fn) fn(cmd);
  };

  const handleEsc = (e: React.MouseEvent<HTMLButtonElement>) => {
    // Remove focus to prevent outline
    e.currentTarget.blur();
    
    // Exit game first if active
    const exitGame = (window as unknown as { exitGame?: () => void }).exitGame;
    if (exitGame) {
      exitGame();
    }
    
    // Trigger ESC key event to close overlays/viewers
    const escEvent = new KeyboardEvent('keydown', {
      key: 'Escape',
      code: 'Escape',
      keyCode: 27,
      which: 27,
      bubbles: true
    });
    window.dispatchEvent(escEvent);
  };

  return (
    <div className="hint-bar">
      <button onClick={() => inject('help')}>
        <code>help</code>
      </button>
      <button onClick={() => inject('contact')}>
        <code>contact</code>
      </button>
      <button onClick={() => inject('imprint')}>
        <code>imprint</code>
      </button>
      {hasViewer && (
        <>
          {!hasTouch ? (
            <span className="hint-esc">
              Press{' '}
              <button className="hint-esc-button" onClick={handleEsc}>
                <code>ESC</code>
              </button>
              {' '}to close
            </span>
          ) : (
            <button className="hint-esc-button" onClick={handleEsc}>
              <code>ESC</code>
            </button>
          )}
        </>
      )}
    </div>
  );
}
