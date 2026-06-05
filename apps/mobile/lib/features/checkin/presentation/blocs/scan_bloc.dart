import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';

// Phase 0 stub. Phase 4 (I-401) sẽ wire:
// Events: ScanDetected(qrPayload), ScanConfirmed, ScanUndone
// States: ScanIdle, ScanInProgress, ScanSuccess, ScanFailure, ScanOffline
// Sử dụng mobile_scanner + dio gRPC call tới core-api.

abstract class ScanEvent extends Equatable {
  const ScanEvent();
  @override
  List<Object?> get props => [];
}

class ScanStarted extends ScanEvent {
  const ScanStarted();
}

class ScanStopped extends ScanEvent {
  const ScanStopped();
}

abstract class ScanState extends Equatable {
  const ScanState();
  @override
  List<Object?> get props => [];
}

class ScanIdle extends ScanState {
  const ScanIdle();
}

class ScanReady extends ScanState {
  const ScanReady();
}

class ScanBloc extends Bloc<ScanEvent, ScanState> {
  ScanBloc() : super(const ScanIdle()) {
    on<ScanStarted>((event, emit) async {
      emit(const ScanReady());
    });
    on<ScanStopped>((event, emit) async {
      emit(const ScanIdle());
    });
  }
}
