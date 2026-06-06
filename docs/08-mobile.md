# 08 · Mobile (Flutter — BLoC + Cubit, iOS + Android, D5 + D9)

> **State management: BLoC + Cubit** (D9). Cubit cho state đơn giản, full BLoC cho flow event-driven. Không Riverpod, không Provider, không setState cho shared state.

## Tech stack

- **State:** BLoC 8.x + Cubit — package `flutter_bloc`
- **Test state:** `bloc_test`, `mocktail`
- **Equality:** `equatable` cho BLoC state/event
- **Routing:** go_router
- **HTTP:** dio + retrofit (codegen từ OpenAPI)
- **Local DB:** drift (SQLite) cho offline queue
- **QR scan:** mobile_scanner (iOS + Android)
- **Secure storage:** flutter_secure_storage (Keychain / Keystore)
- **Background sync:** workmanager + connectivity_plus
- **Crash:** sentry_flutter
- **Analytics:** posthog_flutter (self-host)
- **DI:** get_it cho service-locator (Bloc nhận repo qua constructor injection)
- **i18n:** intl + file ARB
- **Test:** flutter_test + integration_test + bloc_test

## Khi nào dùng Cubit vs BLoC

| Dùng **Cubit** khi | Dùng **BLoC** khi |
|--------------------|--------------------|
| Chuyển trạng thái đơn giản (toggle, counter) | Cần event stream để log / replay |
| Không cần coordinate async phức tạp | Cần debounce, throttle, transformer |
| Ít action, hiển nhiên | Nhiều intent chi tiết từ UI (vd flow scan: `QrDetected`, `VerifyRequested`, `SubmitRequested`, `ResetRequested`) |
| Vd: `SessionCubit`, `FilterCubit` | Vd: `ScanBloc`, `SyncBloc`, `AuthBloc` |

## Cấu trúc app

```
lib/
├── main.dart
├── app.dart                      # MaterialApp.router + MultiBlocProvider
├── core/                         # hạ tầng cross-feature
│   ├── http/                     # dio client, interceptor (auth, retry, logging)
│   ├── storage/                  # secure_storage, drift
│   ├── auth/                     # JWT in-memory, refresh interceptor
│   ├── realtime/                 # socket.io client
│   ├── telemetry/                # sentry + posthog
│   ├── theme/
│   └── di/                       # get_it service locator
├── router.dart                   # GoRouter
└── features/                     # feature-first
    ├── auth/
    │   ├── data/
    │   │   ├── datasources/      # AuthRemoteDataSource
    │   │   ├── models/           # UserDto, AuthResponseDto
    │   │   └── repositories/     # AuthRepositoryImpl
    │   ├── domain/
    │   │   ├── entities/         # User, Session
    │   │   ├── repositories/     # AuthRepository (interface)
    │   │   └── usecases/         # Login, Logout, RefreshToken
    │   └── presentation/
    │       ├── blocs/
    │       │   ├── auth_bloc.dart
    │       │   ├── auth_event.dart
    │       │   └── auth_state.dart
    │       ├── screens/          # LoginScreen
    │       └── widgets/          # LoginForm
    ├── checkin/
    │   ├── data/
    │   │   ├── datasources/
    │   │   │   ├── check_in_remote_data_source.dart
    │   │   │   └── pending_check_in_local_data_source.dart   # drift
    │   │   ├── models/           # CheckInDto, PendingCheckInModel
    │   │   └── repositories/     # CheckInRepositoryImpl
    │   ├── domain/
    │   │   ├── entities/         # QrPayload, CheckInResult, PendingCheckIn
    │   │   ├── repositories/     # CheckInRepository (interface)
    │   │   └── usecases/         # ScanQr, ManualCheckIn, SyncPending
    │   └── presentation/
    │       ├── blocs/
    │       │   ├── scan_bloc.dart           # full BLoC
    │       │   ├── scan_event.dart
    │       │   ├── scan_state.dart
    │       │   ├── sync_bloc.dart           # background sync
    │       │   └── scan_result_cubit.dart   # hiển thị overlay kết quả gần nhất
    │       ├── screens/          # ScanScreen, ManualCheckInScreen, HistoryScreen
    │       └── widgets/          # ScanResultOverlay, ScanCamera
    ├── events/
    │   ├── data/
    │   ├── domain/
    │   └── presentation/
    │       ├── blocs/            # EventListCubit, EventDetailBloc
    │       ├── screens/
    │       └── widgets/
    └── profile/
        ├── data/
        ├── domain/
        └── presentation/
            ├── blocs/            # ProfileCubit
            ├── screens/
            └── widgets/
```

## Ví dụ: `ScanBloc` (pattern full BLoC)

```dart
// features/checkin/presentation/blocs/scan_event.dart
sealed class ScanEvent extends Equatable {
  const ScanEvent();
  @override
  List<Object?> get props => [];
}

class QrDetected extends ScanEvent {
  final String qrData;
  const QrDetected(this.qrData);
  @override
  List<Object?> get props => [qrData];
}

class VerifyRequested extends ScanEvent {
  const VerifyRequested();
}

class SyncRequested extends ScanEvent {
  const SyncRequested();
}

class ResetRequested extends ScanEvent {
  const ResetRequested();
}
```

```dart
// features/checkin/presentation/blocs/scan_state.dart
enum ScanStatus { idle, verifying, accepted, rejected, duplicate, queuedOffline }

class ScanState extends Equatable {
  final ScanStatus status;
  final String? lastQrData;
  final CheckInResult? result;
  final String? errorMessage;

  const ScanState({
    this.status = ScanStatus.idle,
    this.lastQrData,
    this.result,
    this.errorMessage,
  });

  ScanState copyWith({...}) => ScanState(...);

  @override
  List<Object?> get props => [status, lastQrData, result, errorMessage];
}
```

```dart
// features/checkin/presentation/blocs/scan_bloc.dart
class ScanBloc extends Bloc<ScanEvent, ScanState> {
  final ScanQr scanQr;
  final QrSignatureVerifier verifier;
  final PendingCheckInLocalDataSource local;

  ScanBloc({required this.scanQr, required this.verifier, required this.local})
      : super(const ScanState()) {
    on<QrDetected>(_onQrDetected);
    on<VerifyRequested>(_onVerifyRequested, transformer: droppable());
    on<SyncRequested>(_onSyncRequested);
    on<ResetRequested>((_, emit) => emit(const ScanState()));
  }

  Future<void> _onQrDetected(QrDetected event, Emitter<ScanState> emit) async {
    emit(state.copyWith(status: ScanStatus.verifying, lastQrData: event.qrData));
    try {
      final payload = QrPayload.fromQrString(event.qrData);
      final isValid = await verifier.verify(payload);
      if (!isValid) {
        emit(state.copyWith(status: ScanStatus.rejected, errorMessage: 'Invalid signature'));
        return;
      }
      add(const VerifyRequested());
    } catch (e) {
      emit(state.copyWith(status: ScanStatus.rejected, errorMessage: e.toString()));
    }
  }

  Future<void> _onVerifyRequested(VerifyRequested event, Emitter<ScanState> emit) async {
    try {
      final result = await scanQr(state.lastQrData!);
      emit(state.copyWith(status: _toStatus(result), result: result));
    } on NetworkException {
      // queue offline
      await local.insert(state.lastQrData!);
      emit(state.copyWith(status: ScanStatus.queuedOffline));
    } catch (e) {
      emit(state.copyWith(status: ScanStatus.rejected, errorMessage: e.toString()));
    }
  }
}
```

## Ví dụ: `SessionCubit` (state đơn giản)

```dart
// features/auth/presentation/blocs/session_cubit.dart
class SessionCubit extends Cubit<SessionState> {
  final GetCurrentSession getSession;
  final Logout logout;

  SessionCubit({required this.getSession, required this.logout}) : super(const SessionState.unknown());

  Future<void> hydrate() async {
    final session = await getSession();
    emit(session == null ? const SessionState.signedOut() : SessionState.signedIn(session));
  }

  Future<void> signOut() async {
    await logout();
    emit(const SessionState.signedOut());
  }
}
```

## BlocProvider cấp app (app.dart)

```dart
class SaasCheckInApp extends StatelessWidget {
  const SaasCheckInApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiBlocProvider(
      providers: [
        BlocProvider<SessionCubit>(
          create: (_) => sl<SessionCubit>()..hydrate(),
        ),
        BlocProvider<ScanBloc>(
          create: (_) => sl<ScanBloc>(),
        ),
        BlocProvider<SyncBloc>(
          create: (_) => sl<SyncBloc>()..start(),
        ),
      ],
      child: MaterialApp.router(
        title: 'Check-in',
        theme: AppTheme.light,
        routerConfig: appRouter,
      ),
    );
  }
}
```

## Flow check-in offline (D9)

```
1. Staff quét QR (mobile_scanner emit QrDetected)
2. ScanBloc._onQrDetected verify chữ ký Ed25519 offline (JWKS đã cache)
3. ScanBloc._onVerifyRequested gọi usecase scanQr
4. Usecase → Repository → RemoteDataSource (dio)
5. Thành công → emit ScanStatus.accepted → UI hiển thị overlay ✓
6. NetworkException → usecase gọi local.insert() → emit ScanStatus.queuedOffline
7. SyncBloc định kỳ (workmanager 15s):
     - drain pending_checkin
     - retry qua RemoteDataSource
     - 200 → local.delete; 409 → đánh dấu đã giải quyết
8. Server là source of truth: server reconciliation thắng khi xung đột
```

## Schema drift (local)

```dart
@DataClassName('PendingCheckIn')
class PendingCheckIns extends Table {
  TextColumn get id => text()();
  TextColumn get eventId => text()();
  TextColumn get gateId => text()();
  TextColumn get qrPayloadJson => text()();
  TextColumn get qrSignature => blob()();
  TextColumn get scannedAt => text()();
  TextColumn get status => text().withDefault(const Constant('pending'))();
  // pending | sent | conflict | failed
  IntColumn  get attempts => integer().withDefault(const Constant(0))();
  TextColumn get lastError => text().nullable()();
}
```

## Verify QR offline

- Endpoint JWKS: `GET /v1/public/jwks?tenantId=...` (public, cache 24h)
- Lưu trong `flutter_secure_storage`
- Library: package `cryptography` Dart (verify Ed25519)
- Khi miss key rotate → fallback online check; nếu offline, hiển thị "verify khi online"

## Màn hình

- **Login** — org code (slug) + email + password HOẶC magic link
- **Event list** — event được gán cho staff này
- **Scan** — camera toàn màn hình, rung khi thành công/thất bại, overlay kết quả
- **Manual check-in** — search theo registration id / email / phone
- **History** — local gần đây + remote phân trang
- **Profile / logout**

## Parity iOS + Android (D5)

- Mọi màn hình test trên cả 2 nền tảng trước khi release
- Dùng Material 3 cho design nhất quán
- Riêng iOS: khai báo camera + Face ID usage description trong Info.plist
- Riêng Android: permission `CAMERA` + `USE_BIOMETRIC` trong AndroidManifest
- Listing App Store / Play Store chuẩn bị ở Phase 4
- Một release tag → CI build cả 2 nền tảng qua `melos run build:ios` / `melos run build:android`

## Flow auth (D2)

- Login: `POST /v1/auth/login` → access (in-memory) + refresh (secure storage)
- dio interceptor thêm `Authorization: Bearer <access>` cho mọi request
- Khi 401: gọi `POST /v1/auth/refresh` 1 lần, retry request gốc
- Refresh fail → `SessionCubit.signOut()` → redirect tới login
- Biometric (Face ID / vân tay) cho re-entry app (KHÔNG cho token — bảo vệ truy cập local)

## Test

- **Unit:** flutter_test cho usecase, repository
- **Bloc test:** `bloc_test` cho mọi Bloc/Cubit:
  ```dart
  blocTest<ScanBloc, ScanState>(
    'emits [verifying, accepted] when QR valid',
    build: () => ScanBloc(scanQr: mockScanQr, verifier: mockVerifier, local: mockLocal),
    act: (bloc) => bloc.add(QrDetected(validQr)),
    expect: () => [
      isA<ScanState>().having((s) => s.status, 'status', ScanStatus.verifying),
      isA<ScanState>().having((s) => s.status, 'status', ScanStatus.accepted),
    ],
  );
  ```
- **Widget:** pump widget với `BlocProvider.value`
- **Integration:** `integration_test` cho full flow scan → sync trên thiết bị thật
- **Golden test:** cho UI overlay kết quả scan (mỗi nền tảng)

## Build / Release

- **CI:** `melos run build:ios` → IPA, `melos run build:android` → AAB
- **Phân phối nội bộ:** Firebase App Distribution cho Android, TestFlight cho iOS
- **Release store:** Fastlane match cho signing, metadata store để trong `tools/store/`

## gRPC vs REST (Phase 8 — I-801)

Phase 8 bật gRPC cho mobile, REST cho web. Một binary, hai protocol song song.

| Client | Protocol | Port | Lý do |
|--------|----------|------|-------|
| Mobile (Flutter) | **gRPC** (mặc định khi bật flag) | BFF `:50052` | p95 scan < 100ms (vs 200ms REST) |
| Mobile (fallback) | REST | BFF `:3001` | Khi BFF gRPC down → auto-fallback về Dio |
| Web (Next.js) | **REST** | BFF `:3001` | Server Components, OpenAPI auto-gen |
| Checkin-admin | REST | BFF `:3001` | Không phải hot path |

Build flags:

```bash
# Mobile production với gRPC bật
flutter build apk --release \
  --dart-define=USE_GRPC=true \
  --dart-define=GRPC_HOST=api.saas-checkin.com:50052

# Mobile dev (REST, không cần BFF gRPC chạy)
flutter run --dart-define=USE_GRPC=false
```

BFF gRPC server (Phase 8):
- Port: `50052` (env `GRPC_SERVER_PORT`)
- Bật/tắt: `GRPC_SERVER_ENABLED=true|false` (default `true`)
- Boot song song với HTTP qua `app.connectMicroservice()`
- Handlers hiện tại: `CheckInService.{Scan, GetEventStats, UndoCheckIn}`
- File: `apps/api-gateway/src/modules/grpc-server/`

Mobile gRPC client:
- File: `apps/mobile/lib/core/network/grpc/{grpc_config,checkin_grpc_client}.dart`
- Channel: `grpc.ClientChannel` với `ChannelCredentials.secure()` cho prod, insecure cho dev
- Metadata: `authorization: Bearer <jwt>`, `x-tenant-id: <tenantId>`
- Marshalling: JSON over gRPC (transition) — sẽ migrate sang protobuf khi `buf generate` chạy
- Auto-fallback: `GrpcError.unimplemented` / `unavailable` → switch sang Dio REST

Source code map (I-801):
- `apps/api-gateway/src/modules/grpc-server/grpc-server.config.ts`
- `apps/api-gateway/src/modules/grpc-server/grpc-server.module.ts`
- `apps/api-gateway/src/modules/grpc-server/checkin-grpc.controller.ts`
- `apps/api-gateway/test/grpc-server.e2e-spec.ts`
- `apps/mobile/lib/core/network/grpc/grpc_config.dart`
- `apps/mobile/lib/core/network/grpc/checkin_grpc_client.dart`
- `apps/mobile/lib/features/checkin/data/datasources/checkin_remote_datasource.dart` (gRPC + REST switch)
