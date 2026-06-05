import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';

// Phase 0 stub. Phase 1+ thêm events: LoginRequested, MfaRequired, TokenRefreshed.
// States: AuthInitial, AuthLoading, AuthAuthenticated, AuthUnauthenticated, AuthError.

abstract class AuthEvent extends Equatable {
  const AuthEvent();
  @override
  List<Object?> get props => [];
}

class AuthStarted extends AuthEvent {
  const AuthStarted();
}

class AuthLoginRequested extends AuthEvent {
  const AuthLoginRequested({required this.email, required this.password});
  final String email;
  final String password;
  @override
  List<Object?> get props => [email, password];
}

abstract class AuthState extends Equatable {
  const AuthState();
  @override
  List<Object?> get props => [];
}

class AuthInitial extends AuthState {
  const AuthInitial();
}

class AuthLoading extends AuthState {
  const AuthLoading();
}

class AuthAuthenticated extends AuthState {
  const AuthAuthenticated();
}

class AuthUnauthenticated extends AuthState {
  const AuthUnauthenticated({this.error});
  final String? error;
  @override
  List<Object?> get props => [error];
}

class AuthBloc extends Bloc<AuthEvent, AuthState> {
  AuthBloc() : super(const AuthInitial()) {
    on<AuthStarted>((event, emit) async {
      emit(const AuthLoading());
      // Phase 1: call AuthRepository.bootstrap()
      emit(const AuthUnauthenticated());
    });
    on<AuthLoginRequested>((event, emit) async {
      emit(const AuthLoading());
      // Phase 1: call AuthRepository.login(email, password)
      emit(const AuthUnauthenticated(error: 'Phase 0 stub'));
    });
  }
}
