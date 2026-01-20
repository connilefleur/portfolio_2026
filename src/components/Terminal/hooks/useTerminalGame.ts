/**
 * Terminal Game Hook
 * 
 * Manages game state and lifecycle in the terminal
 */

import { useRef, useCallback } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { GameHandler } from '../../../types/terminal';

export function useTerminalGame(
  terminalRef: React.MutableRefObject<XTerm | null>,
  onGameStateChange?: (hasGame: boolean, gameId?: string) => void
) {
  const gameHandlerRef = useRef<GameHandler | null>(null);
  const gameLoopRef = useRef<number | null>(null);
  const currentGameIdRef = useRef<string | null>(null);

  const exitGame = useCallback(() => {
    if (gameLoopRef.current) {
      clearInterval(gameLoopRef.current);
      gameLoopRef.current = null;
    }
    if (gameHandlerRef.current?.onExit) {
      gameHandlerRef.current.onExit();
    }
    gameHandlerRef.current = null;
    currentGameIdRef.current = null;
    const terminal = terminalRef.current;
    if (terminal) {
      // Reset terminal to initial state (like on page load)
      terminal.reset();
      
      // Small delay to ensure terminal is ready after reset
      setTimeout(() => {
        // Show logo and welcome message (same as initial page load)
        // This will be called from the parent component
      }, 10);
    }
    // Notify parent that game is no longer active
    if (onGameStateChange) {
      onGameStateChange(false);
    }
  }, [terminalRef, onGameStateChange]);

  const startGame = useCallback((gameHandler: GameHandler, gameId: string) => {
    const terminal = terminalRef.current;
    if (terminal) {
      // Clear the terminal for the game
      terminal.clear();
      
      gameHandlerRef.current = gameHandler;
      currentGameIdRef.current = gameId;
      
      // Use setTimeout to ensure terminal is ready and dimensions are available
      setTimeout(() => {
        const currentTerminal = terminalRef.current;
        if (currentTerminal && gameHandlerRef.current) {
          // Initialize game by calling render (which calls init)
          if (gameHandlerRef.current.render) {
            gameHandlerRef.current.render(currentTerminal);
          }
          
          // Start game loop (throttled to ~15 FPS for lightweight performance)
          const gameLoop = () => {
            if (gameHandlerRef.current && currentTerminal && terminalRef.current === currentTerminal) {
              gameHandlerRef.current.render(currentTerminal);
            }
          };
          gameLoopRef.current = window.setInterval(gameLoop, 66); // ~15 FPS
        }
      }, 50);
      
      // Notify parent that game is active
      if (onGameStateChange) {
        onGameStateChange(true, gameId);
      }
    }
  }, [terminalRef, onGameStateChange]);

  return {
    gameHandlerRef,
    gameLoopRef,
    currentGameIdRef,
    exitGame,
    startGame,
    isGameActive: () => gameHandlerRef.current !== null,
  };
}
