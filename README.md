# 超星学习通 AI 自动答题（油猴脚本）

在超星学习通作业 / 考试预览页面注入一个 AI 答题面板：自动读取题目，调用 DeepSeek 分析，并把答案填回页面。

## 脚本文件

| 文件 | 版本 | 作用 |
|---|---|---|
| `超星自动答题1.user.js` | 1.3.0 | 主脚本：扫描题目 → AI 分析 → 自动填答 |
| `超星清空重置.user.js` | 1.1 | 一键逐个清空已选选项和已填答案 |

## 功能

- 支持单选、多选、填空、判断题
- 四个操作按钮：扫描题目、AI 分析、填入答案、一键全自动
- 统计总题数、已答数、选择/判断题数、多选/填空题数
- 面板可拖拽、可折叠成浮动按钮
- 支持批量读题，减少 API 请求次数

## 安装

1. 浏览器安装 [Tampermonkey](https://www.tampermonkey.net/) 或 Violentmonkey
2. 新建脚本，把 `.user.js` 的内容粘贴进去并保存（两个脚本分别安装）
3. 打开超星学习通的作业或考试预览页面，右侧会出现答题面板

## 配置

在面板中填写：

- **DeepSeek API Key**：`sk-...`，在 <https://platform.deepseek.com/api_keys> 获取
- **模型**：
  - `deepseek-v4-flash`（快速）
  - `deepseek-v4-pro`（更强）

API Key 只保存在浏览器 `localStorage`（键名 `cx_auto_answer_apikey`），请求直接发往 `https://api.deepseek.com/chat/completions`，不经过其他服务器。

> 注意：不要把填好 Key 的脚本文件发给别人；截图时也注意遮挡 Key。

## 使用

1. 打开作业页面，等待题目加载完成
2. 点击 **扫描** 识别当前页面题目
3. 点击 **AI** 分析答案，或直接点击 **一键全自动**
4. 检查填写结果，确认后自行提交
5. 需要重做时点击右下角 `🔄` 按钮清空答案

## 适配页面

脚本匹配以下地址：

- `https://mooc1-api.chaoxing.com/mooc-ans/mooc2/work/dowork*`
- `https://*.chaoxing.com/mooc-ans/*`
- `https://mooc1-api.chaoxing.com/exam-ans/mooc2/exam/preview*`
- `https://*.chaoxing.com/exam-ans/*`
- 本地测试页 `file:///*作业作答*.html`、`file:///*整卷预览*.html`

## 仓库说明

- 用于离线调试的 `网页1/`（约 22 MB 的整卷预览网页快照）未纳入仓库
- `.claude/settings.json` 只是开发时的本地权限配置，不含任何密钥

## 免责声明

本项目仅供学习浏览器脚本、页面解析和大模型 API 调用使用。使用自动化脚本答题可能违反平台规则，由此产生的后果由使用者自行承担。
