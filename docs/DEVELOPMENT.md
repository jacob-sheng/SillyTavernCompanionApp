# Development

How the repo is built, how to run and test it, and how a release is made. For what the app does,
see the [README](../README.md).

## Layout

```
SillyTavernCompanionApp/                 pnpm monorepo
├─ packages/core/   @st/core - plain TypeScript, runs and tests in Node
│  └─ src/
│     ├─ discovery/     subnet scan, /version fingerprint, KoboldCpp detection
│     ├─ connection/    StClient (CSRF, cookies, Basic Auth), endpoints, presets, avatars
│     ├─ chat/          JSONL serialisation, integrity check for save-back
│     ├─ streaming/     SSE parser, per-backend stream decoding, smooth streaming pacer
│     └─ prompt-engine/ port of SillyTavern's Generate() pipeline:
│        macros, characterFields, storyString, instruct, examples, depthInject, worldinfo/,
│        personas, profiles, tokenizer, buildPrompt, textgenBody, chatcompletion/,
│        kobold, horde, novelai, generate
└─ apps/mobile/     Expo app (expo-router, NativeWind, TanStack Query, Zustand)
   ├─ app/       onboarding/  (tabs)/  character/[avatar]
   ├─ src/       lib/  components/  hooks/  stores/  theme/  i18n/
   ├─ modules/   screen-state (local Expo module: reports when the screen turns off)
   └─ plugins/   withReleaseSigning.js, withGradleProps.js (applied on `expo prebuild`)
```

## How it fits together

The native app reads character/chat lists through StClient. All chat execution and editing run
inside the actual SillyTavern frontend in one retained WebView. The legacy core prompt library
is still unit tested, but the app no longer calls it for generation.

`packages/web-ui` builds a React shell, styles and TavernAdapter into an IIFE using esbuild.
`pnpm --filter @st/web-ui build` writes the ignored generated TypeScript bundle in
`apps/mobile/src/generated/tavernBundle.ts`. Mobile start, typecheck and prebuild build it first.
Injection occurs after page loading and waits for the real context/settings readiness; it does
not rely on Android document-start injection. Original page DOM and plugin iframes stay mounted.

The bridge protocol lives in `packages/web-ui/src/protocol.ts`. Commands/messages validate
version, session, request IDs and typed targets. Credentials are never bridged. The native host
checks the message page origin and uses SecureStore credentials only in the patched Android
HTTP auth callback. See `patches/react-native-webview@14.0.1.patch`; retain this patch when
upgrading WebView and rerun Android isolation tests. Server root protection is required.

Settings/editor operations use upstream controls and handlers. Return-to-home awaits generation
stop and chat save. Query invalidation and native focus refresh update browsing data; old caches
are invalidated rather than uploaded. Preference changes keep theme live and recreate the hidden
browser for language changes without replaying its last mutation.

## Stack

Expo SDK 58, React Native 0.88 (New Architecture, Hermes), React 19, expo-router, `expo/fetch` for
SSE, TanStack Query 5, Zustand 5, NativeWind 4, FlashList 2, Reanimated 4, Gesture Handler 3,
i18next. Exact versions are in `apps/mobile/package.json`.

Tooling: Node 20 or newer (CI runs 22), pnpm 10, JDK 21 for the Android build.

## Run and test

```powershell
pnpm install
pnpm -r typecheck
pnpm -r test                       # core and app tests
pnpm --filter @st/core test        # engine only, no device needed
```

CI runs `typecheck` and `test` on every push to `main` and on every pull request.

Debug build on a connected device:

```powershell
cd apps\mobile
pnpm android
```

The debug build loads its JavaScript from Metro on port 8081. Over USB,
`adb reverse tcp:8081 tcp:8081` makes Metro reachable from the phone. The same works for a
SillyTavern that only listens on the PC: `adb reverse tcp:8000 tcp:8000`, then pair the app with
`127.0.0.1`.

Two things to know about debug builds:

- The debug build has the same application id as the release app but a different signing key.
  Android refuses to install it over a release install. Either uninstall the release app first
  (this deletes its data) or add `applicationIdSuffix ".debug"` to the `debug` build type in the
  generated `android/app/build.gradle`, which installs it next to the release app.
- Builds are arm64-only. For an x86_64 emulator, override the ABI per invocation:
  `.\gradlew.bat :app:assembleDebug "-PreactNativeArchitectures=x86_64"`.

## Translations

The UI has no hardcoded strings. Every user-facing string is a key in both
`apps/mobile/src/i18n/locales/en.json`, `de.json` and `zh-CN.json`, with the same key path in each file, and is
read through `t('namespace.key')`. A change that adds a string adds it to all three files. Translation tests check matching key paths and interpolation parameters.
Chinese device locales map to `zh-CN`; explicit language choices survive restart.

## Remote connection verification

`normalizeServerUrl` accepts a root HTTP/HTTPS URL (bare domains default to HTTPS).
`validateConnection` takes the URL, optional Basic Auth, injected fetch and optional AbortSignal;
it validates `/version`, `/csrf-token` and `/api/characters/all` within a total 15-second budget.
It returns the instance and the same authenticated `StClient` for activation. Typed error codes
are translated in the mobile app. LAN discovery keeps its existing unauthenticated HTTP probe.
`StClient.imageSource` supplies Basic Auth/cookies only for the exact server origin, without CSRF.
All remote image surfaces use `ServerImage`; local image URIs and external hosts receive no headers.
Credentials stay in SecureStore, outside the query cache.

Unit tests cover URL normalization, HTML proxy errors, session reuse, UTF-8 Basic Auth,
timeouts/cancellation, image origin checks, SSE headers, persistence and reconnect failures.
Before calling a release verified on hardware, run this matrix on an Android device with the
[Caddy configuration](../README.md#remote-vps-with-caddy--远程-vps-连接):

- Connect over Wi-Fi and cellular data with valid credentials, then with a wrong password.
- Load characters, user avatars, attachments and full-screen previews; confirm external images
  still respect the media setting and never receive server credentials.
- Read a chat, generate a streamed reply, stop generation and save/reload the conversation.
- Restart the app, reconnect from saved servers, switch servers and replace expired credentials.
- Switch between system/English/German/Simplified Chinese and restart; inspect Chinese text,
  keyboard entry, long error messages and accessibility labels for clipping or missing glyphs.
- Recheck local HTTP IP/port entry and local network discovery.

Automated tests cannot establish TLS trust, native image transport or proxy streaming behavior on
a real device; record live VPS/device results separately. No production VPS configuration is
changed by the app or its tests.

## Release build

The `android/` folder is generated by `pnpm prebuild` and is not checked in. Release signing is
injected by `apps/mobile/plugins/withReleaseSigning.js`. It reads `STC_UPLOAD_STORE_FILE`,
`STC_UPLOAD_STORE_PASSWORD`, `STC_UPLOAD_KEY_ALIAS` and `STC_UPLOAD_KEY_PASSWORD` from the
environment or from `~/.gradle/gradle.properties`. Without them the release build is signed with
the debug keystore.

```powershell
cd apps\mobile
pnpm prebuild
$env:JAVA_HOME = 'C:\Program Files\Eclipse Adoptium\jdk-21.0.6.7-hotspot'   # JDK 21
cd android
.\gradlew.bat :app:assembleRelease
# -> app\build\outputs\apk\release\app-release.apk
```

Release builds use R8 minification.

## Publishing a prerelease

This fork publishes prereleases from synchronized version bumps on `main`. It does not auto-bump
versions merely because the changelog has unreleased entries. To prepare a release:

```sh
pnpm release:bump --bump minor
# or --bump patch; updates all three packages, app.config.ts and android.versionCode,
# and moves the non-empty [Unreleased] entries into the new dated version section.
pnpm release:check
```

Commit and push the changes to `main`. CI runs typecheck, tests, mobile lint and release metadata
checks. After the exact commit passes, Auto release creates its `vX.Y.Z` tag and calls Release.
A version that already has a tag is skipped, so normal commits do not rebuild published versions.
If main advances before CI finishes, the newer commit must pass CI before it is released.
Manual version edits must synchronize all four version fields and increase `android.versionCode`.

Every release is a GitHub **prerelease**, including future versions above 1.0. Signed APKs are
attached to the release; R8 mappings are stored as workflow artifacts. Release rechecks CI gates,
the checked-out tag/version and the APK signing certificate before publishing. An existing tag
is never moved. To retry a failed build, rerun the failed Actions job or dispatch Release with the
existing `tag`. Auto release can also be dispatched for the current main version.

Required repository secrets: `ANDROID_KEYSTORE_BASE64`, `STC_UPLOAD_STORE_PASSWORD`,
`STC_UPLOAD_KEY_ALIAS`, `STC_UPLOAD_KEY_PASSWORD`. Required repository variable:
`ANDROID_SIGNING_CERT_SHA256` (64 hexadecimal characters, no colons). The fingerprint must match
the fork's key; missing secrets or a debug-signed APK fail the release instead of publishing.
Keep an offline backup of the keystore and passwords; keep using the same key for future updates.

The complete keystore is stored in this repository's encrypted Actions Secrets, not just a path
to a developer's computer. GitHub runners reconstruct it for each build, so releases are independent
of any local machine. A Git deploy key is not needed for APK signing. Local signing files are only
an additional backup and must never be committed to the public repository.

The fork uses application ID `io.github.jacobsheng.stcompanion`, display name
`SillyTavern Companion CN`, and the releases of `jacob-sheng/SillyTavernCompanionApp` for updates.
It installs independently of the upstream app, whose signing key cannot be reused by this fork.

## Hybrid integration fixture

CI starts SillyTavern at the commit recorded in [COMPATIBILITY.md](COMPATIBILITY.md), then runs:

```sh
pnpm --filter @st/web-ui build
pnpm --filter @st/web-ui exec playwright install chromium
pnpm --filter @st/web-ui exec playwright test
```

The browser fixture expects port 8190 (override ST_TEST_URL). Playwright starts a deterministic
local streaming model on port 8192. Never point these tests at a user's production instance:
they create characters/chats and change model settings. Optional plugin checks use ST_TEST_MVU
pointing to the pinned MVU bundle, with the pinned helper installed in that isolated instance.

On Windows, use a short source checkout outside OneDrive for native builds. Older SDK-bundled
Ninja can reject generated filenames longer than 260 characters. Set STC_NINJA_PATH to an
independently installed Ninja 1.13.2 executable before Gradle; the config plugin passes it to
CMake. CI Linux builds do not need this variable. Never copy signing secrets into test fixtures.
