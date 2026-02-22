---
name: build-and-test
description: Verifies the integrity of the Ginger Media Handler project by running TypeScript compilation, Vite checks, and Vitest. Use this skill before committing code or finishing a task to ensure no regressions.
---

# Build and Test Skill

As a programmer agent working on the Ginger Media Handler, you must ensure the codebase remains strictly typed and fully functional. This project enforces strict TypeScript rules and uses Vite for compilation.

## Step 1: Run TypeScript Type Checking
Run the TS compiler to catch interface and strictness errors. The project uses multiple tsconfig files, so it's best to run the standard build sequence or TS check.

```bash
npm run lint
```

## Step 2: Run Unit Tests
The project uses Vitest. Ensure your new code doesn't break existing media services.

```bash
npm run test
```
*Note: If the test suite hangs, it might be due to a missing FFmpeg mock. Ensure you mock `child_process.spawn` or `fluent-ffmpeg` in your tests.*

## Step 3: Run a Test Build
To ensure the Electron package compiles properly:
```bash
npm run package
```
If this succeeds without Vite or Forge throwing an error, the build is clean.

## Troubleshooting
- **Type 'any' is not assignable**: The project uses `strict: true`. Use `unknown` or properly type your variables.
- **IPC Event Errors**: Remember to update `src/shared/types/index.ts` whenever you add a new IPC channel.
