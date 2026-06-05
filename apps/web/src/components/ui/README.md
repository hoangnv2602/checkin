# src/components/ui/ — shadcn CLI-managed (D11)

**KHÔNG** copy-paste shadcn component. **KHÔNG** hand-roll Radix-based component.
Tất cả UI primitive phải được add qua CLI:

```bash
cd apps/web
yarn dlx shadcn@latest add button input label card dialog table \
  select checkbox textarea tabs toast sonner avatar badge
```

Sau khi add, customize bằng cách wrap trong `src/modules/<module>/components/<name>-brand.tsx`
— KHÔNG sửa trực tiếp file trong `src/components/ui/` (sẽ bị CLI ghi đè khi update).

## Phase 0 status

- Folder trống — chưa add component nào.
- Phase 1 (I-104 auth UI) sẽ chạy `add button input label` đầu tiên.
