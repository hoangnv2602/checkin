import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import 'features/auth/presentation/blocs/session_cubit.dart';
import 'features/auth/presentation/blocs/auth_bloc.dart';
import 'features/checkin/presentation/blocs/scan_bloc.dart';
import 'core/router/app_router.dart';

class SaasCheckinApp extends StatelessWidget {
  const SaasCheckinApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiBlocProvider(
      providers: [
        BlocProvider<SessionCubit>(create: (_) => SessionCubit()),
        BlocProvider<AuthBloc>(create: (_) => AuthBloc()),
        BlocProvider<ScanBloc>(create: (_) => ScanBloc()),
      ],
      child: MaterialApp.router(
        title: 'SaaS Check-in',
        debugShowCheckedModeBanner: false,
        theme: ThemeData.light(useMaterial3: true),
        darkTheme: ThemeData.dark(useMaterial3: true),
        routerConfig: appRouter,
      ),
    );
  }
}
