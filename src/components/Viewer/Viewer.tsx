import { useEffect, useRef, Suspense, lazy } from 'react';
import { MediaItem, Project } from '../../types/projects';
import { ImageViewer } from './ImageViewer';
import { VideoViewer } from './VideoViewer';
import { ImageStackViewer } from './ImageStackViewer';
import { WindowControls } from '../WindowControls';

// Lazy load the 3D viewer to reduce initial bundle size
const ThreeDViewer = lazy(() => import('./ThreeDViewer').then(m => ({ default: m.ThreeDViewer })));

interface ViewerProps {
  project: Project;
  mediaIndex: number;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
}

export function Viewer({ project, mediaIndex, onNext, onPrev }: ViewerProps) {
  const media = project.media[mediaIndex];
  const hasMultiple = project.media.length > 1;
  const overlayRef = useRef<HTMLDivElement>(null);

  // Auto-focus the viewer overlay when it opens
  useEffect(() => {
    if (overlayRef.current) {
      overlayRef.current.focus();
    }
  }, []);

  // Handle keyboard navigation (ESC is handled globally in App)
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      // Only handle if viewer is open and not typing in an input
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }
      
      if (e.key === 'ArrowRight' && hasMultiple) {
        e.preventDefault();
        onNext();
      } else if (e.key === 'ArrowLeft' && hasMultiple) {
        e.preventDefault();
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
        return (
          <ImageViewer 
            src={getSrc(media)} 
            mobileSrc={media._mobileSrc}
            description={media.description} 
          />
        );
      case 'video':
        return <VideoViewer src={getSrc(media)} description={media.description} />;
      case 'image-stack':
        return <ImageStackViewer sources={getSrcArray(media)} description={media.description} />;
      case '3d-model':
        return (
          <Suspense fallback={<div style={{ color: 'var(--color-overlay-text)' }}>Loading 3D viewer...</div>}>
            <ThreeDViewer src={getSrc(media)} description={media.description} />
          </Suspense>
        );
      default:
        return <p>Unsupported media type</p>;
    }
  };

  return (
    <div 
      className="viewer-overlay"
      ref={overlayRef}
      tabIndex={-1}
      style={{ outline: 'none' }}
    >
      <WindowControls onClose={onClose} />
      {renderMedia()}
      
      {hasMultiple && (
        <div className="viewer-nav">
          <span>← →</span> Navigate ({mediaIndex + 1}/{project.media.length})
        </div>
      )}
    </div>
  );
}
