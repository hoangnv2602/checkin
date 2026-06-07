# Store asset checklist (I-705)

Pre-flight checklist cho Apple App Store + Google Play submission. Reuse
cho mỗi release lớn. Cập nhật status cột `[ ]` → `[x]` khi hoàn thành.

## App icon

| Platform | Size | Format | File |
|---|---|---|---|
| iOS | 1024×1024 | PNG (no alpha, no rounded corners) | `apps/mobile/assets/icon-ios-1024.png` |
| Android | 512×512 | PNG (alpha OK) | `apps/mobile/assets/icon-android-512.png` |
| Adaptive (Android 8+) | 432×432 foreground + 432×432 background | PNG | `apps/mobile/assets/icon-android-adaptive-*.png` |
| Web (PWA fallback) | 192×192, 512×512 | PNG | `apps/web/public/icons/*.png` |
| Favicon | 32×32, 64×64, 128×128 | ICO + PNG | `apps/web/src/app/favicon.ico` |

Icon design: chỉ dùng Aurora palette (`docs/design-system.md`). Không hardcode
màu cụ thể. Test trên light + dark theme.

## iOS screenshots

| Size | Device | Required count |
|---|---|---|
| 6.7" (1290×2796) | iPhone 15 Pro Max | 3-10 |
| 6.5" (1242×2688) | iPhone 11 Pro Max | optional, but recommended |
| 5.5" (1242×2208) | iPhone 8 Plus | optional |
| 12.9" (2048×2732) | iPad Pro (3rd gen) | optional but encouraged |

Capture từ Simulator (`xcrun simctl io booted screenshot`) hoặc real device.
Annotate bằng Figma / Sketch (text overlay: feature name + 1-line value prop).

Recommended screenshots (5):
1. **Live check-in dashboard** — show real-time count, QR scanner, "Scan ticket" CTA.
2. **Event analytics** — peak gate, attendance %, time-to-check-in chart.
3. **Multi-event overview** — list of events, status badges.
4. **Pricing / plans** — 3 plans side-by-side (catches buyers at the screenshot scroll).
5. **Onboarding / first scan** — show the empty-state UX is helpful, not overwhelming.

## Android screenshots

| Size | Device | Required count |
|---|---|---|
| Phone | 1080×1920 or higher | 2-8 |
| 7" tablet | 1200×1920 | optional |
| 10" tablet | 1920×1200 | optional |

Same content as iOS but can re-export from Figma.

## Promotional graphic (Google Play feature graphic)

1024×500 PNG, 24-bit, no alpha. Text overlay: brand + tagline.

## App metadata

### iOS App Store

| Field | Limit | Source |
|---|---|---|
| App name | 30 chars | "SaasCheckin — Event Check-in" |
| Subtitle | 30 chars | "QR scan + live dashboard" |
| Promotional text | 170 chars | Updated per release, no review needed |
| Description | 4000 chars | From `docs/marketing/app-store-description.md` (to write) |
| Keywords | 100 chars (comma-separated) | "check-in,events,QR,scan,tickets" |
| What's new | 4000 chars | Per-release changelog |
| Privacy policy URL | required | `https://saas-checkin.com/privacy` |
| Support URL | required | `https://saas-checkin.com/support` |
| Marketing URL | optional | `https://saas-checkin.com` |
| Category | Primary + secondary | Business (primary), Productivity (secondary) |
| Age rating | 4+ (no objectionable content) | Questionnaire auto-fills |

### Google Play

| Field | Limit | Notes |
|---|---|---|
| App name | 50 chars | |
| Short description | 80 chars | Shown in search results |
| Full description | 4000 chars | |
| App icon | 512×512 | |
| Feature graphic | 1024×500 | Required for featured placement |
| Screenshots | min 2, max 8 per device type | |
| Privacy policy URL | required | Same as iOS |
| Data safety form | required (GDPR-style) | "No data shared with third parties" + audit log + crash reports |
| Content rating | IARC questionnaire | Everyone / PEGI 3 |
| Target API level | 34+ (Android 14) | As of 2026 |

## Versioning strategy

Mobile follows [SemVer](https://semver.org/):

- **MAJOR** (1.0 → 2.0) — breaking change to public API or UX (rare).
- **MINOR** (0.1 → 0.2) — new features, backwards-compatible.
- **PATCH** (0.0.1 → 0.0.2) — bug fixes, no new features.

Build number increments monotonically per platform (required by both stores):
- iOS: `CFBundleVersion` (integer, must increase per upload).
- Android: `versionCode` (integer, same).

`pubspec.yaml` format: `version: MAJOR.MINOR.PATCH+BUILD`
```yaml
version: 1.4.2+47   # 1.4.2 release, build 47
```

## Localization metadata

- [ ] `app_en.arb` (English — required)
- [ ] `app_vi.arb` (Vietnamese — primary market)
- [ ] `app_ja.arb` (Japanese — secondary market)

iOS: add `CFBundleLocalizations` to Info.plist.
Android: add `<locale>` resources under `res/values-vi/`, `res/values-ja/`.

## Data safety form (Google Play) — pre-filled

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | Yes |
| Is all of the user data collected by your app encrypted in transit? | Yes (TLS 1.2+) |
| Do you provide a way for users to request that their data is deleted? | Yes (in-app + email) |
| Account info (email, name) | Collected, not shared |
| App activity (audit log) | Collected, not shared |
| Device ID (Sentry) | Collected, not shared with third parties |
| Financial info (Stripe) | Not collected by SaasCheckin app (handled by Stripe SDK) |
| Location | Not collected |
| Contacts | Not collected |
| Health & fitness | Not collected |
| Messages | Not collected |
| Photos / videos | Not collected |
| Audio | Not collected |
| Files | Not collected |
| Calendar | Not collected |
| Camera | Yes (QR scanner only — not stored) |

## Sign-off

- [ ] Product manager approves final screenshots
- [ ] Designer approves icon (Aurora palette compliance)
- [ ] Marketing approves description + keywords
- [ ] Legal approves privacy policy + ToS links
- [ ] Tech lead approves build artifacts (versionCode, hash, signing)
