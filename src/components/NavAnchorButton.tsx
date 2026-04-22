import type { ReactNode } from "react";

type NavAnchorButtonProps = {
  children: ReactNode;
  onClick: () => void;
  className?: string;
  ariaLabel?: string;
  active?: boolean;
};

export function NavAnchorButton({ children, onClick, className = "", ariaLabel, active = false }: NavAnchorButtonProps) {
  return (
    <button
      type="button"
      className={`text-link tiny ${className}`.trim()}
      data-nav-anchor="true"
      data-active={active ? "true" : undefined}
      onClick={onClick}
      aria-label={ariaLabel}
      aria-current={active ? "page" : undefined}
    >
      {children}
    </button>
  );
}
