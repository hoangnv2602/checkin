# Store submission runbook (I-705)

Submit Flutter app lên Apple App Store + Google Play. Submit **ít nhất 5 ngày làm việc trước launch target**.

> **Đọc kèm:** `docs/operations/store-asset-checklist.md` (icons, screenshots, metadata),
> `docs/legal/privacy-policy.md` (template — cần legal review trước publish),
> `docs/legal/terms-of-service.md` (template).

## Apple App Store

### Pre-flight

- [ ] Apple Developer account active ($99/year)
- [ ] App ID registered: `com.saas-checkin.app` (bundle ID matches `Info.plist`)
- [ ] Provisioning profile: App Store distribution
- [ ] Xcode 15+, iOS 16+ deployment target
- [ ] Privacy policy URL: `https://saas-checkin.com/privacy` (template in `docs/legal/privacy-policy.md`)
- [ ] Support URL: `https://saas-checkin.com/support`
- [ ] App icon: 1024x1024 PNG (no transparency, no rounded corners)
- [ ] Screenshots: 6.7" (iPhone 15 Pro Max), 6.5", 5.5" (iPhone 8 Plus), 12.9" iPad Pro
- [ ] Description (max 4000 chars), keywords (max 100 chars), category, age rating
- [ ] What's new (release notes)
- [ ] Encryption declaration (only HTTPS — exempt)
- [ ] App Tracking Transparency (nếu dùng IDFA — không, skip)
- [ ] Icon + screenshots meet `docs/operations/store-asset-checklist.md` requirements

### Build + submit

```bash
cd apps/mobile
flutter build ipa --release \
  --export-options-plist=ios/ExportOptions.plist

# Validate
xcrun altool --validate-app \
  -f build/ios/ipa/saas_checkin_mobile.ipa \
  -t ios \
  --apiKey $APPLE_API_KEY \
  --apiIssuer $APPLE_API_ISSUER

# Upload
xcrun altool --upload-app \
  -f build/ios/ipa/saas_checkin_mobile.ipa \
  -t ios \
  --apiKey $APPLE_API_KEY \
  --apiIssuer $APPLE_API_ISSUER
```

### TestFlight phases

1. **Internal** (developer team, instant) — smoke test production builds
2. **External** (TestFlight public link, 90 ngày) — 100-10000 testers
3. **Submit for Review** — App Store Connect → App Store tab

### App Store Review time

Trung bình 24-48 giờ. Có thể bị reject:
- Crash on launch (test trên real device)
- Privacy policy thiếu
- In-app purchase chưa khai báo (nếu có)
- App icon y chang template Apple

## Google Play

### Pre-flight

- [ ] Google Play Console account ($25 one-time)
- [ ] Service account JSON cho CI/CD
- [ ] Package name: `com.saas-checkin.app`
- [ ] Signing key (upload key + app signing key)
- [ ] Privacy policy URL
- [ ] App icon: 512x512 PNG
- [ ] Screenshots: phone, 7" tablet, 10" tablet
- [ ] Short description (80 chars), full description (4000 chars)
- [ ] Content rating (IARC questionnaire)
- [ ] Data safety form (GDPR-style disclosure)
- [ ] Ads declaration (nếu có)
- [ ] Target API level: API 34+ (Android 14)

### Build + submit

```bash
cd apps/mobile
flutter build appbundle --release

# Upload via fastlane hoặc direct
bundle exec fastlane supply \
  --track internal \
  --aab build/app/outputs/bundle/release/app-release.aab
```

### Tracks

1. **Internal testing** (100 testers, instant) — smoke test
2. **Closed testing** (alpha/beta) — invite-only, target users
3. **Open testing** (public beta opt-in)
4. **Production** — staged rollout 1% → 10% → 50% → 100%

### Play Review time

Trung bình 1-7 ngày. Strict hơn với:
- Background location
- SMS / Call log access
- Webview login
- Web支付 (cần khai báo)

## Submission timeline

| Day | Action |
|-----|--------|
| T-7 | Build release candidate, smoke test trên real devices |
| T-6 | TestFlight external testing (bắt đầu ngay) |
| T-5 | Submit App Store + Play Console (target) |
| T-4 | Apple review (1-3 ngày), Google review (1-7 ngày) |
| T-3 | Address review feedback nếu có |
| T-2 | Re-submit nếu cần |
| T-1 | Approved! Schedule release |
| T-0 | Public release |

## Post-launch

- [ ] Monitor Sentry crash rate (target < 0.1%)
- [ ] Monitor Play Store / App Store reviews (target > 4.0 stars)
- [ ] Watch ANR rate (Android), hang rate (iOS) trong Play/App Store Console
- [ ] Reply to user reviews trong 24h
- [ ] Submit hotfixes nếu crash > 0.5%

## Bundle ID + version

- **iOS bundle ID:** `com.saas-checkin.app` (set in `ios/Runner/Info.plist` → `CFBundleIdentifier`)
- **Android application ID:** `com.saas-checkin.app` (set in `android/app/build.gradle` → `defaultConfig.applicationId`)
- **Version source of truth:** `apps/mobile/pubspec.yaml` → `version: MAJOR.MINOR.PATCH+BUILD` (e.g. `1.4.2+47`)
- **Auto-injection:**
  - iOS: `--build-name=1.4.2 --build-number=47` flags
  - Android: read from pubspec, write to `versionName` + `versionCode` at build time

## Privacy nutrition labels (iOS) + Data safety (Android)

Cả hai stores yêu cầu disclosure chi tiết. Dùng data từ
`docs/operations/store-asset-checklist.md` → "Data safety form" section.
Re-review mỗi release (mỗi lần thêm analytics SDK / third-party service).

## CI integration

Recommended: Fastlane (cross-platform) cho cả iOS + Android. Setup:

```bash
# Init
cd apps/mobile
bundle init
bundle add fastlane
bundle exec fastlane init

# iOS lane
bundle exec fastlane ios beta     # → TestFlight
bundle exec fastlane ios release  # → App Store

# Android lane
bundle exec fastlane android internal   # → Internal testing
bundle exec fastlane android beta       # → Closed beta
bundle exec fastlane android production # → Production rollout
```

Secrets (Apple API key, Google Play service account JSON) load từ GitHub
Actions secrets (`APPLE_API_KEY`, `APPLE_API_ISSUER`, `GOOGLE_PLAY_JSON_KEY`).

