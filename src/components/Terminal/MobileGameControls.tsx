import { useState, useEffect } from 'react';

interface MobileGameControlsProps {
  isActive: boolean;
  gameId?: string; // 'snake' or 'tetris' to show different controls
  onKeyPress: (key: string) => void;
}

// Detect if device has touch capability
// Simply check for touch support - if device has touch, show touch controls
// If not, user can use keyboard
function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  // Check for touch support - most reliable method
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

export function MobileGameControls({ isActive, gameId, onKeyPress }: MobileGameControlsProps) {
  const [hasTouch, setHasTouch] = useState(false);

  useEffect(() => {
    // Check touch capability once on mount
    // Touch capability doesn't change on resize, so we don't need to re-check
    setHasTouch(isTouchDevice());
  }, []);

  if (!isActive || !hasTouch) {
    return null;
  }

  const handleKey = (key: string) => {
    // Create a synthetic keyboard event
    let keyCode = 0;
    let code = '';
    
    if (key === 'ArrowUp') {
      keyCode = 38;
      code = 'ArrowUp';
    } else if (key === 'ArrowDown') {
      keyCode = 40;
      code = 'ArrowDown';
    } else if (key === 'ArrowLeft') {
      keyCode = 37;
      code = 'ArrowLeft';
    } else if (key === 'ArrowRight') {
      keyCode = 39;
      code = 'ArrowRight';
    } else if (key === ' ') {
      keyCode = 32;
      code = 'Space';
    }
    
    const event = new KeyboardEvent('keydown', {
      key: key,
      code: code,
      keyCode: keyCode,
      which: keyCode,
      bubbles: true,
      cancelable: true
    });
    
    // Dispatch to window so terminal can catch it
    window.dispatchEvent(event);
    
    // Also call the callback directly
    onKeyPress(key);
  };

  return (
    <div className="mobile-game-controls">
      <div className="mobile-controls-grid">
        <button 
          className="mobile-control-btn mobile-control-up"
          onTouchStart={(e) => {
            e.preventDefault();
            handleKey('ArrowUp');
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            handleKey('ArrowUp');
          }}
          aria-label="Up"
        >
          ↑
        </button>
        <div className="mobile-controls-row">
          <button 
            className="mobile-control-btn mobile-control-left"
            onTouchStart={(e) => {
              e.preventDefault();
              handleKey('ArrowLeft');
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              handleKey('ArrowLeft');
            }}
            aria-label="Left"
          >
            ←
          </button>
          <button 
            className="mobile-control-btn mobile-control-down"
            onTouchStart={(e) => {
              e.preventDefault();
              handleKey('ArrowDown');
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              handleKey('ArrowDown');
            }}
            aria-label="Down"
          >
            ↓
          </button>
          <button 
            className="mobile-control-btn mobile-control-right"
            onTouchStart={(e) => {
              e.preventDefault();
              handleKey('ArrowRight');
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              handleKey('ArrowRight');
            }}
            aria-label="Right"
          >
            →
          </button>
        </div>
        {gameId === 'tetris' && (
          <button 
            className="mobile-control-btn mobile-control-rotate"
            onTouchStart={(e) => {
              e.preventDefault();
              handleKey(' ');
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              handleKey(' ');
            }}
            aria-label="Rotate"
          >
            ↻
          </button>
        )}
      </div>
    </div>
  );
}
