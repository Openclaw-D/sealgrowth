# SEAL LAB · Edge AI Research & Development

SEAL LAB adapts small models to real hardware and measures accuracy, latency, memory and power on the target device. The proposed first experiment is offline keyword recognition. Our aim is to publish reproducible code, firmware and procedures wherever possible. SEAL LAB welcomes non-equity sponsorship, declines investment and retains control of research and publication.

SEAL LAB 从事端侧小模型后训练、硬件适配与设备实测。首项候选实验为离线关键词识别。我们尽可能开放代码、固件和实验方法，接受赞助，不接受投资，并独立决定研究方向和结果发布。

The English homepage is `site/index.html`, with a Chinese version at `site/zh/index.html`. SEAL LAB growth advisory resources are available at `site/advisory.html` and `site/zh/advisory.html`. The review tool and its scoring method remain accessible below.

## 目录 / Layout

| 路径 | 内容 | 许可 |
|---|---|---|
| `site/` | 静态网站，部署的就是这个目录：无构建步骤，无外部脚本、字体或统计 | 文案 CC BY-SA 4.0，代码 Apache-2.0 |
| `site/index.html` | 英文研究首页（默认）。历史 Startup / Personal 入口在 advisory.html | 同上 |
| `site/zh/index.html` | 中文首页，内容与英文逐段对应；两页互设 `hreflang` | 同上 |
| `site/review.html` | 评审工具 V2：页内切换中英文，两套模板（初创 / 个人）；默认零接口，"自带密钥"折叠为进阶；每个维度定档后，另做一次不计分的前瞻检查（基准日 2027-11-11，不改变档位） | 同上 |
| `site/assets/lab.js` | 研究首页语言链接与旧评审书签兼容 | Apache-2.0 |
| `site/assets/site.js` | 评审档案模式切换（`?mode=personal`、`#personal`、localStorage `seal-mode-v1`）与语言链接；无 JS 时显示 Startup | Apache-2.0 |
| `site/assets/review.js` | 评审工具全部逻辑：两套模板、提示词（`buildPrompt` 是唯一来源）、解析、六维图、导出 | Apache-2.0 |
| `site/open/` | 方法 `METHOD-V3.md` 与补充件 `METHOD-V3-addendum-2026-11-10.md`；锚点 `anchors-v3.json`、`anchors-personal-v1.json`；个人模板 `personal-v1.md`；提示词 `prompt-v2.md`（`prompt-v1.md` 已被取代，仅存档）；`review-output.schema.json`（接受 v1 与 v2）、`v3-record.schema.json`；合成样例；离线版 `review-offline.html` | 见各文件 |
| `tools/scoring-sheet/` | 本机打分表与创始人版 / 投资人版报告生成器。Python 3 标准库；PDF 需本机 Chrome。说明见其 [README](tools/scoring-sheet/README.md) | Apache-2.0 |
| `examples/synthetic/` | 完全合成的 V3 样例记录 | CC BY-SA 4.0 |

## 本地预览 / Preview

```sh
python3 -m http.server 8787 --directory site
```

打开 <http://localhost:8787/>（英文）或 <http://localhost:8787/zh/>（中文）；加 `?mode=personal` 看个人模式。首页两种模式的正文分别控制在三分钟内读完（英文 Startup ≤ 550 词、Personal ≤ 350 词；中文 ≤ 1300 / 800 汉字）。`method.html` 与 `open/index.html` 只是双语跳转页（`meta refresh` + `noindex`），跳到首页 `#method`、`#open`。

## 离线版 / Offline

`site/open/review-offline.html` 是评审工具的单文件版：`review.html`、`site.css`、`review.js` 内联在一起，CSP 只放行这段内联脚本的 sha256 哈希。下载后直接从磁盘打开即可用；不选进阶服务商就不发出任何网络请求。每次改 `review.html`、`site.css` 或 `review.js` 后都要重新生成（生成脚本在本机 `work/build-offline.cjs`，不在仓库里）。

## 部署

网站是纯静态文件，部署目录为 `site/`，没有构建步骤。

**当前线上地址：<https://openclaw-d.github.io/sealgrowth/>（GitHub Pages，`gh-pages` 分支）。** 发布方法：把 `site/` 拆成 `gh-pages` 分支推上去，GitHub Pages 的来源设为该分支根目录。

```sh
git subtree split --prefix site -b gh-pages && git push -f origin gh-pages && git branch -D gh-pages
```

GitHub Pages 不能设响应头，所以两个首页和工具页在 `<head>` 里用 `<meta http-equiv="Content-Security-Policy">` 声明了同一份 CSP（meta 不支持 frame-ancestors）；两个跳转页不含脚本。`site/.nojekyll` 让 Pages 原样发布。

仓库同时带有 Cloudflare Workers 静态资源配置（`wrangler.jsonc`，`assets.directory` 为 `site`，`site/_headers` 下发六个安全头）：在已登录 Cloudflare 的环境里执行 `WRANGLER_SEND_METRICS=false npx --yes wrangler@4 deploy`。2026-11-05 该账户下所有 Worker 都返回 error 1101（账户级问题，与站点无关），所以暂以 GitHub Pages 为准。

其他静态托管（Netlify、Vercel、自建 Nginx）也能直接托管 `site/`，建议按 `site/_headers` 配置响应头。

部署后检查 `/`、`/zh/`、`/review.html`、`/method.html`、`/open/index.html`（后两者应含 refresh 并跳到首页锚点）、`/open/prompt-v2.md`、`/open/review-offline.html` 均为 200；`site/_headers` 只供 Cloudflare 使用，其中的 CSP 不含离线版脚本哈希，离线版应下载后在本地打开；本地 `python3 -m http.server` 预览没有响应头，但 meta CSP 仍然生效。

评审工具页只靠浏览器直连模型服务商，不需要任何服务端。CSP 的 `connect-src` 只放行 https 和本机地址（localhost、127.0.0.1）；自定义服务商若填 http 的非本机地址，会被浏览器拦下。

## 评审工具怎么保证密钥和输入不经过本站

- 站点是纯静态文件，没有服务器端代码，也没有任何接口可以接收内容。
- 密钥只放在浏览器内存里；只有你勾选"记在这个浏览器里"才写入该浏览器的 localStorage（明文），可随时取消。速查表草稿自动存在本浏览器的 localStorage，点"清空"即删。
- 方法与工具免费；你选的模型服务商可能按其价目收费。
- 请求直接从你的浏览器发往你选择的模型服务商；页面声明 `referrer: no-referrer`，请求同样不带来源。
- 默认的零接口方式连请求都没有：复制提示词到任意对话产品，把它的回复贴回来解析。材料不经过本站。
- 逻辑都在 `site/assets/review.js`，可以自己审。2026-11-05 在上海的一台电脑上实测，DeepSeek、通义千问（百炼兼容模式）、Kimi、SiliconFlow、MiniMax、Anthropic 允许浏览器跨域直连；智谱、火山方舟、OpenAI 在该网络下不行，请用零接口方式。

## 发布前核验

`work/` 目录不在仓库里；发布前在本机跑三件事：Playwright 在 375 px 和 1920×1080 下打开首页与工具页、检查两个跳转页，检查无横向溢出、无控制台错误、无外部请求；比对 `site/open/prompt-v2.md` 与 `review.js` 里四段提示词逐字一致、`anchors-v3.json` 与内置初创锚点一致；用 `review-output.schema.json` 校验合成的 v1 / v2 输出；离线版从 `file://` 打开无控制台错误；在 `tools/scoring-sheet/` 里运行 `node verify.cjs --static-only` 和 `python3 build.py --id sample-company --draft --validate-only`。

## 不公开的东西

个案私有材料、评审记录和非公开联系人留在本地。评审工具使用虚构案例。研究首页可引用公开的开发板规格和厂商教程，拟开展的实验标明状态。

## 许可

文档按 CC BY-SA 4.0（见 `LICENSE-DOCS`），代码按 Apache-2.0（见 `LICENSE-CODE`）。海豹图形与 SEAL LAB、历史品牌标识只用于标识本项目，不在许可范围内，请勿用于暗示背书。`tools/scoring-sheet/EquivalentUnifiedIdeograph-18.0.0.txt` 为 Unicode 数据文件，保留原始许可声明。

评审档案页动画（`site/assets/story.js`）里的地球陆地点，来自 Natural Earth 1:110m 国家边界数据（公有领域，naturalearthdata.com），合并后按 2 度栅格化，不含国界和地名。动画里的海豹和亮点只是示意，不对应真实项目、地点或数量。可读源码在 `src/story.js`；`site/assets/story.js` 是去掉注释、缩短变量名后的发布版，两者行为相同。

`assets/tex` 里的纹理是生成的图像，处理成可平铺的细节图，没有使用第三方照片。
