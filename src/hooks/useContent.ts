import { useState, useCallback } from 'react';

export type ContentType = 'contact' | 'imprint' | null;

export function useContent() {
  const [activeContent, setActiveContent] = useState<ContentType>(null);
  const [contentCache, setContentCache] = useState<Record<string, string>>({});

  const showContent = useCallback(async (type: 'contact' | 'imprint') => {
    setActiveContent(type);
    
    // Load content if not cached
    if (!contentCache[type]) {
      try {
        const response = await fetch(`./content/${type === 'imprint' ? 'impressum' : type}.md`);
        if (response.ok) {
          const text = await response.text();
          setContentCache(prev => ({ ...prev, [type]: text }));
        }
      } catch {
        // Ignore errors
      }
    }
  }, [contentCache]);

  const hideContent = useCallback(() => {
    setActiveContent(null);
  }, []);

  return {
    activeContent,
    showContent,
    hideContent,
    getContent: (type: 'contact' | 'imprint') => contentCache[type] || '',
  };
}
