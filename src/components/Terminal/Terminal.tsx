import { useEffect, useRef, useCallback } from 'react';
import { Terminal as XTerm, ITerminalOptions } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { executeCommand, commands } from './commands';
import { getConnilefleurArt } from './ansi';
import { Project } from '../../types/projects';
import { ViewerState, CommandAction } from '../../types/terminal';
import { theme } from '../../config/theme';

interface TerminalProps {
  projects: Project[];
  currentViewer: ViewerState | null;
  onAction: (action: CommandAction) => void;
}

const PROMPT = '\x1b[32mvisitor\x1b[0m@\x1b[34mportfolio\x1b[0m:~$ ';

// Map display text -> command to execute (allows different display vs execution)
const clickableCommands = new Map<string, string>();
// Track disabled command text (for re-render persistence)
const disabledCommands = new Set<string>();

// Parse [cmd:xxx] or [cmd:display|command] patterns and return display text
// [cmd:help] -> displays "help", executes "help"
// [cmd:example-project|project example-project] -> displays "example-project", executes "project example-project"
function parseClickableCommands(text: string): string {
  return text.replace(/\[cmd:([^\]]+)\]/g, (_match, content) => {
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
}

// Apply disabled styling to an element
function applyDisabledStyle(el: HTMLElement) {
  el.style.setProperty('text-decoration', 'none', 'important');
  el.style.setProperty('color', 'inherit', 'important');
  el.style.setProperty('cursor', 'text', 'important');
}

export function Terminal({ projects, currentViewer, onAction }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const inputBufferRef = useRef('');
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);
  const injectCommandRef = useRef<(cmd: string) => void>(() => {});

  const writePrompt = useCallback(() => {
    terminalRef.current?.write(PROMPT);
  }, []);

  const handleCommand = useCallback((input: string) => {
    const result = executeCommand(input, { projects, currentViewer });
    const terminal = terminalRef.current;
    const container = containerRef.current;
    
    // Handle clear command specially - reset to initial state
    if (result.action?.type === 'clear') {
      if (terminal) {
        terminal.reset();
        clickableCommands.clear();
        disabledCommands.clear();
        // Show logo and welcome message again
        const logo = getConnilefleurArt();
        const logoLines = logo.split('\n');
        logoLines.forEach((line) => {
          terminal.writeln(line);
        });
        terminal.writeln('');
        const openLine = parseClickableCommands("  Type or click [cmd:open] to browse projects.");
        terminal.writeln(openLine);
        const helpLine = parseClickableCommands("  Type or click [cmd:help] for more commands.");
        terminal.writeln(helpLine);
        terminal.writeln('');
      }
      return;
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
    
    // Clear previous clickable commands so only the latest output is clickable
    clickableCommands.clear();
    
    if (result.output && terminal) {
      const lines = result.output.split('\n');
      lines.forEach((line) => {
        const display = parseClickableCommands(line);
        terminal.writeln(display);
      });
    }
    
    if (result.action) {
      onAction(result.action);
    }
  }, [projects, currentViewer, onAction]);

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
        fontFamily: "'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace",
        fontSize: 14,
        lineHeight: 1.2,
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
      
      setTimeout(() => {
        try {
          fitAddon.fit();
        } catch (e) {
          console.warn('FitAddon error:', e);
        }
      }, 50);

      terminalRef.current = terminal;
      fitAddonRef.current = fitAddon;

      // Display logo first - write each line separately for proper formatting
      const logo = getConnilefleurArt();
      const logoLines = logo.split('\n');
      logoLines.forEach((line) => {
        terminal.writeln(line);
      });
      terminal.writeln('');

      // Welcome message with clickable commands
      const openLine = parseClickableCommands("  Type or click [cmd:open] to browse projects.");
      terminal.writeln(openLine);
      const helpLine = parseClickableCommands("  Type or click [cmd:help] for more commands.");
      terminal.writeln(helpLine);
      terminal.writeln('');
      writePrompt();

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
        
        // Check if clicked element has xterm-underline class (indicates a clickable command)
        if (target.classList.toString().includes('xterm-underline')) {
          const text = target.textContent?.trim();
          
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

      // Use capture phase (true) to intercept events before xterm.js can stop them
      document.addEventListener('mousedown', handleMouseDown, true);

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
        observer.disconnect();
        terminal.dispose();
        terminalRef.current = null;
      };
    };

    initTerminal();

    return () => {
      const cleanup = (container as HTMLDivElement & { _cleanup?: () => void })._cleanup;
      if (cleanup) cleanup();
    };
  }, [writePrompt]);


  // Handle keyboard input
  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;

    const disposable = terminal.onKey(({ key, domEvent }) => {
      const ev = domEvent;
      
      if (ev.key === 'Tab') {
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
        terminal.writeln('');
        const input = inputBufferRef.current.trim();
        
        if (input) {
          historyRef.current.push(input);
          historyIndexRef.current = historyRef.current.length;
          handleCommand(input);
        }
        
        inputBufferRef.current = '';
        writePrompt();
        return;
      }

      if (ev.key === 'Backspace') {
        if (inputBufferRef.current.length > 0) {
          inputBufferRef.current = inputBufferRef.current.slice(0, -1);
          terminal.write('\b \b');
        }
        return;
      }

      if (ev.key === 'ArrowUp') {
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
        inputBufferRef.current += key;
        terminal.write(key);
      }
    });

    return () => disposable.dispose();
  }, [handleCommand, writePrompt]);

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
    
    handleCommand(cmd);
    writePrompt();
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
