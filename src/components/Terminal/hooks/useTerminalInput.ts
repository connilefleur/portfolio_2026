/**
 * Terminal Input Hook
 * 
 * Handles keyboard input, command history, and tab completion
 */

import { useRef, useCallback } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { commands } from '../commands';

export function useTerminalInput(
  terminalRef: React.MutableRefObject<XTerm | null>,
  writePrompt: () => void,
  handleCommand: (input: string) => Promise<boolean>,
  isGameActive: () => boolean
) {
  const inputBufferRef = useRef('');
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);

  const handleKeyInput = useCallback((key: string, ev: KeyboardEvent) => {
    const terminal = terminalRef.current;
    if (!terminal) return;

    // Check if we're in game mode
    if (isGameActive()) {
      // Game mode is handled separately
      return;
    }

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
  }, [terminalRef, writePrompt, handleCommand, isGameActive]);

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
  }, [terminalRef, writePrompt, handleCommand]);

  return {
    inputBufferRef,
    historyRef,
    historyIndexRef,
    handleKeyInput,
    injectCommand,
  };
}
