import {
  FALLBACK_MASCOT_STATE,
  isMascotState,
  resolveMascotAnimationOrFallback,
  resolveMascotAssetOrFallback,
  type MascotAnimation,
  type MascotSize,
  type MascotState,
} from "../../assets/mascot";
import "./Mascot.css";

type MascotProps = {
  state: MascotState;
  size?: MascotSize;
  animation?: MascotAnimation;
  className?: string;
  alt?: string;
};

export function Mascot({
  state,
  size = "md",
  animation = "none",
  className = "",
  alt = "",
}: MascotProps) {
  const resolvedState = isMascotState(state) ? state : FALLBACK_MASCOT_STATE;
  const resolvedAnimation = resolveMascotAnimationOrFallback(animation);
  const asset = resolveMascotAssetOrFallback(resolvedState);
  const decorative = alt.trim() === "";
  const animationClass =
    resolvedAnimation === "none" ? "" : `ws-mascot--${resolvedAnimation}`;
  const frameClassNames = [
    "ws-mascot-frame",
    `ws-mascot-frame--${size}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");
  const imageClassNames = ["ws-mascot", animationClass].filter(Boolean).join(" ");

  return (
    <span className={frameClassNames}>
      <img
        className={imageClassNames}
        src={asset.src}
        alt={decorative ? "" : alt}
        aria-hidden={decorative ? true : undefined}
        data-mascot-state={resolvedState}
        data-mascot-animation={resolvedAnimation}
        data-mascot-placeholder={asset.placeholder ? "true" : undefined}
      />
    </span>
  );
}
