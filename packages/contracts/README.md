# packages/contracts — OpenAPI + TS types

> Source of truth cho API contracts giữa BFF ↔ web/mobile.
> Pipeline: NestJS export `openapi.json` → openapi-typescript (TS) + openapi-generator-cli (Dart).

## Layout

```
packages/contracts/
├── openapi.json              # snapshot — generate bằng curl từ BFF /v1/docs-json
├── scripts/generate.ts       # orchestrator: chạy cả web + mobile gen
├── src/
│   ├── index.ts              # public barrel
│   └── gen/
│       └── web.ts            # generated — KHÔNG commit (Phase 1 setup .gitignore)
├── package.json
└── tsconfig.json
```

## Workflow

```bash
# 1. BFF chạy + export spec
pnpm --filter @saas-checkin/api-gateway dev &
sleep 5
curl http://localhost:3001/v1/docs-json > packages/contracts/openapi.json

# 2. Generate clients
pnpm --filter @saas-checkin/contracts gen
# → src/gen/web.ts (TS)
# → src/gen/mobile/ (Dart)
```

## Web (apps/web)

```ts
import { Api } from "@saas-checkin/contracts";
const api = new Api({ baseUrl: "http://localhost:3001" });
const events = await api.events.listEvents();
```

## Mobile (apps/mobile)

```dart
import 'package:saas_checkin_contracts/api.dart';
final api = Api(baseUrl: 'http://localhost:3001');
final events = await api.eventsListEvents();
```

## CI (Phase 1+)

- OpenAPI diff check: so sánh `openapi.json` mới với baseline → fail nếu breaking change
  mà không bump version.
- Generated files `src/gen/*` không commit → CI generate mỗi build.

## Phase 0 status

- ✅ Pipeline scaffold (generate.ts)
- ✅ package.json với openapi-typescript + openapi-generator-cli
- ⏳ Phase 1+ mới có `openapi.json` thật (BFF chưa có route thật)
