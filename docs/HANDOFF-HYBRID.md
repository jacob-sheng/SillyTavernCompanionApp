# 原生首页 + 现代化 WebView：Linux 续接交接

更新时间：2026-11-03。**这是未完成的开发分支，不是可发布版本。**
用户已要求继续，开发恢复在 WSL2 Debian 的 `/home/ayang/src/SillyTavernCompanionApp`。
构建和测试使用 Linux 文件系统；不要在 Windows 安装构建环境。

## Linux 续接进度

- 扩展页新增管理/安装入口及已安装列表搜索（保留原 DOM、事件和第三方设置）；世界书
  创建/条目编辑/保存导出、采样预设修改/另存为/导出均走真实酒馆控件验收通过。
  完整合跑 12 项浏览器验收通过，随后新增的采样预设用例单独通过。
- 第二轮 run `41643893629` APK/资源构建成功，服务就绪门禁发现 Metro 仅监听 localhost
  的 IPv6，127.0.0.1 不可达；已为 Metro 单进程设置 ipv4first，WSL 同命令启动并确认
  `/status` 成功。不是 Android 认证通过。日志和 APK 分开上传，开发分支启用 Gradle 缓存。
- 新增真实角色表单修改、JSON 导出并读回服务器的验收通过；群聊 403 不使用旧缓存。
- 后续：原生/网页共用 palette 和圆角；恢复自动锁定计时设置，常用原生控件响应主题。
  TavernAdapter 等待异步生成/消息事件处理结束再保存；实际流式停止加延迟插件测试通过。
  最新全量 487 项单测、9 项浏览器验收（含固定 MVU）及类型检查/lint 通过。
- 最新续接：修复 Tailwind 配置损坏的 palette 导入（此前类型检查和 lint 未捕获），
  Android JS/Hermes 资源导出通过。CI 增加资源导出检查及服务就绪失败即退出。
- GitHub run `41641293690` 已构建并安装 debug APK，但模拟器测试因 Metro 配置错误
  未到达连接页，**不算 Android 认证或聊天验收通过**。修复后需要重跑。
- 浅色核心面板文字对比度、首次 ready 与 React 监听器安装时序已修复；设置页新增
  保留原绑定控件的章节跳转（三语言）。完整页面流程现代化仍未完成。
- 群聊导航刷新服务端列表；未使用角色首次选择复用酒馆自动创建的聊天，不再额外
  doNewChat。实际 CHAT_CREATED 事件计数验证一次，重复请求不会重复初始化。
- 最新 web-ui 单测 15 项、真实酒馆浏览器用例 8 项通过；固定 Helper/MVU 状态栏
  点击及保存 smoke 通过。插件测试先等导航确认，避免初始化和变量写入竞态。
  停止生成、分支等完整插件组合仍未验收。
- 已从 GitHub 检出；使用现有 Linux JDK 21、Node 24 和 Android SDK。仓库内 Corepack
  shim 固定 pnpm 10.23.0，避免现有全局 pnpm 11 被嵌套脚本误用。
- WSL 镜像网络的 TUN 默认路径无法直连，测试过程通过现有本地 HTTP 代理设置进程环境；
  没有改动 Windows/WSL 全局代理或系统路由。忽略的 `.cache/dev-env.sh` 只属于本机。
- Linux 类型检查、481 项原有/交接单元测试、lint、发布工具检查通过。
- 新增保存读回及角色刷新测试后，web-ui 为 14 项测试。实际酒馆 5 项浏览器回归通过。
- 发现上游角色聊天的保存函数同样吞掉错误：现在角色/群聊均读回消息和插件元数据后
  才确认返回首页，比较遵循 JSON 日期序列化；服务器保存失败不会被误认为成功。
- 原生 WebView 补丁区分子 frame 导航与主页面外链，避免外部 iframe 自动唤起浏览器。
- 新增独立 `Android hybrid acceptance` workflow，在开发分支运行隔离模拟器验证
  原生连接、错误密码、流式聊天、保留实例，以及 Caddy 跨端口/外部 iframe/重定向认证。
  此流程只使用 debug 签名，不发布 APK；首次运行结果仍待确认，当前 fixture 是 HTTP。
- 本机 WSL 无可用 KVM，`modprobe kvm_amd` 返回 Operation not supported；安卓验收交由
  GitHub Linux runner 的 KVM 模拟器。Linux SDK 新增组件和下载仍在 Linux 内进行。
- graphify hook 在 WSL 同样不可用（离线执行返回 ENOTCACHED），既有图尚未刷新。

以下保留首次交接时的范围和细节；旧暂停状态已由用户的继续指令解除。

## 分支与发布状态

- 交接分支：`codex/hybrid-webview-handoff`，基于 `main` 的 `635d01d`。
- 所有包仍为 `0.18.2`，Android versionCode 仍为 `22`。
- 目标：验收后发布 `0.19.0` / versionCode `23`；若已被占用，使用下一可用值。
- 不要直接合并或打标签：Android 认证隔离、原生导航及基础聊天是发布门槛。
- `main` 通过 CI 后会根据版本号自动发布。此交接只推独立分支，没有触发发布。
- 包名、签名和 GitHub Actions Secrets 沿用现有配置。不得提交密钥、密码或本机缓存。

## 用户确认的产品范围

原生保留最近会话、角色列表/搜索/详情/历史、服务器管理、凭据、应用锁、语言、
外观和更新。WebView 承担聊天/生成/停止/消息编辑/分支、角色和会话编辑、模型/
预设/提示词、世界书、身份、扩展管理及高级设置。用户不需要手动切换运行模式。

现代界面随 APK 注入，VPS 不安装我们的界面扩展。酒馆负责业务状态及插件生命周期；
不得另行实现 MVU，不得复制消息节点、重建 iframe 或从原生预创建聊天文件。
第三方插件设置及角色卡 HTML 保留内容；已安装主题不自动停用。
保留原版入口。基线 SillyTavern 1.19.0，中文/英文/德文及深浅色/系统主题。

服务器使用独立 HTTPS 根域名和单层 Caddy Basic Auth；支持已有 LAN HTTP。
不支持子路径、自签名绕过、酒馆用户登录、双层 Basic Auth。

## 已写入源码的工作

- `packages/web-ui`：独立 React/TypeScript 包、esbuild 本地注入包、带版本和会话
  nonce 的固定桥接协议、请求去重队列、TavernAdapter、现代聊天导航和移动编辑面板样式。
- `apps/mobile/src/components/TavernHost.tsx`：唯一活动 WebView，返回首页保留实例，
  导航握手、等待保存/停止、原版回退、原生文件保存、主题同步和隐藏会话语言重载。
- `tavernStore`：avatar/文件/group ID 类型化目标，重复点击防护，重载不重复新建聊天。
- 原生最近会话/角色详情进入网页；新建调用上游 `doNewChat`，历史文件先检查存在。
- 查询失效和焦点刷新；只持久化原生浏览查询并更换缓存版本；预览使用纯文本。
- Android WebView 安全补丁：可信源固定、初始根文档一次性认证、阻止同主机跨端口/
  协议资源借用认证、拒绝其余认证挑战、外部主导航交系统浏览器。
- SecureStore 凭据复用，密码不注入 JS；WebView 独立 Cookie 会话。
- 应用锁 FLAG_SECURE；语言和外观设置；移除旧原生聊天路由、生成入口、编辑路由和
  已确认无调用的 native chat hooks/组件/同步/TTS 模块。
- GitHub CI 增加真实酒馆浏览器集成；发布工具纳入第四个 web-ui 包。
- README、开发文档及兼容清单已更新；CHANGELOG 仍标为开发中。

**范围说明：**目前现代化主要是新的 React 导航/操作入口、聊天与抽屉全屏布局和
原控件样式，复杂字段沿用上游绑定控件。尚不能声称所有主要页面已完成用户要求的
完整交互重组，也没有逐项验证每个字段的读写/导入/导出。继续时需评估并补齐。

## 已得到的验证结果

下列是暂停前实际运行结果，不代表之后的变更全部已重测：

| 检查 | 结果及边界 |
| --- | --- |
| `pnpm -r typecheck` | 最后一次原生模块清理后通过 |
| 移动端 `pnpm --filter mobile lint` | 最后一次通过，无输出告警 |
| `pnpm -r test` | 401 core + 70 mobile + 10 web-ui，共 481 项通过；早于最后的群聊读回保护和旧模块清理 |
| `pnpm release:test` | 5 项通过；未执行版本 bump |
| Playwright `tavern.spec.ts` | 5 项通过：各主要面板、聊天节点/iframe 保留、新建去重、真实流式生成保存返回、原版和未知版本；早于最后的群聊保护和样式作用域调整 |
| 插件 smoke | 实际 Tavern Helper + MVU：解析变量 10→12，消息变量存取，HTML iframe 按钮 12→13，返回首页保存通过 |
| Android APK | 尚未成功产出和安装；Java WebView 补丁在早期构建已编译，后续完整构建受 Windows 环境问题阻塞 |

没有 Android 原生认证隔离验收，也没有实际 VPS/用户卡/真机验收。插件测试没有覆盖
真实模型触发的 MVU MESSAGE_RECEIVED、重生成、继续、分支、删改和进程重启。

## Linux 新检出与复现

在 Linux 本地文件系统检出；WSL2 使用 `~/src`，不要在 `/mnt/c/.../OneDrive` 构建。
本机 `wsl --list --verbose` 已确认有 Debian / WSL2，但本次实现**没有使用 WSL**。
交接时它处于停止状态；不要假设其中已安装 Node/SDK/JDK。

```bash
git clone --branch codex/hybrid-webview-handoff \
  https://github.com/jacob-sheng/SillyTavernCompanionApp.git
cd SillyTavernCompanionApp
corepack enable
pnpm install --frozen-lockfile
pnpm -r typecheck
pnpm -r test
pnpm --filter mobile lint
pnpm release:test
pnpm release:check
```

工具基线：Node 22、pnpm 10.23.0、JDK 21；Expo/Android SDK 版本由现有配置决定。
`pnpm --filter mobile prebuild --platform android` 先构建注入包，再生成原生工程。
`apps/mobile/src/generated/tavernBundle.ts` 是忽略的生成文件，新检出不需要复制。

独立测试酒馆（以下命令创建/修改测试数据，不得用于生产实例）：

```bash
mkdir -p .cache
git clone https://github.com/SillyTavern/SillyTavern.git .cache/SillyTavern
git -C .cache/SillyTavern checkout 7e8663cd9c184a550b37238218bdd32c6efc68e9
npm ci --omit=dev --prefix .cache/SillyTavern
# 在独立终端保持运行；初次页面会出现 onboarding，需要确认。
(cd .cache/SillyTavern && node server.js --port 8190 --browserLaunchEnabled false)
# 另一个终端：
pnpm --filter @st/web-ui build
pnpm --filter @st/web-ui exec playwright install --with-deps chromium
pnpm --filter @st/web-ui exec playwright test tavern.spec.ts
```

Playwright 会启动 `e2e/model-server.mjs` 的固定 OpenAI-compatible SSE 模型服务，
端口 8192。SillyTavern 端口默认 8190，可用 ST_TEST_URL 指向另一个**测试**实例。
测试会创建卡和聊天、改变测试实例的模型设置。不要并行运行共享该实例的测试。

可选插件测试（先运行上面的 base 测试创建测试角色）：

```bash
git clone https://github.com/N0VI028/JS-Slash-Runner.git \
  .cache/SillyTavern/data/default-user/extensions/JS-Slash-Runner
git -C .cache/SillyTavern/data/default-user/extensions/JS-Slash-Runner \
  checkout 5cbd089f1217d00e1f6851f50bf451223860a9c2
curl -fL https://raw.githubusercontent.com/MagicalAstrogy/MagVarUpdate/d03b7dc8a6ebf9bd611c7e2dc91f3b35462deebc/artifact/bundle.js \
  -o .cache/mvu-bundle.js
# 重启测试酒馆，确保发现 Tavern Helper 4.12.0。
ST_TEST_MVU="$PWD/.cache/mvu-bundle.js" \
  pnpm --filter @st/web-ui exec playwright test plugins.spec.ts
```

插件及 MVU 有网络/CDN依赖，未打包到仓库/APK。若上游远程地址迁移，按固定 commit
恢复，不要静默改为 latest。MVU 返回的数据可能被冻结，修改前 structuredClone。

Android debug（先配置 ANDROID_HOME/JDK，并使用 Linux SDK）：

```bash
pnpm --filter mobile prebuild --platform android
cd apps/mobile/android
chmod +x gradlew
./gradlew :app:assembleDebug -PreactNativeArchitectures=x86_64
# ARM 真机删除 ABI 覆盖或使用 arm64-v8a。
```

Debug 需要 Metro：`pnpm --filter mobile start`，并按设备需要配置
`adb reverse tcp:8081 tcp:8081` 及 8190/8191 测试服务转发。
不要覆盖已有正式安装，除非用户同意；应用 ID 相同但 debug 签名不同。

## 优先续接顺序及已知风险

1. Linux 全量检查，审查 `git diff`；锁文件包括 webview patch、expo-system-ui/crypto。
   后续 patch 改动必须通过 pnpm patch 流程同步 hash，确保 frozen install 成功。
2. 成功构建 APK并安装隔离模拟器。测试 Caddy 根路径保护后的原生 HTTP Auth：
   首次回调 `view.getUrl()` 是否已可用、凭据失效重试、401/403、重连。
3. 攻击测试：同主机不同端口/协议、外部 iframe 认证挑战、重定向和外部主导航。
   不得为让登录成功而放宽认证 guard。Android Chromium 的实际认证缓存行为必须实测。
4. 原生首页 → 指定角色/文件 → 新建/历史/编辑 → 停止并保存返回 → 再进保持 iframe。
   覆盖重启、重复 ready/点击、同名角色、中文/特殊文件名、删除目标和服务器切换。
5. WebView 注入失败、未知版本、主题冲突及首次 onboarding 的原版可用性。
   最后的原版 `onLoadEnd` 回退和外链原生事件修复尚未在 APK验证。
6. 群聊：最后增加动态 import 上游 `openGroupById`、目标验证及保存读回检查，尚未重测。
   JSON 全量比较可能受上游消息规范化影响，需验证不会误报，也不会漏掉保存失败。
7. 文件上传/相机、认证下载、Blob 导出。注入代码截获上游 detached download anchor；
   未带 download 属性的下载或第三方导出可能仍走系统下载器，认证行为未验证。
8. 主题/语言持久实例同步、窄屏/横屏/大字体/软键盘、所有编辑页读写与导入导出。
   检查简体中文/英文/德文键、插值及动态错误码，不只做结构一致性测试。
9. 继续现代化页面流程和视觉验收；第三方设置 CSS 作用域最后已收窄，需回归。
10. 固定 MVU/助手测试卡，补全真实生成、正则、快捷回复、提示词扩展参与的完整链路。
11. 核查 migration：保留服务器/凭据/偏好，不上传旧缓存或草稿；剩余未使用模块可继续
    按引用审查清理。应用锁定和系统预览遮挡需真机确认。
12. 更新兼容表和变更记录，满足 Android门槛后才执行 `pnpm release:bump --bump minor`，
    检查版本和 code，再走既有 GitHub Actions 签名发布。明确列出未验收组合。

## Windows 停止状态与本地遗留

暂停后已检查无 8081/8190/8191/8192/5554/5555 监听，无本任务 Java/Kotlin 编译器、
Playwright/Vitest/Metro、Caddy、模拟器进程。没有部署、推送生产数据或发布版本。

本次 Windows 安装/使用了 Android SDK 命令行工具、Android 35 x86_64 测试镜像、
AVD `stc-test`，以及测试缓存里的 Caddy 2.11.7、Ninja 1.13.2、MVU和隔离酒馆。
SDK/模拟器位于用户标准 Android 目录。隔离短路径源码副本为 `C:\stc-build`，
原工作区 `.cache/` 里有测试数据、日志和截图。这些不上传 GitHub，也不应成为续接依赖。
未自动删除 SDK/依赖缓存，以免误删其他项目共用工具。

Windows 构建先后遇到旧 Ninja 长文件名限制、OneDrive cloud reparse dependency 文件
使 Gradle 报 `not a regular file`。曾尝试 materialize `C:\stc-build\node_modules`
云文件，已中止，并检查未发现待恢复的 `.stc-materialized` 临时文件。
不要将这个 Windows 副本的 node_modules 或生成的 android/ 复制到 Linux。
`withShortCmakePaths` 提供可选 STC_NINJA_PATH，仅是 Windows 临时措施，Linux 可复查
是否保留；不能把它当作 Android 功能已验收的依据。

CLAUDE.md 要求 graphify hook-rebuild，但本机 graphify CLI 不可用，图未更新。
仓库既有图可能与本次迁移不一致；继续时按可用工具刷新，勿使用过时图推断调用关系。
