# V3 本机打分表

用于整理六维评审、记录证据与关键前提，并生成创始人版和投资人版报告。六维依次为市场需求、商业模式、资本效率、竞争壁垒、执行能力、投资回报；档位为 `unknown / weak / normal / strong / na`，综合另含 `hold`。评审规则以 [`model.py`](model.py) 为准。

仓库只附带完全合成的样例和测试夹具。样例中的企业、人物、客户、金额、比例、来源和核验状态均为虚构，不代表实际调查或交易。真实项目材料、评审人信息及运行生成的文件应保存在自己的私有目录中。

## 目录

| 路径 | 用途 |
| --- | --- |
| `serve.py`、`sheet.html`、`sheet.js`、`sheet-model.js`、`sheet.css` | 本机服务和可编辑打分表 |
| `model.py` | V3 数据字段、校验、档位规则及两种对外数据投影 |
| `build.py`、`template-*.html`、`render*.js`、`style*.css`、`layout.js`、`tokens.css` | 两版报告的离线构建、样式与排版检查 |
| `data-v3/sample-company.draft.json` | 默认合成样例，与 [`examples/synthetic/sample-company.draft.json`](../../examples/synthetic/sample-company.draft.json) 字节一致 |
| `data-v3/reviewer.txt` | 演示署名 `示例评审人`，不能代表实际审阅 |
| `test-fixtures/`、`synthetic_fixtures.py`、`test*.py`、`test_logic.cjs`、`verify*.cjs` | 合成夹具、单元测试及静态／浏览器检查 |
| `chrome_pipe.py`、`pdfcheck.py`、`pdf_unicode.py`、`render_pdf.py`、`compare_rasters.py` | 本机 Chrome 打印、PDF 文字与栅格检查 |
| `EquivalentUnifiedIdeograph-18.0.0.txt` | Unicode 字符映射数据，保留原始版权与许可声明 |
| `brand.png`、`brand-transparent.png`、`derive_brand.py` | 品牌图和透明背景辅助脚本 |
| `migrate_v2_v3.py` | 将自己的 V2 输入迁移为需要补齐的 V3 草稿，输入与输出须分开 |

运行后会在配置的数据目录产生 `*.sheet.json` 和 `versions/` 快照；报告及检查产物默认写入本工具目录下的 `outputs/`。这些文件不属于公开样例，不应随源码发布。

## 依赖与启动

- Python 3.9 或更高版本；日常使用仅依赖 Python 标准库，无需安装 Python 包。
- 生成 PDF 需要已安装的本机 Chrome。当前 PDF 栅格校验调用 macOS 系统框架，因此完整 PDF 流程需要 macOS；HTML 预览不需要 Chrome。
- JavaScript 自检需要 Node.js（支持 `node:`、`Object.hasOwn` 和 `Array.at` 的版本）。完整浏览器验证另需已安装的 Playwright；静态自检不需要它，也不会下载浏览器。

在仓库根目录执行：

```sh
cd tools/scoring-sheet
python3 serve.py
```

浏览器打开 <http://127.0.0.1:8766/sheet.html?id=sample-company>。服务仅绑定 `127.0.0.1`，按 `Ctrl+C` 停止。页面的预览及确认按钮均会执行完整 PDF 构建；使用这些按钮前，应指定 Chrome：

```sh
python3 serve.py --chrome "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
```

可用 `--port` 更换端口，用 `--data-dir` 和 `--out-dir` 指定私有数据及输出目录。相对路径按启动命令所在目录解析；未传入时，默认路径相对于工具目录。Chrome 也可通过 `SCORING_SHEET_CHROME` 配置，或从 `PATH` 中发现 `google-chrome` / `chromium`。

## 数据格式与样例校验

字段类型、长度、数量、来源引用、资金用途合计和公开白名单见 [`model.py`](model.py) 的 `validation_errors()`、`validate()`、`public_data()` 和 `SCHEMAS`。JSON 样例展示完整格式；编辑界面只允许修改规定字段。

```sh
python3 build.py --id sample-company --draft --validate-only
```

样例六维依次为 `normal / unknown / na / strong / normal / weak`，综合为 `normal`；四项关卡均未核验。样例通过默认校验和两种公开投影，`private_strings()` 对两版均为空。测试夹具另放入合成的内部哨兵文字，用来验证内部内容不会泄露到报告中。

## 生成两版报告

不需要 Chrome 的离线 HTML 预览：

```sh
python3 build.py --id sample-company --draft --html-only --version founder
python3 build.py --id sample-company --draft --html-only --version investor
```

文件分别为 `outputs/sample-company-founder-preview.html` 和 `outputs/sample-company-investor-preview.html`。不传 `--version` 会按资料充分度生成两版；资料不足时跳过投资人版。

生成包含横版和竖版 PDF 的预览：

```sh
python3 build.py --id sample-company --draft \
  --chrome "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
```

创始人版包含六维判断、综合及最弱关键前提；投资人版包含企业卡片和关键前提，不包含评级字段。两版均只输出被选为对外的判断与问题，以及实际引用的来源。预览会标注“内部预览 · 未确认”。

正式生成须在本机页面完成核对，按“确认对外”保存署名和确认快照；这只生成本机文件，不会上传或发送。署名从所选数据目录的 `reviewer.txt` 第一行读取。内容变更会使既有确认失效。已有效确认的数据可再次生成：

```sh
python3 build.py --id sample-company --version founder --chrome "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
python3 build.py --id sample-company --version investor --chrome "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
```

未确认的数据不能通过上述命令生成正式报告；`--assume-confirmed` 仅供 `test-fixtures/` 下以 `fixture-` 开头的测试数据使用。

## 自检

```sh
python3 -m unittest discover -p 'test*.py' -v
node test_logic.cjs
```

以下命令还包含上述测试、语法检查、两版 HTML 投影及泄露检查，不启动浏览器：

```sh
node verify.cjs --static-only
```

完整浏览器验证使用 `node verify.cjs`，需要本机 Chrome 和现有 Playwright。可用 `PLAYWRIGHT_MODULE` 指向已安装模块，用 `SCORING_SHEET_CHROME` 指定 Chrome，用 `SCORING_SHEET_OUT_DIR` 改变验证产物目录。完整模式包含 PDF、页面布局、响应式及保存确认流程，还包含两组各 20 次连续构建；静态通过不能替代这些检查或人工目视审阅。

`python3 synthetic_fixtures.py` 可从公开合成样例重建 8 个 V3 测试夹具和 1 个 V2 迁移夹具。容量长度、溢出拒绝、内部哨兵、暂缓、资料不足与不适用等断言均保留。

## 许可与声明

代码采用 Apache-2.0，文档采用 CC BY-SA 4.0，详见仓库根目录的许可文件。Unicode 数据文件按其原始声明和许可使用。

本工具按原样提供，不构成投资建议。
