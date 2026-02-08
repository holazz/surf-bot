# Surf Bot

自动化 Surf AI 问答机器人，支持批量提问、定时任务。

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置环境变量

在 `.env` 配置环境变量：

| 变量名           | 说明         | 获取方式                            |
| ---------------- | ------------ | ----------------------------------- |
| `ACCESS_TOKEN`   | 用户访问令牌 | 见下方获取教程                      |
| `REFRESH_TOKEN`  | 刷新令牌     | 见下方获取教程                      |
| `DEVICE_ID`      | 设备ID       | 见下方获取教程                      |
| `SESSION_TYPE`   | 聊天模式     | `V2` / `V2_INSTANT` / `V2_THINKING` |
| `QUESTION_COUNT` | 提问次数     | 数字，如 `3`                        |

#### 如何获取 Token 和 Device ID

1. 访问 [https://asksurf.ai](https://asksurf.ai) 并登录
2. 按 `F12` 打开开发者工具
3. 切换到 **Application** 标签
4. 左侧选择 **Local Storage** → `https://asksurf.ai`
5. 找到 `SURF_TOKENS` 键：
   ```json
   {
     "token": "eyJhbGc...", // 复制到 ACCESS_TOKEN
     "refreshToken": "xxx..." // 复制到 REFRESH_TOKEN
   }
   ```
6. 找到 `deviceId` 键, 复制值到 `DEVICE_ID`

### 3. 运行

```bash
# 聊天模式（自动提问每日问题）
pnpm dev

# 定时任务模式（每天早上8点自动提问每日问题）
pnpm schedule
```

## License

MIT
