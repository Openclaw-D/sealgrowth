# 海豹增长 SEAL Growth · 网站与开源评审方法

这是 sealgrowth.cn 的全部内容：静态网站、评审方法 V3、评审提示词、两份 JSON Schema、完全合成的样例，以及本机运行的打分表与报告生成器。**方法和代码全部公开；项目方交给我们的材料永不公开。**

海豹增长是一个人的 FA 实践，现阶段不收费、不以盈利为目的；不提供资金，不向任何人承诺回报，不公开募集资金，对外不以 VC 或基金身份出现。网站与工具的任何输出都不构成投资建议。

## 目录

| 路径 | 内容 | 许可 |
|---|---|---|
| `site/` | 静态网站。部署的就是这个目录：无构建步骤，无外部脚本、字体或统计 | 文案 CC BY-SA 4.0，代码 Apache-2.0 |
| `site/open/` | 方法全文 `METHOD-V3.md`、锚点 `anchors-v3.json`、提示词 `prompt-v1.md`、`review-output.schema.json`、`v3-record.schema.json`、合成样例；网站"开源文件"页直接提供下载 | 见各文件 |
| `site/assets/review.js` | 自带密钥评审工具 V1 的全部逻辑（提示词、表单、直接调用、零接口解析、六维图、导出） | Apache-2.0 |
| `tools/scoring-sheet/` | 本机打分表与创始人版 / 投资人版报告生成器。Python 3 标准库；PDF 需本机 Chrome。说明见其 [README](tools/scoring-sheet/README.md) | Apache-2.0 |
| `examples/synthetic/` | 完全合成的 V3 样例记录（与 `site/open/` 和 `tools/scoring-sheet/data-v3/` 中的副本字节一致） | CC BY-SA 4.0 |

## 本地预览网站

```sh
python3 -m http.server 8787 --directory site
```

打开 <http://localhost:8787/>。三个页面：首页、方法（`method.html`）、评审工具（`review.html`），加开源文件页（`open/`）。

## 部署

网站是纯静态文件，部署目录为 `site/`，没有构建步骤。

- Cloudflare Pages：新建项目，连接本仓库或用 `wrangler pages deploy site` 直接上传；构建命令留空，输出目录填 `site`。Pages 会读取 `site/_headers`，给所有页面加上 CSP 等安全响应头（本地 `python3 -m http.server` 预览时没有这些头）。
- 其他静态托管：把 `site/` 整个目录原样放上去即可。评审工具页只靠浏览器直连模型服务商，不需要任何服务端。
- CSP 的 `connect-src` 只放行 https 和本机地址（localhost、127.0.0.1）；自定义服务商若填 http 的非本机地址，会被浏览器拦下。

## 评审工具怎么保证密钥和输入不经过本站

- 站点是纯静态文件，没有服务器端代码，也没有任何接口可以接收内容。
- 密钥只放在浏览器内存里；只有你勾选"记在这个浏览器里"才写入该浏览器的 localStorage（明文），可随时取消。
- 请求直接从你的浏览器发往你选择的模型服务商；页面声明 `referrer: no-referrer`，请求同样不带来源。
- 零接口方式连请求都没有：复制提示词到任意对话产品，把它的回复贴回来解析。
- 逻辑都在 `site/assets/review.js`，可以自己审。2026-11-05 在上海的一台电脑上实测，DeepSeek、通义千问（百炼兼容模式）、Kimi、SiliconFlow、MiniMax、Anthropic 允许浏览器跨域直连；智谱、火山方舟、OpenAI 在该网络下不行，请用零接口方式。

## 发布前核验

`work/` 目录不在仓库里；发布前在本机跑三件事：Playwright 在 375 px 和 1920×1080 下打开每一页，检查无横向溢出、无控制台错误、无外部请求；比对 `site/open/prompt-v1.md` 与 `review.js` 里的提示词逐字一致、`anchors-v3.json` 与内置锚点一致；在 `tools/scoring-sheet/` 里运行 `node verify.cjs --static-only` 和 `python3 build.py --id sample-company --draft --validate-only`。

## 不公开的东西

真实项目材料、评审记录、评审人信息、联系人。仓库里出现的每一家公司都是虚构的合成样例，来源一律以"合成示例："开头。

## 许可

文档按 CC BY-SA 4.0（见 `LICENSE-DOCS`），代码按 Apache-2.0（见 `LICENSE-CODE`）。海豹图形与"海豹增长 / SEAL Growth"名称只用于标识本项目，不在许可范围内，请勿用于暗示背书。`tools/scoring-sheet/EquivalentUnifiedIdeograph-18.0.0.txt` 为 Unicode 数据文件，保留原始许可声明。
