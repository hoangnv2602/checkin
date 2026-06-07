/**
 * lib/features/checkin/presentation/screens/manual_checkin_screen.dart
 *
 * I-403 — Staff manual check-in: search attendee by email/name, then submit.
 * Useful khi QR hỏng / mất hoặc attendee chưa nhận được email.
 *
 * Dùng chung CheckInRemoteDataSource.manual() (POST /v1/checkin/manual).
 */
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../blocs/scan_bloc.dart';

class ManualCheckInScreen extends StatefulWidget {
  final Guid eventId;
  final Guid organizationId;
  final Guid gateId;
  final Guid staffUserId;
  const ManualCheckInScreen({
    super.key,
    required this.eventId,
    required this.organizationId,
    required this.gateId,
    required this.staffUserId,
  });

  @override
  State<ManualCheckInScreen> createState() => _ManualCheckInScreenState();
}

class _ManualCheckInScreenState extends State<ManualCheckInScreen> {
  final TextEditingController _emailCtl = TextEditingController();
  final TextEditingController _nameCtl = TextEditingController();
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _emailCtl.dispose();
    _nameCtl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final email = _emailCtl.text.trim();
    if (email.isEmpty) {
      setState(() => _error = 'Email required');
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      // Reuse ScanBloc via a synthetic event — we don't need full state
      // machine for one-shot manual lookup. Use repo directly here.
      // For brevity, route through the bloc:
      final repo = context.read<ManualCheckInCubit>();
      final outcome = await repo.submit(
        attendeeEmail: email,
        eventId: widget.eventId,
        organizationId: widget.organizationId,
        gateId: widget.gateId,
        staffUserId: widget.staffUserId,
      );
      if (!mounted) return;
      _showResult(outcome.status.toString().split('.').last);
      if (outcome.status.toString().contains('success')) {
        Future.delayed(const Duration(seconds: 1), () {
          if (mounted) context.pop();
        });
      }
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  void _showResult(String status) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Check-in $status'),
        backgroundColor: switch (status) {
          'success' => Colors.green,
          'duplicate' => Colors.orange,
          _ => Colors.red,
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Manual check-in')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextField(
              controller: _emailCtl,
              keyboardType: TextInputType.emailAddress,
              decoration: const InputDecoration(
                labelText: 'Attendee email',
                prefixIcon: Icon(Icons.email),
                border: OutlineInputBorder(),
              ),
              inputFormatters: [LengthLimitingTextInputFormatter(200)],
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _nameCtl,
              decoration: const InputDecoration(
                labelText: 'Name (optional, log only)',
                prefixIcon: Icon(Icons.person),
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 24),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Text(
                  _error!,
                  style: const TextStyle(color: Colors.red),
                ),
              ),
            FilledButton.icon(
              onPressed: _submitting ? null : _submit,
              icon: _submitting
                  ? const SizedBox(
                      width: 16, height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.check),
              label: const Text('Check in'),
            ),
            const SizedBox(height: 16),
            const Text(
              'Manual check-ins are logged with reason and visible in audit log.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey, fontSize: 12),
            ),
          ],
        ),
      ),
    );
  }
}

/// Tiny Cubit wrapping the manual repo call so screen can call directly.
class ManualCheckInCubit {
  final dynamic _repo;
  ManualCheckInCubit(this._repo);

  Future<dynamic> submit({
    required String attendeeEmail,
    required Guid eventId,
    required Guid organizationId,
    required Guid gateId,
    required Guid staffUserId,
  }) =>
      _repo.manualCheckIn(
        attendeeEmail: attendeeEmail,
        eventId: eventId,
        organizationId: organizationId,
        gateId: gateId,
        staffUserId: staffUserId,
      );
}
