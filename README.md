# ReadWithMe

> 中文长篇网络小说 AI 陪读阅读器 — 让冷门长尾书也能拥有真实的「读书群」氛围

## 关于这个项目

ReadWithMe 是一款探索性产品，尝试用 AI 人格化的段落级评论解决长篇网文的「中段孤独」与「冷门书评论荒漠」问题。

> ⚠️ **当前状态**：项目仍在持续完善中，目前为产品框架阶段。核心阅读 + AI 陪评闭环已经跑通，更多场景细节、人格扩展、UI 打磨与商业化路径仍在迭代。欢迎试用、反馈、共建。

灵感来源是起点读书的「本章说 / 段评」功能——该功能已被验证可提升用户人均阅读时长 32%、付费率 10%，但这套留存机制只对头部书生效，冷门长尾书因评论稀疏陷入「评论荒漠」。ReadWithMe 用 AI 人格补全长尾书的评论氛围，把「读书群」从头部书的特权变成全量书的标配。

## 核心特性

- **段落级 AI 人格评论**：6 个差异化人格（吐槽姬、分析菌、考据党、感慨君、提问菌、我的小书友），每个人格有独立语气、关注点与互动定位
- **章节末「本章说」AI 讨论**：仿起点交互，章节结尾自动生成 2-4 条人格短评作为停留触点
- **段落级追问与多轮对话**：对任一 AI 评论可发起追问，AI 基于章节滚动记忆保持人格一致地继续讨论
- **AI 与用户的混合评论区**：用户回评与 AI 评论嵌套互动，AI 之间也会因人格立场产生观点对比
- **多模型可配置**：OpenAI、Claude、DeepSeek、本地 Ollama 均支持；每个人格可绑不同模型
- **本地优先**：书库、阅读位置、AI 评论、对话历史全部存浏览器 localStorage，AI 调用经本地代理直连用户自配的 LLM，零云端持久化
- **章节滚动记忆**：用结构化 rolling summary 解决长篇小说远超 LLM 上下文窗口的问题
- **三主题切换**：暖白 / 深色 / 护眼黄，字号、行高可调

## 快速开始

### 1. 启动开发服务器

```bash
python -m http.server 3000
```

浏览器打开 <http://localhost:3000/app.html>

### 2. 内置 Demo（无需配置）

首次进入会自动加载《水浒传》作为内置 demo，演示完整阅读 + AI 陪评交互。Demo 模式使用本地模板评论，无需 API Key 即可体验。

### 3.（可选）接入真实 LLM

如果想看到由真实模型生成的评论：

```bash
python proxy_server.py
```

代理默认监听 `127.0.0.1:11435`。在应用「设置 → AI 接入」中：

1. 配置 baseUrl、模型名、API Key（支持 OpenAI 兼容协议）
2. 点击「测试连接」
3. 打开「启用真实 AI」开关

之后新加入的书与新读到的章节将由真实模型生成评论。

## 技术栈

- **前端**：单文件 React 18.3.1 + Babel Standalone（无构建工具，CDN 加载）
- **字体**：Noto Serif SC + Noto Sans SC
- **持久化**：localStorage / sessionStorage，无后端
- **AI 代理**：单文件 Python（200 行），负责 CORS 转发 + 关闭思考链 + 连接测试
- **测试**：Node helper tests + Playwright 浏览器烟测

## 目录结构

```
ReadWithMe/
├── app.html             ← 唯一主文件，单文件 React 应用
├── proxy_server.py      ← 本地 AI 代理（127.0.0.1:11435）
├── 水浒传.txt           ← 内置 demo 小说
├── tests/               ← Node + Playwright 测试
│   ├── ai-reading-helpers.test.js
│   ├── ai-profile-helpers.test.js
│   ├── demo-mode-helpers.test.js
│   └── browser-smoke.js
├── AGENTS.md            ← AI 协作开发约定
└── README.md
```

## 数据结构

```javascript
// 书架
'rwm_novels' → [{ id, title, fileName, totalChapters, lastReadChapter, ... }]

// 每本小说章节内容（独立 key 避免超限）
'rwm_novel_{id}' → { chapters: [{ title, content }, ...] }

// AI 评论缓存（fingerprint 化的失效粒度）
'rwm_ai_comments_{novelId}_{chapterIndex}_{fingerprint}' → [...]

// 章节滚动记忆
'rwm_ai_memory_{novelId}_{chapterIndex}' → { plotSummary, majorCharacters, ... }

// 全局阅读设置
'rwm_settings' → { fontSize, theme, lineHeight }
```

## AI 关键设计

- **章节滚动记忆**：每章生成结构化 summary（plotSummary / majorCharacters / relationships / openQuestions / worldFacts），下一章基于上一章 summary 增量更新，把「长篇小说远超 LLM 上下文」用产品策略而非更大模型解掉。
- **严格 JSON 输出契约**：所有 Prompt 强制 strict JSON 输出，配 5 层防御解析链（去 Markdown 围栏 / 提 JSON 块 / 修复 / 解析 / schema 校验）。
- **关闭思考链**：proxy 在每次请求注入 `/no_think` + `reasoning.enabled=false` + `think=false` + `include_reasoning=false`，覆盖 DeepSeek-R1、Qwen3 等模型的思考链开关。
- **渐进式冷启动**：首章先生成 summary + 章节末讨论（5-10 秒），段落评论分 chunk 流式补全，用户读前几段时后面已经悄悄到位。
- **fingerprint 缓存键**：cache key 由 (novelId, chapterIndex, fingerprint) 组成，fingerprint 由人格 + 模型 + prompt 版本联合哈希；任意配置变更自动失效旧缓存。
- **剧透防御**：多层 Prompt 约束 + 段落 / 章节正文长度截断 + memory 不允许包含未来章节内容。

## 后续路线

- [ ] 真实 LLM 调用的成本、延迟、人格一致性持续打磨
- [ ] 人格自定义与社区分享
- [ ] 移动端 PWA / 原生壳子打包
- [ ] epub 格式支持
- [ ] 多设备云同步（可选，保持本地优先）

## 反馈与共建

欢迎提 Issue 反馈使用体验、人格设计建议、长篇小说兼容性问题等。

## License

MIT
