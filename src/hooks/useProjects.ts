import { useState, useEffect } from 'react';
import { Project } from '../types/projects';

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProjects() {
      try {
        const response = await fetch('./projects-index.json');
        if (!response.ok) {
          // No projects yet is okay
          if (response.status === 404) {
            setProjects([]);
            return;
          }
          throw new Error('Failed to load projects');
        }
        const data = await response.json();
        setProjects(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setProjects([]);
      } finally {
        setLoading(false);
      }
    }

    loadProjects();
  }, []);

  const getProject = (id: string) => projects.find(p => p.id === id);

  return { projects, loading, error, getProject };
}
