import { CommandHandler } from '../../../../types/terminal';

export const history: CommandHandler = {
  name: 'history',
  description: 'Toggle limited history mode (shows only current + 1 line)',
  execute: () => {
    // Toggle limited history mode via global function
    const toggleHistory = (window as unknown as { toggleLimitedHistory?: () => boolean }).toggleLimitedHistory;
    if (toggleHistory) {
      const isEnabled = toggleHistory();
      return {
        output: `Limited history mode ${isEnabled ? 'enabled' : 'disabled'}.\n` +
                `When enabled, only the current line and one history line are displayed.\n` +
                `Run 'history' again to toggle.`
      };
    }
    return {
      output: 'History toggle not available.'
    };
  }
};
