import { CommandHandler } from '../../../../types/terminal';
import { GameHandler } from '../../../../types/terminal';
import { Terminal } from '@xterm/xterm';
import { Point, calculateGameDimensions } from './shared/types';

class SnakeGame {
  private terminal: Terminal | null = null;
  private initialized: boolean = false;
  private snake: Point[] = [];
  private food: Point = { x: 0, y: 0 };
  private direction: Point = { x: 1, y: 0 };
  private nextDirection: Point = { x: 1, y: 0 };
  private score: number = 0;
  private gameOver: boolean = false;
  private paused: boolean = true; // Start paused, wait for user to click/tap
  private width: number = 30;
  private height: number = 20;
  private lastFrameTime: number = 0;
  private frameInterval: number = 150; // ~6-7 FPS for lightweight performance

  private lastOrientation: 'portrait' | 'landscape' | null = null;

  init(terminal: Terminal) {
    this.terminal = terminal;
    
    // Check if orientation changed (need to recalculate dimensions)
    const currentOrientation = typeof window !== 'undefined' && window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
    const orientationChanged = this.lastOrientation !== null && this.lastOrientation !== currentOrientation;
    
    // Responsive width: use full width on mobile, max 30 on desktop
    const cols = terminal.cols || 80;
    const rows = terminal.rows || 24;
    const isMobile = window.innerWidth < 768;
    const dimensions = calculateGameDimensions(cols, rows, isMobile, 30);
    
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
      
      // Start snake in center (only on initial init)
      if (!this.initialized) {
        const startX = Math.floor(this.width / 2);
        const startY = Math.floor(this.height / 2);
        this.snake = [
          { x: startX, y: startY },
          { x: startX - 1, y: startY },
          { x: startX - 2, y: startY }
        ];
        
        this.direction = { x: 1, y: 0 };
        this.nextDirection = { x: 1, y: 0 };
        this.score = 0;
        this.gameOver = false;
        this.spawnFood();
        this.lastFrameTime = Date.now();
        this.initialized = true;
      }
    }
  }

  spawnFood() {
    let attempts = 0;
    do {
      this.food = {
        x: Math.floor(Math.random() * this.width),
        y: Math.floor(Math.random() * this.height)
      };
      attempts++;
    } while (
      this.snake.some(seg => seg.x === this.food.x && seg.y === this.food.y) &&
      attempts < 100
    );
  }

  handleKey(_key: string, ev: KeyboardEvent) {
    if (this.gameOver) return;

    switch (ev.key) {
      case 'ArrowUp':
        if (this.direction.y === 0) {
          this.nextDirection = { x: 0, y: -1 };
        }
        break;
      case 'ArrowDown':
        if (this.direction.y === 0) {
          this.nextDirection = { x: 0, y: 1 };
        }
        break;
      case 'ArrowLeft':
        if (this.direction.x === 0) {
          this.nextDirection = { x: -1, y: 0 };
        }
        break;
      case 'ArrowRight':
        if (this.direction.x === 0) {
          this.nextDirection = { x: 1, y: 0 };
        }
        break;
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
    const dimensions = calculateGameDimensions(cols, rows, isMobile, 30);
    this.width = dimensions.width;
    this.height = dimensions.height;
    
    // Start snake in center
    const startX = Math.floor(this.width / 2);
    const startY = Math.floor(this.height / 2);
    this.snake = [
      { x: startX, y: startY },
      { x: startX - 1, y: startY },
      { x: startX - 2, y: startY }
    ];
    
    this.direction = { x: 1, y: 0 };
    this.nextDirection = { x: 1, y: 0 };
    this.score = 0;
    this.gameOver = false;
    this.paused = true; // Start paused
    this.spawnFood();
    this.lastFrameTime = Date.now();
  }

  update() {
    if (this.gameOver || !this.terminal || this.paused) return;

    const now = Date.now();
    if (now - this.lastFrameTime < this.frameInterval) {
      return; // Skip frame for performance
    }
    this.lastFrameTime = now;

    this.direction = this.nextDirection;

    // Move snake head
    const head = { ...this.snake[0] };
    head.x += this.direction.x;
    head.y += this.direction.y;

    // Check wall collision
    if (head.x < 0 || head.x >= this.width || head.y < 0 || head.y >= this.height) {
      this.gameOver = true;
      return;
    }

    // Check self collision
    if (this.snake.some(seg => seg.x === head.x && seg.y === head.y)) {
      this.gameOver = true;
      return;
    }

    this.snake.unshift(head);

    // Check food collision
    if (head.x === this.food.x && head.y === this.food.y) {
      this.score++;
      this.spawnFood();
    } else {
      this.snake.pop();
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
    this.terminal.writeln('\x1b[1;32mSNAKE\x1b[0m  Score: \x1b[1;33m' + this.score + '\x1b[0m');

    // Top border
    let topBorder = '\x1b[90m+';
    for (let x = 0; x < this.width * 2; x++) {
      topBorder += '-';
    }
    topBorder += '+\x1b[0m';
    this.terminal.writeln(topBorder);

    // Create grid
    const grid: string[][] = [];
    for (let y = 0; y < this.height; y++) {
      grid[y] = [];
      for (let x = 0; x < this.width; x++) {
        grid[y][x] = '  ';
      }
    }

    // Draw food
    grid[this.food.y][this.food.x] = '\x1b[31m##\x1b[0m';

    // Draw snake
    this.snake.forEach((seg, i) => {
      if (i === 0) {
        // Head
        grid[seg.y][seg.x] = '\x1b[32m##\x1b[0m';
      } else {
        // Body
        grid[seg.y][seg.x] = '\x1b[92m##\x1b[0m';
      }
    });

    // Output grid line by line
    for (let y = 0; y < this.height; y++) {
      let line = '\x1b[90m|\x1b[0m';
      for (let x = 0; x < this.width; x++) {
        line += grid[y][x];
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

    // Game status
    this.terminal.writeln('');
    if (this.gameOver) {
      this.terminal.writeln('\x1b[1;31mGAME OVER!\x1b[0m');
      this.terminal.writeln('Final Score: \x1b[1;33m' + this.score + '\x1b[0m');
      this.terminal.writeln('Click/Tap to play again. Press ESC to exit.');
    } else if (this.paused) {
      this.terminal.writeln('\x1b[1;33mPAUSED\x1b[0m - Click/Tap to start or resume');
      this.terminal.writeln('Use arrow keys to move. Press ESC to exit.');
    } else {
      this.terminal.writeln('Use arrow keys to move. Click/Tap to pause. Press ESC to exit.');
    }
  }

  exit() {
    // Cleanup if needed
  }
}

export const snake: CommandHandler = {
  name: 'snake',
  description: 'Play Snake game',
  execute: () => {
    const game = new SnakeGame();
    
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
        gameId: 'snake',
        gameHandler: handler
      }
    };
  }
};
