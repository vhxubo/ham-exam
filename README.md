# ham-exam · HAM 题库

业余无线电台操作技术能力验证（A/B/C 类）刷题站。零构建、零依赖、纯静态——原生 JS + localStorage，扔到 GitHub Pages 就能用。

- 题库：CRAC **2025-10 版**，A 类 683 题 / B 类 1143 题 / C 类 1282 题，全量带解析与助记
- 考试规格：A 类 40 题（单选 32 + 多选 8）· 40 分钟 · 30 题合格；B 类 60 题（45+15）· 60 分钟 · 45 题合格；C 类 90 题（70+20）· 90 分钟 · 70 题合格。多选须完全一致才得分

## 功能

| 模式 | 说明 |
| --- | --- |
| 刷题 | 顺序/随机，即时判分，可**返回上一题回看**，**选项顺序打乱**（官方源数据单选答案恒为 A，不打乱等于白刷），解析中的选项字母会按当前展示顺序自动重映射 |
| 背题 | 原序展示、直接高亮答案，与解析文本的字母引用一致，可前后翻题 |
| 模拟考试 | 按官方规格抽卷、答题卡、倒计时、单选自动跳题、**上一题/下一题自由跳转**、中途退出可续考（计时不停）、考后分章报告 + 错题回顾 |
| 错题本 | 答错自动收录（考试错题也进），**连对两次自动移除** |
| 章节练习 | 5 章 × 全部小节，中文知识点名称，每节独立进度与正确率 |
| 统计 | 覆盖率、正确率、分章正确率、考试历史，学习数据一键导出/导入 |
| 其他 | 全文搜索（Ctrl+K）、深色/浅色/跟随系统、移动端适配、PWA 安装（离线可用）、键盘快捷键（1234/ABCD 选项、Enter 确认/下一题、← 返回上一题/上一题）、`dist/ham-exam.html` 单文件分享版（A 类，本地双击可用） |

各题库的进度、错题、考试历史完全隔离，顶栏 A/B/C 一键切换（按需加载，B/C 只在切到时才下载）。

## 使用

直接开 `index.html` 或起任意静态服务器：

```sh
cd ham-exam && python3 -m http.server 8080
```

### 发布 GitHub Pages

推到 GitHub 后：仓库 **Settings → Pages → Build and deployment → Source 选 "GitHub Actions"**（只需设置一次），之后每次 push `main` 都会自动部署（`.github/workflows/deploy.yml`）。

工作流会先校验 `banks/`、`dist/` 与 `data/raw/` 源数据一致——改了题库源数据但忘跑构建脚本时，部署会直接失败提醒你。

## 构建

题库源数据在 `data/raw/`（来自社区整理，版权归 CRAC，仅供学习）。改数据后重新生成：

```sh
python3 scripts/build_banks.py        # 生成 banks/bank-{a,b,c}.js + 配图
python3 scripts/build_standalone.py   # 生成 dist/ham-exam.html 单文件版
```

### 安装为应用（PWA）

HTTPS 部署后（GitHub Pages 即可），浏览器菜单选「安装」/「添加到主屏幕」即可像原生应用一样离线刷题。图标改动后记得跑 `python3 scripts/make_icons.py` 重新生成 PNG。更新策略：页面网络优先，静态资源（JS/CSS/题库）缓存秒开、后台静默刷新——联网打开一次即完成更新；发版时递增 `sw.js` 里的 `CACHE` 版本号即可让老用户清掉旧缓存。

## 数据来源

- 题库 JSON（含解析/助记/配图）：[AlliotTech/ham-exam-web](https://github.com/AlliotTech/ham-exam-web)
- 章节知识点名称：[LNC0831/crac-ham-guide](https://github.com/LNC0831/crac-ham-guide)
- 官方题库与考核标准：[CRAC](https://www.crac.org.cn/?p=1287)
