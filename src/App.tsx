import { useCallback, useEffect, useState } from 'react';
import { Terminal } from './components/Terminal/Terminal';
import { HintBar } from './components/Terminal/HintBar';
import { MobileGameControls } from './components/Terminal/MobileGameControls';
import { Viewer } from './components/Viewer/Viewer';
import { useProjects } from './hooks/useProjects';
import { useViewer } from './hooks/useViewer';
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
  const [hasGame, setHasGame] = useState(false);
  const [currentGameId, setCurrentGameId] = useState<string | undefined>();

  // Function to handle ESC/back behavior
  const handleEscape = useCallback(() => {
    // Exit game first if active
    if (hasGame) {
      const exitGame = (window as unknown as { exitGame?: () => void }).exitGame;
      if (exitGame) {
        exitGame();
        setHasGame(false);
      }
      return;
    }
    if (viewer) {
      closeViewer();
      // Refresh terminal after viewer closes
      setTimeout(() => {
        const refreshTerminal = (window as unknown as { refreshTerminal?: () => void }).refreshTerminal;
        if (refreshTerminal) {
          refreshTerminal();
        }
      }, 100);
      // Remove focus from any active element to prevent focus outline
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    }
  }, [viewer, closeViewer, hasGame]);

  // Global ESC key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleEscape();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleEscape]);

  // Browser back button handler (popstate)
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      // If viewer or game is open, close it instead of navigating back
      if (viewer || hasGame) {
        e.preventDefault();
        handleEscape();
        // Push current state back to prevent navigation
        window.history.pushState(null, '', window.location.href);
      }
    };

    // Push initial state
    window.history.pushState({ viewer: false }, '', window.location.href);
    
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [viewer, hasGame, handleEscape]);

  // Update history when viewer/game state changes
  useEffect(() => {
    if (viewer || hasGame) {
      window.history.pushState({ viewer: true }, '', window.location.href);
    }
  }, [viewer, hasGame]);

  const handleAction = useCallback((action: CommandAction) => {
    switch (action.type) {
      case 'open-viewer':
        openViewer(action.projectId, action.mediaIndex);
        break;
      case 'close-viewer':
        closeViewer();
        break;
      case 'clear':
        // Terminal handles this internally
        break;
    }
  }, [openViewer, closeViewer]);

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
        onGameStateChange={(hasGame, gameId) => {
          setHasGame(hasGame);
          setCurrentGameId(gameId);
        }}
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
      
      <HintBar hasViewer={!!viewer || hasGame} />
      
      <MobileGameControls 
        isActive={hasGame}
        gameId={currentGameId}
        onKeyPress={() => {
          // Keys are handled by global event listener in Terminal
        }}
      />
    </div>
  );
}
