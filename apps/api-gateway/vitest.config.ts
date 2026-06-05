// apps/api-gateway/vitest.config.ts — I-105
// SWC plugin thay esbuild để respect useDefineForClassFields=false. Với
// target es2022 + useDefineForClassFields=true (esbuild mặc định), class
// field declaration chạy SAU constructor, ghi đè Nest DI inject → this.auth
// undefined. SWC với tsconfig.test.json tôn trọng field semantics cũ.
import { defineConfig } from "vitest/config";
import path from "node:path";
import swc from "unplugin-swc";

export default defineConfig({
  plugins: [
    swc.vite({
      module: { type: "es6" },
      jsc: {
        target: "es2020",
        parser: { syntax: "typescript", decorators: true, dynamicImport: true },
        transform: {
          legacyDecorator: true,
          decoratorMetadata: true,
          useDefineForClassFields: false,
        },
        keepClassNames: true,
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    globals: false,
    include: ["src/**/*.spec.ts", "test/**/*.e2e-spec.ts"],
    setupFiles: ["./test/setup.ts"],
    testTimeout: 20_000,
  },
});
