interface ImageViewerProps {
  src: string;
  description?: string;
}

export function ImageViewer({ src, description }: ImageViewerProps) {
  return (
    <div className="viewer-content">
      <img src={src} alt={description || 'Project image'} />
      {description && <p className="viewer-description">{description}</p>}
    </div>
  );
}
