import { CommandHandler } from '../../../../types/terminal';

export const neofetch: CommandHandler = {
  name: 'neofetch',
  description: 'System information with style',
  execute: () => ({
    output: `
       ████████╗
       ╚══██╔══╝   Portfolio Terminal
          ██║      ----------------
          ██║      OS: Web Browser
          ██║      Host: Your Device
          ╚═╝      Terminal: xterm.js
                   Theme: Dark
    `
  })
};
