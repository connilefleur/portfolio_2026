interface ImageViewerProps {
  src: string;
  mobileSrc?: string;
  description?: string;
}

export function ImageViewer({ src, mobileSrc, description }: ImageViewerProps) {
  // Use srcset for responsive images if mobile version is available
  if (mobileSrc) {
    return (
      <div className="viewer-content">
        <img 
          src={src} 
          srcSet={`${mobileSrc} 1200w, ${src} 2000w`}
          sizes="(max-width: 768px) 1200px, 2000px"
          alt={description || 'Project image'} 
        />
        {description && <p className="viewer-description">{description}</p>}
      </div>
    );
  }
  
  return (
    <div className="viewer-content">
      <img src={src} alt={description || 'Project image'} />
      {description && <p className="viewer-description">{description}</p>}
    </div>
  );
}
