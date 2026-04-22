import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { TileId } from "../canvas/tileRegistry";
import { NavAnchorButton } from "../components/NavAnchorButton";
import { BackIcon, ChevronLeftIcon, ChevronRightIcon, VolumeOffIcon, VolumeOnIcon } from "../components/HomeIcon";
import type { ProjectItem, ProjectMedia } from "../types/content";
import { SlideShell } from "../components/SlideShell";

type ViewerFitMode = "portrait" | "landscape" | "square";

function getViewerFitMode(width: number, height: number): ViewerFitMode {
  if (!width || !height) return "portrait";
  if (width > height) return "landscape";
  if (height > width) return "portrait";
  return "square";
}

type ProjectViewerTileProps = {
  project: ProjectItem | undefined;
  currentIndex: number;
  onBack: () => void;
  onSelectIndex: (index: number) => void;
  goToTile: (id: TileId) => void;
};

function fallbackProject(): ProjectItem {
  return {
    id: "fallback-viewer",
    slug: "",
    title: "Project",
    category: "Graphic Design",
    description: "Project details will be added soon.",
    year: "2025",
    client: "Client",
    tags: [],
    detail: {
      panels: [
        { heading: "Approach", body: "Project details will be added soon." },
        { heading: "Outcomes", body: "Project details will be added soon." }
      ],
      media: {
        heroPrimary: "",
        heroSecondary: "",
        viewerMedia: []
      }
    },
    media: [],
    path: ""
  };
}

function buildAssetUrl(project: ProjectItem, media: ProjectMedia) {
  return `${project.path}/${media.src}`;
}

function isGeneratedPosterFileName(fileName: string) {
  return /\.poster\.(jpg|jpeg|png|webp)$/i.test(fileName);
}

function getMediaFileName(src: string) {
  return src.split("/").pop() ?? src;
}

function ViewerMedia({
  project,
  media,
  muted,
  onFitModeChange,
  onAspectRatioChange,
}: {
  project: ProjectItem;
  media?: ProjectMedia;
  muted: boolean;
  onFitModeChange: (mode: ViewerFitMode) => void;
  onAspectRatioChange: (ratio: number) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    setIsPlaying(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, [media?.id]);

  if (!media) {
    return <div className="project-viewer-stage__empty">No media selected</div>;
  }

  const src = buildAssetUrl(project, media);

  if (media.type === "image") {
    return (
      <div className="project-viewer-stage__frame">
        <img
          className="project-viewer-stage__asset"
          src={src}
          alt={media.description || ""}
          loading="eager"
          onLoad={(event) => {
            onFitModeChange(getViewerFitMode(event.currentTarget.naturalWidth, event.currentTarget.naturalHeight));
            onAspectRatioChange(event.currentTarget.naturalWidth / event.currentTarget.naturalHeight);
          }}
        />
      </div>
    );
  }

  if (media.type === "video") {
    return (
      <div className="project-viewer-stage__video-wrap project-viewer-stage__frame">
        <video
          ref={videoRef}
          className="project-viewer-stage__asset"
          src={src}
          playsInline
          muted={muted}
          loop
          preload="metadata"
          onLoadedMetadata={(event) => {
            onFitModeChange(getViewerFitMode(event.currentTarget.videoWidth, event.currentTarget.videoHeight));
            onAspectRatioChange(event.currentTarget.videoWidth / event.currentTarget.videoHeight);
          }}
          onClick={() => {
            if (!videoRef.current) return;
            if (videoRef.current.paused) {
              videoRef.current.play();
              setIsPlaying(true);
            } else {
              videoRef.current.pause();
              setIsPlaying(false);
            }
          }}
        />
        {!isPlaying && (
          <button
            type="button"
            className="project-viewer-stage__play"
            onClick={() => {
              if (!videoRef.current) return;
              videoRef.current.play();
              setIsPlaying(true);
            }}
            aria-label="Play video"
          >
            PLAY
          </button>
        )}
      </div>
    );
  }

  return <div className="project-viewer-stage__empty">Preview unavailable</div>;
}

export function ProjectViewerTile({ project, currentIndex, onBack, onSelectIndex, goToTile }: ProjectViewerTileProps) {
  const displayProject = project ?? fallbackProject();
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const viewerMedia = useMemo(() => {
    const media = displayProject.media.filter((item) => !isGeneratedPosterFileName(getMediaFileName(item.src)));
    const names = (displayProject.detail.media.viewerMedia ?? []).filter((name) => !isGeneratedPosterFileName(name));
    if (!names || names.length === 0) {
      return media;
    }
    const resolved = names
      .map((name) => media.find((item) => getMediaFileName(item.src) === name))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
    return resolved.length > 0 ? resolved : media;
  }, [displayProject]);

  const safeLength = viewerMedia.length || 1;
  const normalizedIndex = ((currentIndex % safeLength) + safeLength) % safeLength;
  const activeMedia = viewerMedia[normalizedIndex];
  const [animationDirection, setAnimationDirection] = useState<"next" | "previous">("next");
  const [viewerFitMode, setViewerFitMode] = useState<ViewerFitMode>("portrait");
  const [viewerAspectRatio, setViewerAspectRatio] = useState(1);
  const [isMuted, setIsMuted] = useState(true);

  useEffect(() => {
    setAnimationDirection("next");
  }, [displayProject.slug]);

  const stopAllViewerVideos = () => {
    const videos = viewerRef.current?.querySelectorAll("video") ?? [];
    videos.forEach((video) => {
      video.pause();
      video.currentTime = 0;
    });
  };

  useEffect(() => {
    return () => {
      stopAllViewerVideos();
    };
  }, []);

  const handleBack = () => {
    stopAllViewerVideos();
    setIsMuted(true);
    onBack();
  };

  const goPrevious = () => {
    setAnimationDirection("previous");
    onSelectIndex((normalizedIndex - 1 + safeLength) % safeLength);
  };

  const goNext = () => {
    setAnimationDirection("next");
    onSelectIndex((normalizedIndex + 1) % safeLength);
  };

  const viewerStyle = {
    "--project-viewer-media-aspect": String(viewerAspectRatio || 1),
  } as CSSProperties;
  const usesSideNav = viewerFitMode === "portrait";
  const isVideo = activeMedia?.type === "video";

  return (
    <SlideShell className="project-viewer-shell">
      <div ref={viewerRef} className={`project-viewer project-viewer--${viewerFitMode}`} style={viewerStyle}>
        {!usesSideNav ? (
          <div className={`project-viewer__topbar${isVideo ? " project-viewer__topbar--with-secondary" : ""}`}>
            <NavAnchorButton className="project-viewer__top-action" onClick={handleBack} ariaLabel="Back to project">
              <BackIcon className="nav-icon" />
            </NavAnchorButton>
            {isVideo ? (
              <NavAnchorButton className="project-viewer__top-action project-viewer__top-action--secondary" onClick={() => setIsMuted((value) => !value)} ariaLabel={isMuted ? "Unmute video" : "Mute video"}>
                {isMuted ? <VolumeOffIcon className="nav-icon" /> : <VolumeOnIcon className="nav-icon" />}
              </NavAnchorButton>
            ) : null}
          </div>
        ) : null}

        <div className={`project-viewer__stage-row${usesSideNav ? " project-viewer__stage-row--with-side-nav" : ""}`}>
          {usesSideNav ? (
            <div className="project-viewer__side-column project-viewer__side-column--left">
              <NavAnchorButton className="project-viewer__nav project-viewer__nav--side project-viewer__nav--home" onClick={handleBack} ariaLabel="Back to project">
                <BackIcon className="nav-icon" />
              </NavAnchorButton>
              <NavAnchorButton className="project-viewer__nav project-viewer__nav--side project-viewer__nav--left" onClick={goPrevious} ariaLabel="Previous media">
                <ChevronLeftIcon className="nav-icon" />
              </NavAnchorButton>
            </div>
          ) : null}

          <div className="project-viewer-stage">
            <div
              key={`${activeMedia?.id ?? "empty"}-${animationDirection}`}
              className={`project-viewer-stage__inner project-viewer-stage__inner--${animationDirection}`}
            >
              <ViewerMedia
                project={displayProject}
                media={activeMedia}
                muted={isMuted}
                onFitModeChange={setViewerFitMode}
                onAspectRatioChange={setViewerAspectRatio}
              />
            </div>
          </div>

          {usesSideNav ? (
            <div className={`project-viewer__side-column project-viewer__side-column--right${isVideo ? " project-viewer__side-column--split" : ""}`}>
              {isVideo ? (
                <NavAnchorButton className="project-viewer__nav project-viewer__nav--side project-viewer__nav--mute" onClick={() => setIsMuted((value) => !value)} ariaLabel={isMuted ? "Unmute video" : "Mute video"}>
                  {isMuted ? <VolumeOffIcon className="nav-icon" /> : <VolumeOnIcon className="nav-icon" />}
                </NavAnchorButton>
              ) : null}
              <NavAnchorButton className="project-viewer__nav project-viewer__nav--side project-viewer__nav--right" onClick={goNext} ariaLabel="Next media">
                <ChevronRightIcon className="nav-icon" />
              </NavAnchorButton>
            </div>
          ) : null}
        </div>

        {!usesSideNav ? (
          <div className="project-viewer__nav-layer">
            <NavAnchorButton className="project-viewer__nav project-viewer__nav--left" onClick={goPrevious} ariaLabel="Previous media">
              <ChevronLeftIcon className="nav-icon" />
            </NavAnchorButton>
            <NavAnchorButton className="project-viewer__nav project-viewer__nav--right" onClick={goNext} ariaLabel="Next media">
              <ChevronRightIcon className="nav-icon" />
            </NavAnchorButton>
          </div>
        ) : null}
      </div>
    </SlideShell>
  );
}
