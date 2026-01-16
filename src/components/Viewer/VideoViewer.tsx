interface VideoViewerProps {
  src: string;
  description?: string;
}

export function VideoViewer({ src, description }: VideoViewerProps) {
  return (
    <div className="viewer-content">
      <video 
        src={src} 
        controls 
        autoPlay 
        playsInline
        style={{ maxWidth: '100%', maxHeight: '80vh' }}
      />
      {description && <p className="viewer-description">{description}</p>}
    </div>
  );
}
