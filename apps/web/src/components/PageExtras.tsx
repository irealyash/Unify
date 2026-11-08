import { GoogleAuthButton } from "@/components/GoogleAuthButton";
import { CREDITS } from "@/credits";
import { isTestMode } from "@/lib/testMode";

/** Keeps text readable over the 3D background. */
export const OVER_SCENE_TEXT = "[text-shadow:0_1px_3px_rgba(0,0,0,0.85)]";
/** The sign-in box (or test mode status), sized to match the form's fields. */
export const AUTH_BOX = "h-11 bg-[rgba(28,21,16,0.6)] py-0 backdrop-blur-sm";

/** Test mode's status box, at the bottom of the screen. Shows nothing outside test mode. */
export function TestModeBox() {
  if (!isTestMode()) return null;
  return (
    <div
      className={`${OVER_SCENE_TEXT} relative z-10 mx-auto mb-3 w-full max-w-[21rem] px-6 md:absolute md:bottom-6 md:left-1/2 md:mb-0 md:-translate-x-1/2 md:px-0`}
    >
      <GoogleAuthButton className={AUTH_BOX} />
    </div>
  );
}

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
