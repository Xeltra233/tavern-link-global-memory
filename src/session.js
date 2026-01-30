/**
 * 会话管理模块 - 全局共享记忆版本
 */

import fs from 'fs';
import path from 'path';

export class SessionManager {
	constructor(maxHistoryLength = 50, maxGlobalMessages = 2000) {
		this.maxHistoryLength = maxHistoryLength;
		this.maxGlobalMessages = maxGlobalMessages;
		
		// 全局共享记忆存储
		this.globalMemoryFile = path.join(process.cwd(), 'data', 'chats', 'global_memory.json');
		this.globalMessages = this.loadGlobalMemory();
		
		// 保留粘性条目管理（按会话）
		this.stickyEntries = new Map();
		this.sessionsFile = path.join(process.cwd(), 'data', 'chats', 'sessions_meta.json');
		this.loadSessionsMeta();
		
		console.log(`[全局记忆] 初始化完成，已加载 ${this.globalMessages.length} 条消息`);
		console.log(`[全局记忆] 配置: 上下文窗口=${this.maxHistoryLength}, 总容量=${this.maxGlobalMessages}`);
	}
	/**
     * 动态更新配置（支持热更新）
     */
    setConfig(config) {  // ✅ 独立的类方法
        this.maxHistoryLength = config.chat?.historyLimit || 50;
        this.maxGlobalMessages = config.chat?.maxGlobalMessages || 2000;
        console.log(`[全局记忆] 配置已更新: 上下文窗口=${this.maxHistoryLength}, 总容量=${this.maxGlobalMessages}`);
    }

    loadGlobalMemory() {
    try {
        if (fs.existsSync(this.globalMemoryFile)) {
            const content = fs.readFileSync(this.globalMemoryFile, 'utf-8');
            const data = JSON.parse(content);
            
            // 兼容两种格式
            if (Array.isArray(data)) {
                // 纯数组格式
                return data;
            } else if (data.messages && Array.isArray(data.messages)) {
                // 对象包裹格式
                return data.messages;
            }
        }
    } catch (err) {
        console.error('加载全局记忆失败:', err);
    }
    return [];
}


    saveGlobalMemory() {
        try {
            const dir = path.dirname(this.globalMemoryFile);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(
                this.globalMemoryFile, 
                JSON.stringify(this.globalMessages, null, 2),
                'utf-8'
            );
        } catch (err) {
            console.error('保存全局记忆失败:', err);
        }
    }

    loadSessionsMeta() {
        try {
            if (fs.existsSync(this.sessionsFile)) {
                const data = JSON.parse(fs.readFileSync(this.sessionsFile, 'utf-8'));
                this.stickyEntries = new Map(
                    data.map(([id, entries]) => [id, new Map(entries)])
                );
            }
        } catch (err) {
            console.error('加载会话元数据失败:', err);
        }
    }

    saveSessionsMeta() {
        try {
            const dir = path.dirname(this.sessionsFile);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            const data = Array.from(this.stickyEntries.entries()).map(([id, entries]) => [
                id,
                Array.from(entries.entries())
            ]);
            fs.writeFileSync(this.sessionsFile, JSON.stringify(data, null, 2));
        } catch (err) {
            console.error('保存会话元数据失败:', err);
        }
    }

    /**
     * 获取会话（兼容旧接口）
     */
    getSession(sessionId) {
        if (!this.stickyEntries.has(sessionId)) {
            this.stickyEntries.set(sessionId, new Map());
        }
        
        return {
            messages: this.getHistory(sessionId, this.maxHistoryLength),
            createdAt: Date.now(),
            lastActive: Date.now(),
            stickyEntries: this.stickyEntries.get(sessionId)
        };
    }

    /**
     * 添加消息到全局记忆
     */
    addMessage(sessionId, role, content) {
    const message = {
        sessionId,
        role,
        content,
        timestamp: Date.now(),
        date: new Date().toISOString()
    };

    this.globalMessages.push(message);

    // 限制全局记忆总量（使用构造函数传入的值）
    if (this.globalMessages.length > this.maxGlobalMessages) {
        const removed = this.globalMessages.length - this.maxGlobalMessages;
        this.globalMessages = this.globalMessages.slice(-this.maxGlobalMessages);
        console.log(`[全局记忆] 已裁剪至 ${this.maxGlobalMessages} 条（删除最旧的 ${removed} 条）`);
    }

    this.saveGlobalMemory();
}


    /**
     * 清除指定会话的消息
     */
    clearSession(sessionId) {
        const beforeCount = this.globalMessages.length;
        this.globalMessages = this.globalMessages.filter(msg => msg.sessionId !== sessionId);
        const afterCount = this.globalMessages.length;
        
        this.stickyEntries.delete(sessionId);
        
        this.saveGlobalMemory();
        this.saveSessionsMeta();
        
        console.log(`[全局记忆] 已清除会话 ${sessionId} 的 ${beforeCount - afterCount} 条消息`);
    }

    /**
     * 获取会话历史（从全局记忆中筛选或返回全部）
     */
    getHistory(sessionId = null, limit = null) {
    // ✅ 如果没传 limit，使用当前配置
    const actualLimit = limit !== null ? limit : this.maxHistoryLength;
        let messages;
        
        if (sessionId === null || sessionId === 'global') {
            // 返回全局所有消息
            messages = this.globalMessages;
        } else {
            // 返回特定会话的消息
            messages = this.globalMessages.filter(msg => msg.sessionId === sessionId);
        }

        return messages.slice(-actualLimit).map(msg => ({
            role: msg.role,
            content: msg.content,
            timestamp: msg.timestamp,
            date: msg.date
        }));
    }

    /**
	 * 获取全局共享记忆（供 AI 使用）
	 */
	getGlobalHistory(limit = null, includeMetadata = false) {
		// ✅ 如果没传 limit，使用当前配置的 maxHistoryLength
		const actualLimit = limit !== null ? limit : this.maxHistoryLength;
		const recent = this.globalMessages.slice(-actualLimit);
		
		if (!includeMetadata) {
			return recent.map(msg => ({
				role: msg.role,
				content: msg.content
			}));
		}
		
		return recent;
	}


    /**
     * 清除会话历史
     */
    clearHistory(sessionId) {
        this.globalMessages = this.globalMessages.filter(msg => msg.sessionId !== sessionId);
        this.saveGlobalMemory();
        console.log(`[全局记忆] 已清除会话 ${sessionId} 的历史`);
    }

    /**
     * 获取所有会话列表
     */
    listSessions() {
        const sessionMap = new Map();
        
        for (const msg of this.globalMessages) {
            const sid = msg.sessionId;
            if (!sessionMap.has(sid)) {
                sessionMap.set(sid, {
                    id: sid,
                    messageCount: 0,
                    createdAt: msg.timestamp,
                    lastActive: msg.timestamp
                });
            }
            
            const session = sessionMap.get(sid);
            session.messageCount++;
            session.lastActive = Math.max(session.lastActive, msg.timestamp);
        }
        
        return Array.from(sessionMap.values()).sort((a, b) => b.lastActive - a.lastActive);
    }

    deleteSession(sessionId) {
        this.clearSession(sessionId);
    }

    cleanupSessions(maxIdleTime = 24 * 60 * 60 * 1000) {
        const now = Date.now();
        const sessions = this.listSessions();
        
        for (const session of sessions) {
            if (now - session.lastActive > maxIdleTime) {
                this.deleteSession(session.id);
            }
        }
    }

    updateStickyEntries(sessionId, triggeredEntries) {
        if (!this.stickyEntries.has(sessionId)) {
            this.stickyEntries.set(sessionId, new Map());
        }
        
        const sessionSticky = this.stickyEntries.get(sessionId);
        
        for (const [key, remaining] of sessionSticky) {
            if (remaining <= 1) {
                sessionSticky.delete(key);
            } else {
                sessionSticky.set(key, remaining - 1);
            }
        }
        
        for (const entry of triggeredEntries) {
            if (entry.sticky && entry.sticky > 0) {
                sessionSticky.set(entry.key, entry.sticky);
            }
        }
        
        this.saveSessionsMeta();
    }

    getStickyEntryKeys(sessionId) {
        const sessionSticky = this.stickyEntries.get(sessionId);
        return sessionSticky ? new Set(sessionSticky.keys()) : new Set();
    }

    getStats() {
        const sessions = this.listSessions();
        const uniqueUsers = new Set(
            this.globalMessages
                .map(m => m.sessionId.split('_').slice(-1)[0])
                .filter(Boolean)
        );
        
        return {
            totalMessages: this.globalMessages.length,
            totalSessions: sessions.length,
            uniqueUsers: uniqueUsers.size,
            oldestMessage: this.globalMessages[0]?.date,
            newestMessage: this.globalMessages[this.globalMessages.length - 1]?.date,
            memoryFileSizeMB: this.getMemoryFileSize()
        };
    }

    getMemoryFileSize() {
        try {
            if (fs.existsSync(this.globalMemoryFile)) {
                const stats = fs.statSync(this.globalMemoryFile);
                return (stats.size / 1024 / 1024).toFixed(2);
            }
        } catch (err) {
            console.error('获取文件大小失败:', err);
        }
        return 0;
    }

    clearGlobalMemory() {
        this.globalMessages = [];
        this.stickyEntries.clear();
        this.saveGlobalMemory();
        this.saveSessionsMeta();
        console.log('[全局记忆] 已清空所有记忆');
    }

    searchMessages(keyword, limit = 50) {
        const results = this.globalMessages.filter(msg =>
            msg.content.toLowerCase().includes(keyword.toLowerCase())
        );
        return results.slice(-limit);
    }

    exportMemory() {
        return {
            messages: this.globalMessages,
            stats: this.getStats(),
            exportDate: new Date().toISOString()
        };
    }
}

/**
 * 获取全局记忆对象（供 API 直接访问）
 */
export function getGlobalMemory() {
    // 需要从实例中获取，这里返回原始数据
    const filePath = path.join(process.cwd(), 'data', 'chats', 'global_memory.json');
    try {
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf-8');
            const data = JSON.parse(content);
            
            // 兼容两种格式
            if (Array.isArray(data)) {
                return {
                    messages: data,
                    totalMessages: data.length,
                    lastCleanup: Date.now()
                };
            }
            return data;
        }
    } catch (err) {
        console.error('读取全局记忆失败:', err);
    }
    
    return {
        messages: [],
        totalMessages: 0,
        lastCleanup: Date.now()
    };
}
