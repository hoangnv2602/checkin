# 0010. State management Flutter: BLoC + Cubit

- **Status:** Accepted (D9)
- **Date:** 2026-06-04

## Context

App mobile có hai loại state rõ rệt:

1. **UI state đơn giản** — toggle, lựa chọn hiện tại, giá trị form local, visibility của modal.
2. **Flow async event-driven** — QR scan → verify → submit → success/failure; background sync offline queue; auth login → lưu session.

Các lựa chọn quản lý state:
- **BLoC + Cubit** — event/state tường minh, test tốt qua `bloc_test`, ecosystem lớn.
- **Riverpod** — dựa trên provider, ít boilerplate hơn, nhưng trộn "state đến từ đâu" với "được consume thế nào".
- **Chỉ Provider** — quá low-level cho flow không tầm thường.
- **setState** — chỉ chấp nhận cho state widget-local thoáng qua.

Flow quan trọng nhất của app mobile (scan) là event-driven với nhiều state chi tiết (verifying, accepted, rejected, queued offline, syncing). Đó là use case điển hình của BLoC.

## Decision

Áp dụng **BLoC + Cubit** (từ `flutter_bloc` 8.x) làm giải pháp state management duy nhất cho `apps/mobile/`.

- **Cubit** cho state đơn giản — `SessionCubit`, `FilterCubit`, `ThemeCubit`, màn form đơn giản.
- **Full BLoC** cho flow event-driven — `ScanBloc`, `SyncBloc`, `AuthBloc`, `EventDetailBloc`.
- Dùng `equatable` cho state/event equality, `bloc_test` cho unit test.
- Instance Bloc được đăng ký trong `core/di/service_locator.dart` (dùng `get_it`) và cung cấp qua `MultiBlocProvider` trong `app.dart`.
- Constructor injection: Bloc nhận usecase / repository qua constructor — không `BuildContext.read` bên trong Bloc.
- **Cấm:** Riverpod, `Provider`, `setState` cho shared state chéo widget. `setState` OK chỉ cho state thuần local của widget (vd animate 1 widget).

## Consequences

### Positive
- **State machine tường minh** — `ScanState` là sealed/enum class; state không thể tồn tại là unrepresentable.
- **Khả năng test** — `bloc_test` + `mocktail` cho coverage đầy đủ với expectation tất định.
- **Xử lý async** — event transformer (`droppable`, `debounce`, `restartable`) có sẵn; không cần debounce thủ công trong widget.
- **Logging/replay** — event là stream tường minh; có thể log hoặc replay để debug.
- **Quen thuộc với hầu hết Flutter hire** — BLoC là pattern state được biết đến rộng rãi nhất.

### Negative
- Boilerplate nhiều hơn Riverpod (event + state + bloc cho mỗi flow không tầm thường).
- Dev mới cần học tách event/state trước khi contribute.
- Quy ước 3 file (`_bloc.dart`, `_event.dart`, `_state.dart`) / feature có thể thấy nặng cho feature nhỏ.

### Neutral
- Dùng Cubit khi lớp event của BLoC là overkill; giảm boilerplate cho ~30% case.
- Bloc-to-Bloc communication qua Cubit/BLoC listener hoặc shared repository; tránh `bloc.emit` trực tiếp từ bên ngoài.

## Quy ước folder (mỗi feature)

```
features/<name>/presentation/
├── blocs/
│   ├── <name>_bloc.dart
│   ├── <name>_event.dart
│   └── <name>_state.dart
└── (hoặc)
├── cubits/
│   └── <name>_cubit.dart
```

## Alternatives considered

- **Riverpod** — DX tốt, nhưng team có nhiều kinh nghiệm BLoC hơn và flow scan event-driven hợp BLoC hơn.
- **Chỉ Provider** — quá low-level; sẽ tự re-implement BLoC.
- **Redux (flutter_redux)** — boilerplate nặng hơn, kém idiomatic trong Flutter hiện đại.

## Revisit if

- Team chuẩn hoá trên Riverpod và BLoC trở thành nút thắt tuyển dụng.
- Feature mới cần reactivity chi tiết mà BLoC stream model xử lý kém.
