# Hybrid client compatibility and acceptance

The modern shell targets SillyTavern **1.19.0**, pinned in CI at
`7e8663cd9c184a550b37238218bdd32c6efc68e9`. Unknown versions and missing capabilities
offer the original page. The APK contains only the companion UI, not SillyTavern or plugins.

## Architecture boundaries

The native application owns browsing, servers, credentials, lock, updates and preferences.
The retained WebView owns chat state and all editing/generation. The adapter preserves original
chat nodes, input controls and plugin iframes. Core editor fields retain their existing handlers.
Third-party extension settings and iframe contents are not redesigned.

Native navigation uses avatar filenames, chat filenames and group IDs, never display names.
Commands have a session nonce and request ID; repeated mutations are not replayed across
ready events or browser reloads. After a crash, reconnect explicitly; there is no automatic send.

Credentials are supplied by the Android HTTP auth callback only for the first trusted-root
challenge. The root must be protected by Basic Auth. Same-host cross-port/protocol resources
are blocked when credentials are present; other authentication challenges are refused.
WebView cookies are independent of the native client's cookies. No password crosses the JS bridge.
Use system-trusted TLS; there is no certificate bypass.

## Reproducible checks

Browser tests use the actual pinned SillyTavern and a local deterministic OpenAI-compatible
streaming server. They cover all main editor entry points, retained DOM/iframe identity,
new-chat deduplication, streaming generation, save/return, original mode and unknown versions.
An unused card emits CHAT_CREATED once; group navigation refreshes the server list. Stop/return
waits for pending asynchronous upstream generation/message events before verifying saved metadata.
Light editor contrast and settings-section navigation are checked against real bound controls.
Unit tests cover bridge validation, command queues, navigation failures and native request state.
Existing connection, localization, storage and core tests remain part of CI.

WSL2 Debian validation on 2026-11-03: 487 unit tests, 9 browser tests including the fixed plugin
fixture, typecheck and mobile lint passed. Android Hermes asset export passed after repairing
the Tailwind palette import. Run 41641293690 built/installed the debug APK but failed before
the connection screen because Metro did not start. It provides no Android auth acceptance.

Optional plugin smoke fixture:

- Tavern Helper 4.12.0, commit `5cbd089f1217d00e1f6851f50bf451223860a9c2`.
- MVU beta bundle, commit `d03b7dc8a6ebf9bd611c7e2dc91f3b35462deebc`.
- Tests parse a variable update, persist message variables, render a real Tavern Helper iframe,
  click its state button and save before returning home.
- Plugins are downloaded only into an isolated test instance, not redistributed in the APK.

## Acceptance still required

Do not infer universal plugin support from these smoke tests. Full MVU generation/re-generation,
continue, branch switching, deleted messages and restart combinations need separate card tests.
User VPS credentials and user cards have not been provided. Physical Wi-Fi/mobile-network,
camera, OEM download picker, large-font and background lifecycle combinations remain device checks.

Before publishing this migration, complete Android Basic Auth isolation (external iframe,
same host/different port, redirects and invalid credentials), native-to-web navigation and basic
chat acceptance. Record exact results here; browser tests do not replace this release gate.

## Migration

Server records, SecureStore credentials, language and lock preferences are preserved. Old query
caches are invalidated with a cache version; only native browsing queries are persisted now.
Legacy draft files are left untouched, never written back automatically. Old native chat routes,
generation and settings synchronization are removed. The core prompt library remains available
and tested as a library, but the application uses the server's actual browser pipeline.
