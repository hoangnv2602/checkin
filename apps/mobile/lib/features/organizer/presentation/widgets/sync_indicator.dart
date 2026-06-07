/**
 * lib/features/organizer/presentation/widgets/sync_indicator.dart
 *
 * I-907 — Sync indicator widget: hiển thị trạng thái cache (fresh/stale/error).
 */
import 'package:flutter/material.dart';
import '../../domain/entities/cached_event.dart';
import '../../domain/entities/dashboard_state.dart';

class SyncIndicator extends StatelessWidget {
  const SyncIndicator({super.key, required this.state});

  final DashboardState state;

  @override
  Widget build(BuildContext context) {
    return switch (state) {
      DashboardInitial() => const _Chip(label: 'Sẵn sàng', color: Colors.grey),
      DashboardLoading() => const _Chip(label: 'Đang đồng bộ…', color: Colors.blue),
      DashboardLoaded(:final fromCache, :final events) => _LoadedChip(
          fromCache: fromCache,
          staleCount: events.where((e) => e.isStale).length,
        ),
      DashboardError(:final fallback) => _Chip(
          label: fallback.isEmpty ? 'Lỗi mạng' : 'Mạng lỗi — dùng cache',
          color: Colors.orange,
        ),
    };
  }
}

class _Chip extends StatelessWidget {
  const _Chip({required this.label, required this.color});
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 6),
          Text(label, style: TextStyle(color: color, fontSize: 12)),
        ],
      ),
    );
  }
}

class _LoadedChip extends StatelessWidget {
  const _LoadedChip({required this.fromCache, required this.staleCount});
  final bool fromCache;
  final int staleCount;

  @override
  Widget build(BuildContext context) {
    if (fromCache) {
      return const _Chip(label: 'Cache (offline)', color: Colors.amber);
    }
    if (staleCount > 0) {
      return _Chip(label: 'Có $staleCount sự kiện stale', color: Colors.amber);
    }
    return const _Chip(label: 'Đã đồng bộ', color: Colors.green);
  }
}
