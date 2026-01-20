/**
 * Simple ANSI art generator
 * Converts text to ASCII art using a basic block pattern
 */

// Simple 5-line font pattern for ASCII art
const fontPattern: Record<string, string[]> = {
  'A': [' ███ ', '█   █', '█████', '█   █', '█   █'],
  'B': ['████ ', '█   █', '████ ', '█   █', '████ '],
  'C': [' ███ ', '█   █', '█    ', '█   █', ' ███ '],
  'D': ['████ ', '█   █', '█   █', '█   █', '████ '],
  'E': ['█████', '█    ', '████ ', '█    ', '█████'],
  'F': ['█████', '█    ', '████ ', '█    ', '█    '],
  'G': [' ███ ', '█    ', '█  ██', '█   █', ' ███ '],
  'H': ['█   █', '█   █', '█████', '█   █', '█   █'],
  'I': ['█████', '  █  ', '  █  ', '  █  ', '█████'],
  'J': ['█████', '    █', '    █', '█   █', ' ███ '],
  'K': ['█   █', '█  █ ', '███  ', '█  █ ', '█   █'],
  'L': ['█    ', '█    ', '█    ', '█    ', '█████'],
  'M': ['█   █', '██ ██', '█ █ █', '█   █', '█   █'],
  'N': ['█   █', '██  █', '█ █ █', '█  ██', '█   █'],
  'O': [' ███ ', '█   █', '█   █', '█   █', ' ███ '],
  'P': ['████ ', '█   █', '████ ', '█    ', '█    '],
  'Q': [' ███ ', '█   █', '█   █', '█  ██', ' ████'],
  'R': ['████ ', '█   █', '████ ', '█  █ ', '█   █'],
  'S': [' ███ ', '█    ', ' ███ ', '    █', ' ███ '],
  'T': ['█████', '  █  ', '  █  ', '  █  ', '  █  '],
  'U': ['█   █', '█   █', '█   █', '█   █', ' ███ '],
  'V': ['█   █', '█   █', '█   █', ' █ █ ', '  █  '],
  'W': ['█   █', '█   █', '█ █ █', '██ ██', '█   █'],
  'X': ['█   █', ' █ █ ', '  █  ', ' █ █ ', '█   █'],
  'Y': ['█   █', ' █ █ ', '  █  ', '  █  ', '  █  '],
  'Z': ['█████', '   █ ', '  █  ', ' █   ', '█████'],
  '0': [' ███ ', '█  ██', '█ █ █', '██  █', ' ███ '],
  '1': ['  █  ', ' ██  ', '  █  ', '  █  ', '█████'],
  '2': [' ███ ', '    █', ' ███ ', '█    ', '█████'],
  '3': [' ███ ', '    █', ' ███ ', '    █', ' ███ '],
  '4': ['█   █', '█   █', '█████', '    █', '    █'],
  '5': ['█████', '█    ', '████ ', '    █', '████ '],
  '6': [' ███ ', '█    ', '████ ', '█   █', ' ███ '],
  '7': ['█████', '    █', '   █ ', '  █  ', ' █   '],
  '8': [' ███ ', '█   █', ' ███ ', '█   █', ' ███ '],
  '9': [' ███ ', '█   █', ' ████', '    █', ' ███ '],
  ' ': ['     ', '     ', '     ', '     ', '     '],
  '-': ['     ', '     ', '█████', '     ', '     '],
  '.': ['     ', '     ', '     ', '     ', '  █  '],
  '!': ['  █  ', '  █  ', '  █  ', '     ', '  █  '],
  '?': [' ███ ', '    █', '  ██ ', '     ', '  █  '],
};

export function generateAnsiArt(text: string, color: string = '\x1b[36m', maxWidth?: number): string {
  const upperText = text.toUpperCase();
  
  // Check if mobile to use smaller spacing for ANSI art
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  
  // Base character dimensions
  const baseCharWidth = 5;
  const baseSpacing = 1;
  const charWithSpacing = baseCharWidth + baseSpacing;
  
  // If no maxWidth, render normally without wrapping
  if (!maxWidth || maxWidth <= 0) {
    return generateAnsiArtChunk(upperText, color, baseSpacing, isMobile);
  }
  
  // Calculate how many characters fit per line
  // For n characters, we need: n * baseCharWidth + (n-1) * baseSpacing = n * 6 - 1
  // So: n * 6 - 1 <= maxWidth
  // Therefore: n <= (maxWidth + 1) / 6
  // We use floor to be conservative and ensure we don't overflow
  const charsPerLine = Math.max(1, Math.floor((maxWidth + 1) / charWithSpacing));
  
  // Calculate actual width needed for the full text
  const actualWidthNeeded = upperText.length * baseCharWidth + (upperText.length - 1) * baseSpacing;
  
  // Only wrap if the text actually doesn't fit
  if (actualWidthNeeded <= maxWidth) {
    return generateAnsiArtChunk(upperText, color, baseSpacing, isMobile);
  }
  
  // Break into chunks that fit on separate lines
  const chunks: string[] = [];
  for (let i = 0; i < upperText.length; i += charsPerLine) {
    chunks.push(upperText.substring(i, i + charsPerLine));
  }
  
  // Generate art for each chunk and combine with line breaks
  // Don't pad to maxWidth - let each chunk be its natural width
  // This prevents alignment issues on mobile
  const chunkArts = chunks.map(chunk => generateAnsiArtChunk(chunk, color, baseSpacing, isMobile));
  return chunkArts.join('\n\n');
}

function generateAnsiArtChunk(text: string, color: string, spacing: number, _isMobile: boolean = false): string {
  // Always use full 5-line pattern for proper character display
  // The compact 3-line pattern was cutting off important parts
  const numLines = 5;
  const lines: string[] = Array(numLines).fill('');
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const pattern = fontPattern[char] || fontPattern[' '];
    
    // Always use all 5 lines (0-4) for complete character display
    for (let lineIdx = 0; lineIdx < numLines; lineIdx++) {
      lines[lineIdx] += pattern[lineIdx];
      // Add spacing after each character (except the last one)
      if (i < text.length - 1) {
        lines[lineIdx] += ' '.repeat(spacing);
      }
    }
  }
  
  // Ensure all lines have the same width (pad shorter lines)
  const maxLineWidth = Math.max(...lines.map(line => line.length));
  const normalizedLines = lines.map(line => {
    const currentWidth = line.length;
    if (currentWidth < maxLineWidth) {
      return line + ' '.repeat(maxLineWidth - currentWidth);
    }
    return line;
  });
  
  return `${color}${normalizedLines.join('\n')}\x1b[0m`;
}
