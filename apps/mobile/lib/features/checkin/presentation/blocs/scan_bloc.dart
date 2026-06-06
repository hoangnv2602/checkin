/**
 * lib/features/checkin/presentation/blocs/scan_bloc.dart
 *
 * I-403 — ScanBloc: full state machine for QR scan flow.
 *
 * Events: ScanDetected, ScanConfirmed, ScanReverted, SyncRequested
 * States: ScanIdle, ScanDetected, ScanSubmitting, ScanSuccess,
 *         ScanDuplicate, ScanRejected, ScanOfflineQueued, ScanError
 *
 * Side effects: haptic + audio (success vs reject).
 */
import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';
import 'package:flutter/services.dart';
import 'package:audioplayers/audioplayers.dart';

import '../../domain/entities/check_in_outcome.dart';
import '../../domain/entities/scanned_ticket.dart';
import '../../domain/repositories/checkin_repository.dart';

// Events
abstract class ScanEvent extends Equatable {
  const ScanEvent();
  @override
  List<Object?> get props => [];
}

class ScanDetected extends ScanEvent {
  final ScannedTicket ticket;
  const ScanDetected(this.ticket);
  @override
  List<Object?> get props => [ticket];
}

class ScanManualSubmitted extends ScanEvent {
  final String email;
  const ScanManualSubmitted(this.email);
  @override
  List<Object?> get props => [email];
}

class ScanReset extends ScanEvent {
  const ScanReset();
}

// States
abstract class ScanState extends Equatable {
  const ScanState();
  @override
  List<Object?> get props => [];
}

class ScanIdle extends ScanState {
  const ScanIdle();
}

class ScanSubmitting extends ScanState {
  final ScannedTicket ticket;
  const ScanSubmitting(this.ticket);
  @override
  List<Object?> get props => [ticket];
}

class ScanSucceeded extends ScanState {
  final ScannedTicket ticket;
  final String attendeeName;
  const ScanSucceeded({required this.ticket, required this.attendeeName});
  @override
  List<Object?> get props => [ticket, attendeeName];
}

class ScanDuplicateDetected extends ScanState {
  final ScannedTicket ticket;
  const ScanDuplicateDetected(this.ticket);
  @override
  List<Object?> get props => [ticket];
}

class ScanRejected extends ScanState {
  final ScannedTicket ticket;
  final String reason;
  const ScanRejected({required this.ticket, required this.reason});
  @override
  List<Object?> get props => [ticket, reason];
}

class ScanOfflineQueued extends ScanState {
  final ScannedTicket ticket;
  const ScanOfflineQueued(this.ticket);
  @override
  List<Object?> get props => [ticket];
}

class ScanError extends ScanState {
  final String message;
  const ScanError(this.message);
  @override
  List<Object?> get props => [message];
}

class ScanBloc extends Bloc<ScanEvent, ScanState> {
  final CheckInRepository _repo;
  final AudioPlayer _audio = AudioPlayer();

  // staff context — inject từ SessionBloc
  String gateId = '';
  String staffUserId = '';

  ScanBloc(this._repo) : super(const ScanIdle()) {
    on<ScanDetected>(_onDetected);
    on<ScanReset>((_, emit) => emit(const ScanIdle()));
  }

  Future<void> _onDetected(ScanDetected event, Emitter<ScanState> emit) async {
    emit(ScanSubmitting(event.ticket));
    try {
      final outcome = await _repo.submitScan(
        ticket: event.ticket,
        gateId: _asGuid(gateId),
        staffUserId: _asGuid(staffUserId),
      );
      _hapticFor(outcome);
      switch (outcome.status) {
        case CheckInStatus.success:
          emit(ScanSucceeded(
            ticket: event.ticket,
            attendeeName: outcome.attendeeName ?? 'Attendee',
          ));
          break;
        case CheckInStatus.duplicate:
          emit(ScanDuplicateDetected(event.ticket));
          break;
        case CheckInStatus.rejected:
          emit(ScanRejected(
            ticket: event.ticket,
            reason: outcome.rejectReason ?? 'Rejected',
          ));
          break;
      }
    } catch (e) {
      emit(ScanError(e.toString()));
    }
  }

  void _hapticFor(CheckInOutcome outcome) {
    switch (outcome.status) {
      case CheckInStatus.success:
        HapticFeedback.heavyImpact();
        _audio.play(AssetSource('sounds/success.mp3'));
        break;
      case CheckInStatus.duplicate:
        HapticFeedback.mediumImpact();
        _audio.play(AssetSource('sounds/duplicate.mp3'));
        break;
      case CheckInStatus.rejected:
        HapticFeedback.heavyImpact();
        _audio.play(AssetSource('sounds/reject.mp3'));
        break;
    }
  }

  Guid _asGuid(String value) => Guid(value);
}
