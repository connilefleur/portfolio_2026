import { useEffect, Suspense, lazy } from 'react';
import { MediaItem, Project } from '../../types/projects';
import { ImageViewer } from './ImageViewer';
import { VideoViewer } from './VideoViewer';
import { ImageStackViewer } from './ImageStackViewer';

// Lazy load the 3D viewer to reduce initial bundle size
const ThreeDViewer = lazy(() => import('./ThreeDViewer').then(m => ({ default: m.ThreeDViewer })));

interface ViewerProps {
  project: Project;
  mediaIndex: number;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
}

export function Viewer({ project, mediaIndex, onClose, onNext, onPrev }: ViewerProps) {
  const media = project.media[mediaIndex];
  const hasMultiple = project.media.length > 1;

  // Handle keyboard navigation (ESC is handled globally in App)
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && hasMultiple) {
        onNext();
      } else if (e.key === 'ArrowLeft' && hasMultiple) {
        onPrev();
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onNext, onPrev, hasMultiple]);

  const getSrc = (item: MediaItem): string => {
    return (item._resolvedSrc as string) || (item.src as string);
  };

  const getSrcArray = (item: MediaItem): string[] => {
    return (item._resolvedSrc as string[]) || (item.src as string[]);
  };

  const renderMedia = () => {
    switch (media.type) {
      case 'image':
        return <ImageViewer src={getSrc(media)} description={media.description} />;
      case 'video':
        return <VideoViewer src={getSrc(media)} description={media.description} />;
      case 'image-stack':
        return <ImageStackViewer sources={getSrcArray(media)} description={media.description} />;
      case '3d-model':
        return (
          <Suspense fallback={<div style={{ color: '#888' }}>Loading 3D viewer...</div>}>
            <ThreeDViewer src={getSrc(media)} description={media.description} />
          </Suspense>
        );
      default:
        return <p>Unsupported media type</p>;
    }
  };

  return (
    <div className="viewer-overlay" onClick={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}>
      {renderMedia()}
      
      {hasMultiple && (
        <div className="viewer-nav">
          <span>← →</span> Navigate ({mediaIndex + 1}/{project.media.length})
        </div>
      )}
    </div>
  );
}
