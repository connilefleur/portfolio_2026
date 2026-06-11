import { useState, useEffect, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { Viewer } from './Viewer';

interface Props {
  page: 'work' | 'contact' | 'tools' | 'imprint';
  meta?: ReactNode;
  children: ReactNode;
  shellClass?: string;
  contentClass?: string;
}

function Clock() {
  const [time, setTime] = useState(() => format());

  function format() {
    const now = new Date();
    const h = String(now.getUTCHours() + 1).padStart(2, '0');
    const m = String(now.getUTCMinutes()).padStart(2, '0');
    return `${h}:${m} CET`;
  }

  useEffect(() => {
    const id = setInterval(() => setTime(format()), 15000);
    return () => clearInterval(id);
  }, []);

  return <span>{time}</span>;
}

export function Layout({ page, meta, children, shellClass = '', contentClass = '' }: Props) {
  const navLinks: { to: string; label: string; id: typeof page }[] = [
    { to: '/',        label: 'Work',    id: 'work'    },
    { to: '/tools',   label: 'Tools',   id: 'tools'   },
    { to: '/contact', label: 'Contact', id: 'contact' },
  ];

  return (
    <div className={`shell ${shellClass}`}>
      <header className="bar-top">
        <div className="brand">
          C. Löffler <span className="cursor" aria-hidden="true" />
        </div>
        <div className="bar-meta">{meta}</div>
        <nav className="bar-nav">
          {navLinks.map(link => (
            <NavLink
              key={link.id}
              to={link.to}
              aria-current={page === link.id ? 'page' : undefined}
              end={link.to === '/'}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className={contentClass}>
        {children}
        <Viewer />
      </main>

      <footer className="bar-bot">
        <span><NavLink to="/imprint">Imprint</NavLink></span>
        <span className="center">© 2026</span>
        <span className="right">
          <a href="mailto:connilefleur@protonmail.com">connilefleur@protonmail.com</a>
        </span>
      </footer>
    </div>
  );
}

export { Clock };
