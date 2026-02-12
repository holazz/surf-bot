# Surf Bot

自动化 Surf AI 问答机器人，基于区块链热点新闻自动生成问题并批量提问，支持定时任务。

## 功能特性

- 🤖 **智能问题生成**：整合 CryptoCompare、PANews、Reddit 等多个新闻源，通过 LLM 生成区块链热点问题
- 🔄 **自动 Token 刷新**：智能检测 Token 过期并自动刷新，无需手动维护
- 📊 **批量提问**：支持随机提问数量范围，模拟真实用户行为
- ⏱️ **随机间隔**：支持问题间随机等待时间，避免被识别为机器人
- 📅 **定时任务**：支持 Cron 表达式，可自动在指定时间执行

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置环境变量

在项目根目录创建 `.env` 文件并配置以下环境变量：

#### LLM API 配置（用于生成热点问题）

| 变量名              | 说明                          | 示例值                                          |
| ------------------- | ----------------------------- | ----------------------------------------------- |
| `LLM_API_KEY`       | LLM API 密钥                  | `sk-xxx...`                                     |
| `LLM_API_BASE_URL`  | LLM API 基础 URL              | `https://dashscope.aliyuncs.com/compatible-mode/v1` (QWEN) 或 `https://api.openai.com/v1` (OpenAI) |
| `LLM_MODEL`         | LLM 模型名称                  | `qwen-plus` / `gpt-4o` / `deepseek-chat`        |

**支持的 LLM 提供商**：
- **OpenAI**：`https://api.openai.com/v1`，模型如 `gpt-4o`、`gpt-4-turbo`
- **QWEN（通义千问）**：`https://dashscope.aliyuncs.com/compatible-mode/v1`，模型如 `qwen-plus`、`qwen-max`
- **DeepSeek**：`https://api.deepseek.com/v1`，模型如 `deepseek-chat`
- 其他兼容 OpenAI API 格式的服务

#### Surf AI 配置

| 变量名                    | 说明                         | 示例值                                    |
| ------------------------- | ---------------------------- | ----------------------------------------- |
| `ACCESS_TOKEN`            | Surf AI 用户访问令牌         | `eyJhbGc...`（见下方获取教程）            |
| `REFRESH_TOKEN`           | Surf AI 刷新令牌             | `xxx...`（见下方获取教程）                |
| `DEVICE_ID`               | 设备唯一标识 UUID            | `xxx-xxx-xxx-xxx`（见下方获取教程）       |
| `SESSION_TYPE`            | Surf AI 聊天模式             | `V2` / `V2_INSTANT` / `V2_THINKING`       |
| `QUESTION_COUNT_RANGE`    | 提问次数范围                 | `7,10` 表示随机提问 7 到 10 个问题        |
| `QUESTION_INTERVAL_RANGE` | 提问间隔时间范围（分钟）     | `0,1` 表示每次提问间隔 0 到 1 分钟        |
| `SCHEDULE_CRON`           | 定时任务 Cron 表达式         | `0 8 * * *` 表示每天早上 8 点执行         |

#### 如何获取 Surf AI Token 和 Device ID

1. 访问 [https://asksurf.ai](https://asksurf.ai) 并登录
2. 按 `F12` 打开开发者工具
3. 切换到 **Application** 标签
4. 左侧选择 **Local Storage** → `https://asksurf.ai`
5. 找到 `SURF_TOKENS` 键，复制其中的值：
   ```json
   {
     "token": "eyJhbGc...", // 复制到 ACCESS_TOKEN
     "refreshToken": "xxx..." // 复制到 REFRESH_TOKEN
   }
   ```
6. 找到 `deviceId` 键，复制其值到 `DEVICE_ID`

### 3. 运行

```bash
# 立即执行模式（自动获取新闻并生成热点问题，批量提问）
pnpm dev

# 定时任务模式（按 SCHEDULE_CRON 配置的时间自动执行）
pnpm schedule
```

## License

MIT
