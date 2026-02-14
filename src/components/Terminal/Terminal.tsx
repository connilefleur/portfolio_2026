import { useEffect, useRef, useCallback } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { executeCommand, commands } from './commands';
import { parseClickableCommands, clickableCommands, disabledCommands, clearClickableCommands, clearActiveClickableCommands, persistentCommandInstances, applyDisabledStyle } from './utils/clickableCommands';
import { displayLogoAndWelcome } from './utils/displayLogo';
import { getTerminalOptions } from './utils/terminalOptions';
import { useTerminalEvents } from './hooks/useTerminalEvents';
import { PROMPT } from './constants';
import { Project } from '../../types/projects';
import { ViewerState, CommandAction, GameHandler } from '../../types/terminal';
import { useThemeContext } from '../../contexts/ThemeContext';

interface TerminalProps {
  projects: Project[];
  currentViewer: ViewerState | null;
  onAction: (action: CommandAction) => void;
  onGameStateChange?: (hasGame: boolean, gameId?: string) => void;
}

export function Terminal({ projects, currentViewer, onAction, onGameStateChange }: TerminalProps) {
  const { currentTheme } = useThemeContext();
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const inputBufferRef = useRef('');
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);
  const injectCommandRef = useRef<(cmd: string) => void>(() => {});
  const gameHandlerRef = useRef<GameHandler | null>(null);
  const gameLoopRef = useRef<number | null>(null);
  const currentGameIdRef = useRef<string | null>(null);
  const initialLogoDisplayedRef = useRef(false);
  const limitedHistoryRef = useRef(false); // Track limited history mode
  const initialLineCountRef = useRef(0); // Track number of initial lines (logo + welcome)
  const lastOutputLineCountRef = useRef(0); // Track number of lines in last output

  const writePrompt = useCallback(() => {
    const terminal = terminalRef.current;
    if (terminal) {
      // Clear current line and write prompt to avoid duplication
      terminal.write('\x1b[2K\r' + PROMPT);
      // Ensure terminal can receive input
      terminal.focus();
    }
  }, []);

  // Helper function to write lines (normal mode - no special handling)
  const writeLine = useCallback((line: string) => {
    const terminal = terminalRef.current;
    if (!terminal) return;
    terminal.writeln(line);
  }, []);

  // Helper function to display logo and welcome message
  const displayLogoAndWelcomeCallback = useCallback((isInitial: boolean = false) => {
    const terminal = terminalRef.current;
    if (!terminal) return;

    // Prevent duplicate initial display
    if (isInitial && initialLogoDisplayedRef.current) {
      return;
    }
    if (isInitial) {
      initialLogoDisplayedRef.current = true;
    }

    // Use requestAnimationFrame on mobile to ensure terminal is fully rendered
    const displayLogo = () => {
      displayLogoAndWelcome({
        terminal,
        fitAddon: fitAddonRef.current,
        container: containerRef.current,
        writeLine,
        writePrompt,
        initialLineCountRef,
      });
    };

    // On mobile, use requestAnimationFrame to ensure terminal is fully rendered
    if (isInitial && typeof window !== 'undefined' && window.innerWidth < 768) {
      requestAnimationFrame(() => {
        requestAnimationFrame(displayLogo); // Double RAF for better timing
      });
    } else {
      displayLogo();
    }
  }, [writePrompt, writeLine]);

  const refreshTerminal = useCallback(() => {
    const terminal = terminalRef.current;
    if (terminal && !gameHandlerRef.current) {
      // Only refresh if not in game mode
      // Clear any duplicate prompts by clearing the last line and rewriting
      terminal.write('\x1b[2K\r');
      writePrompt();
    }
  }, [writePrompt]);

  // Expose refreshTerminal function globally
  useEffect(() => {
    (window as unknown as { refreshTerminal?: () => void }).refreshTerminal = refreshTerminal;
    return () => {
      delete (window as unknown as { refreshTerminal?: () => void }).refreshTerminal;
    };
  }, [refreshTerminal]);

  // Expose toggleLimitedHistory function globally
  useEffect(() => {
    const toggleLimitedHistory = () => {
      limitedHistoryRef.current = !limitedHistoryRef.current;
      return limitedHistoryRef.current;
    };
    (window as unknown as { toggleLimitedHistory?: () => boolean }).toggleLimitedHistory = toggleLimitedHistory;
    return () => {
      delete (window as unknown as { toggleLimitedHistory?: () => boolean }).toggleLimitedHistory;
    };
  }, []);

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
      
      clearClickableCommands();
      
      // Small delay to ensure terminal is ready after reset
      setTimeout(() => {
        // Show logo and welcome message (same as initial page load)
        displayLogoAndWelcomeCallback(false);
      }, 10);
    }
    // Notify parent that game is no longer active
    if (onGameStateChange) {
      onGameStateChange(false);
    }
  }, [displayLogoAndWelcomeCallback, onGameStateChange]);

  // Expose exitGame function globally for ESC button
  useEffect(() => {
    (window as unknown as { exitGame?: () => void }).exitGame = exitGame;
    return () => {
      delete (window as unknown as { exitGame?: () => void }).exitGame;
    };
  }, [exitGame]);

  const handleCommand = useCallback(async (input: string): Promise<boolean> => {
    const result = executeCommand(input, { projects, currentViewer });
    const terminal = terminalRef.current;
    const container = containerRef.current;
    
    // Handle async commands
    const resolvedResult = result instanceof Promise ? await result : result;
    
    // Handle clear command specially - just clear terminal, don't show logo
    if (resolvedResult.action?.type === 'clear') {
      if (terminal) {
        terminal.reset();
        clearClickableCommands();
        // Just clear terminal, don't show logo - logo only appears on initial page load
        writePrompt();
      }
      return false;
    }
    
    // Mark current clickable commands as disabled (for persistence across re-renders)
    // But exclude persistent command instances (help, open from initial welcome) from being disabled
    clickableCommands.forEach((_cmd, displayText) => {
      // Only disable if not a persistent command instance (from initial welcome)
      const isPersistent = persistentCommandInstances.has(`${displayText.toLowerCase()}:initial`);
      if (!isPersistent) {
        disabledCommands.add(displayText);
      }
    });
    
    // Remove styling from old clickable commands using inline styles
    // But skip persistent command instances (from initial welcome)
    if (container && terminal) {
      const oldLinks = container.querySelectorAll('[class*="xterm-underline"]');
      oldLinks.forEach(el => {
        const text = el.textContent?.trim();
        if (text) {
          // Check if this element is in the initial lines area
          // We need to find which line this element is on
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
    
    // Clear previous clickable commands and links so only the latest output is clickable
    // Note: We don't clear disabledCommands here, only the active ones
    clearActiveClickableCommands();
    
    if (resolvedResult.output && terminal) {
      // If limited history is active, clear previous output and command line (but keep initial lines)
      if (limitedHistoryRef.current) {
        const buffer = terminal.buffer.active;
        const totalLines = buffer.length;
        const outputStartLine = initialLineCountRef.current; // Line where output starts (after initial lines)
        
        // Calculate how many lines to clear: previous output + previous command line + previous prompt
        // We need to clear everything from outputStartLine to the current cursor position
        const linesToClear = totalLines - outputStartLine;
        
        if (linesToClear > 0) {
          // Move cursor to start of output area
          terminal.write(`\x1b[${outputStartLine + 1};1H`); // Move to line (1-indexed, +1 because ANSI is 1-based)
          
          // Clear all lines from output start to end
          for (let i = 0; i < linesToClear; i++) {
            terminal.write('\x1b[2K'); // Clear entire line
            if (i < linesToClear - 1) {
              terminal.write('\x1b[1B'); // Move down (except on last iteration)
            }
          }
          
          // Move cursor back to where we should write (after initial lines)
          terminal.write(`\x1b[${outputStartLine + 1};1H`);
        }
      }
      
      const lines = resolvedResult.output.split('\n');
      lines.forEach((line) => {
        const display = parseClickableCommands(line);
        writeLine(display);
      });
      
      // Add empty line after output for visual spacing (only if there was output)
      if (terminal && resolvedResult.output.trim().length > 0) {
        terminal.writeln('');
      }
      
      // Track number of output lines for next time
      lastOutputLineCountRef.current = lines.length;
    }
    
    if (resolvedResult.action) {
      // Handle game start action
      if (resolvedResult.action.type === 'start-game') {
        const terminal = terminalRef.current;
        if (terminal) {
          // Clear the terminal for the game
          terminal.clear();
          
          gameHandlerRef.current = resolvedResult.action.gameHandler;
          currentGameIdRef.current = resolvedResult.action.gameId;
          
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
            onGameStateChange(true, resolvedResult.action.gameId);
          }
        }
        return true; // Return true to indicate game was started
      }
      onAction(resolvedResult.action);
    }
    return false;
  }, [projects, currentViewer, onAction, onGameStateChange]);

  // Initialize terminal (only once, but with current theme)
  useEffect(() => {
    if (!containerRef.current || terminalRef.current) return;

    const container = containerRef.current;
    
    const initTerminal = () => {
      if (container.clientWidth === 0 || container.clientHeight === 0) {
        requestAnimationFrame(initTerminal);
        return;
      }

      const terminal = new XTerm(getTerminalOptions(currentTheme));
      const fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);

      // Open terminal and wait for it to be ready
      terminal.open(container);
      
      // Ensure terminal can receive focus for input
      terminal.focus();
      
      // Wait for terminal to be fully initialized before accessing dimensions
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        // Ensure background is set immediately on all xterm elements
        const xtermElement = container.querySelector('.xterm') as HTMLElement;
        if (xtermElement) {
          xtermElement.style.backgroundColor = currentTheme.terminal.background;
        }
        const viewport = container.querySelector('.xterm-viewport') as HTMLElement;
        if (viewport) {
          viewport.style.backgroundColor = currentTheme.terminal.background;
        }
        const screen = container.querySelector('.xterm-screen') as HTMLElement;
        if (screen) {
          screen.style.backgroundColor = currentTheme.terminal.background;
        }
        
        terminalRef.current = terminal;
        fitAddonRef.current = fitAddon;
        
        // Expose terminal reference globally for ANSI art width calculation
        window.__terminalRef = terminal;

        // Fit once so terminal has dimensions and DOM rows for measurement
        setTimeout(() => {
          try {
            if (terminalRef.current && fitAddonRef.current) {
              fitAddonRef.current.fit();
            }
          } catch (e) {
            console.warn('FitAddon initial fit error:', e);
          }
        }, 0);
      });

      // Show logo only when container size is stable (avoids wrong cols on small/first paint)
      let lastWidth = 0;
      let lastHeight = 0;
      let stableCount = 0;
      let logoScheduled = false;
      const scheduleLogoOnce = () => {
        if (logoScheduled) return;
        logoScheduled = true;
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            try {
              if (fitAddonRef.current) fitAddonRef.current.fit();
            } catch {
              // ignore
            }
            displayLogoAndWelcomeCallback(true);
          });
        });
      };
      const resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry || !containerRef.current) return;
        const { width, height } = entry.contentRect;
        const w = Math.round(width);
        const h = Math.round(height);
        if (w <= 0 || h <= 0) return;
        if (w === lastWidth && h === lastHeight) {
          stableCount++;
          if (stableCount >= 2) scheduleLogoOnce();
        } else {
          lastWidth = w;
          lastHeight = h;
          stableCount = 0;
        }
      });
      resizeObserver.observe(container);
      // If size is already stable (e.g. no further layout), show logo after a short delay
      const fallbackLogo = setTimeout(() => {
        if (!logoScheduled) scheduleLogoOnce();
      }, 150);

      const handleResize = () => {
        try {
          fitAddon.fit();
        } catch (e) {
          console.warn('FitAddon resize error:', e);
        }
      };
      window.addEventListener('resize', handleResize);

      (container as HTMLDivElement & { _cleanup?: () => void })._cleanup = () => {
        clearTimeout(fallbackLogo);
        resizeObserver.disconnect();
        window.removeEventListener('resize', handleResize);
        delete window.__terminalRef;
        terminal.dispose();
        terminalRef.current = null;
      };
    };

    initTerminal();

    return () => {
      const cleanup = (container as HTMLDivElement & { _cleanup?: () => void })._cleanup;
      if (cleanup) cleanup();
      // Reset flag on cleanup
      initialLogoDisplayedRef.current = false;
    };
  }, [writePrompt, displayLogoAndWelcomeCallback, currentTheme]);

  const injectCommand = useCallback((cmd: string) => {
    const terminal = terminalRef.current;
    if (!terminal) return;
    
    terminal.write('\x1b[2K\r');
    writePrompt();
    terminal.write(cmd);
    terminal.writeln('');
    
    inputBufferRef.current = '';
    historyRef.current.push(cmd);
    historyIndexRef.current = historyRef.current.length;
    
    handleCommand(cmd).then((wasGame) => {
      if (!wasGame) {
        writePrompt();
      }
    });
  }, [writePrompt, handleCommand]);

  useEffect(() => {
    injectCommandRef.current = injectCommand;
  }, [injectCommand]);

  // Set up event handlers for clickable commands and game interactions
  useTerminalEvents({
    container: containerRef.current!,
    gameHandlerRef,
    injectCommand,
    initialLineCountRef,
  });


  // Handle keyboard input
  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;

    // Global keyboard handler for game mode (catches events from mobile controls and desktop)
    // This needs to be on window to catch all keys, especially arrow keys
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Only handle game keys if we're actually in game mode
      if (!gameHandlerRef.current) {
        return; // Let terminal handle all input when not in game mode
      }
      
      // ESC to exit game
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        exitGame();
        return;
      }
      // Pass arrow keys and space to game handler
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        if (gameHandlerRef.current.onKey) {
          gameHandlerRef.current.onKey(e.key, e);
        }
      }
    };

    // Use capture phase to catch keys before terminal can consume them
    window.addEventListener('keydown', handleGlobalKeyDown, true);

    const disposable = terminal.onKey(({ key, domEvent }) => {
      const ev = domEvent;
      
      // Check if we're in game mode
      if (gameHandlerRef.current) {
        // ESC to exit game
        if (ev.key === 'Escape') {
          exitGame();
          return;
        }
        // Pass key to game handler
        if (gameHandlerRef.current.onKey) {
          gameHandlerRef.current.onKey(key, ev);
        }
        return;
      }
      
      if (ev.key === 'Tab') {
        // Don't process Tab if we're in game mode
        if (gameHandlerRef.current) {
          return;
        }
        ev.preventDefault();
        const input = inputBufferRef.current;
        const matches = Object.keys(commands).filter(c => c.startsWith(input));
        
        if (matches.length === 1) {
          const completion = matches[0].slice(input.length);
          inputBufferRef.current += completion;
          terminal.write(completion);
        } else if (matches.length > 1) {
          terminal.writeln('');
          terminal.writeln(matches.join('  '));
          writePrompt();
          terminal.write(inputBufferRef.current);
        }
        return;
      }

      if (ev.key === 'Enter') {
        // Don't process Enter if we're in game mode
        if (gameHandlerRef.current) {
          return;
        }
        
        terminal.writeln('');
        const input = inputBufferRef.current.trim();
        
        if (input) {
          historyRef.current.push(input);
          historyIndexRef.current = historyRef.current.length;
          handleCommand(input).then((wasGame) => {
            // Don't write prompt if a game was started
            if (!wasGame) {
              inputBufferRef.current = '';
              writePrompt();
            } else {
              inputBufferRef.current = '';
            }
          });
        } else {
          inputBufferRef.current = '';
          writePrompt();
        }
        return;
      }

      if (ev.key === 'Backspace') {
        // Don't process Backspace if we're in game mode
        if (gameHandlerRef.current) {
          return;
        }
        if (inputBufferRef.current.length > 0) {
          inputBufferRef.current = inputBufferRef.current.slice(0, -1);
          terminal.write('\b \b');
        }
        return;
      }

      if (ev.key === 'ArrowUp') {
        // Don't process ArrowUp if we're in game mode
        if (gameHandlerRef.current) {
          return;
        }
        if (historyRef.current.length > 0 && historyIndexRef.current > 0) {
          historyIndexRef.current--;
          const cmd = historyRef.current[historyIndexRef.current];
          terminal.write('\x1b[2K\r');
          writePrompt();
          terminal.write(cmd);
          inputBufferRef.current = cmd;
        }
        return;
      }

      if (ev.key === 'ArrowDown') {
        // Don't process ArrowDown if we're in game mode
        if (gameHandlerRef.current) {
          return;
        }
        if (historyIndexRef.current < historyRef.current.length - 1) {
          historyIndexRef.current++;
          const cmd = historyRef.current[historyIndexRef.current];
          terminal.write('\x1b[2K\r');
          writePrompt();
          terminal.write(cmd);
          inputBufferRef.current = cmd;
        } else {
          historyIndexRef.current = historyRef.current.length;
          terminal.write('\x1b[2K\r');
          writePrompt();
          inputBufferRef.current = '';
        }
        return;
      }

      if (ev.ctrlKey && ev.key === 'c') {
        terminal.writeln('^C');
        inputBufferRef.current = '';
        writePrompt();
        return;
      }

      if (ev.ctrlKey && ev.key === 'l') {
        terminal.clear();
        writePrompt();
        return;
      }

      if (key.length === 1 && !ev.ctrlKey && !ev.altKey && !ev.metaKey) {
        // Don't capture input if we're in game mode
        if (gameHandlerRef.current) {
          return;
        }
        inputBufferRef.current += key;
        terminal.write(key);
      }
    });

    return () => {
      disposable.dispose();
      window.removeEventListener('keydown', handleGlobalKeyDown, true);
      // Clean up game loop on unmount
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
        gameLoopRef.current = null;
      }
    };
  }, [handleCommand, writePrompt, exitGame]);

  useEffect(() => {
    (window as unknown as { injectCommand?: (cmd: string) => void }).injectCommand = injectCommand;
    return () => {
      delete (window as unknown as { injectCommand?: (cmd: string) => void }).injectCommand;
    };
  }, [injectCommand]);

  return (
    <div 
      ref={containerRef} 
      className="terminal-container"
    />
  );
}
