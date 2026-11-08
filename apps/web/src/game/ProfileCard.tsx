import { AtSign, Copy, Link2, Mail, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  CONTACT_FIELDS,
  contactHref,
  readableAnswers,
  type ContactId,
  type MatchSummary,
  type PlayerState,
  type TeammateProfile,
} from "@unify/shared";
import { request, requestWithin } from "@/lib/socket";

/** The server gives Gemini 15 seconds, then answers with a plain comparison. */
const MATCH_TIMEOUT_MS = 20_000;

const ICONS: Record<ContactId, typeof Mail> = {
  email: Mail,
  discord: AtSign,
  instagram: AtSign,
  linkedin: Link2,
};

type Loaded<T> = { status: "loading" } | { status: "ready"; data: T } | { status: "failed"; error: string };

/** Loads something for this card, ignoring the answer if the card has since been closed. */
function useLoad<T>(load: () => Promise<T>) {
  const [state, setState] = useState<Loaded<T>>({ status: "loading" });
  useEffect(() => {
    let active = true;
    load().then(
      (data) => active && setState({ status: "ready", data }),
      (err: unknown) =>
        active && setState({ status: "failed", error: err instanceof Error ? err.message : "Something went wrong" }),
    );
    return () => {
      active = false;
    };
    // Mounted fresh per teammate (keyed by id), so this only ever runs once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return state;
}

/** Side panel shown when you click someone in your group: why you match, how to reach them, their answers. */
export function ProfileCard({ player, onClose }: { player: PlayerState; onClose: () => void }) {
  const profile = useLoad<TeammateProfile>(() => request("profile:get", { id: player.id }));
  const match = useLoad<MatchSummary>(() => requestWithin(MATCH_TIMEOUT_MS, "profile:match", { id: player.id }));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <aside
      aria-label={`${player.name}'s profile`}
      className="unify-pop absolute inset-x-3 bottom-3 top-24 z-20 flex flex-col overflow-hidden rounded-2xl bg-card text-[#0f1222] shadow-[0_24px_60px_-24px_rgba(15,18,34,0.45)] sm:left-auto sm:right-4 sm:w-[370px]"
    >
      <header className="flex items-center gap-3 border-b border-border px-5 py-4">
        <span className="h-4 w-4 shrink-0 rounded-full" style={{ background: player.color }} />
        <h2 className="min-w-0 flex-1 truncate font-display text-xl font-semibold tracking-tight">{player.name}</h2>
        {!player.connected ? <span className="text-xs text-[#8a8fa0]">Away</span> : null}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close profile"
          className="rounded-lg p-1.5 text-[#6b7080] transition hover:bg-clay/40 hover:text-[#0f1222]"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
        <section className="rounded-xl bg-clay/35 p-4">
          <h3 className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-primary">
            {match.status === "ready" && match.data.source === "template" ? null : <Sparkles className="h-3.5 w-3.5" />}
            Why you match
          </h3>
          {match.status === "loading" ? (
            <p className="animate-pulse text-sm text-[#6b7080]">Comparing how you both work…</p>
          ) : match.status === "failed" ? (
            <p className="text-sm text-[#6b7080]">Couldn't work this out right now. Reopen this profile to try again.</p>
          ) : (
            <p className="text-sm leading-relaxed text-[#3a3f55]">{match.data.text}</p>
          )}
        </section>

        {profile.status === "loading" ? (
          <p className="animate-pulse text-sm text-[#6b7080]">Loading profile…</p>
        ) : profile.status === "failed" ? (
          <p className="text-sm text-[#c2410c]">{profile.error}</p>
        ) : (
          <>
            <Contacts profile={profile.data} name={player.name} />
            <Answers profile={profile.data} name={player.name} />
          </>
        )}
      </div>
    </aside>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-[#8a8fa0]">{children}</h3>;
}

function Contacts({ profile, name }: { profile: TeammateProfile; name: string }) {
  const shared = CONTACT_FIELDS.flatMap((field) => {
    const value = profile.contacts[field.id];
    return value ? [{ ...field, value }] : [];
  });

  return (
    <section>
      <SectionTitle>Contact</SectionTitle>
      {shared.length === 0 ? (
        <p className="text-sm text-[#6b7080]">{name} didn't share any contact links.</p>
      ) : (
        <ul className="space-y-1">
          {shared.map((field) => (
            <li key={field.id}>
              <ContactRow id={field.id} label={field.label} value={field.value} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ContactRow({ id, label, value }: { id: ContactId; label: string; value: string }) {
  const Icon = ICONS[id];
  const href = contactHref(id, value);
  const body = (
    <>
      <Icon className="h-4 w-4 shrink-0 text-[#8a8fa0]" />
      <span className="w-20 shrink-0 text-[#6b7080]">{label}</span>
      <span className="min-w-0 flex-1 truncate text-left font-medium">{value}</span>
    </>
  );
  const rowClass = "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-clay/40";

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={rowClass}>
        {body}
      </a>
    );
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`Copied ${value}`);
    } catch {
      toast.error("Couldn't copy that");
    }
  }

  return (
    <button type="button" onClick={copy} title={`Copy ${label} username`} className={rowClass}>
      {body}
      <Copy className="h-3.5 w-3.5 shrink-0 text-[#8a8fa0]" />
    </button>
  );
}

function Answers({ profile, name }: { profile: TeammateProfile; name: string }) {
  const answers = profile.answers ? readableAnswers(profile.answers) : [];
  return (
    <section>
      <SectionTitle>Their answers</SectionTitle>
      {answers.length === 0 ? (
        <p className="text-sm text-[#6b7080]">{name} didn't fill in the questionnaire.</p>
      ) : (
        <dl className="space-y-3">
          {answers.map((a) => (
            <div key={a.id}>
              <dt className="text-xs text-[#8a8fa0] first-letter:uppercase">{a.topic}</dt>
              <dd className="whitespace-pre-wrap break-words text-sm text-[#0f1222]">{a.answer}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
