/**
 * Terminal Event Handlers Hook
 * 
 * Handles mouse and touch events for clickable commands and game interactions
 */

import { useEffect, useRef } from 'react';
import { GameHandler } from '../../../types/terminal';
import { clickableCommands, clickableLinks, applyDisabledStyle, disabledCommands, persistentCommandInstances, persistentCommandMappings } from '../utils/clickableCommands';

export interface UseTerminalEventsParams {
  container: HTMLElement;
  gameHandlerRef: React.MutableRefObject<GameHandler | null>;
  injectCommand: (cmd: string) => void;
  initialLineCountRef: React.MutableRefObject<number>;
}

export function useTerminalEvents({
  container,
  gameHandlerRef,
  injectCommand,
  initialLineCountRef,
}: UseTerminalEventsParams) {
  // Touch state for mobile
  const touchStartTimeRef = useRef(0);
  const touchStartTargetRef = useRef<HTMLElement | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!container) return;
    // Click handler - use mousedown + capture phase to intercept before xterm.js stops propagation
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      // Only handle if within the terminal container
      if (!container.contains(target)) {
        return;
      }
      
      // If a game is active, handle click/tap to pause/resume
      if (gameHandlerRef.current && gameHandlerRef.current.onClick) {
        // Don't trigger if clicking on a clickable command
        const isClickableCommand = target.classList.toString().includes('xterm-underline') || 
                                    target.closest('[class*="xterm-underline"]');
        if (!isClickableCommand) {
          e.preventDefault();
          e.stopPropagation();
          // Small delay to ensure game state is updated before next render
          setTimeout(() => {
            if (gameHandlerRef.current && gameHandlerRef.current.onClick) {
              gameHandlerRef.current.onClick();
            }
          }, 0);
          return;
        }
      }
      
      // Check if clicked element has xterm-underline class (indicates a clickable command or link)
      if (target.classList.toString().includes('xterm-underline')) {
        const text = target.textContent?.trim();
        
        // Check for external link first
        if (text && clickableLinks.has(text)) {
          const url = clickableLinks.get(text)!;
          e.preventDefault();
          e.stopPropagation();
          window.open(url, '_blank', 'noopener,noreferrer');
          return;
        }
        
        // Check for command (including persistent commands)
        if (text) {
          let command: string | undefined = clickableCommands.get(text);
          // Fallback: check persistent command mappings if not in active commands
          if (!command && persistentCommandMappings.has(text)) {
            command = persistentCommandMappings.get(text);
          }
          if (command) {
            e.preventDefault();
            e.stopPropagation();
            setTimeout(() => {
              injectCommand(command!);
            }, 0);
            return;
          }
        }
      }
      
      // Also check parent for underline class
      const underlinedParent = target.closest('[class*="xterm-underline"]') as HTMLElement;
      if (underlinedParent) {
        const text = underlinedParent.textContent?.trim();
        
        // Check for external link first
        if (text && clickableLinks.has(text)) {
          const url = clickableLinks.get(text)!;
          e.preventDefault();
          e.stopPropagation();
          window.open(url, '_blank', 'noopener,noreferrer');
          return;
        }
        
        // Check for command (including persistent commands)
        if (text) {
          let command: string | undefined = clickableCommands.get(text);
          // Fallback: check persistent command mappings if not in active commands
          if (!command && persistentCommandMappings.has(text)) {
            command = persistentCommandMappings.get(text);
          }
          if (command) {
            e.preventDefault();
            e.stopPropagation();
            setTimeout(() => {
              injectCommand(command!);
            }, 0);
            return;
          }
        }
      }
    };
    
    // Handle touch events for mobile
    // Use touchend instead of touchstart to avoid conflicts with scrolling/selection
    const handleTouchStart = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      
      // Only handle if within the terminal container
      if (!container.contains(target)) {
        return;
      }
      
      // Store touch start info
      touchStartTimeRef.current = Date.now();
      touchStartTargetRef.current = target;
      const touch = e.touches[0];
      if (touch) {
        touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
      }
    };
    
    const handleTouchEnd = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      
      // Only handle if within the terminal container
      if (!container.contains(target)) {
        touchStartTimeRef.current = 0;
        touchStartTargetRef.current = null;
        touchStartPosRef.current = null;
        return;
      }
      
      // Check if this was a quick tap (not a long press or drag)
      const touchDuration = Date.now() - touchStartTimeRef.current;
      const touch = e.changedTouches[0];
      
      // Calculate movement distance
      let moved = false;
      if (touchStartPosRef.current && touch) {
        const dx = Math.abs(touch.clientX - touchStartPosRef.current.x);
        const dy = Math.abs(touch.clientY - touchStartPosRef.current.y);
        moved = dx > 10 || dy > 10; // More than 10px movement = drag
      }
      
      // Only trigger if it was a quick tap (< 300ms), same target, and minimal movement
      if (touchDuration < 300 && touchDuration > 0 && touchStartTargetRef.current === target && !moved) {
        // Check if tapping on a clickable link or command
        const isClickable = target.classList.toString().includes('xterm-underline') || 
                            target.closest('[class*="xterm-underline"]');
        
        if (isClickable) {
          const underlinedElement = target.closest('[class*="xterm-underline"]') as HTMLElement || target;
          const text = underlinedElement.textContent?.trim();
          
          // Check for external link first
          if (text && clickableLinks.has(text)) {
            const url = clickableLinks.get(text)!;
            e.preventDefault();
            e.stopPropagation();
            window.open(url, '_blank', 'noopener,noreferrer');
            touchStartTimeRef.current = 0;
            touchStartTargetRef.current = null;
            touchStartPosRef.current = null;
            return;
          }
          
            // Check for command (including persistent commands)
            if (text) {
              let command: string | undefined = clickableCommands.get(text);
              // Fallback: check persistent command mappings if not in active commands
              if (!command && persistentCommandMappings.has(text)) {
                command = persistentCommandMappings.get(text);
              }
              if (command) {
                e.preventDefault();
                e.stopPropagation();
                setTimeout(() => {
                  injectCommand(command!);
                }, 10);
                touchStartTimeRef.current = 0;
                touchStartTargetRef.current = null;
                touchStartPosRef.current = null;
                return;
              }
            }
        }
        
        // If a game is active, handle tap to pause/resume
        if (gameHandlerRef.current && gameHandlerRef.current.onClick) {
          // Don't trigger if tapping on a clickable command or link
          if (!isClickable) {
            e.preventDefault();
            e.stopPropagation();
            // Small delay to ensure game state is updated before next render
            setTimeout(() => {
              if (gameHandlerRef.current && gameHandlerRef.current.onClick) {
                gameHandlerRef.current.onClick();
              }
            }, 10);
            touchStartTimeRef.current = 0;
            touchStartTargetRef.current = null;
            touchStartPosRef.current = null;
            return;
          }
        }
      }
      
      touchStartTimeRef.current = 0;
      touchStartTargetRef.current = null;
      touchStartPosRef.current = null;
    };

    // MutationObserver to handle xterm re-renders - disable old commands when they reappear
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) {
            // Check if this node or its children have underline class
            const underlinedElements = node.classList?.toString().includes('xterm-underline') 
              ? [node] 
              : Array.from(node.querySelectorAll('[class*="xterm-underline"]'));
            
            underlinedElements.forEach((el) => {
              const text = el.textContent?.trim();
              if (text && disabledCommands.has(text) && !clickableCommands.has(text)) {
                // Check if this element is in the initial lines area
                let isInInitialLines = false;
                try {
                  // Try to find the parent row element
                  let rowElement = el.parentElement;
                  let rowIndex = -1;
                  
                  // Find the row index by traversing up to find xterm rows
                  while (rowElement && rowIndex === -1) {
                    if (rowElement.classList.contains('xterm-rows')) {
                      // Found the rows container, now find the index
                      const rows = Array.from(rowElement.children);
                      rowIndex = rows.findIndex(row => row.contains(el));
                      break;
                    }
                    rowElement = rowElement.parentElement;
                  }
                  
                  // If we found the row index, check if it's within initial lines
                  if (rowIndex >= 0 && rowIndex < initialLineCountRef.current) {
                    isInInitialLines = true;
                  }
                } catch (e) {
                  // If we can't determine the line, fall back to checking persistent instances
                  isInInitialLines = persistentCommandInstances.has(`${text.toLowerCase()}:initial`);
                }
                
                // Only disable if not in initial lines
                if (!isInInitialLines) {
                  applyDisabledStyle(el as HTMLElement);
                }
              }
            });
          }
        });
      });
    });
    
    observer.observe(container, { childList: true, subtree: true });

    // Use capture phase (true) to intercept events before xterm.js can stop them
    document.addEventListener('mousedown', handleMouseDown, true);
    document.addEventListener('touchstart', handleTouchStart, { passive: true, capture: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: false, capture: true });

    return () => {
      document.removeEventListener('mousedown', handleMouseDown, true);
      document.removeEventListener('touchstart', handleTouchStart, true);
      document.removeEventListener('touchend', handleTouchEnd, true);
      observer.disconnect();
    };
  }, [container, gameHandlerRef, injectCommand, initialLineCountRef]);
}
