import { useState } from 'react';

interface ImageStackViewerProps {
  sources: string[];
  description?: string;
}

export function ImageStackViewer({ sources, description }: ImageStackViewerProps) {
  const [index, setIndex] = useState(0);

  const prev = () => setIndex(i => (i === 0 ? sources.length - 1 : i - 1));
  const next = () => setIndex(i => (i === sources.length - 1 ? 0 : i + 1));

  return (
    <div className="viewer-content">
      <img src={sources[index]} alt={description || `Image ${index + 1}`} />
      
      <div className="image-stack-controls">
        <button onClick={prev}>← Prev</button>
        <span className="image-stack-counter">
          {index + 1} / {sources.length}
        </span>
        <button onClick={next}>Next →</button>
      </div>
      
      {description && <p className="viewer-description">{description}</p>}
    </div>
  );
}
