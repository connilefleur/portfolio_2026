import { CommandHandler } from '../../../../types/terminal';
import { GameHandler } from '../../../../types/terminal';
import { Terminal } from '@xterm/xterm';
import { calculateGameDimensions } from './shared/types';

interface Tetromino {
  shape: number[][];
  color: string;
}

const TETROMINOES: Record<string, Tetromino> = {
  I: { shape: [[1,1,1,1]], color: '\x1b[36m' }, // Cyan
  O: { shape: [[1,1],[1,1]], color: '\x1b[33m' }, // Yellow
  T: { shape: [[0,1,0],[1,1,1]], color: '\x1b[35m' }, // Magenta
  S: { shape: [[0,1,1],[1,1,0]], color: '\x1b[32m' }, // Green
  Z: { shape: [[1,1,0],[0,1,1]], color: '\x1b[31m' }, // Red
  J: { shape: [[1,0,0],[1,1,1]], color: '\x1b[34m' }, // Blue
  L: { shape: [[0,0,1],[1,1,1]], color: '\x1b[37m' }  // White
};

class TetrisGame {
  private terminal: Terminal | null = null;
  private initialized: boolean = false;
  private board: number[][] = [];
  private currentPiece: { shape: number[][]; x: number; y: number; color: string } | null = null;
  private nextPiece: Tetromino | null = null;
  private score: number = 0;
  private level: number = 1;
  private lines: number = 0;
  private gameOver: boolean = false;
  private paused: boolean = true; // Start paused, wait for user to click/tap
  private width: number = 10;
  private height: number = 20;
  private lastFallTime: number = 0;
  private fallInterval: number = 800; // Start slow for lightweight performance

  private lastOrientation: 'portrait' | 'landscape' | null = null;

  init(terminal: Terminal) {
    this.terminal = terminal;
    
    // Check if orientation changed (need to recalculate dimensions)
    const currentOrientation = typeof window !== 'undefined' && window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
    const orientationChanged = this.lastOrientation !== null && this.lastOrientation !== currentOrientation;
    
    // Responsive width: use full width on mobile, max 10 on desktop
    const cols = terminal.cols || 80;
    const rows = terminal.rows || 24;
    const isMobile = window.innerWidth < 768;
    const dimensions = calculateGameDimensions(cols, rows, isMobile, 10);
    
    // If dimensions changed or orientation changed, reset game
    if (!this.initialized || orientationChanged || this.width !== dimensions.width || this.height !== dimensions.height) {
      this.width = dimensions.width;
      this.height = dimensions.height;
      this.lastOrientation = currentOrientation;
      
      // Reset game state if already initialized (orientation change)
      if (this.initialized && orientationChanged) {
        this.restart();
        return;
      }
      
      // Initialize board (only on initial init)
      if (!this.initialized) {
        this.board = [];
        for (let y = 0; y < this.height; y++) {
          this.board[y] = [];
          for (let x = 0; x < this.width; x++) {
            this.board[y][x] = 0;
          }
        }
        
        this.score = 0;
        this.level = 1;
        this.lines = 0;
        this.gameOver = false;
        this.paused = true; // Start paused
        this.lastFallTime = Date.now();
        this.fallInterval = 800;
        
        // Spawn first pieces
        this.nextPiece = this.getRandomPiece();
        this.spawnPiece();
        this.initialized = true;
      }
    }
  }

  getRandomPiece(): Tetromino {
    const keys = Object.keys(TETROMINOES);
    const key = keys[Math.floor(Math.random() * keys.length)];
    return TETROMINOES[key];
  }

  spawnPiece() {
    if (!this.nextPiece) return;
    
    const piece = this.nextPiece;
    this.currentPiece = {
      shape: piece.shape.map(row => [...row]),
      x: Math.floor(this.width / 2) - Math.floor(piece.shape[0].length / 2),
      y: 0,
      color: piece.color
    };
    
    this.nextPiece = this.getRandomPiece();
    
    // Check game over
    if (this.checkCollision(this.currentPiece.x, this.currentPiece.y, this.currentPiece.shape)) {
      this.gameOver = true;
    }
  }

  checkCollision(x: number, y: number, shape: number[][]): boolean {
    for (let py = 0; py < shape.length; py++) {
      for (let px = 0; px < shape[py].length; px++) {
        if (shape[py][px]) {
          const nx = x + px;
          const ny = y + py;
          
          if (nx < 0 || nx >= this.width || ny >= this.height) {
            return true;
          }
          
          if (ny >= 0 && this.board[ny][nx]) {
            return true;
          }
        }
      }
    }
    return false;
  }

  rotatePiece(): number[][] {
    if (!this.currentPiece) return [];
    
    const shape = this.currentPiece.shape;
    const rotated: number[][] = [];
    const rows = shape.length;
    const cols = shape[0].length;
    
    for (let x = 0; x < cols; x++) {
      rotated[x] = [];
      for (let y = rows - 1; y >= 0; y--) {
        rotated[x][rows - 1 - y] = shape[y][x];
      }
    }
    
    return rotated;
  }

  lockPiece() {
    if (!this.currentPiece) return;
    
    for (let py = 0; py < this.currentPiece.shape.length; py++) {
      for (let px = 0; px < this.currentPiece.shape[py].length; px++) {
        if (this.currentPiece.shape[py][px]) {
          const nx = this.currentPiece.x + px;
          const ny = this.currentPiece.y + py;
          
          if (ny >= 0) {
            this.board[ny][nx] = 1; // Lock piece
          }
        }
      }
    }
    
    this.clearLines();
    this.spawnPiece();
  }

  clearLines() {
    let linesCleared = 0;
    
    for (let y = this.height - 1; y >= 0; y--) {
      if (this.board[y].every(cell => cell === 1)) {
        this.board.splice(y, 1);
        this.board.unshift(new Array(this.width).fill(0));
        linesCleared++;
        y++; // Check same line again
      }
    }
    
    if (linesCleared > 0) {
      this.lines += linesCleared;
      this.score += linesCleared * 100 * this.level;
      this.level = Math.floor(this.lines / 10) + 1;
      this.fallInterval = Math.max(200, 800 - (this.level - 1) * 50);
    }
  }

  togglePause() {
    if (this.gameOver) {
      this.restart();
      return;
    }
    this.paused = !this.paused;
  }

  restart() {
    if (!this.terminal) return;
    
    // Reset game state
    const cols = this.terminal.cols || 80;
    const rows = this.terminal.rows || 24;
    const isMobile = window.innerWidth < 768;
    const dimensions = calculateGameDimensions(cols, rows, isMobile, 10);
    this.width = dimensions.width;
    this.height = dimensions.height;
    this.height = Math.max(10, Math.min(20, rows - 5));
    
    // Initialize board
    this.board = [];
    for (let y = 0; y < this.height; y++) {
      this.board[y] = [];
      for (let x = 0; x < this.width; x++) {
        this.board[y][x] = 0;
      }
    }
    
    this.score = 0;
    this.level = 1;
    this.lines = 0;
    this.gameOver = false;
    this.paused = true; // Start paused
    this.lastFallTime = Date.now();
    this.fallInterval = 800;
    
    // Spawn first pieces
    this.nextPiece = this.getRandomPiece();
    this.spawnPiece();
  }

  handleKey(_key: string, ev: KeyboardEvent) {
    if (this.gameOver || !this.currentPiece) return;
    
    // Allow pause toggle even when paused
    if (ev.key === 'p' || ev.key === 'P') {
      this.togglePause();
      return;
    }
    
    if (this.paused) return;

    switch (ev.key) {
      case 'ArrowLeft':
        if (!this.checkCollision(this.currentPiece.x - 1, this.currentPiece.y, this.currentPiece.shape)) {
          this.currentPiece.x--;
        }
        break;
      case 'ArrowRight':
        if (!this.checkCollision(this.currentPiece.x + 1, this.currentPiece.y, this.currentPiece.shape)) {
          this.currentPiece.x++;
        }
        break;
      case 'ArrowDown':
        if (!this.checkCollision(this.currentPiece.x, this.currentPiece.y + 1, this.currentPiece.shape)) {
          this.currentPiece.y++;
        }
        break;
      case 'ArrowUp':
      case ' ':
        const rotated = this.rotatePiece();
        if (!this.checkCollision(this.currentPiece.x, this.currentPiece.y, rotated)) {
          this.currentPiece.shape = rotated;
        }
        break;
    }
  }

  update() {
    if (this.gameOver || this.paused || !this.currentPiece) return;

    const now = Date.now();
    if (now - this.lastFallTime >= this.fallInterval) {
      if (!this.checkCollision(this.currentPiece.x, this.currentPiece.y + 1, this.currentPiece.shape)) {
        this.currentPiece.y++;
      } else {
        this.lockPiece();
      }
      this.lastFallTime = now;
    }
  }

  render() {
    if (!this.terminal) return;
    
    // Ensure game is initialized
    if (!this.initialized) {
      this.init(this.terminal);
    }

    this.update();

    // Clear screen and move cursor to top
    this.terminal.write('\x1b[2J\x1b[H');

    // Header
    this.terminal.writeln('\x1b[1;35mTETRIS\x1b[0m  ' + 
      `Score: \x1b[1;33m${this.score}\x1b[0m  ` +
      `Level: \x1b[1;36m${this.level}\x1b[0m  ` +
      `Lines: \x1b[1;32m${this.lines}\x1b[0m`);
    this.terminal.writeln('');

    // Create display board
    const display: string[][] = [];
    for (let y = 0; y < this.height; y++) {
      display[y] = [];
      for (let x = 0; x < this.width; x++) {
        display[y][x] = this.board[y][x] ? '\x1b[37m##\x1b[0m' : '  ';
      }
    }

    // Draw current piece
    if (this.currentPiece) {
      for (let py = 0; py < this.currentPiece.shape.length; py++) {
        for (let px = 0; px < this.currentPiece.shape[py].length; px++) {
          if (this.currentPiece.shape[py][px]) {
            const nx = this.currentPiece.x + px;
            const ny = this.currentPiece.y + py;
            if (ny >= 0 && ny < this.height && nx >= 0 && nx < this.width) {
              display[ny][nx] = this.currentPiece.color + '##\x1b[0m';
            }
          }
        }
      }
    }

    // Top border
    let topBorder = '\x1b[90m+';
    for (let x = 0; x < this.width * 2; x++) {
      topBorder += '-';
    }
    topBorder += '+\x1b[0m';
    this.terminal.writeln(topBorder);

    // Draw board line by line
    for (let y = 0; y < this.height; y++) {
      let line = '\x1b[90m|\x1b[0m';
      for (let x = 0; x < this.width; x++) {
        line += display[y][x];
      }
      line += '\x1b[90m|\x1b[0m';
      this.terminal.writeln(line);
    }

    // Bottom border
    let bottomBorder = '\x1b[90m+';
    for (let x = 0; x < this.width * 2; x++) {
      bottomBorder += '-';
    }
    bottomBorder += '+\x1b[0m';
    this.terminal.writeln(bottomBorder);

    // Next piece preview
    if (this.nextPiece) {
      this.terminal.writeln('');
      let nextLine = 'Next: ';
      for (let py = 0; py < this.nextPiece.shape.length; py++) {
        for (let px = 0; px < this.nextPiece.shape[py].length; px++) {
          if (this.nextPiece.shape[py][px]) {
            nextLine += this.nextPiece.color + '##\x1b[0m';
          } else {
            nextLine += '  ';
          }
        }
        if (py < this.nextPiece.shape.length - 1) {
          this.terminal.writeln(nextLine);
          nextLine = '      ';
        }
      }
      this.terminal.writeln(nextLine);
    }

    // Game status
    this.terminal.writeln('');
    if (this.gameOver) {
      this.terminal.writeln('\x1b[1;31mGAME OVER!\x1b[0m');
      this.terminal.writeln('Final Score: \x1b[1;33m' + this.score + '\x1b[0m');
      this.terminal.writeln('Click/Tap to play again. Press ESC to exit.');
    } else if (this.paused) {
      this.terminal.writeln('\x1b[1;33mPAUSED\x1b[0m - Click/Tap to start or resume');
      this.terminal.writeln('Controls: <- -> v (move), ^/Space (rotate), P (pause), ESC (exit)');
    } else {
      this.terminal.writeln('Controls: <- -> v (move), ^/Space (rotate), Click/Tap or P (pause), ESC (exit)');
    }
  }

  exit() {
    // Cleanup if needed
  }
}

export const tetris: CommandHandler = {
  name: 'tetris',
  description: 'Play Tetris game',
  execute: () => {
    const game = new TetrisGame();
    
    const handler: GameHandler = {
      onKey: (key: string, ev: KeyboardEvent) => {
        game.handleKey(key, ev);
      },
      onExit: () => {
        game.exit();
      },
      onClick: () => {
        game.togglePause();
      },
      render: (terminal: Terminal) => {
        game.init(terminal);
        game.render();
      }
    };

    return {
      output: '',
      action: {
        type: 'start-game',
        gameId: 'tetris',
        gameHandler: handler
      }
    };
  }
};
