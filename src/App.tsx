import { useCallback, useEffect } from 'react';
import { Terminal } from './components/Terminal/Terminal';
import { HintBar } from './components/Terminal/HintBar';
import { Viewer } from './components/Viewer/Viewer';
import { ContentOverlay } from './components/Viewer/ContentOverlay';
import { useProjects } from './hooks/useProjects';
import { useViewer } from './hooks/useViewer';
import { useContent } from './hooks/useContent';
import { useTheme } from './hooks/useTheme';
import { CommandAction } from './types/terminal';

export default function App() {
  useTheme(); // Apply theme colors
  const { projects, loading, getProject } = useProjects();
  const { 
    viewer, 
    openViewer, 
    closeViewer, 
    nextMedia, 
    prevMedia,
    currentProject 
  } = useViewer(getProject);
  const { activeContent, showContent, hideContent, getContent } = useContent();

  // Global ESC key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (activeContent) {
          hideContent();
          // Remove focus from any active element to prevent focus outline
          if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
          }
        } else if (viewer) {
          closeViewer();
          // Remove focus from any active element to prevent focus outline
          if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeContent, viewer, hideContent, closeViewer]);

  const handleAction = useCallback((action: CommandAction) => {
    switch (action.type) {
      case 'open-viewer':
        openViewer(action.projectId, action.mediaIndex);
        break;
      case 'close-viewer':
        closeViewer();
        hideContent();
        break;
      case 'show-overlay':
        showContent(action.overlay);
        break;
      case 'close-overlay':
        hideContent();
        break;
      case 'clear':
        // Terminal handles this internally
        break;
    }
  }, [openViewer, closeViewer, showContent, hideContent]);

  if (loading) {
    return (
      <div className="app" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#ffffff' }}>Loading...</p>
      </div>
    );
  }

  return (
    <div className="app">
      <Terminal 
        projects={projects}
        currentViewer={viewer}
        onAction={handleAction}
      />
      
      {viewer && currentProject && (
        <Viewer
          project={currentProject}
          mediaIndex={viewer.mediaIndex}
          onClose={closeViewer}
          onNext={nextMedia}
          onPrev={prevMedia}
        />
      )}
      
      {activeContent && (
        <ContentOverlay
          content={getContent(activeContent)}
          onClose={hideContent}
        />
      )}
      
      <HintBar hasViewer={!!viewer || !!activeContent} />
    </div>
  );
}
