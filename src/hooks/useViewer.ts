import { useState, useCallback } from 'react';
import { Project } from '../types/projects';
import { ViewerState } from '../types/terminal';

export function useViewer(getProject: (id: string) => Project | undefined) {
  const [viewer, setViewer] = useState<ViewerState | null>(null);

  const openViewer = useCallback((projectId: string, mediaIndex = 0) => {
    const project = getProject(projectId);
    if (!project) return false;
    
    setViewer({ projectId, mediaIndex });
    return true;
  }, [getProject]);

  const closeViewer = useCallback(() => {
    setViewer(null);
  }, []);

  const nextMedia = useCallback(() => {
    if (!viewer) return;
    const project = getProject(viewer.projectId);
    if (!project) return;
    
    const nextIndex = (viewer.mediaIndex + 1) % project.media.length;
    setViewer({ ...viewer, mediaIndex: nextIndex });
  }, [viewer, getProject]);

  const prevMedia = useCallback(() => {
    if (!viewer) return;
    const project = getProject(viewer.projectId);
    if (!project) return;
    
    const prevIndex = viewer.mediaIndex === 0 
      ? project.media.length - 1 
      : viewer.mediaIndex - 1;
    setViewer({ ...viewer, mediaIndex: prevIndex });
  }, [viewer, getProject]);

  const currentProject = viewer ? getProject(viewer.projectId) : null;
  const currentMedia = currentProject?.media[viewer?.mediaIndex ?? 0];

  return {
    viewer,
    openViewer,
    closeViewer,
    nextMedia,
    prevMedia,
    currentProject,
    currentMedia,
  };
}
