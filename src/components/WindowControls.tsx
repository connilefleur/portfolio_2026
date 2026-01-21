import { useCallback } from 'react';

interface WindowControlsProps {
  onClose?: () => void;
  onMinimize?: () => void;
  onMaximize?: () => void;
  showMinimize?: boolean;
  showMaximize?: boolean;
}

/**
 * macOS-style Window Controls Component
 * 
 * Displays red, yellow, and green dots in the top-left corner
 * Similar to macOS window controls
 */
export function WindowControls({ 
  onClose, 
  onMinimize, 
  onMaximize,
  showMinimize = false,
  showMaximize = false 
}: WindowControlsProps) {
  const handleClose = useCallback(() => {
    if (onClose) {
      onClose();
    } else {
      // Default: trigger ESC key
      const escEvent = new KeyboardEvent('keydown', {
        key: 'Escape',
        code: 'Escape',
        keyCode: 27,
        which: 27,
        bubbles: true
      });
      window.dispatchEvent(escEvent);
    }
  }, [onClose]);

  const handleMinimize = useCallback(() => {
    if (onMinimize) {
      onMinimize();
    }
  }, [onMinimize]);

  const handleMaximize = useCallback(() => {
    if (onMaximize) {
      onMaximize();
    }
  }, [onMaximize]);

  return (
    <div className="window-controls">
      <button
        className="window-control window-control-close"
        onClick={handleClose}
        aria-label="Close"
        title="Close"
      >
        <span className="window-control-dot"></span>
      </button>
      {showMinimize && (
        <button
          className="window-control window-control-minimize"
          onClick={handleMinimize}
          aria-label="Minimize"
          title="Minimize"
        >
          <span className="window-control-dot"></span>
        </button>
      )}
      {showMaximize && (
        <button
          className="window-control window-control-maximize"
          onClick={handleMaximize}
          aria-label="Maximize"
          title="Maximize"
        >
          <span className="window-control-dot"></span>
        </button>
      )}
    </div>
  );
}
