/**
 * Lite Chat Engine - 轻量级 QQ 聊天引擎
 * 兼容 SillyTavern 数据格式
 */
/**
 * Lite Chat Engine - 轻量级 QQ 聊天引擎
 * 兼容 SillyTavern 数据格式
 */

// ========================================
// 启动横幅
// ========================================
const colors = {
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  gray: '\x1b[90m',
  reset: '\x1b[0m'
};

console.log(`
${colors.cyan}========================================
   🍺 Tavern-Link 魔改版 v1.0
========================================${colors.reset}

${colors.green}✓${colors.reset} 魔改功能已启用
${colors.gray}├─ 全局记忆池可配置
├─ 上下文窗口可调节
└─ Web 控制面板热更新${colors.reset}
`);
// ========================================

import express from 'express';
import session from 'express-session';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

import { OneBotClient } from './onebot.js';
import { CharacterManager } from './character.js';
import { WorldBookManager } from './worldbook.js';
import { PromptBuilder } from './prompt.js';
import { AIClient } from './ai.js';
import { SessionManager } from './session.js';
import { RegexProcessor } from './regex.js';
import { setupRoutes } from './routes.js';
import { Logger } from './logger.js';
import { TTSManager, VOICE_TYPES, parseVoiceTags } from './tts.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');

// 加载配置
function loadConfig() {
    const configPath = join(ROOT_DIR, 'config.json');
    if (fs.existsSync(configPath)) {
        return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
    throw new Error('配置文件不存在: config.json');
}

// 保存配置
function saveConfig(config) {
    const configPath = join(ROOT_DIR, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
}

const config = loadConfig();
const logger = new Logger();

// 数据目录（默认为项目根目录下的 data 文件夹）
const DATA_DIR = config.chat.dataDir || join(ROOT_DIR, 'data');

// 初始化各模块
const characterManager = new CharacterManager(DATA_DIR);
const worldBookManager = new WorldBookManager(DATA_DIR);
const sessionManager = new SessionManager(
    config.chat.historyLimit || 30,  // 每次发给 AI 的消息数
    config.chat.maxGlobalMessages || 2000  // 全局记忆池容量
);
const regexProcessor = new RegexProcessor(config.regex);
const aiClient = new AIClient(config.ai);
const promptBuilder = new PromptBuilder(characterManager, worldBookManager);
const ttsManager = new TTSManager();

// 初始化 TTS 配置
if (config.tts) {
    ttsManager.updateConfig(config.tts);
}

// 创建 Express 应用
const app = express();
const server = createServer(app);

app.use(express.json());

// Session 中间件（用于登录认证）
if (config.auth?.enabled) {
    app.use(session({
        secret: config.auth.sessionSecret || 'tavern-link-default-secret',
        resave: false,
        saveUninitialized: false,
        cookie: { 
            secure: false,
            maxAge: 24 * 60 * 60 * 1000
        }
    }));
}

app.use(express.static(join(ROOT_DIR, 'public')));
app.use('/audio', express.static(join(ROOT_DIR, 'audio')));

// 连接 OneBot
const bot = new OneBotClient(config.onebot, logger);

// 设置 API 路由
// 设置 API 路由
setupRoutes(app, config, saveConfig, {
    characterManager,
    worldBookManager,
    sessionManager,
    regexProcessor,
    aiClient,
    promptBuilder,
    logger,
    bot,
    ttsManager,
    VOICE_TYPES
});


// 创建 WebSocket 服务器（用于前端实时日志）
const wss = new WebSocketServer({ server, path: '/ws/logs' });

wss.on('connection', (ws) => {
    logger.info('Web 面板已连接');
    logger.addListener((log) => {
        if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify(log));
        }
    });
});

// 处理 QQ 消息
async function handleMessage(event, bot) {
    const { message_type, user_id, group_id, raw_message, message } = event;
    
    // 提取纯文本
    // 提取纯文本
	let text = '';
	let isAtMe = false;

	for (const seg of message) {
		if (seg.type === 'text') {
			text += seg.data.text;
		} else if (seg.type === 'at' && seg.data.qq === String(bot.selfId)) {
			isAtMe = true;
		}
	}
	text = text.trim();

	// ✅ 构造结构化消息前缀（包含完整上下文信息）
	if (text) {
		const { sender } = event;
		const chatType = message_type === 'private' ? '私聊' : '群聊';
		const userName = sender?.card || sender?.nickname || '未知用户';
		const groupId = message_type === 'group' ? group_id : 'N/A';
		const groupName = message_type === 'group' 
			? (event.group_name || sender?.group_name || `群${group_id}`) 
			: 'N/A';
		const timestamp = new Date().toLocaleString('zh-CN', { 
			timeZone: 'Asia/Shanghai', 
			hour12: false 
		});
		
		text = `[${chatType}|QQ:${user_id}|昵称:${userName}|群号:${groupId}|群名:${groupName}|时间:${timestamp}] ${text}`;
	}

	
    // 检查触发条件
    const triggerMode = config.chat.triggerMode || 'always';
    let shouldRespond = false;
    
    if (message_type === 'group') {
        if (isAtMe) {
            shouldRespond = true;
        }
    } else {
        if (triggerMode === 'always' || !triggerMode) {
            shouldRespond = true;
        } else if (triggerMode === 'keyword') {
            const keywords = config.chat.triggerKeywords || [];
            for (const kw of keywords) {
                if (text.includes(kw)) {
                    shouldRespond = true;
                    break;
                }
            }
        }
    }
    
    // 检查白名单
    const allowedGroups = config.chat.allowedGroups || [];
    const allowedUsers = config.chat.allowedUsers || [];
    
    if (allowedGroups.length > 0 && message_type === 'group') {
        if (!allowedGroups.includes(group_id)) {
            shouldRespond = false;
        }
    }
    if (allowedUsers.length > 0) {
        if (!allowedUsers.includes(user_id)) {
            shouldRespond = false;
        }
    }
    
    if (!shouldRespond || !text) return;
    
    // 使用固定的全局会话 ID（所有人共享同一份记忆）
	const sessionId = 'global_shared_memory';
    
    logger.info(`收到消息 [${sessionId}]: ${text.substring(0, 100)}...`);
	logger.debug(`完整消息内容: ${text}`); // 完整消息会写入日志文件
    
    try {
        // 获取粘性条目
        const stickyKeys = sessionManager.getStickyEntryKeys(sessionId);
        
        // 使用全局共享记忆（最近 N 条）
        const contextWindow = config.chat.historyLimit || 30;
        const globalHistory = sessionManager.getGlobalHistory(contextWindow, false);
        
        logger.info(`[全局记忆] 使用最近 ${globalHistory.length} 条消息作为上下文`);
        
        // 构建 Prompt（使用全局记忆）
        const { messages, worldBookCount, worldBookEntries } = await promptBuilder.build(
            config.chat.defaultCharacter,
            text,
            globalHistory,
            stickyKeys
        );
        
        // 统计触发方式
        const keywordTriggered = worldBookEntries.filter(e => e.triggeredByKeyword).length;
        const stickyTriggered = worldBookEntries.filter(e => e.triggeredBySticky).length;
        logger.info(`世界书匹配: ${worldBookCount} 条 (关键词: ${keywordTriggered}, 粘性: ${stickyTriggered})`);

                // 调用 AI（带超时检测）
        // ⏱️ 超时时间从配置文件读取（默认 60 秒）
        // 💡 如果聊天记录过大或角色卡复杂，请在 Web 面板配置中将超时时间改为 120 秒（2 分钟）
        // 🔥 支持热更新：在 Web 面板修改后立即生效，无需重启服务
        const TIMEOUT_MS = config.ai.timeout || 60000;
		let reply;

		try {
			const aiPromise = aiClient.chat(messages);
			const timeoutPromise = new Promise((_, reject) => {
				setTimeout(() => reject(new Error('AI_TIMEOUT')), TIMEOUT_MS);
			});

			reply = await Promise.race([aiPromise, timeoutPromise]);
		} catch (error) {
			// 统一处理所有 AI 相关错误
			let failMessage = '处理消息时出现错误，请稍后重试';
			
			if (error.message === 'AI_TIMEOUT') {
                // ✨ 自适应显示实际超时时间
                const timeoutSeconds = Math.floor(TIMEOUT_MS / 1000);
				logger.warn(`AI 响应超时 [${sessionId}]（等待时间: ${timeoutSeconds}秒）`);
				failMessage = `AI 响应超时（等待超过${timeoutSeconds}秒），请在 Web 面板配置中增加超时时间`;
			} else if (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED')) {
				failMessage = '连接 AI 服务失败，请检查网络或 API 配置';

			} else if (error.message.includes('timeout')) {
				failMessage = 'AI 响应超时，请稍后重试';
			} else if (error.message.includes('rate limit')) {
				failMessage = 'API 调用频率超限，请稍后再试';
			} else if (error.message.includes('401') || error.message.includes('403')) {
				failMessage = 'API 密钥无效，请联系管理员检查配置';
			} else if (error.message.includes('500') || error.message.includes('502')) {
				failMessage = 'AI 服务暂时不可用，请稍后重试';
			}
			
			// 发送失败提示给用户
			try {
				if (message_type === 'group') {
					await bot.sendGroupMessage(group_id, failMessage);
				} else {
					await bot.sendPrivateMessage(user_id, failMessage);
				}
			} catch (sendError) {
				logger.error(`发送失败提示失败: ${sendError.message}`);
			}
			
			logger.error(`AI 调用失败: ${error.message}`);
			return; // 直接返回，不继续处理
		}

        // 正则处理
        const processedReply = regexProcessor.process(reply);
        
        // 保存到全局记忆
        sessionManager.addMessage(sessionId, 'user', text);
        sessionManager.addMessage(sessionId, 'assistant', processedReply);
        
        // 更新粘性世界书条目状态
        sessionManager.updateStickyEntries(sessionId, worldBookEntries);
        
        logger.info(`回复 [${sessionId}]: ${processedReply.substring(0, 50)}...`);
        
        // 解析 [voice:...] 标签
        const ttsConfig = ttsManager.getConfig();
        const { textParts, hasVoice } = parseVoiceTags(processedReply);
        
        // 按顺序发送文字和语音
        for (const part of textParts) {
            if (part.type === 'text') {
                const splitMessage = config.chat.splitMessage !== false;
                
                if (splitMessage) {
                    const segments = part.content.split(/\n\n+/).filter(s => s.trim());
                    for (const segment of segments) {
                        if (message_type === 'group') {
                            await bot.sendGroupMessage(group_id, segment.trim());
                        } else {
                            await bot.sendPrivateMessage(user_id, segment.trim());
                        }
                        if (segments.length > 1) {
                            await new Promise(r => setTimeout(r, 500));
                        }
                    }
                } else {
                    if (message_type === 'group') {
                        await bot.sendGroupMessage(group_id, part.content);
                    } else {
                        await bot.sendPrivateMessage(user_id, part.content);
                    }
                }
            } else if (part.type === 'voice' && ttsConfig.enabled) {
                try {
                    logger.info(`[TTS] 合成语音: ${part.content.substring(0, 30)}...`);
                    const audioPath = await ttsManager.synthesize(part.content);
                    
                    if (message_type === 'group') {
                        await bot.sendGroupRecord(group_id, audioPath);
                    } else {
                        await bot.sendPrivateRecord(user_id, audioPath);
                    }
                    logger.info(`[TTS] 语音发送成功`);
                } catch (ttsError) {
                    logger.warn(`[TTS] 语音合成失败: ${ttsError.message}`);
                    const fallbackText = `（语音：${part.content}）`;
                    if (message_type === 'group') {
                        await bot.sendGroupMessage(group_id, fallbackText);
                    } else {
                        await bot.sendPrivateMessage(user_id, fallbackText);
                    }
                }
            } else if (part.type === 'voice' && !ttsConfig.enabled) {
                const fallbackText = `（语音：${part.content}）`;
                if (message_type === 'group') {
                    await bot.sendGroupMessage(group_id, fallbackText);
                } else {
                    await bot.sendPrivateMessage(user_id, fallbackText);
                }
            }
            
            await new Promise(r => setTimeout(r, 300));
        }
        
    } catch (error) {
    // 这里只处理非 AI 调用的其他错误（如正则处理、消息保存等）
    logger.error(`处理消息失败（非 AI 错误）: ${error.message}`);
    
    try {
        const failMessage = '处理回复时出现错误，请联系管理员';
        if (message_type === 'group') {
            await bot.sendGroupMessage(group_id, failMessage);
        } else {
            await bot.sendPrivateMessage(user_id, failMessage);
        }
    } catch (sendError) {
        logger.error(`发送失败提示失败: ${sendError.message}`);
    }
}

}

bot.on('message', (event) => handleMessage(event, bot));

bot.on('connected', () => {
    logger.info(`已连接到 OneBot: ${config.onebot.url}`);
});

bot.on('disconnected', () => {
    logger.warn('OneBot 连接断开，将自动重连...');
});

// 启动服务器
server.listen(config.server.port, config.server.host, () => {
    logger.info(`服务器已启动: http://${config.server.host}:${config.server.port}`);
    
    // 自动加载默认角色
    if (config.chat.defaultCharacter) {
        try {
            const character = characterManager.loadCharacter(config.chat.defaultCharacter);
            logger.info(`已加载默认角色: ${config.chat.defaultCharacter}`);
            
            // 自动加载对应的世界书
            const charName = character.name || config.chat.defaultCharacter;
            const worldBook = worldBookManager.readWorldBook(charName);
            if (worldBook) {
                worldBookManager.currentWorldBook = worldBook;
                worldBookManager.currentWorldBookName = charName;
                logger.info(`已自动加载世界书: ${charName}`);
            }
        } catch (error) {
            logger.warn(`加载默认角色失败: ${error.message}`);
        }
    }
    
    bot.connect();
});
