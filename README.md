# SillyTavern Companion

> 🛟 **Need help or found a bug?** Get support at [support.doodesch.de/sillytaverncompanionapp](https://github.com/jacob-sheng/SillyTavernCompanionApp/issues).

[![CI](https://github.com/jacob-sheng/SillyTavernCompanionApp/actions/workflows/ci.yml/badge.svg)](https://github.com/jacob-sheng/SillyTavernCompanionApp/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/jacob-sheng/SillyTavernCompanionApp?include_prereleases)](https://github.com/jacob-sheng/SillyTavernCompanionApp/releases)
[![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-blue)](LICENSE)

An Android app for [SillyTavern](https://github.com/SillyTavern/SillyTavern). It finds the
SillyTavern instance on your home network, or connects to a remote HTTPS server, so you can carry on your chats from the phone.

Your PC keeps doing the work. Characters, chats, settings and the AI backend stay where they are,
and nothing has to be installed on the SillyTavern side. The app builds its prompts with a port of
SillyTavern's own prompt code, so a reply you generate on the phone gets the same prompt it would
get on the desktop.

Status: beta. Android 7 or newer, 64-bit ARM phones.

| Find your instance | Character page | Chat | Generation settings |
|---|---|---|---|
| ![Discovery](docs/media/discovery.png) | ![Character page](docs/media/character.png) | ![Chat](docs/media/chat.png) | ![Generation settings](docs/media/gensettings.png) |

## What it does

**Connect**
- Scans local Wi-Fi, or connects manually using an HTTPS domain or a local IP and port.
- Supports Caddy or SillyTavern HTTP Basic Auth, including authenticated images and streaming.
- Remembers multiple servers and offers reconnect on the start page, even without local Wi-Fi.

**Chat**
- Replies stream in word by word, with the same smooth streaming option as the desktop.
- Swipes, regenerate, continue, stop, impersonate. Alternate greetings show up as swipes on the
  first message.
- Edit, copy, hide and delete messages, branch a chat, rename and delete chats.
- Reasoning blocks, image attachments for vision models (chat completion), read-aloud with the
  phone's text-to-speech.
- Markdown rendering that follows the desktop, including quoted speech and nested styles.

**Same prompt as the desktop**
- Macros, character fields, story string, instruct mode, example dialogues, Author's Note,
  `@depth` injections and persona positions.
- World Info with selective logic, inclusion groups, minimum activations and timed effects
  (sticky, cooldown, delay). A lorebook panel shows which entries are active and lets you mute
  single entries.
- Token budgets come from SillyTavern's tokenizers. Tests compare the built prompt and the request
  bodies with what the desktop produces.

**Settings on the phone**
- Pick the connection profile and the persona. Create, edit and delete personas.
- Quick settings for temperature, response length and context size, plus a full screen with every
  sampler SillyTavern offers for the active backend.
- Edit context templates, instruct templates and the system prompt.
- Changes go back to SillyTavern if you turn on "Sync with PC". Only the fields you touched are
  written.

**Around it**
- Chats are saved back to the PC, with a conflict check if the chat changed there in the meantime.
- Character pages hide the definitions until you ask for them, so you do not spoil a card by
  opening it.
- Cached characters and chats for reading offline, drafts survive a crash.
- Optional app lock with fingerprint or device PIN.
- English, German and Simplified Chinese, picked from the phone language or selected in Settings.

## Supported backends

The app does not talk to the AI backend directly. It sends the request to SillyTavern, and
SillyTavern forwards it like it does for the desktop. So the backend has to be set up and connected
in SillyTavern first.

| SillyTavern API | Covered |
|---|---|
| Text Completion | KoboldCpp, llama.cpp, Ollama, TabbyAPI, Text Generation WebUI, vLLM, Aphrodite, OpenRouter, Mancer, TogetherAI, InfermaticAI, DreamGen, Featherless, HuggingFace, Generic |
| Chat Completion | OpenAI, Claude, Google AI Studio, Vertex AI, OpenRouter, Mistral, Cohere, DeepSeek, xAI, Groq, Perplexity, Azure OpenAI, Custom and the other sources SillyTavern lists |
| NovelAI | Clio, Kayra, Erato |
| KoboldAI Classic | yes |
| AI Horde | yes, with queue position in the chat |

Not every backend has been run against a live server. If one misbehaves, please
[report it](https://github.com/jacob-sheng/SillyTavernCompanionApp/issues).

This fork uses its own signing key and application ID (`io.github.jacobsheng.stcompanion`).
It installs alongside the upstream app; its in-app updater follows this fork's releases.

## Install

<img src="docs/media/qr-releases.png" alt="QR code linking to the releases page" width="170" align="right" />

1. Download the APK from the [releases page](https://github.com/jacob-sheng/SillyTavernCompanionApp/releases),
   or scan the QR code with your phone.
2. Open the APK on the phone and allow installing from this source when Android asks.

The APK is signed, but it does not come from Google Play. Play Protect warns about an unknown
developer because of that.

After the first install the app updates itself: it checks GitHub on launch, and
Settings > "Check for updates" downloads and installs the new version.

## Set up SillyTavern

SillyTavern only answers on the PC itself by default. To let the phone in, edit `config.yaml` in
your SillyTavern folder and restart SillyTavern:

```yaml
listen: true
whitelist:
  - ::1
  - 127.0.0.1
  - 192.168.178.*   # your home network, see the IP of your PC
```

Then:

1. Start SillyTavern and connect your AI backend in it, like you would for the desktop.
2. Put the phone on the same network as the PC.
3. Open the app. It scans the network and lists the instance.

If you use `basicAuthMode` in SillyTavern, choose "Pair manually" in the app and enter the username
and password there.

Local IP connections still support HTTP. For a remote VPS, use an HTTPS domain with Caddy
Basic Auth as described below. The AI backend remains configured on the SillyTavern server.

### Remote VPS with Caddy / 远程 VPS 连接

Use a dedicated domain such as `https://st.example.com` pointing to your VPS. Caddy and
SillyTavern run on the same VPS in this example. Keep SillyTavern listening only on loopback,
with its whitelist allowing `127.0.0.1` and `::1`; expose Caddy's ports 80/443, not port 8000.
This setup uses Caddy Basic Auth only: SillyTavern's `basicAuthMode` and user-account login
must be disabled. Do not enable forwarded-IP whitelist checks unless your whitelist is
configured for the actual remote clients.

Generate a password hash interactively (do not put the plaintext password in the Caddyfile):

```sh
caddy hash-password
```

Caddyfile (replace the example domain, username and hash):

```caddyfile
st.example.com {
    basic_auth {
        companion REPLACE_WITH_CADDY_PASSWORD_HASH
    }
    reverse_proxy 127.0.0.1:8000 {
        flush_interval -1
    }
}
```

Caddy obtains a publicly trusted TLS certificate automatically when DNS and ports are configured.
`flush_interval -1` disables proxy buffering for responsive streaming. With containers, use the
SillyTavern container address instead of loopback and allow that proxy address in the whitelist.

In the app, choose **Connect manually → Server URL**, enter `https://st.example.com`, then the
Caddy username and plaintext password. A bare domain defaults to HTTPS; custom ports are supported.
The app verifies the server, CSRF session and character-list access before saving the connection.
The start page lists saved servers for reconnect; if credentials expire, choose **Edit connection**.

中文操作：选择“手动连接 → 服务器网址”，填写 HTTPS 域名和 Caddy 的用户名、密码。
中文系统默认使用简体中文，也可在“设置 → 语言”中选择“简体中文”。重启后可在首页点按已保存服务器重连。

This release supports domain root deployments only, with system-trusted TLS certificates.
Subpaths such as `/tavern`, self-signed certificate bypass, SillyTavern account login and two
independent layers of Basic Auth are not supported.

## Troubleshooting

**The scan finds nothing.**
Check that `listen: true` is set and SillyTavern was restarted, that the phone's network is in the
whitelist, and that the firewall on the PC lets the SillyTavern port (8000 by default) through.
Guest Wi-Fi and some routers keep devices apart; pair manually with the IP and port of the PC in
that case.

**Remote login fails.**
401 means the Basic Auth credentials were rejected; 403 means access is forbidden (check the
proxy rules and SillyTavern whitelist). For connection failures, check DNS, network access and
certificate validity. An HTML login page is not a usable SillyTavern API session. Use a dedicated
root-domain reverse proxy and disable SillyTavern account login for this setup.

**"AI backend not connected" or "No response".**
SillyTavern has no connection to the backend. Open SillyTavern on the PC, connect the API there and
check that a model is selected. In the app, Settings shows which connection profile is active.

**A reply looks different from the desktop.**
That is a bug worth reporting. Include the backend, the connection profile type and, if you can,
the request from the SillyTavern console.

## Not supported

- Group chats.
- Variable macros that keep state (`getvar`, `setvar`).
- SillyTavern's server-side TTS. The app reads aloud with the phone's own voice.
- iOS, and 32-bit Android phones.

Open work is on the [project board](https://github.com/users/DooDesch/projects/1), what shipped is
in the [changelog](CHANGELOG.md).

## Development

The repo is a pnpm monorepo: `packages/core` holds the prompt engine and the SillyTavern client in
plain TypeScript, `apps/mobile` is the Expo app. Setup, architecture, tests and the release build
are in [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

To publish the next prerelease, add entries under `[Unreleased]` in `CHANGELOG.md`, run
`pnpm release:bump --bump patch` (or `--bump minor`), then commit and push to `main`.
GitHub Actions validates the change, tags the new version and publishes the signed APK using
the signing key stored in repository Secrets. No local Android build or signing setup is required.

## License and attribution

GNU AGPL-3.0, see [LICENSE](LICENSE).

The prompt engine in `packages/core/src/prompt-engine` is a TypeScript port of client-side
prompt-building code from [SillyTavern](https://github.com/SillyTavern/SillyTavern) (AGPL-3.0).
SillyTavern Companion is an independent app and is not affiliated with the SillyTavern project.
