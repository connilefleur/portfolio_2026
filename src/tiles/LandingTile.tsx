import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { ProjectItem, SiteInfo } from "../types/content";
import type { TileId } from "../canvas/tileRegistry";
import { TileFrame } from "./TileFrame";

type LandingTileProps = {
  projects: ProjectItem[];
  siteInfo: SiteInfo;
  goToTile: (id: TileId) => void;
  introPhase: "active" | "exiting" | "done";
  onIntroEnter: () => void;
};

const INTRO_OVERLAY_BLEED = 64;
const INTRO_START_DELAY_MS = 110;

function deriveIndex(label: string) {
  const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let acc = label.length;
  for (let i = 0; i < label.length; i++) {
    acc = (acc * 37 + label.charCodeAt(i)) >>> 0;
  }
  let result = "";
  while (result.length < 4) {
    result += alphabet[acc % alphabet.length];
    acc = Math.floor(acc / alphabet.length) + 3;
  }
  return result;
}

function getLinks(projects: ProjectItem[]): Array<{ label: string; index: string; target: TileId }> {
  const projectLinks = projects.slice(0, 3).map((p, i) => {
    const label = `Project ${i + 1}`;
    return {
      label,
      index: deriveIndex(label),
      target: `project-${p.slug}` as TileId
    };
  });
  return [
    { label: "About me", index: deriveIndex("About me"), target: "about-me" },
    ...projectLinks,
    { label: "Recognition", index: deriveIndex("Recognition"), target: "recognition" },
    { label: "Contact", index: deriveIndex("Contact"), target: "work-together" }
  ];
}

export function LandingTile({ projects, siteInfo, goToTile, introPhase, onIntroEnter }: LandingTileProps) {
  const links = getLinks(projects);
  const isIntroVisible = introPhase !== "done";
  const frameRef = useRef<HTMLDivElement>(null);
  const brandRef = useRef<HTMLSpanElement>(null);
  const introLabelRef = useRef<HTMLButtonElement>(null);
  const introDelayRef = useRef<number | null>(null);
  const introSequenceStartedRef = useRef(false);
  const [useTapTrigger, setUseTapTrigger] = useState(false);
  const [overlayTarget, setOverlayTarget] = useState({
    x: 0,
    y: 0,
    scaleX: 1,
    scaleY: 1,
    radius: 0
  });
  const [nameMotion, setNameMotion] = useState({
    dx: 0,
    dy: 0,
    scale: 1
  });

  const syncOverlayTargets = useCallback(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const rect = frame.getBoundingClientRect();
    const vw = window.innerWidth || 1;
    const vh = window.innerHeight || 1;
    const startWidth = vw + INTRO_OVERLAY_BLEED * 2;
    const startHeight = vh + INTRO_OVERLAY_BLEED * 2;
    const radius = Number.parseFloat(window.getComputedStyle(frame).borderTopLeftRadius) || 0;
    setOverlayTarget({
      x: rect.left + INTRO_OVERLAY_BLEED,
      y: rect.top + INTRO_OVERLAY_BLEED,
      scaleX: rect.width / startWidth,
      scaleY: rect.height / startHeight,
      radius
    });

    const brand = brandRef.current;
    const label = introLabelRef.current;
    if (!brand || !label) return;
    const brandRect = brand.getBoundingClientRect();
    const labelRect = label.getBoundingClientRect();
    const brandStyle = window.getComputedStyle(brand);
    const labelStyle = window.getComputedStyle(label);
    const brandFontSize = Number.parseFloat(brandStyle.fontSize) || 14;
    const labelFontSize = Number.parseFloat(labelStyle.fontSize) || 32;
    const labelCenterX = labelRect.left + labelRect.width / 2;
    const labelCenterY = labelRect.top + labelRect.height / 2;
    const brandCenterX = brandRect.left + brandRect.width / 2;
    const brandCenterY = brandRect.top + brandRect.height / 2;
    setNameMotion({
      dx: brandCenterX - labelCenterX,
      dy: brandCenterY - labelCenterY,
      scale: brandFontSize / labelFontSize
    });
  }, []);

  useLayoutEffect(() => {
    if (!isIntroVisible) return;
    syncOverlayTargets();
  }, [isIntroVisible, syncOverlayTargets]);

  useLayoutEffect(() => {
    if (!isIntroVisible) return;
    syncOverlayTargets();
  }, [isIntroVisible, syncOverlayTargets]);

  useLayoutEffect(() => {
    if (!isIntroVisible) return;
    const onResize = () => syncOverlayTargets();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [isIntroVisible, syncOverlayTargets]);

  useEffect(() => {
    if (!isIntroVisible) {
      introSequenceStartedRef.current = false;
    }
  }, [isIntroVisible]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(hover: none), (pointer: coarse)");
    const updateTriggerMode = () => setUseTapTrigger(mediaQuery.matches);
    updateTriggerMode();
    mediaQuery.addEventListener("change", updateTriggerMode);
    return () => mediaQuery.removeEventListener("change", updateTriggerMode);
  }, []);

  useEffect(() => {
    return () => {
      if (introDelayRef.current) {
        window.clearTimeout(introDelayRef.current);
      }
    };
  }, []);

  const beginIntroSequence = () => {
    if (introPhase !== "active") return;
    if (introSequenceStartedRef.current) return;
    introSequenceStartedRef.current = true;
    if (introDelayRef.current) {
      window.clearTimeout(introDelayRef.current);
    }
    introDelayRef.current = window.setTimeout(() => {
      syncOverlayTargets();
      onIntroEnter();
      introDelayRef.current = null;
    }, INTRO_START_DELAY_MS);
  };

  const overlayStyle = {
    "--intro-overlay-bleed": `${INTRO_OVERLAY_BLEED}px`,
    "--intro-target-x": `${overlayTarget.x}px`,
    "--intro-target-y": `${overlayTarget.y}px`,
    "--intro-target-scale-x": `${overlayTarget.scaleX}`,
    "--intro-target-scale-y": `${overlayTarget.scaleY}`,
    "--intro-target-radius": `${overlayTarget.radius}px`,
    "--intro-name-dx": `${nameMotion.dx}px`,
    "--intro-name-dy": `${nameMotion.dy}px`,
    "--intro-name-scale": `${nameMotion.scale}`
  } as CSSProperties;

  const introOverlay =
    isIntroVisible && typeof document !== "undefined"
      ? createPortal(
          <>
            <div className={`landing-intro-overlay${introPhase === "exiting" ? " is-exiting" : ""}`} style={overlayStyle} />
            <button
              ref={introLabelRef}
              className={`landing-intro-enter${introPhase === "exiting" ? " is-exiting" : ""}`}
              style={overlayStyle}
              onMouseEnter={() => {
                if (useTapTrigger) return;
                beginIntroSequence();
              }}
              onFocus={beginIntroSequence}
              onClick={() => {
                if (!useTapTrigger) return;
                beginIntroSequence();
              }}
            >
              {siteInfo.brand.name.toUpperCase()}
            </button>
          </>,
          document.body
        )
      : null;

  return (
    <TileFrame className={isIntroVisible ? "landing-intro-frame" : undefined} introPhase={introPhase} frameRef={frameRef}>
      {introOverlay}
      <div className="landing-content">
        <header className="tile-header tiny">
          <span className="landing-brand" ref={brandRef}>
            {siteInfo.brand.name.toUpperCase()}
          </span>
          <span>{`${siteInfo.meta.title} 2026`.toUpperCase()}</span>
        </header>
        <nav className="landing-grid" aria-label="Primary portfolio navigation">
          {links.map((link) => (
            <div key={`${link.target}-${link.label}`} className="landing-row">
              <button className="landing-link" onClick={() => goToTile(link.target)}>
                {link.label}
              </button>
              <button className="landing-index-link" onClick={() => goToTile(link.target)}>
                {link.index}
              </button>
            </div>
          ))}
        </nav>
      </div>
    </TileFrame>
  );
}
