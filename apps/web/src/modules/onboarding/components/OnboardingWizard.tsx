/**
 * apps/web/src/modules/onboarding/components/OnboardingWizard.tsx
 *
 * I-703 — 5-step onboarding wizard. Resumable: state lives in BFF (Redis,
 * 90-day TTL, keyed by userId). Each step calls `advance(step, data)` to
 * persist progress. User can `skip` (sets dismissed=true) or `reset`.
 *
 * Steps:
 *  1. Confirm email
 *  2. Create first event (template "Conference")
 *  3. Invite staff (≥1 email)
 *  4. Publish event
 *  5. Share registration link
 */
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useOnboarding } from "../hooks/useOnboarding";
import {
  OnboardingStep,
  type OnboardingState,
  type OnboardingStepType,
} from "../types/onboarding";

const STEP_LABELS: Record<OnboardingStepType, string> = {
  [OnboardingStep.ConfirmEmail]: "Confirm email",
  [OnboardingStep.CreateEvent]: "Create first event",
  [OnboardingStep.AddStaff]: "Add staff",
  [OnboardingStep.Publish]: "Publish",
  [OnboardingStep.Share]: "Share link",
};

const STEP_ORDER: OnboardingStepType[] = [
  OnboardingStep.ConfirmEmail,
  OnboardingStep.CreateEvent,
  OnboardingStep.AddStaff,
  OnboardingStep.Publish,
  OnboardingStep.Share,
];

function defaultState(): OnboardingState {
  return {
    currentStep: OnboardingStep.ConfirmEmail,
    highestCompletedStep: null,
    data: {},
    dismissed: false,
    updatedAt: new Date().toISOString(),
  };
}

export function OnboardingWizard({ initialState }: { initialState: OnboardingState | null }) {
  const router = useRouter();
  const fallback = initialState ?? defaultState();
  const { state, advance, skip, isPending, error } = useOnboarding(fallback);
  const [eventName, setEventName] = useState("Tech Conference 2026");
  const [venueName, setVenueName] = useState("Hanoi Convention Center");
  const [staffEmails, setStaffEmails] = useState<string[]>([""]);

  const currentIdx = STEP_ORDER.indexOf(state.currentStep);
  const isComplete = state.highestCompletedStep === STEP_ORDER[STEP_ORDER.length - 1];

  function handleSkip() {
    skip();
    router.push("/dashboard");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Welcome to SaasCheckin</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Let&apos;s get your first event live in 5 steps. You can skip and come back later.
        </p>
      </header>

      <Stepper current={state.currentStep} highest={state.highestCompletedStep} />

      {error && (
        <div
          role="alert"
          className="rounded border border-destructive bg-destructive/10 p-3 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      <div
        className="rounded border border-border bg-card p-6"
        aria-busy={isPending}
      >
        {isComplete ? (
          <CompletePanel state={state} />
        ) : (
          <>
            {state.currentStep === OnboardingStep.ConfirmEmail && (
              <Step1Email
                onConfirm={() => advance(OnboardingStep.ConfirmEmail)}
                disabled={isPending}
              />
            )}
            {state.currentStep === OnboardingStep.CreateEvent && (
              <Step2Event
                name={eventName}
                venue={venueName}
                onNameChange={setEventName}
                onVenueChange={setVenueName}
                onCreate={(id) => advance(OnboardingStep.CreateEvent, { eventId: id })}
                disabled={isPending}
              />
            )}
            {state.currentStep === OnboardingStep.AddStaff && (
              <Step3Staff
                emails={staffEmails}
                onChange={setStaffEmails}
                onSend={(emails) => advance(OnboardingStep.AddStaff, { staffEmails: emails })}
                disabled={isPending}
              />
            )}
            {state.currentStep === OnboardingStep.Publish && (
              <Step4Publish
                eventId={state.data.eventId ?? "—"}
                onPublish={() =>
                  advance(OnboardingStep.Publish, { publishedAt: new Date().toISOString() })
                }
                disabled={isPending}
              />
            )}
            {state.currentStep === OnboardingStep.Share && (
              <Step5Share
                eventId={state.data.eventId ?? ""}
                onDone={() => advance(OnboardingStep.Share)}
                disabled={isPending}
              />
            )}
          </>
        )}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          Step {currentIdx + 1} of {STEP_ORDER.length}
        </span>
        {!isComplete && (
          <button
            type="button"
            onClick={handleSkip}
            disabled={isPending}
            className="text-sm text-muted-foreground hover:underline disabled:opacity-50"
          >
            Skip for now
          </button>
        )}
      </div>
    </div>
  );
}

function Stepper({
  current,
  highest,
}: {
  current: OnboardingStepType;
  highest: OnboardingStepType | null;
}) {
  const highestIdx = highest ? STEP_ORDER.indexOf(highest) : -1;
  return (
    <ol className="flex items-center justify-between gap-2" aria-label="Onboarding progress">
      {STEP_ORDER.map((step, idx) => {
        const isComplete = idx < highestIdx || (idx === highestIdx && step !== current);
        const isCurrent = step === current;
        return (
          <li key={step} className="flex flex-1 flex-col items-center text-center">
            <div
              className={`mb-2 flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium ${
                isComplete
                  ? "bg-success text-success-foreground"
                  : isCurrent
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
              }`}
              aria-current={isCurrent ? "step" : undefined}
            >
              {isComplete ? "✓" : idx + 1}
            </div>
            <span className="text-xs text-muted-foreground">{STEP_LABELS[step]}</span>
          </li>
        );
      })}
    </ol>
  );
}

function Step1Email({ onConfirm, disabled }: { onConfirm: () => void; disabled: boolean }) {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-foreground">Confirm your email</h2>
      <p className="text-sm text-muted-foreground">
        We sent a verification link to your inbox. Click it to continue.
      </p>
      <button
        type="button"
        onClick={onConfirm}
        disabled={disabled}
        className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        I&apos;ve confirmed
      </button>
    </div>
  );
}

function Step2Event({
  name,
  venue,
  onNameChange,
  onVenueChange,
  onCreate,
  disabled,
}: {
  name: string;
  venue: string;
  onNameChange: (v: string) => void;
  onVenueChange: (v: string) => void;
  onCreate: (id: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-foreground">Create your first event</h2>
      <p className="text-sm text-muted-foreground">
        Start with a Conference template — fully editable later.
      </p>
      <label className="block">
        <span className="text-xs font-medium text-muted-foreground">Event name</span>
        <input
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          disabled={disabled}
          className="mt-1 w-full rounded border border-input bg-background px-3 py-2 text-foreground"
        />
      </label>
      <label className="block">
        <span className="text-xs font-medium text-muted-foreground">Venue</span>
        <input
          value={venue}
          onChange={(e) => onVenueChange(e.target.value)}
          disabled={disabled}
          className="mt-1 w-full rounded border border-input bg-background px-3 py-2 text-foreground"
        />
      </label>
      <button
        type="button"
        onClick={() => onCreate(crypto.randomUUID())}
        disabled={disabled || !name.trim() || !venue.trim()}
        className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        Create event
      </button>
    </div>
  );
}

function Step3Staff({
  emails,
  onChange,
  onSend,
  disabled,
}: {
  emails: string[];
  onChange: (emails: string[]) => void;
  onSend: (emails: string[]) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-foreground">Invite staff</h2>
      <p className="text-sm text-muted-foreground">
        Add gate staff who will scan tickets. They&apos;ll receive an invite email.
      </p>
      {emails.map((email, idx) => (
        <input
          key={idx}
          type="email"
          value={email}
          onChange={(e) =>
            onChange(emails.map((v, i) => (i === idx ? e.target.value : v)))
          }
          placeholder="staff@example.com"
          disabled={disabled}
          className="w-full rounded border border-input bg-background px-3 py-2 text-foreground"
        />
      ))}
      <button
        type="button"
        onClick={() => onChange([...emails, ""])}
        disabled={disabled}
        className="text-sm text-primary hover:underline disabled:opacity-50"
      >
        + Add another
      </button>
      <button
        type="button"
        onClick={() => onSend(emails.filter((e) => /.+@.+\..+/.test(e)))}
        disabled={disabled || !emails.some((e) => /.+@.+\..+/.test(e))}
        className="block rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        Send invites
      </button>
    </div>
  );
}

function Step4Publish({
  eventId,
  onPublish,
  disabled,
}: {
  eventId: string;
  onPublish: () => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-foreground">Publish event</h2>
      <p className="text-sm text-muted-foreground">
        Make your event live so attendees can register. Event ID: <code>{eventId}</code>
      </p>
      <button
        type="button"
        onClick={onPublish}
        disabled={disabled}
        className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        Publish now
      </button>
    </div>
  );
}

function Step5Share({
  eventId,
  onDone,
  disabled,
}: {
  eventId: string;
  onDone: () => void;
  disabled: boolean;
}) {
  const url = `https://web.saas-checkin.com/e/default/event/${eventId}`;
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
          type="button"
          onClick={() => navigator.clipboard.writeText(url)}
          disabled={disabled}
          className="rounded border border-border px-3 py-2 text-sm text-foreground disabled:opacity-50"
        >
          Copy
        </button>
      </div>
      <button
        type="button"
        onClick={onDone}
        disabled={disabled}
        className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        Finish setup
      </button>
    </div>
  );
}

function CompletePanel({ state }: { state: OnboardingState }) {
  return (
    <div className="space-y-2 text-center">
      <div className="text-3xl">🎉</div>
      <h2 className="text-lg font-semibold text-foreground">You&apos;re all set</h2>
      <p className="text-sm text-muted-foreground">
        Event ID <code>{state.data.eventId}</code> is published. {state.data.staffEmails?.length ?? 0}{" "}
        staff invited. Share the link and start scanning tickets.
      </p>
    </div>
  );
}
