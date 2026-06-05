import 'package:flutter_test/flutter_test.dart';

import 'package:saas_checkin_mobile/features/auth/presentation/blocs/session_cubit.dart';

void main() {
  group('SessionCubit', () {
    test('initial state is SessionInitial', () {
      final cubit = SessionCubit();
      expect(cubit.state, isA<SessionInitial>());
      cubit.close();
    });

    test('bootstrap emits SessionSignedOut', () async {
      final cubit = SessionCubit();
      await cubit.bootstrap();
      expect(cubit.state, isA<SessionSignedOut>());
      cubit.close();
    });
  });
}
