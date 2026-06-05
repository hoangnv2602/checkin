import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';

/// SessionCubit — global session state (JWT, current user, current tenant).
/// Phase 0 stub — chỉ quản lý "logged in / out" flag.
/// Phase 1+ thêm: refresh token rotation, biometric unlock, multi-tenant switcher.
class SessionCubit extends Cubit<SessionState> {
  SessionCubit() : super(const SessionInitial());

  Future<void> bootstrap() async {
    // Phase 1: read secure storage, restore session
    emit(const SessionSignedOut());
  }

  Future<void> signIn(String accessToken, String refreshToken) async {
    // Phase 1: persist tokens via flutter_secure_storage
    emit(SessionSignedIn(accessToken: accessToken, refreshToken: refreshToken));
  }

  Future<void> signOut() async {
    emit(const SessionSignedOut());
  }
}

abstract class SessionState extends Equatable {
  const SessionState();
  @override
  List<Object?> get props => [];
}

class SessionInitial extends SessionState {
  const SessionInitial();
}

class SessionSignedOut extends SessionState {
  const SessionSignedOut();
}

class SessionSignedIn extends SessionState {
  const SessionSignedIn({required this.accessToken, required this.refreshToken});
  final String accessToken;
  final String refreshToken;
  @override
  List<Object?> get props => [accessToken, refreshToken];
}
