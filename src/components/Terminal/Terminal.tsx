import { useEffect, useRef, useCallback } from 'react';
import { Terminal as XTerm, ITerminalOptions } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { executeCommand, commands } from './commands';
import { getConnilefleurArt } from './ansi';
import { Project } from '../../types/projects';
import { ViewerState, CommandAction, GameHandler } from '../../types/terminal';
import { theme } from '../../config/theme';

interface TerminalProps {
  projects: Project[];
  currentViewer: ViewerState | null;
  onAction: (action: CommandAction) => void;
  onGameStateChange?: (hasGame: boolean, gameId?: string) => void;
}

const PROMPT = '\x1b[32mvisitor\x1b[0m@\x1b[34mportfolio\x1b[0m:~$ ';

// Map display text -> command to execute (allows different display vs execution)
const clickableCommands = new Map<string, string>();
// Map display text -> URL for external links
const clickableLinks = new Map<string, string>();
// Track disabled command text (for re-render persistence)
const disabledCommands = new Set<string>();

// Parse [cmd:xxx] or [cmd:display|command] patterns and return display text
// [cmd:help] -> displays "help", executes "help"
// [cmd:example-project|project example-project] -> displays "example-project", executes "project example-project"
// Also parse [link:url|text] and [mailto:email|text] for external links
function parseClickableCommands(text: string): string {
  // Parse external links: [link:url|text] or [mailto:email|text]
  text = text.replace(/\[(link|mailto):([^\|]+)\|([^\]]+)\]/g, (_match, type, urlOrEmail, displayText) => {
    let url: string;
    if (type === 'mailto') {
      url = `mailto:${urlOrEmail}`;
    } else {
      url = urlOrEmail;
    }
    
    // Register this link as clickable
    clickableLinks.set(displayText, url);
    // Style: cyan + underline
    return `\x1b[36m\x1b[4m${displayText}\x1b[0m`;
  });
  
  // Parse commands: [cmd:xxx] or [cmd:display|command]
  text = text.replace(/\[cmd:([^\]]+)\]/g, (_match, content) => {
    let displayText: string;
    let command: string;
    
    if (content.includes('|')) {
      // Format: display|command
      const parts = content.split('|');
      displayText = parts[0];
      command = parts[1];
    } else {
      // Format: command (display same as command)
      displayText = content;
      command = content;
    }
    
    // Register this command as clickable
    clickableCommands.set(displayText, command);
    // Style: cyan + underline
    return `\x1b[36m\x1b[4m${displayText}\x1b[0m`;
  });
  
  return text;
}

// Apply disabled styling to an element
function applyDisabledStyle(el: HTMLElement) {
  el.style.setProperty('text-decoration', 'none', 'important');
  el.style.setProperty('color', 'inherit', 'important');
  el.style.setProperty('cursor', 'text', 'important');
}

export function Terminal({ projects, currentViewer, onAction, onGameStateChange }: TerminalProps) {
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
  const scrollPositionBeforeGameRef = useRef<number>(0);

  const writePrompt = useCallback(() => {
    const terminal = terminalRef.current;
    if (terminal) {
      // Clear current line and write prompt to avoid duplication
      terminal.write('\x1b[2K\r' + PROMPT);
    }
  }, []);

  // Helper function to display logo and welcome message
  const displayLogoAndWelcome = useCallback((isInitial: boolean = false) => {
    const terminal = terminalRef.current;
    if (!terminal) return;

    // Prevent duplicate initial display
    if (isInitial && initialLogoDisplayedRef.current) {
      return;
    }
    if (isInitial) {
      initialLogoDisplayedRef.current = true;
    }

    // Ensure terminal is fitted before getting cols
    // Use requestAnimationFrame on mobile to ensure terminal is fully rendered
    const displayLogo = () => {
      const fitAddon = fitAddonRef.current;
      if (fitAddon) {
        try {
          fitAddon.fit();
        } catch (e) {
          console.warn('FitAddon error in displayLogoAndWelcome:', e);
        }
      }

      const currentTerminal = terminalRef.current;
      if (!currentTerminal) return;

      const logo = getConnilefleurArt(currentTerminal.cols);
      const logoLines = logo.split('\n');
      logoLines.forEach((line) => {
        currentTerminal.writeln(line);
      });
      currentTerminal.writeln('');

      // Welcome message with clickable commands
      const openLine = parseClickableCommands("  Type or click [cmd:open] to browse projects.");
      currentTerminal.writeln(openLine);
      const helpLine = parseClickableCommands("  Type or click [cmd:help] for more commands.");
      currentTerminal.writeln(helpLine);
      currentTerminal.writeln('');
      writePrompt();
    };

    // On mobile, use requestAnimationFrame to ensure terminal is fully rendered
    if (isInitial && typeof window !== 'undefined' && window.innerWidth < 768) {
      requestAnimationFrame(() => {
        requestAnimationFrame(displayLogo); // Double RAF for better timing
      });
    } else {
      displayLogo();
    }
  }, [writePrompt]);

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
      // Clear the game output from visible screen
      terminal.write('\x1b[2J\x1b[H'); // Clear screen and move to top
      
      // Restore scroll position to show history that was visible before game started
      const savedScroll = scrollPositionBeforeGameRef.current;
      const currentScroll = terminal.buffer.active.baseY;
      const scrollDiff = savedScroll - currentScroll;
      
      if (scrollDiff !== 0) {
        // Scroll to restore the previous view
        terminal.scrollLines(scrollDiff);
      }
      
      clickableCommands.clear();
      clickableLinks.clear();
      disabledCommands.clear();
      // Show prompt - command is already in history from before game started
      writePrompt();
    }
    // Notify parent that game is no longer active
    if (onGameStateChange) {
      onGameStateChange(false);
    }
  }, [writePrompt, onGameStateChange]);

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
        clickableCommands.clear();
        clickableLinks.clear();
        disabledCommands.clear();
        // Just clear terminal, don't show logo - logo only appears on initial page load
        writePrompt();
      }
      return false;
    }
    
    // Mark current clickable commands as disabled (for persistence across re-renders)
    clickableCommands.forEach((_cmd, displayText) => {
      disabledCommands.add(displayText);
    });
    
    // Remove styling from old clickable commands using inline styles
    if (container) {
      const oldLinks = container.querySelectorAll('[class*="xterm-underline"]');
      oldLinks.forEach(el => {
        applyDisabledStyle(el as HTMLElement);
      });
    }
    
    // Clear previous clickable commands and links so only the latest output is clickable
    clickableCommands.clear();
    clickableLinks.clear();
    
    if (resolvedResult.output && terminal) {
      const lines = resolvedResult.output.split('\n');
      lines.forEach((line) => {
        const display = parseClickableCommands(line);
        terminal.writeln(display);
      });
    }
    
    if (resolvedResult.action) {
      // Handle game start action
      if (resolvedResult.action.type === 'start-game') {
        const terminal = terminalRef.current;
        if (terminal) {
          // Save scroll position before clearing (so we can restore it on exit)
          // baseY is the scroll position - higher values mean scrolled up more
          scrollPositionBeforeGameRef.current = terminal.buffer.active.baseY;
          // Clear only the visible screen for the game, keep scrollback history
          terminal.write('\x1b[2J\x1b[H'); // Clear screen and move to top
          
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

      const options: ITerminalOptions = {
        theme: {
          background: theme.terminal.background,
          foreground: theme.terminal.foreground,
          cursor: theme.terminal.cursor,
          cursorAccent: theme.terminal.cursorAccent,
          selectionBackground: theme.terminal.selectionBackground,
          black: theme.terminal.black,
          red: theme.terminal.red,
          green: theme.terminal.green,
          yellow: theme.terminal.yellow,
          blue: theme.terminal.blue,
          magenta: theme.terminal.magenta,
          cyan: theme.terminal.cyan,
          white: theme.terminal.white,
          brightBlack: theme.terminal.brightBlack,
          brightRed: theme.terminal.brightRed,
          brightGreen: theme.terminal.brightGreen,
          brightYellow: theme.terminal.brightYellow,
          brightBlue: theme.terminal.brightBlue,
          brightMagenta: theme.terminal.brightMagenta,
          brightCyan: theme.terminal.brightCyan,
          brightWhite: theme.terminal.brightWhite,
        },
        fontFamily: "'Doto', sans-serif",
        fontSize: window.innerWidth < 768 ? 16 : 14,
        lineHeight: window.innerWidth < 768 ? 1.2 : 1.2,
        cursorBlink: true,
        cursorStyle: 'block',
        scrollback: 1000,
        allowProposedApi: true,
      };

      const terminal = new XTerm(options);
      const fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);

      terminal.open(container);
      
      // Ensure background is set immediately on all xterm elements
      const xtermElement = container.querySelector('.xterm') as HTMLElement;
      if (xtermElement) {
        xtermElement.style.backgroundColor = theme.terminal.background;
      }
      const viewport = container.querySelector('.xterm-viewport') as HTMLElement;
      if (viewport) {
        viewport.style.backgroundColor = theme.terminal.background;
      }
      const screen = container.querySelector('.xterm-screen') as HTMLElement;
      if (screen) {
        screen.style.backgroundColor = theme.terminal.background;
      }
      
      terminalRef.current = terminal;
      fitAddonRef.current = fitAddon;
      
      // Expose terminal reference globally for ANSI art width calculation
      (window as any).__terminalRef = terminal;

      // Fit terminal first, then display logo with correct dimensions
      // This ensures terminal.cols is accurate before generating the logo
      setTimeout(() => {
        // Display logo and welcome message (isInitial=true to prevent duplicates)
        displayLogoAndWelcome(true);
      }, 50);

      // Handle resize
      const handleResize = () => {
        try {
          fitAddon.fit();
        } catch (e) {
          console.warn('FitAddon resize error:', e);
        }
      };
      window.addEventListener('resize', handleResize);

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
          
          // Check for command
          if (text && clickableCommands.has(text)) {
            const command = clickableCommands.get(text)!;
            e.preventDefault();
            e.stopPropagation();
            setTimeout(() => {
              injectCommandRef.current(command);
            }, 0);
            return;
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
          
          // Check for command
          if (text && clickableCommands.has(text)) {
            const command = clickableCommands.get(text)!;
            e.preventDefault();
            e.stopPropagation();
            setTimeout(() => {
              injectCommandRef.current(command);
            }, 0);
            return;
          }
        }
      };
      
      // Also handle touch events for mobile
      // Use touchend instead of touchstart to avoid conflicts with scrolling/selection
      let touchStartTime = 0;
      let touchStartTarget: HTMLElement | null = null;
      let touchStartPos: { x: number; y: number } | null = null;
      
      const handleTouchStart = (e: TouchEvent) => {
        const target = e.target as HTMLElement;
        
        // Only handle if within the terminal container
        if (!container.contains(target)) {
          return;
        }
        
        // Store touch start info
        touchStartTime = Date.now();
        touchStartTarget = target;
        const touch = e.touches[0];
        if (touch) {
          touchStartPos = { x: touch.clientX, y: touch.clientY };
        }
      };
      
      const handleTouchEnd = (e: TouchEvent) => {
        const target = e.target as HTMLElement;
        
        // Only handle if within the terminal container
        if (!container.contains(target)) {
          touchStartTime = 0;
          touchStartTarget = null;
          touchStartPos = null;
          return;
        }
        
        // Check if this was a quick tap (not a long press or drag)
        const touchDuration = Date.now() - touchStartTime;
        const touch = e.changedTouches[0];
        
        // Calculate movement distance
        let moved = false;
        if (touchStartPos && touch) {
          const dx = Math.abs(touch.clientX - touchStartPos.x);
          const dy = Math.abs(touch.clientY - touchStartPos.y);
          moved = dx > 10 || dy > 10; // More than 10px movement = drag
        }
        
        // Only trigger if it was a quick tap (< 300ms), same target, and minimal movement
        if (touchDuration < 300 && touchDuration > 0 && touchStartTarget === target && !moved) {
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
              touchStartTime = 0;
              touchStartTarget = null;
              touchStartPos = null;
              return;
            }
            
            // Check for command
            if (text && clickableCommands.has(text)) {
              const command = clickableCommands.get(text)!;
              e.preventDefault();
              e.stopPropagation();
              setTimeout(() => {
                injectCommandRef.current(command);
              }, 10);
              touchStartTime = 0;
              touchStartTarget = null;
              touchStartPos = null;
              return;
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
              touchStartTime = 0;
              touchStartTarget = null;
              touchStartPos = null;
              return;
            }
          }
        }
        
        touchStartTime = 0;
        touchStartTarget = null;
        touchStartPos = null;
      };

      // Use capture phase (true) to intercept events before xterm.js can stop them
      document.addEventListener('mousedown', handleMouseDown, true);
      document.addEventListener('touchstart', handleTouchStart, { passive: true, capture: true });
      document.addEventListener('touchend', handleTouchEnd, { passive: false, capture: true });

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
                // If this text is in disabledCommands and NOT in current clickableCommands, disable it
                if (text && disabledCommands.has(text) && !clickableCommands.has(text)) {
                  applyDisabledStyle(el as HTMLElement);
                }
              });
            }
          });
        });
      });
      
      observer.observe(container, { childList: true, subtree: true });

      (container as HTMLDivElement & { _cleanup?: () => void })._cleanup = () => {
        window.removeEventListener('resize', handleResize);
        document.removeEventListener('mousedown', handleMouseDown, true);
        document.removeEventListener('touchstart', handleTouchStart, true);
        document.removeEventListener('touchend', handleTouchEnd, true);
        observer.disconnect();
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
  }, [writePrompt, displayLogoAndWelcome]);


  // Handle keyboard input
  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;

    // Global keyboard handler for game mode (catches events from mobile controls and desktop)
    // This needs to be on window to catch all keys, especially arrow keys
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (gameHandlerRef.current) {
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
