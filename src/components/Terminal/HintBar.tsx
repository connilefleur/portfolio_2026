interface HintBarProps {
  hasViewer: boolean;
}

export function HintBar({ hasViewer }: HintBarProps) {
  const inject = (cmd: string) => {
    const fn = (window as unknown as { injectCommand?: (cmd: string) => void }).injectCommand;
    if (fn) fn(cmd);
  };

  return (
    <div className="hint-bar">
      <button onClick={() => inject('help')}>
        <code>help</code>
      </button>
      <button onClick={() => inject('projects')}>
        <code>projects</code>
      </button>
      <button onClick={() => inject('contact')}>
        <code>contact</code>
      </button>
      <button onClick={() => inject('imprint')}>
        <code>imprint</code>
      </button>
      {hasViewer && (
        <span className="hint-esc">Press <code>ESC</code> to close</span>
      )}
    </div>
  );
}
