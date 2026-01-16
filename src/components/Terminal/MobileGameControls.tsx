import { useState, useEffect } from 'react';

interface MobileGameControlsProps {
  isActive: boolean;
  gameId?: string; // 'snake' or 'tetris' to show different controls
  onKeyPress: (key: string) => void;
}

// Detect if device is mobile/tablet
function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const isSmallScreen = window.innerWidth < 1024;
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  return hasTouch && (isSmallScreen || isMobileUA);
}

export function MobileGameControls({ isActive, gameId, onKeyPress }: MobileGameControlsProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(isMobileDevice());
    const handleResize = () => {
      setIsMobile(isMobileDevice());
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!isActive || !isMobile) {
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
