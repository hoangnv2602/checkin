/**
 * apps/checkin-admin/src/modules/queue/components/DlqReplayPage.tsx
 *
 * I-806 — Admin UI: list DLQ entries, replay hoặc discard.
 * Path: /admin/queues/:queueName/dlq
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2, RefreshCw } from "lucide-react";

export interface DlqEntry {
  id: string;
  originalQueue: string;
  originalJobId: string;
  data: unknown;
  failedReason: string;
  attemptsMade: number;
  movedAt: string;
}

interface Props {
  queueName: string;
  entries: DlqEntry[];
  onReplay: (id: string) => Promise<void>;
  onDiscard: (id: string) => Promise<void>;
  loading?: boolean;
}

export function DlqReplayPage({ queueName, entries, onReplay, onDiscard, loading }: Props) {
  const [busy, setBusy] = useState<string | null>(null);

  if (loading) return <Skeleton className="h-64 w-full" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>DLQ · {queueName}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {entries.length} failed job(s) after retries. Replay để chạy lại, hoặc discard.
        </p>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No failed jobs 🎉</p>
        ) : (
          <ul className="space-y-2">
            {entries.map((e) => (
              <li
                key={e.id}
                className="flex items-start justify-between gap-3 rounded-md border border-border p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <code className="text-xs text-muted-foreground">{e.id}</code>
                    <Badge variant="destructive" className="text-xs">
                      {e.attemptsMade} attempts
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(e.movedAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-foreground">{e.failedReason}</p>
                  <pre className="mt-1 max-h-32 overflow-auto rounded bg-muted p-2 text-xs text-muted-foreground">
                    {JSON.stringify(e.data, null, 2)}
                  </pre>
                </div>
                <div className="flex flex-col gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      setBusy(e.id);
                      try { await onReplay(e.id); } finally { setBusy(null); }
                    }}
                    disabled={busy !== null}
                  >
                    <RefreshCw className="mr-1 h-3 w-3" />
                    Replay
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      setBusy(e.id);
                      try { await onDiscard(e.id); } finally { setBusy(null); }
                    }}
                    disabled={busy !== null}
                  >
                    <Trash2 className="mr-1 h-3 w-3" />
                    Discard
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
