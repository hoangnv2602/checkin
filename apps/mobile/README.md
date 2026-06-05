# apps/mobile — Flutter Check-in App (D9)

> Flutter 3.6 — iOS + Android. **BLoC + Cubit** (D9). Feature-first layout.
> Audience: event staff (gate scanner), check-in operators.

## Phase 0 status

- ✅ Project skeleton (pubspec, analysis_options, main.dart, app.dart)
- ✅ Feature-first layout: `lib/features/<name>/{data,domain,presentation}`
- ✅ 3 BLoCs scaffolded: `SessionCubit`, `AuthBloc`, `ScanBloc`
- ✅ 2 screens placeholder: Login, Scan
- ✅ go_router với 2 routes
- ✅ Env config qua `--dart-define` (compile-time)
- ✅ Sentry init (no-op nếu DSN rỗng)
- ⏳ Phase 1+: real API client, secure storage, drift schema, mobile_scanner
- ⏳ Android/iOS native config (`flutter create .`) — Phase 0 chỉ có placeholder

## Quick start

```bash
cd apps/mobile
flutter pub get
flutter pub run build_runner build       # drift/retrofit codegen (Phase 1+)
flutter run --dart-define=API_BASE_URL=http://localhost:3001/v1
```

## Test

```bash
flutter test
melos run test         # monorepo-wide
melos run analyze      # dart analyze
melos run format       # dart format .
```

## Layout (D9 + clean architecture lite)

```
lib/
├── main.dart                       # entry point + Sentry init
├── app.dart                        # MultiBlocProvider + MaterialApp.router
├── core/
│   ├── config/env.dart            # API_BASE_URL, WS_BASE_URL, SENTRY_DSN
│   ├── router/app_router.dart     # go_router config
│   ├── network/                   # dio + retrofit client (Phase 1)
│   ├── storage/                   # flutter_secure_storage wrapper (Phase 1)
│   └── theme/                     # Aurora tokens cho mobile (Phase 2)
└── features/
    ├── auth/                      # Login, MFA, session restore
    │   ├── data/{datasources,repositories,models}
    │   ├── domain/{entities,repositories,usecases}
    │   └── presentation/{blocs,screens}
    └── checkin/                   # QR scan (Phase 4 — I-401)
        └── (same structure)
```

## Boundaries

- **KHÔNG dùng Provider, Riverpod, setState cho shared state** — BLoC/Cubit only.
- **data → domain → presentation** dependency direction (clean architecture).
- **Cross-feature communication** qua core/ (vd: SessionCubit ở core, được wrap trong MultiBlocProvider).

## Phase 1+ ghi chú

- `flutter create .` ở Phase 0 chưa chạy → Android/iOS folders empty. Phase 1 sẽ generate native config.
- Drift schema ở `lib/core/storage/schema.dart` (offline check-in queue).
- Mobile dùng OpenAPI client từ `packages/contracts/` (sau I-016).
