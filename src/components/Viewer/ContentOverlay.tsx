import { parseMarkdown } from '../../utils/markdown';

interface ContentOverlayProps {
  content: string;
  onClose: () => void;
}

export function ContentOverlay({ content, onClose }: ContentOverlayProps) {
  // ESC is handled globally in App
  const html = parseMarkdown(content);

  return (
    <div className="content-overlay" onClick={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}>
      <div 
        className="content-box"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
