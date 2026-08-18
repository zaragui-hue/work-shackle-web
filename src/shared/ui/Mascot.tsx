import {
  FALLBACK_MASCOT_STATE,
  isMascotState,
  resolveMascotAssetOrFallback,
  type MascotSize,
  type MascotState,
} from "../../assets/mascot";
import "./Mascot.css";

type MascotProps = {
  state: MascotState;
  size?: MascotSize;
  className?: string;
  alt?: string;
};

export function Mascot({
  state,
  size = "md",
  className = "",
  alt = "",
}: MascotProps) {
  const resolvedState = isMascotState(state) ? state : FALLBACK_MASCOT_STATE;
  const asset = resolveMascotAssetOrFallback(resolvedState);
  const decorative = alt.trim() === "";
  const classNames = ["ws-mascot", `ws-mascot--${size}`, className]
    .filter(Boolean)
    .join(" ");

  return (
    <img
      className={classNames}
      src={asset.src}
      alt={decorative ? "" : alt}
      aria-hidden={decorative ? true : undefined}
      data-mascot-state={resolvedState}
      data-mascot-placeholder={asset.placeholder ? "true" : undefined}
    />
  );
}
