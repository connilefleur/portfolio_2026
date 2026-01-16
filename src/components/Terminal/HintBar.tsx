import { useState, useEffect } from 'react';

interface HintBarProps {
  hasViewer: boolean;
}

// Detect if device is mobile/tablet (no physical keyboard)
function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  
  // Check for touch device
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  
  // Check screen size (tablets and phones)
  const isSmallScreen = window.innerWidth < 1024;
  
  // Check user agent for mobile devices
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  return hasTouch && (isSmallScreen || isMobileUA);
}

export function HintBar({ hasViewer }: HintBarProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(isMobileDevice());
    
    const handleResize = () => {
      setIsMobile(isMobileDevice());
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
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
          {!isMobile ? (
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
