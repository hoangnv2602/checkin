import 'package:flutter/material.dart';

/// LoginScreen — Phase 0 placeholder.
/// Phase 1 (I-104) sẽ wire AuthBloc + react-hook-form equivalent.
class LoginScreen extends StatelessWidget {
  const LoginScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('SaaS Check-in')),
      body: const Center(
        child: Padding(
          padding: EdgeInsets.all(24.0),
          child: Text(
            'Login form — Phase 0 placeholder.\n'
            'Phase 1: AuthBloc + form fields + biometric option.',
            textAlign: TextAlign.center,
          ),
        ),
      ),
    );
  }
}
