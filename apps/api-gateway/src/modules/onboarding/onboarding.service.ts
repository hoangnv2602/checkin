/**
 * apps/api-gateway/src/modules/onboarding/onboarding.service.ts
 *
 * I-703 — Onboarding wizard state. Stored in Redis keyed by userId, 90-day TTL.
 * Resume được từ bất kỳ step nào. Idempotent: gọi nhiều lần cùng step thì noop.
 *
 * Onboarding flow (5 steps, sequential):
 *   1. CONFIRM_EMAIL — user xác nhận email verification link
 *   2. CREATE_EVENT  — tạo event đầu tiên (template "Conference")
 *   3. ADD_STAFF     — invite ≥1 staff (gate scanner)
 *   4. PUBLISH       — publish event (status: published)
 *   5. SHARE         — copy public registration link
 *
 * User có thể `skip` (lưu `dismissed=true`, không hiện lại). Có thể `reset` để
 * chạy lại wizard (dùng cho testing / chuyển tổ chức).
 */
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type Redis from "ioredis";
import { REDIS } from "../_shared/redis/redis.module";

export const OnboardingStep = {
  ConfirmEmail: "confirm_email",
  CreateEvent: "create_event",
  AddStaff: "add_staff",
  Publish: "publish",
  Share: "share",
} as const;
export type OnboardingStepType = (typeof OnboardingStep)[keyof typeof OnboardingStep];

export const ONBOARDING_STEPS: OnboardingStepType[] = [
  OnboardingStep.ConfirmEmail,
  OnboardingStep.CreateEvent,
  OnboardingStep.AddStaff,
  OnboardingStep.Publish,
  OnboardingStep.Share,
];

export interface OnboardingStateDto {
  /** Step user đang làm (hoặc step tiếp theo chưa complete). */
  currentStep: OnboardingStepType;
  /** Step cao nhất đã complete (resume từ đây). */
  highestCompletedStep: OnboardingStepType | null;
  /** Per-step metadata: created event id, invited staff emails, published timestamp. */
  data: {
    eventId?: string;
    staffEmails?: string[];
    publishedAt?: string;
  };
  /** User skip wizard → dismissed = true, BFF không trả state nữa. */
  dismissed: boolean;
  /** ISO timestamp cập nhật lần cuối. */
  updatedAt: string;
}

const TTL_SECONDS = 90 * 24 * 60 * 60; // 90 days
const KEY_PREFIX = "onboarding:";

function key(userId: string): string {
  return `${KEY_PREFIX}${userId}`;
}

function defaultState(): OnboardingStateDto {
  return {
    currentStep: OnboardingStep.ConfirmEmail,
    highestCompletedStep: null,
    data: {},
    dismissed: false,
    updatedAt: new Date().toISOString(),
  };
}

function stepIndex(step: OnboardingStepType): number {
  const idx = ONBOARDING_STEPS.indexOf(step);
  if (idx === -1) throw new NotFoundException(`Unknown step: ${step}`);
  return idx;
}

@Injectable()
export class OnboardingService {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async getState(userId: string): Promise<OnboardingStateDto> {
    const raw = await this.redis.get(key(userId));
    if (!raw) {
      const fresh = defaultState();
      await this.persist(userId, fresh);
      return fresh;
    }
    return JSON.parse(raw) as OnboardingStateDto;
  }

  /**
   * Đánh dấu step complete, optionally cung cấp data. Auto-advance nếu còn
   * step tiếp theo. Nếu step đã là step cuối → trả state "complete" (highest
   * = share, current = share, dismissed = false; UI sẽ show "done" panel).
   */
  async advance(
    userId: string,
    step: OnboardingStepType,
    data: OnboardingStateDto["data"] = {},
  ): Promise<OnboardingStateDto> {
    const state = await this.getState(userId);
    if (state.dismissed) return state;

    const stepIdx = stepIndex(step);
    const highestIdx = state.highestCompletedStep ? stepIndex(state.highestCompletedStep) : -1;

    // Idempotent: step đã complete rồi thì chỉ merge data, không advance lùi.
    const isAdvancing = stepIdx > highestIdx;
    const newHighest = isAdvancing ? step : state.highestCompletedStep;
    const newCurrent = isAdvancing
      ? ONBOARDING_STEPS[Math.min(stepIdx + 1, ONBOARDING_STEPS.length - 1)]!
      : state.currentStep;

    const next: OnboardingStateDto = {
      ...state,
      currentStep: newCurrent,
      highestCompletedStep: newHighest,
      data: { ...state.data, ...data },
      updatedAt: new Date().toISOString(),
    };
    await this.persist(userId, next);
    return next;
  }

  async skip(userId: string): Promise<OnboardingStateDto> {
    const state = await this.getState(userId);
    const next: OnboardingStateDto = {
      ...state,
      dismissed: true,
      updatedAt: new Date().toISOString(),
    };
    await this.persist(userId, next);
    return next;
  }

  async reset(userId: string): Promise<OnboardingStateDto> {
    await this.redis.del(key(userId));
    return this.getState(userId);
  }

  private async persist(userId: string, state: OnboardingStateDto): Promise<void> {
    await this.redis.set(key(userId), JSON.stringify(state), "EX", TTL_SECONDS);
  }
}
