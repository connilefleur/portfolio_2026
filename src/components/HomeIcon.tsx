import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

export function HomeIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        className="nav-icon__fill"
        d="M5 10.62L12 5.17L19 10.62V19H14V14H10V19H5V10.62Z"
        fill="currentColor"
      />
      <path
        className="nav-icon__stroke"
        d="M5 10.62L12 5.17L19 10.62V19H14V14H10V19H5V10.62Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function BackIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path className="nav-icon__fill" d="M20 11H7.83L13.42 5.41L12 4L4 12L12 20L13.41 18.59L7.83 13H20V11Z" fill="currentColor" />
      <path className="nav-icon__stroke" d="M20 12H6M11 7L6 12L11 17" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path className="nav-icon__fill" d="M15.41 17.41L10 12L15.41 6.59L14 5.17L7.17 12L14 18.83L15.41 17.41Z" fill="currentColor" />
      <path className="nav-icon__stroke" d="M14.5 5L8 12L14.5 19" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path className="nav-icon__fill" d="M8.59 17.41L14 12L8.59 6.59L10 5.17L16.83 12L10 18.83L8.59 17.41Z" fill="currentColor" />
      <path className="nav-icon__stroke" d="M9.5 5L16 12L9.5 19" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}


export function VolumeOnIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path className="nav-icon__fill" d="M5 10V14H8L12.5 18V6L8 10H5Z" fill="currentColor" />
      <path className="nav-icon__stroke" d="M5 10H8L12.5 6V18L8 14H5V10Z" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <path className="nav-icon__stroke" d="M15.5 9C16.7 9.8 17.5 10.82 17.5 12C17.5 13.18 16.7 14.2 15.5 15" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <path className="nav-icon__stroke" d="M17.5 6.5C19.48 7.83 20.75 9.77 20.75 12C20.75 14.23 19.48 16.17 17.5 17.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function VolumeOffIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path className="nav-icon__fill" d="M5 10V14H8L12.5 18V6L8 10H5Z" fill="currentColor" />
      <path className="nav-icon__stroke" d="M5 10H8L12.5 6V18L8 14H5V10Z" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <path className="nav-icon__stroke" d="M16 9L20 15" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <path className="nav-icon__stroke" d="M20 9L16 15" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
