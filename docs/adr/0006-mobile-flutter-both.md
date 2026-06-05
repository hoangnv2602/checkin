# 0006. Nền tảng mobile: Flutter, iOS + Android cùng lúc

- **Status:** Accepted (D5)
- **Date:** 2026-06-04

## Context

App check-in dùng cho gate staff trên chính điện thoại của họ. Phải đáng tin, nhanh, và offline-capable. Ba chiến lược nền tảng:
- **Flutter (iOS + Android từ một codebase)**
- **Native iOS + native Android** (hai team / gấp đôi công)
- **React Native** (JavaScript khắp nơi, nhưng tooling offline yếu hơn)

Tính năng quan trọng của app (QR scan, offline SQLite queue, background sync, secure storage) có package Flutter trưởng thành (`mobile_scanner`, `drift`, `workmanager`, `flutter_secure_storage`) và yêu cầu tích hợp OS sâu.

## Decision

Dùng **Flutter** và ship **iOS + Android cùng lúc**, bắt đầu với bản TestFlight + Internal Testing ở Phase 4.

- Một codebase Dart, 2 release store được điều phối
- CI: `melos run build:ios` (TestFlight) và `melos run build:android` (Play Internal) trên cùng git tag
- Yêu cầu feature parity trên cả 2 nền tảng; không có đường tắt "chỉ-Android"
- Tag release v0.1.0 → cả 2 store nhận trong cùng 24 giờ

## Consequences

### Positive
- Một dev team viết cả 2 app.
- Một nguồn sự thật cho hành vi offline, logic QR, xử lý JWT.
- Migration schema drift áp dụng giống nhau trên cả 2 nền tảng.

### Negative
- Quy trình review App Store + Play Store chạy khác timeline; một cái có thể block cái kia.
- Package Flutter cho một số tính năng platform-specific (vd camera nâng cao) có thể chậm hơn native SDK.
- Phải maintain metadata + signing setup của cả 2 store song song.

### Neutral
- Icon app, splash, listing store có thể khác / nền tảng (mình giữ giống nhau để nhất quán brand).

## Alternatives considered

- **Android trước, iOS sau** — giảm một nửa risk review nhưng gấp đôi timeline; user chọn rõ là cả hai.
- **Native (Swift + Kotlin)** — UX tốt nhất nhưng gấp đôi engineering. Không có business case ở MVP.
- **React Native** — ecosystem cho offline + barcode yếu hơn Flutter. Team có nhiều kinh nghiệm Flutter hơn.

## Quality gate (cả 2 nền tảng)

- Mọi tính năng chạy trên iPhone SE (màn nhỏ) và Android 5 năm tuổi (RAM thấp)
- Accessibility: nhãn VoiceOver / TalkBack trên mọi widget tương tác
- Hiệu năng: cold start < 2s, scan → overlay success < 200ms
- Crash-free session > 99.5% (Sentry)
- Không code platform-conditional (`Platform.isIOS` cho phép nhưng minimize)
