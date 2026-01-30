# 🍺 Tavern-Link 魔改版

**Tavern-Link 魔改版** 是一个支持 **全局共享记忆** 的 QQ AI 机器人，实现多会话跨用户的持久化上下文管理。

> 🎯 **设计理念**：让 AI 拥有真正的"群体记忆"能力，自动注入消息元数据（QQ号/昵称/群组/时间戳），可以记住并关联不同用户、不同群组的历史对话。

> 🤖 **特别说明**：本项目含人量为 0%，全部代码由 Claude 编写。有 bug 欢迎提 Issue，我会叫 Claude 来修。

## ✨ 功能特性

- 🧠 **全局共享记忆**：所有用户、所有群组共享同一个 AI 上下文，真正的"群体记忆"
- 📝 **自动元数据注入**：每条消息自动附加 `[私聊/群聊|QQ:xxx|昵称:xxx|群号:xxx|群名:xxx|时间:xxx]` 格式信息
- 🔗 **持久化存储**：基于 JSON 文件实现，重启后记忆不丢失
- ⚙️ **灵活配置**：可自定义记忆容量、触发条件、角色设定
- 🔥 **热更新支持**：通过 Web 面板修改配置无需重启，实时生效
- ⏱️ **可调节超时**：AI 响应超时时间可在 Web 面板配置，支持热更新
- 🎭 **角色扮演友好**：元数据格式为旁白式，不破坏角色人设
- 💬 **QQ 集成**：通过 OneBot WebSocket 连接 NapCat
- 🌐 **Web 面板**：简洁的 Web 管理界面，支持登录认证
- ✂️ **消息分段**：长回复自动分段发送，更自然
- 🔧 **正则处理**：支持对 AI 回复进行正则替换
- 🔊 **TTS 语音合成**：支持豆包（字节跳动）TTS，AI 可以发送语音消息
- 📚 **世界书支持**：兼容 SillyTavern 世界书格式，支持粘性条目

## 📦 安装使用

```bash
# 克隆仓库
git clone https://github.com/Xeltra233/tavern-link-global-memory.git
cd tavern-link-global-memory

# 安装依赖
npm install

# 复制配置文件
cp config.example.json config.json

# 编辑配置文件，填入你的 API Key 等信息
nano config.json

# 启动运行
npm start
```

访问 `http://localhost:8001` 打开 Web 管理面板。

## ⚙️ 配置说明

编辑 `config.json`：

```json
{
  "auth": {
    "enabled": true,
    "username": "admin",
    "password": "your-password-here",
    "sessionSecret": "your-random-secret-key-change-this"
  },
  "server": {
    "port": 8001,
    "host": "0.0.0.0"
  },
  "onebot": {
    "url": "ws://127.0.0.1:3001",
    "accessToken": ""
  },
  "ai": {
    "baseUrl": "https://api.example.com/v1",
    "apiKey": "your-api-key-here",
    "model": "your-model-name",
    "maxTokens": 65535,
    "temperature": 1,
    "timeout": 60000
  },
  "chat": {
    "triggerPrefix": "",
    "historyLimit": 100,
    "maxGlobalMessages": 2000,
    "allowedGroups": [],
    "splitMessage": true,
    "defaultCharacter": "你的角色名"
  },
  "regex": {
    "enabled": true,
    "rules": []
  },
  "tts": {
    "enabled": false,
    "appId": "your-doubao-app-id",
    "accessToken": "your-doubao-access-token",
    "voiceType": "zh_female_wanwanxiaohe_moon_bigtts",
    "speed": 1,
    "volume": 1,
    "pitch": 1
  }
}
```

### 配置项详解

#### 🔐 认证配置 (`auth`)
| 配置项 | 说明 |
|--------|------|
| `enabled` | 是否启用登录认证 |
| `username` | 登录用户名 |
| `password` | 登录密码 |
| `sessionSecret` | Session 密钥（请修改为随机字符串） |

#### 🌐 服务器配置 (`server`)
| 配置项 | 说明 |
|--------|------|
| `port` | Web 面板端口 |
| `host` | 监听地址（`0.0.0.0` 允许外网访问） |

#### 🤖 OneBot 配置 (`onebot`)
| 配置项 | 说明 |
|--------|------|
| `url` | NapCat WebSocket 地址 |
| `accessToken` | OneBot 访问令牌（可选） |

#### 🧠 AI 配置 (`ai`)
| 配置项 | 说明 | 默认值 | 推荐值 |
|--------|------|--------|--------|
| `baseUrl` | AI API 地址 | - | - |
| `apiKey` | API Key | - | - |
| `model` | 模型名称 | - | - |
| `maxTokens` | 最大生成 token 数 | 4096 | 8192-65535 |
| `temperature` | 温度参数（控制随机性） | 0.7 | 0.7-1.0（角色扮演）<br>0.3-0.5（客服助手） |
| `timeout` | **AI 响应超时时间（毫秒）** | 60000 | **60000（1分钟）**<br>**120000（2分钟，复杂场景推荐）** |

> 💡 **timeout 说明**：如果聊天记录过大或角色卡复杂，建议改为 120000（2 分钟）。支持热更新，可在 Web 面板实时修改。

#### 💬 聊天配置 (`chat`)
| 配置项 | 说明 | 默认值 | 推荐值 |
|--------|------|--------|--------|
| `triggerPrefix` | 前缀触发的关键词 | "" | "" 或 "/chat" |
| `historyLimit` | **上下文窗口大小**（每次发送给 AI 的消息数） | 30 | **30-100**（普通）<br>**100-200**（复杂角色） |
| `maxGlobalMessages` | **全局记忆池容量上限**（所有用户共享） | 2000 | **1000-2000**（小群）<br>**3000-5000**（大群） |
| `allowedGroups` | 群组白名单（空数组表示不限制） | [] | - |
| `splitMessage` | 是否分段发送长消息 | true | true |
| `defaultCharacter` | 默认角色名称 | - | - |

> 💡 **historyLimit vs maxGlobalMessages**：
> - `historyLimit`：每次从记忆池中提取最近的 N 条消息发送给 AI（上下文窗口）
> - `maxGlobalMessages`：记忆池的总容量，超过后自动删除最旧的消息

#### 🔧 正则配置 (`regex`)
| 配置项 | 说明 |
|--------|------|
| `enabled` | 是否启用正则替换 |
| `rules` | 正则替换规则列表（在 Web 面板配置） |

#### 🔊 TTS 配置 (`tts`)
| 配置项 | 说明 |
|--------|------|
| `enabled` | 是否启用 TTS 语音合成 |
| `appId` | 豆包 TTS App ID |
| `accessToken` | 豆包 TTS Access Token |
| `voiceType` | 音色类型（参考豆包文档） |
| `speed` | 语速（0.2-3.0） |
| `volume` | 音量（0.1-3.0） |
| `pitch` | 音调（0.1-3.0） |

## 🔥 热更新功能

通过 Web 面板修改以下配置项，**无需重启**即可实时生效：

### ✅ **支持热更新的配置**
- ⏱️ **AI 响应超时时间** (`ai.timeout`) - 🆕
- 🧠 **上下文窗口大小** (`chat.historyLimit`) - 🆕
- 💾 **全局记忆池容量** (`chat.maxGlobalMessages`) - 🆕
- 🤖 AI 模型参数（baseUrl、apiKey、model、maxTokens、temperature）
- 🎯 触发规则（triggerPrefix、allowedGroups）
- 🎭 角色设定（defaultCharacter、系统提示词）
- 🔧 正则规则（regex.rules）
- 🔊 TTS 设置（所有 TTS 相关配置）
- ✂️ 消息分段开关（splitMessage）

修改后点击 **"💾 保存配置"** 按钮即可立即应用新配置，**无需重启程序**。

### 🔄 **需要重启的配置**
- 服务器端口（`server.port`）
- OneBot WebSocket URL（`onebot.url`）
- 认证配置（`auth.*`）

## 💬 使用方式

### 基础对话

在群聊中 @机器人 即可触发：

```
用户A: @机器人 你好
机器人: 你好！有什么我可以帮助你的吗？

用户B: @机器人 刚才 A 
