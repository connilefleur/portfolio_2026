import { useEffect, useRef, useCallback } from 'react';
import { Terminal as XTerm, ITerminalOptions } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { executeCommand, commands } from './commands';
import { Project } from '../../types/projects';
import { ViewerState, CommandAction } from '../../types/terminal';

interface TerminalProps {
  projects: Project[];
  currentViewer: ViewerState | null;
  onAction: (action: CommandAction) => void;
}

const PROMPT = '\x1b[32mvisitor\x1b[0m@\x1b[34mportfolio\x1b[0m:~$ ';

// Store valid clickable commands
const clickableCommands = new Set<string>();

// Parse [cmd:xxx] patterns and return display text
function parseClickableCommands(text: string): string {
  return text.replace(/\[cmd:([^\]]+)\]/g, (_match, cmd) => {
    // Register this command as clickable
    clickableCommands.add(cmd);
    // Style: cyan + underline
    return `\x1b[36m\x1b[4m${cmd}\x1b[0m`;
  });
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

  // Initialize terminal
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
          background: '#0d0d0d',
          foreground: '#e0e0e0',
          cursor: '#4ec9b0',
          cursorAccent: '#0d0d0d',
          selectionBackground: '#264f78',
          black: '#0d0d0d',
          red: '#f44747',
          green: '#4ec9b0',
          yellow: '#dcdcaa',
          blue: '#569cd6',
          magenta: '#c586c0',
          cyan: '#9cdcfe',
          white: '#e0e0e0',
          brightBlack: '#666666',
          brightRed: '#f44747',
          brightGreen: '#4ec9b0',
          brightYellow: '#dcdcaa',
          brightBlue: '#569cd6',
          brightMagenta: '#c586c0',
          brightCyan: '#9cdcfe',
          brightWhite: '#ffffff',
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
      
      setTimeout(() => {
        try {
          fitAddon.fit();
        } catch (e) {
          console.warn('FitAddon error:', e);
        }
      }, 50);

      terminalRef.current = terminal;
      fitAddonRef.current = fitAddon;

      // Welcome message
      terminal.writeln('');
      terminal.writeln("  Welcome to the Portfolio Terminal");
      terminal.writeln("  Type 'help' to see available commands, or click commands in output.");
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

      // Click handler - detect clicks on underlined text (commands)
      const handleClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        
        // Check if clicked element or parent has xterm-underline class
        const underlinedElement = target.closest('.xterm-underline-1, .xterm-underline-2, .xterm-underline-3, [class*="xterm-underline"]');
        
        if (underlinedElement) {
          const text = underlinedElement.textContent?.trim();
          console.log('Clicked underlined text:', text);
          
          if (text && clickableCommands.has(text)) {
            console.log('Executing command:', text);
            e.preventDefault();
            e.stopPropagation();
            injectCommandRef.current(text);
            return;
          }
        }
        
        // Also check if we clicked directly on a span with cyan color (xterm-fg-6 or similar)
        if (target.tagName === 'SPAN' && target.classList.toString().includes('xterm-fg-')) {
          const text = target.textContent?.trim();
          console.log('Clicked colored span:', text);
          
          if (text && clickableCommands.has(text)) {
            console.log('Executing command:', text);
            e.preventDefault();
            e.stopPropagation();
            injectCommandRef.current(text);
            return;
          }
        }
      };

      // Mousemove handler to show pointer cursor on clickable text
      const handleMouseMove = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        
        const underlinedElement = target.closest('.xterm-underline-1, .xterm-underline-2, .xterm-underline-3, [class*="xterm-underline"]');
        
        let isOverLink = false;
        
        if (underlinedElement) {
          const text = underlinedElement.textContent?.trim();
          if (text && clickableCommands.has(text)) {
            isOverLink = true;
          }
        }
        
        // Also check colored spans
        if (!isOverLink && target.tagName === 'SPAN' && target.classList.toString().includes('xterm-fg-')) {
          const text = target.textContent?.trim();
          if (text && clickableCommands.has(text)) {
            isOverLink = true;
          }
        }

        container.style.cursor = isOverLink ? 'pointer' : '';
      };

      container.addEventListener('click', handleClick);
      container.addEventListener('mousemove', handleMouseMove);

      (container as HTMLDivElement & { _cleanup?: () => void })._cleanup = () => {
        window.removeEventListener('resize', handleResize);
        container.removeEventListener('click', handleClick);
        container.removeEventListener('mousemove', handleMouseMove);
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
