import 'package:flutter/material.dart';

/// ScanScreen — Phase 0 placeholder.
/// Phase 4 (I-401) sẽ wire mobile_scanner + ScanBloc + offline queue.
class ScanScreen extends StatelessWidget {
  const ScanScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Scan QR')),
      body: const Center(
        child: Padding(
          padding: EdgeInsets.all(24.0),
          child: Text(
            'Camera preview + scan overlay — Phase 0 placeholder.\n'
            'Phase 4: mobile_scanner package + ScanBloc.',
            textAlign: TextAlign.center,
          ),
        ),
      ),
    );
  }
}
