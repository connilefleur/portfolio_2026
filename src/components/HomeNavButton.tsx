import type { ReactNode } from "react";
import type { TileId } from "../canvas/tileRegistry";
import { NavAnchorButton } from "./NavAnchorButton";
import { HomeIcon } from "./HomeIcon";

type HomeNavButtonProps = {
  goToTile: (id: TileId) => void;
  label?: ReactNode;
  to?: TileId;
};

export function HomeNavButton({ goToTile, label = <HomeIcon className="nav-icon" />, to = "landing" }: HomeNavButtonProps) {
  return (
    <NavAnchorButton onClick={() => goToTile(to)} ariaLabel="Home">
      {label}
    </NavAnchorButton>
  );
}
