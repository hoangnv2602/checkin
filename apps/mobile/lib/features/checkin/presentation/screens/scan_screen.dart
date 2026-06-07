/**
 * lib/features/checkin/presentation/screens/scan_screen.dart
 *
 * I-403 — Staff camera scan screen. mobile_scanner package, ScanBloc state
 * machine, haptics + audio feedback on success/reject.
 *
 * Throttle detection: 800ms cooldown giữa các scan để tránh duplicate
 * (camera có thể emit 1 code nhiều lần). Idempotent: cùng JTI scan lại
 * sẽ trả 409 (handled by backend).
 */
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:go_router/go_router.dart';

import '../../domain/entities/scanned_ticket.dart';
import '../blocs/scan_bloc.dart';

class ScanScreen extends StatefulWidget {
  const ScanScreen({super.key});

  @override
  State<ScanScreen> createState() => _ScanScreenState();
}

class _ScanScreenState extends State<ScanScreen> {
  final MobileScannerController _controller = MobileScannerController(
    detectionSpeed: DetectionSpeed.noDuplicates,
    formats: const [BarcodeFormat.qrCode],
  );

  String? _lastScannedRaw;
  DateTime _lastScannedAt = DateTime.fromMillisecondsSinceEpoch(0);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _onDetect(BarcodeCapture capture) {
    for (final barcode in capture.barcodes) {
      final raw = barcode.rawValue;
      if (raw == null || raw.isEmpty) continue;

      // 800ms cooldown to avoid duplicate emission from camera
      final now = DateTime.now();
      if (raw == _lastScannedRaw &&
          now.difference(_lastScannedAt).inMilliseconds < 800) {
        continue;
      }
      _lastScannedRaw = raw;
      _lastScannedAt = now;

      final ticket = _parseQr(raw);
      if (ticket == null) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Invalid QR format')),
        );
        continue;
      }

      context.read<ScanBloc>().add(ScanDetected(ticket));
      break;
    }
  }

  /// QR payload: base64-encoded JSON `{"jti","rid","eid","oid","iat","exp","sig"}`.
  /// (Backend-core tạo chuẩn này — `RegistrationRepository.IssueQr`).
  ScannedTicket? _parseQr(String raw) {
    try {
      final decoded = jsonDecode(
        raw.contains('.')
            ? raw.split('.').last
            : utf8.decode(base64Decode(raw)),
      ) as Map<String, dynamic>;
      return ScannedTicket(
        jti: Guid(decoded['jti'] as String),
        registrationId: Guid(decoded['rid'] as String),
        eventId: Guid(decoded['eid'] as String),
        organizationId: Guid(decoded['oid'] as String),
        issuedAt: DateTime.parse(decoded['iat'] as String),
        expiresAt: DateTime.parse(decoded['exp'] as String),
        signature: decoded['sig'] as String,
      );
    } catch (_) {
      return null;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Scan QR'),
        actions: [
          IconButton(
            icon: const Icon(Icons.flash_on),
            onPressed: () => _controller.toggleTorch(),
          ),
          IconButton(
            icon: const Icon(Icons.cameraswitch),
            onPressed: () => _controller.switchCamera(),
          ),
        ],
      ),
      body: BlocConsumer<ScanBloc, ScanState>(
        listener: (context, state) {
          if (state is ScanSucceeded) {
            _showFeedback(
              icon: Icons.check_circle,
              color: Colors.green,
              title: 'Welcome ${state.attendeeName}',
            );
            Future.delayed(const Duration(seconds: 2), () {
              if (mounted) context.read<ScanBloc>().add(const ScanReset());
            });
          } else if (state is ScanDuplicateDetected) {
            _showFeedback(
              icon: Icons.warning,
              color: Colors.orange,
              title: 'Already checked in',
            );
          } else if (state is ScanRejected) {
            _showFeedback(
              icon: Icons.error,
              color: Colors.red,
              title: 'Rejected: ${state.reason}',
            );
          } else if (state is ScanOfflineQueued) {
            _showFeedback(
              icon: Icons.cloud_off,
              color: Colors.blueGrey,
              title: 'Offline — queued for sync',
            );
          }
        },
        builder: (context, state) {
          return Stack(
            children: [
              MobileScanner(
                controller: _controller,
                onDetect: _onDetect,
              ),
              _scanOverlay(context),
              if (state is ScanSubmitting)
                const Positioned.fill(
                  child: ColoredBox(
                    color: Colors.black54,
                    child: Center(child: CircularProgressIndicator()),
                  ),
                ),
              Positioned(
                bottom: 32,
                left: 0,
                right: 0,
                child: Center(
                  child: FilledButton.icon(
                    onPressed: () => context.push('/checkin/manual'),
                    icon: const Icon(Icons.keyboard),
                    label: const Text('Manual check-in'),
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _scanOverlay(BuildContext context) {
    return Center(
      child: Container(
        width: 260,
        height: 260,
        decoration: BoxDecoration(
          border: Border.all(color: Colors.white, width: 2),
          borderRadius: BorderRadius.circular(16),
        ),
      ),
    );
  }

  void _showFeedback({
    required IconData icon,
    required Color color,
    required String title,
  }) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            Icon(icon, color: color),
            const SizedBox(width: 12),
            Expanded(child: Text(title)),
          ],
        ),
        duration: const Duration(seconds: 2),
      ),
    );
  }
}
