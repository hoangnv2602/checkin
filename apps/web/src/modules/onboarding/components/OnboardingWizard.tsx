/**
 * apps/web/src/modules/onboarding/components/OnboardingWizard.tsx
 *
 * I-703 — 5-step onboarding wizard. Resumable: state lưu ở server-side
 * (User.OnboardingStep column, sẽ thêm ở Phase 6+) + cookie fallback.
 *
 * Steps:
 *  1. Confirm email (verify link)
 *  2. Create first event (template "Conference")
 *  3. Add first staff (invite by email)
 *  4. Publish event
 *  5. Share registration link
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Step = 1 | 2 | 3 | 4 | 5;

interface State {
  step: Step;
  emailVerified: boolean;
  eventId: string | null;
  staffEmails: string[];
  published: boolean;
}

const STEP_LABELS = [
  "Confirm email",
  "Create first event",
  "Add staff",
  "Publish",
  "Share link",
];

export function OnboardingWizard({ initialStep = 1 }: { initialStep?: Step }) {
  const router = useRouter();
  const [state, setState] = useState<State>({
    step: initialStep,
    emailVerified: false,
    eventId: null,
    staffEmails: [],
    published: false,
  });

  function next() {
    setState((s) => ({ ...s, step: Math.min(5, s.step + 1) as Step }));
  }
  function back() {
    setState((s) => ({ ...s, step: Math.max(1, s.step - 1) as Step }));
  }
  function skip() {
    router.push(`/${state.eventId ? "dashboard" : "onboarding/skip"}`);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <Stepper current={state.step} />

      <div className="rounded border border-border bg-card p-6">
        {state.step === 1 && <Step1Email onConfirm={() => { setState((s) => ({ ...s, emailVerified: true })); next(); }} />}
        {state.step === 2 && <Step2Event onCreate={(id) => { setState((s) => ({ ...s, eventId: id })); next(); }} />}
        {state.step === 3 && <Step3Staff onAdd={(emails) => { setState((s) => ({ ...s, staffEmails: emails })); next(); }} />}
        {state.step === 4 && <Step4Publish eventId={state.eventId!} onPublish={() => { setState((s) => ({ ...s, published: true })); next(); }} />}
        {state.step === 5 && <Step5Share eventId={state.eventId!} onDone={skip} />}
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={back}
          disabled={state.step === 1}
          className="rounded border border-border px-4 py-2 text-sm text-foreground disabled:opacity-50"
        >
          Back
        </button>
        <button onClick={skip} className="text-sm text-muted-foreground hover:underline">
          Skip for now
        </button>
      </div>
    </div>
  );
}

function Stepper({ current }: { current: Step }) {
  return (
    <ol className="flex items-center justify-between">
      {STEP_LABELS.map((label, idx) => {
        const step = (idx + 1) as Step;
        const isComplete = step < current;
        const isCurrent = step === current;
        return (
          <li key={label} className="flex flex-1 flex-col items-center text-center">
            <div
              className={`mb-2 flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium ${
                isComplete
                  ? "bg-success text-success-foreground"
                  : isCurrent
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {isComplete ? "✓" : step}
            </div>
            <span className="text-xs text-muted-foreground">{label}</span>
            {idx < STEP_LABELS.length - 1 && (
              <div className="absolute hidden" aria-hidden />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function Step1Email({ onConfirm }: { onConfirm: () => void }) {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-foreground">Confirm your email</h2>
      <p className="text-sm text-muted-foreground">
        We sent a verification link to your inbox. Click it to continue.
      </p>
      <button onClick={onConfirm} className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
        I&apos;ve confirmed
      </button>
    </div>
  );
}

function Step2Event({ onCreate }: { onCreate: (id: string) => void }) {
  const [name, setName] = useState("Tech Conference 2026");
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-foreground">Create your first event</h2>
      <p className="text-sm text-muted-foreground">Start with a Conference template — fully editable later.</p>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full rounded border border-input bg-background px-3 py-2 text-foreground"
      />
      <button
        onClick={() => onCreate("new-event-id")}
        className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        Create event
      </button>
    </div>
  );
}

function Step3Staff({ onAdd }: { onAdd: (emails: string[]) => void }) {
  const [emails, setEmails] = useState<string[]>([""]);
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-foreground">Invite staff</h2>
      <p className="text-sm text-muted-foreground">Add gate staff who will scan tickets. They&apos;ll receive an invite email.</p>
      {emails.map((email, idx) => (
        <input
          key={idx}
          value={email}
          onChange={(e) => setEmails((prev) => prev.map((v, i) => (i === idx ? e.target.value : v)))}
          placeholder="staff@example.com"
          className="w-full rounded border border-input bg-background px-3 py-2 text-foreground"
        />
      ))}
      <button
        onClick={() => setEmails((prev) => [...prev, ""])}
        className="text-sm text-primary hover:underline"
      >
        + Add another
      </button>
      <button
        onClick={() => onAdd(emails.filter((e) => e.includes("@")))}
        className="block rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        Send invites
      </button>
    </div>
  );
}

function Step4Publish({ eventId, onPublish }: { eventId: string; onPublish: () => void }) {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-foreground">Publish event</h2>
      <p className="text-sm text-muted-foreground">
        Make your event live so attendees can register. Event ID: <code>{eventId}</code>
      </p>
      <button onClick={onPublish} className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
        Publish now
      </button>
    </div>
  );
}

function Step5Share({ eventId, onDone }: { eventId: string; onDone: () => void }) {
  const url = `https://web.saas-checkin.com/e/your-org/event/${eventId}`;
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-foreground">Share your event</h2>
      <p className="text-sm text-muted-foreground">Copy this URL to share with attendees.</p>
      <div className="flex gap-2">
        <input
          readOnly
          value={url}
          className="flex-1 rounded border border-input bg-background px-3 py-2 font-mono text-sm text-foreground"
        />
        <button
          onClick={() => navigator.clipboard.writeText(url)}
          className="rounded border border-border px-3 py-2 text-sm text-foreground"
        >
          Copy
        </button>
      </div>
      <button onClick={onDone} className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
        Finish setup
      </button>
    </div>
  );
}
