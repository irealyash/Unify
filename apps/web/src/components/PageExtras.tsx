import { CREDITS } from "@/credits";

/** Keeps text readable over the 3D background. */
export const OVER_SCENE_TEXT = "[text-shadow:0_1px_3px_rgba(0,0,0,0.85)]";
/** Attribution for the 3D model, in the bottom-right corner. */
export function ModelCredits() {
  return (
    <footer
      className={`${OVER_SCENE_TEXT} relative z-10 px-6 pb-5 text-center text-xs text-white/80 md:absolute md:bottom-4 md:right-6 md:max-w-[15rem] md:p-0 md:text-right xl:max-w-none`}
    >
      {CREDITS.map((c) => (
        <p key={c.url}>
          3D model:{" "}
          <a href={c.url} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
            {c.work}
          </a>{" "}
          by {c.author} ({c.license}) via {c.source}
        </p>
      ))}
    </footer>
  );
}
