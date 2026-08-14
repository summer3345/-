/*
 * Luciole 2.0 —— 小萤火 · 帷幕沙漏（均匀散落内核）
 * clean-room 重构 · Phase 1
 *
 * 产品宪法（不可违背）：
 *  1. 真相锁定，路径开放。
 *  2. 玩家输入是行动意图，不是既成事实。
 *  3. 上帝掌握真相，不掌握选择。
 *  4. 演员只有当下的演出权——完整秘密永不进入演员上下文。
 *  5. 受保护范围之外，故事仍能正常呼吸。
 *
 * 安全承诺（全部本地可验证）：
 *  - 结构安全：hidden_secret 只进编译请求，永不进注入文本；
 *  - 白名单安全：注入文本只来自已编译并通过安检的候选；
 *  - 字面安检：禁词表 + 残留酒馆宏拦截 + 秘密原文连续片段重合检查。
 *
 * 明确不做（Phase 1）：
 *  - 无 pending 锁、无探针、无两阶段事务、无 inverse diff、无版本迁移；
 *  - 无三层洋葱、无六档阶段；
 *  - 运行期 API 调用数 = 0（编译期才联网）。
 */
(function () {
    'use strict';

    /* ================================================================
     * 1. 常量与小工具
     * ================================================================ */

    var EXT_NAME = 'luciole_v2';
    var INJECT_KEY = 'luciole_v2_clue';
    var PANEL_ID = 'lcl2_panel';
    var LOG_LIMIT = 120;
    var SECRET_OVERLAP_WINDOW = 12;   // 秘密原文连续重合检查窗口（字符）
    var DEFAULT_BATCH = 8;            // 编译分批：每批线索条数上限

    function ctx() { return SillyTavern.getContext(); }

    /* 聊天身份令牌：用于跨异步边界确认"还是刚才那个聊天"。
     * 依次尝试三种来源，全都拿不到就返回空串——空串 = 守卫自动失效，
     * 行为与打补丁前完全一致，绝不会因为取不到 id 就误杀编译。 */
    var chatTokenSource = '';
    function chatToken() {
        var c;
        try { c = ctx(); } catch (e) { return ''; }
        try {
            if (typeof c.getCurrentChatId === 'function') {
                var v = c.getCurrentChatId();
                if (v !== null && v !== undefined && v !== '') { chatTokenSource = 'getCurrentChatId'; return String(v); }
            }
        } catch (e) { }
        try {
            if (c.chatId !== null && c.chatId !== undefined && c.chatId !== '') { chatTokenSource = 'chatId'; return String(c.chatId); }
        } catch (e) { }
        try {
            var ch = (c.characterId === null || c.characterId === undefined) ? '' : c.characterId;
            var gr = (c.groupId === null || c.groupId === undefined) ? '' : c.groupId;
            if (ch !== '' || gr !== '') { chatTokenSource = 'character/group'; return 'ch:' + ch + '|gr:' + gr; }
        } catch (e) { }
        chatTokenSource = '';
        return '';
    }

    /* 守卫判据：只有"两头都拿得到令牌、且不一样"才算换了聊天。
     * 任何一头是空串都放行——宁可守卫失灵，不可误杀。 */
    function chatChangedSince(token) {
        if (!token) return false;
        var now = chatToken();
        if (!now) return false;
        return now !== token;
    }

    function trim(v) { return String(v == null ? '' : v).replace(/^\s+|\s+$/g, ''); }
    function isArray(v) { return Object.prototype.toString.call(v) === '[object Array]'; }
    function isObject(v) { return !!v && typeof v === 'object' && !isArray(v); }
    function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
    function clone(v) { try { return JSON.parse(JSON.stringify(v)); } catch (e) { return v; } }
    function nowIso() { return new Date().toISOString(); }

    function uid(prefix) {
        return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
    }

    function esc(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function toast(msg, kind) {
        try {
            var t = window.toastr;
            if (!t) return;
            if (kind === 'error') t.error(msg, '小萤火');
            else if (kind === 'warning') t.warning(msg, '小萤火');
            else if (kind === 'success') t.success(msg, '小萤火');
            else t.info(msg, '小萤火');
        } catch (e) { }
    }

    /* 残留酒馆宏检测：注入文本里绝不允许出现 {{...}}，
     * 防止酒馆在插件安检之后二次展开内容（交接书 实机坑 #8）。 */
    function hasResidualMacro(text) {
        return /\{\{[^}]*\}\}/.test(String(text || ''));
    }

    /* 与秘密原文的连续片段重合检查：
     * 对秘密文本做长度 SECRET_OVERLAP_WINDOW 的滑动窗口，
     * 任一窗口若原样出现在线索里则判定泄漏。纯本地、可严格证明。 */
    function overlapsSecret(clueText, secretText) {
        var clue = String(clueText || '');
        var secret = String(secretText || '').replace(/\s+/g, '');
        var flatClue = clue.replace(/\s+/g, '');
        if (secret.length < SECRET_OVERLAP_WINDOW) return false;
        for (var i = 0; i + SECRET_OVERLAP_WINDOW <= secret.length; i++) {
            var win = secret.substr(i, SECRET_OVERLAP_WINDOW);
            if (flatClue.indexOf(win) >= 0) return true;
        }
        return false;
    }

    function containsBanned(clueText, bannedList) {
        var text = String(clueText || '');
        for (var i = 0; i < (bannedList || []).length; i++) {
            var w = trim(bannedList[i]);
            if (w && text.indexOf(w) >= 0) return w;
        }
        return null;
    }

    /* ================================================================
     * 2. 存储层
     *  - 全局设置（extensionSettings）：连接配置、注入深度等跨聊天偏好
     *  - 故事账本（chatMetadata）：每个聊天独立，绝不串线
     * ================================================================ */

    function defaultSettings() {
        return {
            api: { url: '', key: '', model: '', timeout_s: 240, max_tokens: 4000, temperature: 0.8 },
            use_tavern: false,     // true = 用酒馆当前连接（raw/quiet 降级，非流式，可能超时）
            depth: 1,              // setExtensionPrompt 注入深度
            batch_size: DEFAULT_BATCH,
            show_floater: true,    // 萤火虫浮标（可停进避风塘）
            api2: { url: '', key: '', model: '' },  // 调度员连接（智能调度用；留空复用编译连接）
            ctx_strip: 'thinking, think, cot, reasoning, thought, plan, 思考, 思维链',  // 读上下文时剔除的标签块
            ctx_prefer: ''          // 若填写：楼层中含任一此类标签块时，只取块内文本（如 正文, summary）
        };
    }

    function settings() {
        var c = ctx();
        var root = c.extensionSettings || (c.extensionSettings = {});
        if (!isObject(root[EXT_NAME])) root[EXT_NAME] = defaultSettings();
        var s = root[EXT_NAME];
        var d = defaultSettings();
        if (!isObject(s.api)) s.api = d.api;
        if (!isObject(s.api2)) s.api2 = d.api2;
        var k;
        for (k in d.api) if (s.api[k] === undefined) s.api[k] = d.api[k];
        for (k in d.api2) if (s.api2[k] === undefined) s.api2[k] = d.api2[k];
        for (k in d) if (s[k] === undefined) s[k] = d[k];
        return s;
    }

    function saveSettings() {
        try {
            var c = ctx();
            if (typeof c.saveSettingsDebounced === 'function') c.saveSettingsDebounced();
        } catch (e) { }
    }

    function blankStory() {
        return {
            v: 2,
            status: 'empty',           // empty | compiled | lit | finished
            hidden_secret: '',         // 完整秘密——只进编译请求，永不注入
            banned_words: [],
            config: {
                total_rounds: 100,
                interval: 10,
                clue_count: 10,
                intensity: 'standard', // gentle | standard | clear
                author_mode: true,
                run_mode: 'uniform'    // uniform | smart（AI 监督为 Phase 3）
            },
            clues: [],                 // { id, text, used, delivered_count }
            clock: {
                round: 0,              // 相对轮：点亮 = 第 0 轮，此后每条玩家消息 +1
                next_due: 1,           // 下一次投放的相对轮（点亮后第一条玩家消息即首个机会）
                cursor: 0,             // 已送条数（派生自 used 计数）
                active_id: null,       // 台上线索 id
                planned: null,         // smart: {for_round, clue_id} / supervise: {for_round, god_text|hold}
                hold_streak: 0,        // AI 监督连续暂缓计数
                lit_at: null
            },
            draft: null,               // 编译中断续跑用：{ clues: [], batch_done: n }
            log: []
        };
    }

    function chatStoryContainer() {
        var c = ctx();
        var meta = c.chatMetadata;
        if (!isObject(meta)) return null;   // 没有打开聊天
        if (!isObject(meta[EXT_NAME])) meta[EXT_NAME] = blankStory();
        return meta[EXT_NAME];
    }

    function story() {
        var st = chatStoryContainer();
        if (!st) return null;
        // 结构自愈（只补缺失字段，不做版本迁移）
        var d = blankStory();
        if (!isObject(st.config)) st.config = d.config;
        if (!isObject(st.clock)) st.clock = d.clock;
        if (!isArray(st.clues)) st.clues = [];
        if (!isArray(st.log)) st.log = [];
        if (!isArray(st.banned_words)) st.banned_words = [];
        var k;
        for (k in d.config) if (st.config[k] === undefined) st.config[k] = d.config[k];
        for (k in d.clock) if (st.clock[k] === undefined) st.clock[k] = d.clock[k];
        return st;
    }

    function saveStory() {
        try {
            var c = ctx();
            if (typeof c.saveMetadataDebounced === 'function') c.saveMetadataDebounced();
            else if (typeof c.saveMetadata === 'function') c.saveMetadata();
        } catch (e) { }
    }

    function log(msg) {
        var st = story();
        if (!st) return;
        st.log.push({ t: nowIso(), msg: String(msg) });
        if (st.log.length > LOG_LIMIT) st.log.splice(0, st.log.length - LOG_LIMIT);
        saveStory();
        renderLogSoon();
    }

    /* ================================================================
     * 3. 能力自检（启动时一次，缺什么明说什么）
     * ================================================================ */

    function capabilityReport() {
        var c = ctx();
        var caps = {
            inject: typeof c.setExtensionPrompt === 'function',
            metadata: isObject(c.chatMetadata) || c.chatMetadata === undefined, // 未开聊天时 undefined 属正常
            events: !!(c.eventSource && c.eventTypes),
            worldinfo: typeof c.loadWorldInfo === 'function',
            tavern_gen: typeof c.generateRaw === 'function' || typeof c.generateQuietPrompt === 'function'
        };
        var missing = [];
        if (!caps.inject) missing.push('演员注入口（setExtensionPrompt）');
        if (!caps.events) missing.push('聊天事件监听（eventSource）');
        caps.core_ok = caps.inject && caps.events;
        caps.missing = missing;
        return caps;
    }

    /* ================================================================
     * 4. 素材读取（编译台专用；范围严格限定为：
     *    角色卡适用字段 + 角色主世界书 + 角色卡内嵌世界书）
     * ================================================================ */

    function boundedText(text, limit) {
        var t = trim(text);
        if (t.length <= limit) return t;
        return t.slice(0, limit) + '\n……（超长截断，仅供取材）';
    }

    function activeCharacterRecords() {
        try {
            var c = ctx();
            var characters = c.characters || [];
            var current = characters[c.characterId];
            if (c.groupId === null || c.groupId === undefined || c.groupId === '') {
                return current ? [current] : [];
            }
            var groups = c.groups || [];
            var group = null;
            for (var g = 0; g < groups.length; g++) {
                if (String(groups[g] && groups[g].id) === String(c.groupId)) group = groups[g];
            }
            var members = group && isArray(group.members) ? group.members.map(String) : [];
            var disabled = group && isArray(group.disabled_members) ? group.disabled_members.map(String) : [];
            var out = [];
            for (var i = 0; i < characters.length; i++) {
                var avatar = trim(characters[i] && characters[i].avatar);
                if (avatar && members.indexOf(avatar) >= 0 && disabled.indexOf(avatar) < 0) out.push(characters[i]);
            }
            return out.length ? out : (current ? [current] : []);
        } catch (e) { return []; }
    }

    function characterCardText(limit) {
        try {
            var records = activeCharacterRecords();
            var parts = [];
            for (var i = 0; i < records.length; i++) {
                var ch = records[i];
                var sub = [];
                if (ch.name) sub.push('姓名：' + ch.name);
                if (ch.description) sub.push(ch.description);
                if (ch.personality) sub.push('性格：' + ch.personality);
                if (ch.scenario) sub.push('场景：' + ch.scenario);
                if (sub.length) parts.push(sub.join('\n'));
            }
            return boundedText(parts.join('\n---\n'), limit);
        } catch (e) { return ''; }
    }

    function worldBookEntriesText(data) {
        var entries = data && data.entries;
        var rows = [];
        if (isArray(entries)) rows = entries;
        else if (isObject(entries)) {
            var keys = Object.keys(entries);
            for (var i = 0; i < keys.length; i++) rows.push(entries[keys[i]]);
        }
        var texts = [];
        for (var r = 0; r < rows.length; r++) {
            var row = rows[r];
            var disabled = row && (row.disable === true || row.disabled === true || row.enabled === false);
            var content = trim(row && row.content);
            if (content && !disabled) texts.push(content);
        }
        return texts.join('\n');
    }

    /* 楼层文本清洗：
     * 1) prefer 标签命中 → 只取块内文本（如你的预设把正文/摘要包在专属标签里）；
     * 2) 否则剥掉 strip 标签块（思维链等），其余原样保留。 */
    function tagList(csv) {
        return String(csv || '').split(/[,，]/).map(trim).filter(Boolean);
    }

    function escapeReg(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

    function cleanMessageText(raw) {
        var text = String(raw || '');
        var s = settings();
        var prefer = tagList(s.ctx_prefer);
        for (var p = 0; p < prefer.length; p++) {
            var tag = escapeReg(prefer[p]);
            var re = new RegExp('<' + tag + '[^>]*>([^]*?)</' + tag + '>', 'gi');
            var m, picked = [];
            while ((m = re.exec(text)) !== null) picked.push(trim(m[1]));
            if (picked.length) return picked.join('\n');
        }
        var strip = tagList(s.ctx_strip);
        for (var q = 0; q < strip.length; q++) {
            var tag2 = escapeReg(strip[q]);
            text = text.replace(new RegExp('<' + tag2 + '[^>]*>[^]*?</' + tag2 + '>', 'gi'), '');
        }
        // 顺手剥掉 HTML 注释块
        text = text.replace(/<!--[^]*?-->/g, '');
        return trim(text.replace(/\n{3,}/g, '\n\n'));
    }

    /* 已有正文窗口：从最新往前取，跳过系统消息，总量封顶。
     * 直接给原文片段，不做二次摘要调用——少一次 API 就少一个失败点。
     * 返回 { text, count } */
    function recentStoryText(msgLimit, charLimit) {
        try {
            var c = ctx();
            var chat = c.chat || [];
            var picked = [];
            var total = 0;
            for (var i = chat.length - 1; i >= 0 && picked.length < msgLimit; i--) {
                var m = chat[i];
                if (!m || m.is_system) continue;
                var body = cleanMessageText(m.mes);
                if (!body) continue;
                var line = (m.is_user ? '玩家' : (trim(m.name) || '角色')) + '：' + body;
                if (total + line.length > charLimit) {
                    // 装不下整条就停：只收整条消息，不切半句话
                    if (picked.length === 0) picked.unshift(line.slice(0, charLimit) + '……（本条超长截断）');
                    break;
                }
                picked.unshift(line);
                total += line.length;
            }
            return { text: picked.join('\n'), count: picked.length };
        } catch (e) { return { text: '', count: 0 }; }
    }

    /* 返回 Promise<{ text, sources: [名字], missed: [原因] }> */
    function readCharacterWorldBooks(limit) {
        var c = ctx();
        var records = activeCharacterRecords();
        var texts = [];
        var sources = [];
        var missed = [];
        var loaders = [];
        for (var a = 0; a < records.length; a++) {
            (function (ch) {
                var data = ch && ch.data || {};
                var ext = data.extensions || {};
                var mainName = trim(ext.world);
                if (mainName) {
                    if (typeof c.loadWorldInfo === 'function') {
                        loaders.push(Promise.resolve().then(function () {
                            return c.loadWorldInfo(mainName);
                        }).then(function (wb) {
                            var t = worldBookEntriesText(wb);
                            if (t) { texts.push(t); sources.push('角色主世界书「' + mainName + '」'); }
                        }).catch(function (err) {
                            missed.push('角色主世界书「' + mainName + '」读取失败：' + (trim(err && err.message) || '未知原因'));
                        }));
                    } else {
                        missed.push('本酒馆版本没有公开 loadWorldInfo，角色主世界书「' + mainName + '」未纳入取材');
                    }
                }
                if (data.character_book) {
                    var t2 = worldBookEntriesText(data.character_book);
                    if (t2) { texts.push(t2); sources.push('角色卡内嵌世界书'); }
                }
            }(records[a]));
        }
        return Promise.all(loaders).then(function () {
            // 去重：酒馆导入内嵌书时常会同时把它落成独立世界书并绑为角色主书，
            // 两个入口指向同一份内容。按归一化文本比对，重复的只保留第一份。
            var seen = {};
            var uniqueTexts = [];
            var uniqueSources = [];
            var dropped = [];
            for (var i = 0; i < texts.length; i++) {
                var norm = String(texts[i]).replace(/\s+/g, '');
                var key = simpleHash(norm) + '_' + norm.length;
                if (seen[key]) { dropped.push(sources[i]); continue; }
                seen[key] = true;
                uniqueTexts.push(texts[i]);
                uniqueSources.push(sources[i]);
            }
            return {
                text: boundedText(uniqueTexts.join('\n---\n'), limit),
                sources: uniqueSources,
                deduped: dropped,
                missed: missed
            };
        });
    }

    /* ================================================================
     * 5. API 层（仅编译期使用；运行期零联网）
     *  主航道：独立 API（OpenAI 兼容），真流式，抗反代 60s 超时；
     *  备航道：酒馆当前连接（generateRaw / generateQuietPrompt 降级），
     *          非流式，明确标注可能被中转切断。
     * ================================================================ */

    function normalizeApiUrl(url) {
        var u = trim(url).replace(/\/+$/, '');
        if (!u) return '';
        if (/\/chat\/completions$/.test(u)) return u;
        if (/\/v\d+$/.test(u)) return u + '/chat/completions';
        return u + '/v1/chat/completions';
    }

    /* 解析 OpenAI 风格 SSE 流；reasoning 与正文分流，只累积正文。
     * onProgress(receivedChars) 用于 UI 进度。 */
    function readOpenAiStream(res, onProgress) {
        if (!res.body || !res.body.getReader) {
            return res.text().then(function (raw) { return extractFromJsonText(raw); });
        }
        var reader = res.body.getReader();
        var decoder = new TextDecoder('utf-8');
        var buffer = '';
        var content = '';
        var reasoning = '';
        function pump() {
            return reader.read().then(function (step) {
                if (step.done) return finish();
                buffer += decoder.decode(step.value, { stream: true });
                var lines = buffer.split(/\r?\n/);
                buffer = lines.pop();
                for (var i = 0; i < lines.length; i++) {
                    var line = trim(lines[i]);
                    if (!line || line.indexOf('data:') !== 0) continue;
                    var payload = trim(line.slice(5));
                    if (payload === '[DONE]') continue;
                    try {
                        var obj = JSON.parse(payload);
                        var delta = obj.choices && obj.choices[0] && obj.choices[0].delta || {};
                        if (typeof delta.content === 'string') content += delta.content;
                        if (typeof delta.reasoning_content === 'string') reasoning += delta.reasoning_content;
                        if (typeof delta.reasoning === 'string') reasoning += delta.reasoning;
                    } catch (e) { /* 非 JSON 行忽略 */ }
                }
                if (onProgress) onProgress(content.length, reasoning.length);
                return pump();
            });
        }
        function finish() {
            if (trim(content)) return content;
            // 正文为空但 reasoning 里可能藏着完整 JSON（部分推理模型的怪癖）
            var recovered = recoverJsonObject(reasoning);
            if (recovered) return recovered;
            var err = new Error('模型返回了 ' + reasoning.length + ' 字思考过程，但正文为空。建议：换非推理模型，或在中转后台关闭 reasoning 输出。');
            err.code = 'EMPTY_CONTENT';
            throw err;
        }
        return pump().catch(function (error) {
            try { reader.cancel(); } catch (e) { }
            throw error;
        });
    }

    function extractFromJsonText(raw) {
        var data;
        try { data = JSON.parse(raw); }
        catch (e) {
            var err0 = new Error('接口返回的不是 JSON（前 120 字）：' + String(raw).slice(0, 120));
            throw err0;
        }
        if (data.error) {
            var msg = isObject(data.error) ? (data.error.message || JSON.stringify(data.error)) : String(data.error);
            var err = new Error('接口报错：' + msg);
            throw err;
        }
        var choice = data.choices && data.choices[0] || {};
        var content = choice.message && choice.message.content || '';
        if (trim(content)) return content;
        var reasoning = choice.message && (choice.message.reasoning_content || choice.message.reasoning) || '';
        var recovered = recoverJsonObject(reasoning);
        if (recovered) return recovered;
        var err2 = new Error('模型返回成功但正文为空。');
        err2.code = 'EMPTY_CONTENT';
        throw err2;
    }

    /* 从杂讯文本中恢复第一个配平的 JSON 对象（用于 ```json 包裹或 reasoning 混入的场合） */
    function recoverJsonObject(text) {
        var t = String(text || '');
        var start = t.indexOf('{');
        while (start >= 0) {
            var depth = 0;
            var inStr = false;
            var escNext = false;
            for (var i = start; i < t.length; i++) {
                var ch = t.charAt(i);
                if (escNext) { escNext = false; continue; }
                if (ch === '\\') { escNext = true; continue; }
                if (ch === '"') { inStr = !inStr; continue; }
                if (inStr) continue;
                if (ch === '{') depth++;
                else if (ch === '}') {
                    depth--;
                    if (depth === 0) {
                        var candidate = t.slice(start, i + 1);
                        try { JSON.parse(candidate); return candidate; } catch (e) { break; }
                    }
                }
            }
            start = t.indexOf('{', start + 1);
        }
        return '';
    }

    function withTimeout(promise, ms, onTimeout) {
        var timer = null;
        var guard = new Promise(function (resolve, reject) {
            timer = setTimeout(function () {
                if (onTimeout) { try { onTimeout(); } catch (e) { } }
                var err = new Error('请求超过 ' + Math.round(ms / 1000) + ' 秒未完成，已中止。建议：确认 API 地址支持流式，或调大超时。');
                err.code = 'TIMEOUT';
                reject(err);
            }, ms);
        });
        return Promise.race([promise, guard]).then(function (v) {
            clearTimeout(timer); return v;
        }, function (e) {
            clearTimeout(timer); throw e;
        });
    }

    /* 独立 API 调用（编译主航道，真流式） */
    function callStandaloneApi(systemPrompt, userPrompt, onProgress) {
        var s = settings();
        var api = s.api;
        if (!trim(api.url)) return Promise.reject(new Error('还没有填写 API 地址。请到「连接」一节配置。'));
        if (!trim(api.model)) return Promise.reject(new Error('还没有填写模型名。请到「连接」一节配置。'));
        var controller = typeof AbortController === 'function' ? new AbortController() : null;
        var request = fetch(normalizeApiUrl(api.url), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + (api.key || '')
            },
            body: JSON.stringify({
                model: api.model,
                messages: [
                    { role: 'system', content: String(systemPrompt || '') },
                    { role: 'user', content: String(userPrompt || '') }
                ],
                max_tokens: clamp(parseInt(api.max_tokens, 10) || 4000, 500, 32000),
                temperature: api.temperature == null ? 0.8 : Number(api.temperature),
                stream: true
            }),
            signal: controller ? controller.signal : undefined
        }).then(function (res) {
            if (!res.ok) {
                return res.text().then(function (raw) {
                    var hint = '';
                    if (res.status === 401 || res.status === 403) hint = 'API 密钥不对或没有权限。';
                    else if (res.status === 404) hint = 'API 地址不对（检查是否需要 /v1 结尾）。';
                    else if (res.status === 429) hint = '限流了，稍等一会儿再试。';
                    else if (res.status >= 500) hint = '服务端出错，可能是中转不稳定。';
                    throw new Error('HTTP ' + res.status + '：' + hint + '（' + String(raw).slice(0, 150) + '）');
                });
            }
            var contentType = res.headers && res.headers.get ? String(res.headers.get('content-type') || '') : '';
            if (/application\/json/i.test(contentType)) {
                return res.text().then(extractFromJsonText);
            }
            return readOpenAiStream(res, onProgress);
        });
        var timeoutMs = clamp((parseInt(s.api.timeout_s, 10) || 240), 30, 900) * 1000;
        return withTimeout(request, timeoutMs, function () { if (controller) controller.abort(); });
    }

    /* 酒馆当前连接（备航道，非流式） */
    function callTavernApi(systemPrompt, userPrompt) {
        var c = ctx();
        var whole = String(systemPrompt || '') + '\n\n' + String(userPrompt || '');
        if (typeof c.generateRaw === 'function') {
            return Promise.resolve().then(function () {
                return c.generateRaw({ prompt: whole, quietToLoud: false });
            }).then(function (out) {
                if (trim(out)) return String(out);
                throw new Error('酒馆连接返回为空。');
            }).catch(function (e) { throw dressTavernError(e); });
        }
        if (typeof c.generateQuietPrompt === 'function') {
            return Promise.resolve().then(function () {
                var p;
                try { p = c.generateQuietPrompt({ quietPrompt: whole }); }
                catch (e) { p = c.generateQuietPrompt(whole, false, true); }
                return p;
            }).then(function (out) {
                if (trim(out)) return String(out);
                throw new Error('酒馆连接返回为空。');
            }).catch(function (e) { throw dressTavernError(e); });
        }
        return Promise.reject(new Error('当前酒馆版本没有 raw / quiet 生成能力，请改用独立 API。'));
    }

    /* 把酒馆航道的裸报错翻译成人话与自救指引 */
    function dressTavernError(e) {
        var msg = trim(e && e.message || e) || '未知错误';
        var hint = '';
        if (/504|timeout|timed out/i.test(msg)) {
            hint = '——这是上游等太久被网关掐断（酒馆连接是非流式的通病）。解法：④连接里取消勾选"使用酒馆当前连接"，改填独立 API 走流式。DS 官网填 https://api.deepseek.com + deepseek-chat（max_tokens ≤ 8192）。';
        } else if (/Internal Server Error|500/i.test(msg)) {
            hint = '——上游服务出错。若反复出现，建议改用独立 API 流式编译（DS 官网：https://api.deepseek.com + deepseek-chat）。';
        }
        return new Error(msg + hint);
    }

    /* GET /v1/models → 模型 id 列表（填充 datalist，既能选也能手输） */
    function fetchModelList(url, key) {
        var base = trim(url).replace(/\/+$/, '');
        if (!base) return Promise.reject(new Error('先填 API 地址。'));
        var modelsUrl = /\/v\d+$/.test(base) ? base + '/models' : base + '/v1/models';
        var controller = typeof AbortController === 'function' ? new AbortController() : null;
        var req = fetch(modelsUrl, {
            method: 'GET',
            headers: { 'Authorization': 'Bearer ' + (key || '') },
            signal: controller ? controller.signal : undefined
        }).then(function (res) {
            if (!res.ok) return res.text().then(function (raw) { throw new Error('HTTP ' + res.status + '（' + String(raw).slice(0, 80) + '）'); });
            return res.json();
        }).then(function (data) {
            var rows = isArray(data && data.data) ? data.data : (isArray(data) ? data : []);
            var ids = [];
            for (var i = 0; i < rows.length; i++) {
                var id = trim(rows[i] && (rows[i].id || rows[i].model || rows[i].name));
                if (id) ids.push(id);
            }
            if (!ids.length) throw new Error('接口通了，但没有返回模型列表。');
            ids.sort();
            return ids;
        });
        return withTimeout(req, 20000, function () { if (controller) controller.abort(); });
    }

    function callCompilerApi(systemPrompt, userPrompt, onProgress) {
        var s = settings();
        if (s.use_tavern) return callTavernApi(systemPrompt, userPrompt);
        return callStandaloneApi(systemPrompt, userPrompt, onProgress);
    }

    /* ================================================================
     * 6. 编译器（唯一看得到完整秘密的环节）
     *  输出 Schema 极简：{"clues":["...","..."]}
     *  —— 字符串数组是各家模型最不容易写错的形状。
     *  分批生成 + 草稿续跑 + 本地安检。
     * ================================================================ */

    var INTENSITY_TEXT = {
        gentle: '轻柔：只投气味、光线、旧物、迟疑的语气这类环境迹象；绝不解释含义，让玩家自己起疑。',
        standard: '标准：具体可感的迹象——一件反常的小物、一句欲言又止的话、一处对不上的细节；可以引起注意，但不给出解释。',
        clear: '清晰：明确可追查的证据或直白的反常行为；玩家能据此提出具体疑问，但线索本身仍不说破真相。'
    };

    function compilerSystemPrompt(st) {
        return [
            '你是一位隐藏叙事的编剧助手。用户会给你一个「完整秘密」——它是一个角色扮演故事里被藏起来的真相脉络。',
            '你的任务：把通往真相的路，拆成一串按顺序投放的「线索」。',
            '',
            '铁律：',
            '1. 线索绝不能直接说出秘密本身。它们只是路上的路标，不是终点。',
            '2. 顺序从浅到深：第一条最含蓄，最后一条离真相最近，但仍然不说破。',
            '3. 每条线索是写给"扮演角色的演员"看的舞台指示，告诉演员这一幕可以自然带出什么迹象。用第二人称祈使或描述句，例如"让她整理旧物时，一枚不属于这个家的袖扣从抽屉深处滚出来"。',
            '4. 线索必须扎根于给定的角色与世界环境，用其中真实存在的地点、物件、习俗和人物关系做载体。',
            '5. 每条线索 30～80 字。不要编号，不要解释，不要出现"线索""秘密""真相"这些出戏的词。',
            '6. 力度要求——' + (INTENSITY_TEXT[st.config.intensity] || INTENSITY_TEXT.standard),
            (st.banned_words.length ? '7. 以下词语绝对禁止出现在任何线索里：' + st.banned_words.join('、') : ''),
            '',
            '输出格式：只输出一个 JSON 对象，形如 {"clues":["第一条","第二条"]}。',
            '不要输出任何其他文字、解释或 Markdown 代码块标记。'
        ].join('\n');
    }

    function compilerUserPrompt(st, materials, batchCount, existingClues) {
        var parts = [];
        parts.push('【完整秘密（绝密，仅你可见）】\n' + st.hidden_secret);
        if (materials.card) parts.push('【角色与开场设定（演员可见的公开信息）】\n' + materials.card);
        if (materials.world) parts.push('【世界环境素材（埋线索的土壤）】\n' + materials.world);
        if (materials.story) parts.push('【已有剧情（最近进展）】\n' + materials.story + '\n\n线索必须衔接以上现场：沿用已出现的人物、地点与正在进行的情节，不与已发生的事实矛盾，不重复已经被玩家注意到的迹象。');
        if (existingClues.length) {
            parts.push('【已定稿的前序线索（不要重复它们的意象和载体）】\n' +
                existingClues.map(function (c, i) { return (i + 1) + '. ' + c; }).join('\n'));
            parts.push('本批请续写第 ' + (existingClues.length + 1) + ' 条起的 ' + batchCount + ' 条，深度衔接前序、继续递进。');
        } else {
            parts.push('本批请生成最开始的 ' + batchCount + ' 条，从最浅的迹象起步。');
        }
        parts.push('总计划共 ' + st.config.clue_count + ' 条，本批只写 ' + batchCount + ' 条。输出 {"clues":[...]}。');
        return parts.join('\n\n');
    }

    function parseCluesJson(rawText) {
        var raw = trim(rawText).replace(/^```(?:json)?/i, '').replace(/```$/, '');
        var jsonText = recoverJsonObject(raw) || raw;
        var data;
        try { data = JSON.parse(jsonText); }
        catch (e) { throw new Error('模型输出无法解析为 JSON（前 100 字）：' + raw.slice(0, 100)); }
        var list = data && data.clues;
        if (!isArray(list)) throw new Error('模型输出里没有 clues 数组。');
        var out = [];
        for (var i = 0; i < list.length; i++) {
            var t = trim(typeof list[i] === 'string' ? list[i] : (list[i] && list[i].text));
            if (t) out.push(t);
        }
        if (!out.length) throw new Error('模型输出的线索为空。');
        return out;
    }

    /* 本地安检：返回 { pass: [], rejected: [{text, reason}] } */
    function vetClues(candidates, st) {
        var pass = [];
        var rejected = [];
        for (var i = 0; i < candidates.length; i++) {
            var text = candidates[i];
            var banned = containsBanned(text, st.banned_words);
            if (banned) { rejected.push({ text: text, reason: '包含禁词「' + banned + '」' }); continue; }
            if (hasResidualMacro(text)) { rejected.push({ text: text, reason: '包含酒馆宏 {{...}}，有二次展开风险' }); continue; }
            if (overlapsSecret(text, st.hidden_secret)) { rejected.push({ text: text, reason: '与秘密原文有 ' + SECRET_OVERLAP_WINDOW + ' 字以上连续重合' }); continue; }
            if (text.length > 300) { rejected.push({ text: text, reason: '超长（' + text.length + ' 字），不像一条线索' }); continue; }
            pass.push(text);
        }
        return { pass: pass, rejected: rejected };
    }

    var compileState = { running: false, cancel: false };

    function compileStory() {
        var st = story();
        if (!st) return Promise.reject(new Error('请先打开一个聊天。'));
        if (compileState.running) return Promise.reject(new Error('编译正在进行中。'));
        if (!trim(st.hidden_secret)) return Promise.reject(new Error('隐藏脉络还是空的——先把秘密写给小萤火。'));
        if (st.config.run_mode === 'supervise') return Promise.reject(new Error('AI 监督模式不需要编译——写好秘密直接点亮即可。'));
        if (st.status === 'lit') return Promise.reject(new Error('故事正在点亮中。请先熄灭，再重新编译。'));

        var target = clamp(parseInt(st.config.clue_count, 10) || 10, 1, 200);
        st.config.clue_count = target;
        var needRounds = target * clamp(parseInt(st.config.interval, 10) || 10, 1, 999);
        var planRounds = clamp(parseInt(st.config.total_rounds, 10) || 100, 1, 9999);
        if (needRounds > planRounds * 1.2) {
            log('提示：' + target + ' 条 × 每 ' + st.config.interval + ' 轮一条 ≈ ' + needRounds + ' 轮才能送完，超出预计 ' + planRounds + ' 轮。想在预计轮数内送完可减少条数或缩短间隔（不强制，按你的节奏来）。');
        }
        var batchSize = clamp(parseInt(settings().batch_size, 10) || DEFAULT_BATCH, 1, 20);

        // 续跑：草稿里已有的定稿线索直接继承
        var doneClues = [];
        if (st.draft && isArray(st.draft.clues) && st.draft.secret_hash === simpleHash(st.hidden_secret)) {
            doneClues = st.draft.clues.slice();
            log('发现上次未完成的草稿，从第 ' + (doneClues.length + 1) + ' 条继续。');
        }

        compileState.running = true;
        compileState.cancel = false;
        setCompileUi(true, '准备取材……');

        var materials = { card: '', world: '', story: '', missed: [] };
        var homeToken = chatToken();   // 编译全程锁定这个聊天

        function assertHome() {
            if (chatChangedSince(homeToken)) throw new Error('编译期间切换了聊天，本次作废（已保住的草稿留在原聊天里，回去再点编译即可续跑）。');
        }

        return Promise.resolve().then(function () {
            assertHome();
            materials.card = characterCardText(4000);
            var recent = recentStoryText(40, 8000);
            materials.story = recent.text;
            materials.story_count = recent.count;
            return readCharacterWorldBooks(6000);
        }).then(function (wb) {
            assertHome();
            materials.world = wb.text;
            materials.missed = wb.missed;
            var picked = ['角色卡'];
            if (wb.sources.length) picked = picked.concat(wb.sources);
            picked.push(materials.story_count > 0 ? ('最近正文 ' + materials.story_count + ' 条') : '正文（空聊天，跳过）');
            log('取材完成：' + picked.join(' + '));
            if (wb.deduped && wb.deduped.length) log('已去重：' + wb.deduped.join('、') + ' 与已读内容相同，只保留一份。');
            for (var m = 0; m < wb.missed.length; m++) log('⚠ ' + wb.missed[m]);
            return runBatches();
        }).then(function () {
            assertHome();
            st.clues = doneClues.map(function (text) {
                return { id: uid('clue'), text: text, used: false, delivered_count: 0 };
            });
            st.draft = null;
            st.status = 'compiled';
            st.clock = blankStory().clock;
            saveStory();
            log('编译完成：' + st.clues.length + ' 条线索已备好，等待你预览确认。');
            toast('编译完成，' + st.clues.length + ' 条线索已备好', 'success');
            compileState.running = false;
            setCompileUi(false, '');
            renderPanel();
        }).catch(function (err) {
            compileState.running = false;
            setCompileUi(false, '');
            var msg = (err && err.message) || String(err);
            // 人已经不在原聊天了：只弹提示，绝不把日志写进别人的账本
            if (chatChangedSince(homeToken)) {
                toast('编译已中断：' + msg, 'error');
                renderPanel();
                throw err;
            }
            // 保草稿：已定稿部分不丢
            if (doneClues.length) {
                st.draft = { clues: doneClues, secret_hash: simpleHash(st.hidden_secret) };
                saveStory();
                log('编译中断，已保住 ' + doneClues.length + ' 条草稿。修好问题后再点编译即可续跑。');
            }
            log('✗ 编译失败：' + msg);
            toast('编译失败：' + msg, 'error');
            renderPanel();
            throw err;
        });

        function runBatches() {
            if (compileState.cancel) throw new Error('已手动停止。');
            assertHome();
            if (doneClues.length >= target) return Promise.resolve();
            var need = Math.min(batchSize, target - doneClues.length);
            var batchNo = Math.floor(doneClues.length / batchSize) + 1;
            setCompileUi(true, '正在生成第 ' + (doneClues.length + 1) + '～' + (doneClues.length + need) + ' 条（共 ' + target + ' 条）……');
            return callBatchWithRetry(need, 2).then(function (accepted) {
                assertHome();
                for (var i = 0; i < accepted.length && doneClues.length < target; i++) doneClues.push(accepted[i]);
                // 每批落草稿，随时断随时续
                st.draft = { clues: doneClues.slice(), secret_hash: simpleHash(st.hidden_secret) };
                saveStory();
                log('第 ' + batchNo + ' 批完成，累计 ' + doneClues.length + '/' + target + ' 条。');
                return runBatches();
            });
        }

        function callBatchWithRetry(need, retriesLeft) {
            return Promise.resolve().then(function () {
                return callCompilerApi(
                    compilerSystemPrompt(st),
                    compilerUserPrompt(st, materials, need, doneClues),
                    function (chars) { setCompileUi(true, '模型书写中，已接收 ' + chars + ' 字……'); }
                );
            }).then(function (raw) {
                var candidates = parseCluesJson(raw);
                var vetted = vetClues(candidates, st);
                for (var r = 0; r < vetted.rejected.length; r++) {
                    log('安检拦下一条：' + vetted.rejected[r].reason);
                }
                if (!vetted.pass.length) throw new Error('本批线索全部被安检拦下。');
                return vetted.pass;
            }).catch(function (err) {
                if (retriesLeft > 0 && !compileState.cancel && !chatChangedSince(homeToken)) {
                    log('本批出错（' + (err && err.message || err) + '），重试一次……');
                    return callBatchWithRetry(need, retriesLeft - 1);
                }
                throw err;
            });
        }
    }

    function simpleHash(text) {
        var t = String(text || '');
        var h = 2166136261;
        for (var i = 0; i < t.length; i++) {
            h ^= t.charCodeAt(i);
            h = (h * 16777619) >>> 0;
        }
        return h.toString(36);
    }

    /* ================================================================
     * 7. 运行时（纯本地，零 API）
     *  消费模型：一条线索占据一个完整"回复位"（含全部重抽）。
     *  MESSAGE_SENT   → 清算上一位 → 轮钟++ → 到点则下一条上台并注入
     *  MESSAGE_RECEIVED → 台上线索送达计数++（重抽自然复用，不重复消费）
     *  CHAT_CHANGED   → 现场还原
     * ================================================================ */

    function findClue(st, id) {
        for (var i = 0; i < st.clues.length; i++) if (st.clues[i].id === id) return st.clues[i];
        return null;
    }

    function activeClue(st) {
        return st.clock.active_id ? findClue(st, st.clock.active_id) : null;
    }

    function usedCount(st) {   // 语义：真正送出的条数（废弃不算送出）
        var n = 0;
        for (var i = 0; i < st.clues.length; i++) if (st.clues[i].used && !st.clues[i].dropped) n++;
        return n;
    }

    function unusedClues(st) {
        var out = [];
        for (var i = 0; i < st.clues.length; i++) if (!st.clues[i].used) out.push(st.clues[i]);
        return out;
    }

    /* 本轮该投哪条：
     * 均匀 → 未用池第一条（保持编译时的浅→深顺序）；
     * 智能 → 调度员预选的那条（若仍有效），否则确定性回退到未用池第一条。 */
    function pickClueForRound(st) {
        var pool = unusedClues(st);
        if (!pool.length) return null;
        if (st.config.run_mode === 'smart') {
            var plan = st.clock.planned;
            if (plan && plan.for_round === st.clock.round) {
                var chosen = findClue(st, plan.clue_id);
                if (chosen && !chosen.used) return { clue: chosen, via: '调度员选牌' };
            }
            var why = '顺序发牌';
            if (!plan) why = '调度未及完成，按顺序发牌';
            else if (plan.failed) why = '调度没成，按顺序发牌';
            return { clue: pool[0], via: why };
        }
        return { clue: pool[0], via: '' };
    }

    function injectText(clueText) {
        var text = [
            '【舞台指示 · 仅本回合】',
            clueText,
            '（自然融入演出即可，不要向玩家解释这段指示的存在。）'
        ].join('\n');
        // 末道闸：注入前最后一次宏检查
        if (hasResidualMacro(text)) {
            log('⚠ 注入前发现残留宏，本条已拦下改为空注入。');
            text = '';
        }
        applyInjection(text);
    }

    function applyInjection(text) {
        var c = ctx();
        var depth = clamp(parseInt(settings().depth, 10) || 1, 0, 20);
        try { c.setExtensionPrompt(INJECT_KEY, text, 1, depth, false, 0); }
        catch (e) {
            try { c.setExtensionPrompt(INJECT_KEY, text, 1, depth); }
            catch (e2) { log('✗ 注入口调用失败：' + (e2 && e2.message || e2)); }
        }
    }

    function clearInjection() { applyInjection(''); }

    /* 玩家发出一条消息 */
    function onUserMessage() {
        var st = story();
        if (!st || st.status !== 'lit') return;

        // 1) 清算上一个回复位
        var current = activeClue(st);
        if (current) {
            if (current.delivered_count > 0) {
                current.used = true;
                st.clock.active_id = null;
                st.clock.cursor = usedCount(st);
                clearInjection();
                log('一条线索已完成使命，退场（累计已送 ' + st.clock.cursor + ' 条）。');
            } else {
                // 从未进入任何一次生成（玩家连发消息）——原地等待，不浪费
            }
        }

        // 2) 轮钟前进
        st.clock.round += 1;

        // 3) 到点且台上无人 → 上台（三档各走各的小内核）
        if (!st.clock.active_id && st.clock.round >= st.clock.next_due) {
            if (st.config.run_mode === 'supervise') {
                superviseDispatch(st);
            } else {
                var pool = unusedClues(st);
                if (pool.length) {
                    var picked = pickClueForRound(st);
                    var next = picked.clue;
                    st.clock.active_id = next.id;
                    st.clock.planned = null;   // 预选一经消费即作废
                    next.delivered_count = 0;
                    injectText(next.text);
                    st.clock.next_due = st.clock.round + clamp(parseInt(st.config.interval, 10) || 10, 1, 999);
                    log('第 ' + st.clock.round + ' 轮：线索上台' + (picked.via ? '（' + picked.via + '）' : '') + '，将随下一次回复送出。');
                }
            }
        }

        // 4) 存货耗尽收尾（仅编译制模式；AI 监督没有"送完"概念，故事由 God 陪到最后）
        if (st.config.run_mode !== 'supervise' && !st.clock.active_id && !unusedClues(st).length && st.status !== 'finished') {
            st.status = 'finished';
            clearInjection();
            var dropped = 0;
            for (var di = 0; di < st.clues.length; di++) if (st.clues[di].dropped) dropped++;
            if (dropped) {
                log('线索池见底了：实际送出 ' + st.clock.cursor + ' 条，另有 ' + dropped + ' 条被剧情越过、安静退场。故事的真相，现在交给你们自己走完。');
                toast('小萤火的线索已用尽（送出 ' + st.clock.cursor + ' 条）', 'success');
            } else {
                log('所有线索都已送完。故事的真相，现在交给你们自己走完。');
                toast('小萤火的线索已全部送完', 'success');
            }
        }
        saveStory();
        renderPanel();
    }

    /* AI 监督：消费 God 在空档里给出的裁决 */
    function superviseDispatch(st) {
        var plan = st.clock.planned;
        st.clock.planned = null;
        if (plan && plan.for_round === st.clock.round && trim(plan.god_text)) {
            // God 设计的指示已过安检 → 入账本并上台（复用全部簿记）
            var clue = { id: uid('god'), text: trim(plan.god_text), used: false, delivered_count: 0 };
            st.clues.push(clue);
            st.clock.active_id = clue.id;
            st.clock.hold_streak = 0;
            injectText(clue.text);
            st.clock.next_due = st.clock.round + clamp(parseInt(st.config.interval, 10) || 10, 1, 999);
            log('第 ' + st.clock.round + ' 轮：God 递来一条现场设计的指示，将随下一次回复送出。');
        } else if (plan && plan.for_round === st.clock.round && plan.hold) {
            st.clock.hold_streak = (st.clock.hold_streak || 0) + 1;
            st.clock.next_due = st.clock.round + 1;   // 暂缓：下一轮再问
            log('第 ' + st.clock.round + ' 轮：God 判断此刻不宜递光，暂缓一轮。');
            if (st.clock.hold_streak >= 3) log('⚠ God 已连续暂缓 ' + st.clock.hold_streak + ' 轮。若嫌节奏慢，可检查秘密写法是否给了它可下手的素材，或调高线索力度。');
        } else {
            st.clock.next_due = st.clock.round + 1;   // 没来得及/失败：下一轮再试
            log('第 ' + st.clock.round + ' 轮：God 未及回应，本轮不投，下一轮再问。');
        }
    }

    /* AI 回复落地（含每一次重抽的落地） */
    function onAiMessage() {
        var st = story();
        if (!st || st.status !== 'lit') return;
        var current = activeClue(st);
        if (current) {
            current.delivered_count += 1;
            if (current.delivered_count === 1) {
                log('线索已随本次回复进入演出。（重抽会继续带着它，直到你再次发言）');
            }
        }
        saveStory();
        renderPanel();
        // 一轮流水线：智能调度在两轮之间的空档里后台选牌，
        // 注入仍在下一次玩家消息时同步发生——时序物理安全不变。
        maybePlanAhead(st);
    }

    /* ---- 智能调度：调度员（一轮流水线） ---- */

    var planFlight = null;   // 防重复起飞

    function maybePlanAhead(st) {
        if (st.status !== 'lit') return;
        var mode = st.config.run_mode;
        if (mode !== 'smart' && mode !== 'supervise') return;
        var nextRound = st.clock.round + 1;
        if (st.clock.active_id) return;                       // 台上还有人，下一轮不投
        if (nextRound < st.clock.next_due) return;            // 下一轮不到点
        if (st.clock.planned && st.clock.planned.for_round === nextRound) return;  // 已规划（含已失败：本轮不再重试）
        if (planFlight) return;

        var homeToken = chatToken();   // 起飞时记下是哪个聊天，落地必须对得上

        if (mode === 'smart') {
            var pool = unusedClues(st);
            if (pool.length <= 1) return;                     // 0/1 条无需选牌
            var window_ = pool.slice(0, 5);                   // 候选窗口：未用池头 5 条，保持大体递进
            var recent = recentStoryText(10, 3000);
            planFlight = callSchedulerApi(schedulerSystemPrompt(), schedulerUserPrompt(recent.text, window_))
                .then(function (raw) {
                    if (chatChangedSince(homeToken)) return;  // 人已经走了：这份结果作废，绝不写进别的聊天
                    var picked = matchClueIdInText(raw, window_);
                    var fresh = story();
                    if (!fresh || fresh.config.run_mode !== 'smart' || fresh.status !== 'lit') return;
                    if (picked) {
                        var drops = matchDropsInText(raw, window_, picked.id);
                        for (var d = 0; d < drops.length; d++) {
                            var dc = findClue(fresh, drops[d]);
                            if (dc && !dc.used) { dc.used = true; dc.dropped = true; }
                        }
                        if (drops.length) log('调度员废弃了 ' + drops.length + ' 条已被剧情越过的线索（作者模式里标"已弃"，可随时查看）。');
                        fresh.clock.planned = { for_round: nextRound, clue_id: picked.id };
                        log('调度员已为下一次机会选牌。');
                    } else {
                        fresh.clock.planned = { for_round: nextRound, failed: true };
                        log('调度员回话看不懂，届时按顺序发牌兜底。');
                    }
                    saveStory();
                })
                .catch(function (err) {
                    if (chatChangedSince(homeToken)) return;
                    var fresh = story();
                    // 记为"本轮已试过"，避免玩家每重抽一次就重新调度一次、白烧额度
                    if (fresh) { fresh.clock.planned = { for_round: nextRound, failed: true }; saveStory(); }
                    log('调度员出错（' + (err && err.message || err) + '），届时按顺序发牌兜底。');
                })
                .then(function () { planFlight = null; });
            return;
        }

        // supervise：God 现场裁决
        var recent2 = recentStoryText(12, 3500);
        var given = [];
        for (var g = Math.max(0, st.clues.length - 5); g < st.clues.length; g++) given.push(st.clues[g].text);
        planFlight = callSchedulerApi(godSystemPrompt(st), godUserPrompt(st, recent2.text, given))
            .then(function (raw) {
                // 最要紧的一道：God 读的是这个聊天的秘密，落地时人若已走，整份作废。
                if (chatChangedSince(homeToken)) return;
                var fresh = story();
                if (!fresh || fresh.config.run_mode !== 'supervise' || fresh.status !== 'lit') return;
                var verdict = parseGodVerdict(raw, fresh);
                if (verdict.hold) {
                    fresh.clock.planned = { for_round: nextRound, hold: true };
                    log('God 裁决：此刻暂缓。');
                } else if (verdict.text) {
                    fresh.clock.planned = { for_round: nextRound, god_text: verdict.text };
                    log('God 已为下一次机会设计好一条指示。');
                } else {
                    fresh.clock.planned = { for_round: nextRound, hold: true };
                    log('God 的设计被安检拦下（' + verdict.reason + '），按暂缓处理。');
                }
                saveStory();
            })
            .catch(function (err) {
                if (chatChangedSince(homeToken)) return;
                var fresh = story();
                if (fresh) { fresh.clock.planned = { for_round: nextRound, failed: true }; saveStory(); }
                log('God 出错（' + (err && err.message || err) + '），届时本轮不投。');
            })
            .then(function () { planFlight = null; });
    }

    /* ---- AI 监督：God 提示词与裁决解析 ---- */

    function godSystemPrompt(st) {
        return [
            '你是一个角色扮演故事的隐藏叙事监督者。你知晓完整秘密，演员不知晓。',
            '你的职责：阅读近期剧情，判断此刻是否适合向"扮演角色的演员"递一条舞台指示，让剧情朝真相自然靠近一步。',
            '',
            '裁决规则：',
            '1. 若此刻剧情正紧、气氛不宜、或玩家正专注于别的事——第一行只输出 HOLD，不输出其他任何字。',
            '2. 若适合递光——直接输出一条 30～80 字的舞台指示：告诉演员这一幕可以自然带出什么迹象。用祈使或描述句，扎根于当前场景里真实存在的人物、地点、物件。',
            '3. 指示绝不能说破秘密本身，不出现"线索""秘密""真相"这类出戏的词，不使用 {{ }} 宏。',
            '4. 力度要求——' + (INTENSITY_TEXT[st.config.intensity] || INTENSITY_TEXT.standard),
            (st.banned_words.length ? '5. 以下词语绝对禁止出现：' + st.banned_words.join('、') : ''),
            '',
            '只输出 HOLD 或指示文本本身，不要解释，不要 Markdown。'
        ].join('\n');
    }

    function godUserPrompt(st, recentText, givenList) {
        var parts = [];
        parts.push('【完整秘密（绝密，仅你可见）】\n' + st.hidden_secret);
        parts.push('【近期剧情】\n' + (recentText || '（故事尚未开场）'));
        if (givenList.length) parts.push('【你此前已递出的指示（不要重复它们的意象）】\n' + givenList.map(function (t, i) { return (i + 1) + '. ' + t; }).join('\n'));
        parts.push('现在裁决：HOLD，或直接写出这一程的指示。');
        return parts.join('\n\n');
    }

    function parseGodVerdict(rawText, st) {
        var raw = trim(rawText);
        if (!raw) return { hold: true };
        if (/^HOLD\b/i.test(raw)) return { hold: true };
        // 剥掉可能的引号与代码块
        var text = raw.replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/, '');
        text = trim(text.replace(/^[「"']+|[」"']+$/g, ''));
        if (text.length > 300) text = text.slice(0, 300);
        var vetted = vetClues([text], st);
        if (!vetted.pass.length) return { hold: false, text: '', reason: vetted.rejected[0].reason };
        return { hold: false, text: vetted.pass[0] };
    }

    function schedulerSystemPrompt() {
        return [
            '你是隐藏叙事的调度员。下面有若干条候选舞台指示，请从中选出最贴合当前剧情现场的一条。',
            '你只有选牌权，没有创作权。',
            '第一行只输出所选那条的编号（形如 clue_xxxxx）。',
            '若候选中有已被剧情明确越过、永远不再合适投放的条目，可另起一行输出：弃 编号（最多两条；拿不准就不要弃）。',
            '除此之外不要输出任何其他文字。'
        ].join('\n');
    }

    function schedulerUserPrompt(recentText, candidates) {
        var lines = ['【近期剧情】', recentText || '（新故事，尚无剧情）', '', '【候选舞台指示】'];
        for (var i = 0; i < candidates.length; i++) {
            lines.push('编号 ' + candidates[i].id + '：' + candidates[i].text);
        }
        lines.push('');
        lines.push('只输出最合适那条的编号。');
        return lines.join('\n');
    }

    /* 解析器：直接在回话里搜候选 id 子串，出现位置最靠前者当选。
     * id 是随机串，不存在误匹配——这比让小模型写合法 JSON 可靠得多。 */
    function matchClueIdInText(rawText, candidates) {
        var text = String(rawText || '');
        var best = null;
        var bestPos = Infinity;
        for (var i = 0; i < candidates.length; i++) {
            var pos = text.indexOf(candidates[i].id);
            if (pos >= 0 && pos < bestPos) { bestPos = pos; best = candidates[i]; }
        }
        return best;
    }

    /* 废弃解析：只认以「弃 / DROP」开头的行，只认候选窗口内的 id，
     * 每次最多 2 条，且不能弃掉选中的那条——防小模型抽风清空池子。 */
    function matchDropsInText(rawText, candidates, pickedId) {
        var drops = [];
        var lines = String(rawText || '').split(/\r?\n/);
        for (var l = 0; l < lines.length && drops.length < 2; l++) {
            var line = trim(lines[l]);
            if (!/^(弃|DROP)/i.test(line)) continue;
            for (var i = 0; i < candidates.length && drops.length < 2; i++) {
                var id = candidates[i].id;
                if (id !== pickedId && line.indexOf(id) >= 0 && drops.indexOf(id) < 0) drops.push(id);
            }
        }
        return drops;
    }

    /* 调度员连接：独立配置，留空复用编译连接；小请求、零温度、短超时 */
    function callSchedulerApi(systemPrompt, userPrompt) {
        var s = settings();
        var prof = {
            url: trim(s.api2.url) || s.api.url,
            key: trim(s.api2.key) || s.api.key,
            model: trim(s.api2.model) || s.api.model
        };
        if (!trim(prof.url) || !trim(prof.model)) {
            return Promise.reject(new Error('调度员连接未配置（也没有可复用的编译连接）'));
        }
        var controller = typeof AbortController === 'function' ? new AbortController() : null;
        var request = fetch(normalizeApiUrl(prof.url), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (prof.key || '') },
            body: JSON.stringify({
                model: prof.model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                max_tokens: 200,
                temperature: 0,
                stream: false
            }),
            signal: controller ? controller.signal : undefined
        }).then(function (res) {
            if (!res.ok) return res.text().then(function (raw) { throw new Error('HTTP ' + res.status + '（' + String(raw).slice(0, 80) + '）'); });
            return res.text().then(function (raw) {
                try { return extractFromJsonText(raw); }
                catch (e) { return raw; }   // 有的中转裸回文本——反正解析器只搜 id 子串
            });
        });
        return withTimeout(request, 45000, function () { if (controller) controller.abort(); });
    }

    /* 切换聊天：现场还原 */
    function onChatChanged() {
        clearInjection();  // 先清，防止上一个聊天的注入串场
        var st = story();
        if (!st) { renderPanel(); return; }
        if (st.status === 'lit') {
            var current = activeClue(st);
            if (current) {
                if (current.delivered_count > 0) {
                    // 离场前已完成使命 → 补退役
                    current.used = true;
                    st.clock.active_id = null;
                    st.clock.cursor = usedCount(st);
                    log('回到这个故事：上次台上的线索已完成，补记退场。');
                } else {
                    injectText(current.text);
                    log('回到这个故事：台上线索恢复注入。');
                }
                saveStory();
            }
        }
        renderPanel();
    }

    /* ---- 点亮 / 熄灭 / 进度控制 ---- */

    function lightUp() {
        var st = story();
        if (!st) return toast('请先打开一个聊天', 'warning');
        readFormIntoStory();
        if (st.config.run_mode === 'supervise') {
            if (!trim(st.hidden_secret)) return toast('AI 监督模式：把隐藏脉络写好即可点亮，无需编译', 'warning');
            if (st.status === 'lit') return;
        } else {
            if (st.status !== 'compiled') return toast('先完成编译并确认线索，才能点亮', 'warning');
            if (!st.clues.length) return toast('没有可用线索', 'warning');
        }
        st.status = 'lit';
        if (!st.clock.lit_at) {
            st.clock.lit_at = nowIso();
            try { st.clock.lit_at_floor = (ctx().chat || []).length; } catch (e) { st.clock.lit_at_floor = 0; }
            st.clock.round = 0;
            st.clock.next_due = 1;   // 点亮后的第一条玩家消息即是第一次机会（宪法 5.4）
        }
        saveStory();
        log('🕯 故事点亮。你的下一次行动，就是第一束光的机会。');
        toast('小萤火已点亮', 'success');
        renderPanel();
    }

    /* 手动点灯：玩家嫌节奏慢时，立即投放一条（可指定），不等间隔。
     * 排程从当前轮重新顺延；本条同样随下一次回复送出、走完整簿记。 */
    function manualDispatch(clueId) {
        var st = story();
        if (!st) return toast('请先打开一个聊天', 'warning');
        if (st.status !== 'lit') return toast('先点亮故事，才能手动加灯', 'warning');
        if (st.config.run_mode === 'supervise') {
            return toast('AI 监督模式由 God 掌灯；想加快节奏可把间隔调小', 'info');
        }
        if (st.clock.active_id) return toast('台上还有一条在演，等它随你的下一条消息退场后再点', 'warning');
        var chosen = null;
        if (clueId) {
            chosen = findClue(st, clueId);
            if (!chosen || chosen.used) return toast('这条不在待命队列里', 'warning');
        } else {
            var picked = pickClueForRound(st);
            if (!picked) return toast('没有可投的线索了', 'warning');
            chosen = picked.clue;
        }
        st.clock.active_id = chosen.id;
        st.clock.planned = null;
        chosen.delivered_count = 0;
        injectText(chosen.text);
        st.clock.next_due = st.clock.round + clamp(parseInt(st.config.interval, 10) || 10, 1, 999);
        saveStory();
        log('手动加灯：一条线索' + (clueId ? '（你指定的）' : '') + '立即上台，将随下一次回复送出。后续排程从现在重新起算。');
        toast('已加一束光', 'success');
        renderPanel();
    }

    function concludeStory() {
        var st = story();
        if (!st || st.status !== 'lit') return toast('只有点亮中的故事可以完结', 'warning');
        clearInjection();
        var left = 0;
        for (var i = 0; i < st.clues.length; i++) {
            if (!st.clues[i].used) { st.clues[i].used = true; st.clues[i].dropped = true; left++; }
        }
        st.clock.active_id = null;
        st.clock.planned = null;
        st.status = 'finished';
        saveStory();
        log('故事完结。' + (left ? '剩余 ' + left + ' 条线索安静退场——它们是备料，不是任务。' : '所有线索恰好用尽。'));
        toast('故事已完结', 'success');
        renderPanel();
    }

    function extinguish() {
        var st = story();
        if (!st || st.status !== 'lit') return;
        st.status = 'compiled';
        clearInjection();
        saveStory();
        log('故事暂时熄灭。进度已保留（第 ' + st.clock.round + ' 轮，已送 ' + st.clock.cursor + ' 条），随时可以再点亮。');
        renderPanel();
    }

    function resetProgress() {
        var st = story();
        if (!st) return;
        clearInjection();
        for (var i = 0; i < st.clues.length; i++) { st.clues[i].used = false; st.clues[i].dropped = false; st.clues[i].delivered_count = 0; }
        st.clock = blankStory().clock;
        st.clock.planned = null;
        if (st.status === 'lit' || st.status === 'finished') st.status = 'compiled';
        saveStory();
        log('进度已归零，线索完好。可以重新点亮。');
        renderPanel();
    }

    function rewindOneRound() {
        var st = story();
        if (!st || st.status !== 'lit') return toast('只有点亮状态下才能回拨', 'warning');
        if (st.clock.round <= 0) return toast('已经在第 0 轮', 'warning');
        st.clock.round -= 1;
        saveStory();
        log('轮钟回拨一格，现在是第 ' + st.clock.round + ' 轮。（删了楼可以用这个手动校正）');
        renderPanel();
    }

    function wipeStory() {
        var st = chatStoryContainer();
        if (!st) return;
        clearInjection();
        var c = ctx();
        c.chatMetadata[EXT_NAME] = blankStory();
        saveStory();
        toast('本聊天的故事已清空', 'info');
        renderPanel();
    }

    /* ================================================================
     * 8. UI（普通用户只看人话；作者模式才见线索原文）
     * ================================================================ */

    function statusLine() {
        var st = story();
        if (!st) return { text: '还没有打开聊天。', next: '打开一个角色聊天后再回来。' };
        if (compileState.running) return { text: '正在编译……', next: '等它写完，或点「停止」。' };
        switch (st.status) {
            case 'empty':
                if (st.config.run_mode === 'supervise') {
                    return { text: '这个聊天还没有故事。', next: 'AI 监督模式：写下隐藏脉络后直接点亮，God 现场设计每一程光。' };
                }
                if (st.draft && isArray(st.draft.clues) && st.draft.clues.length) {
                    return { text: '上次编译中断，已保住 ' + st.draft.clues.length + ' 条草稿。', next: '点「编译」即可从断点续跑。' };
                }
                return { text: '这个聊天还没有故事。', next: '在「故事」里写下隐藏脉络，然后点「编译」。' };
            case 'compiled':
                return {
                    text: '已备好 ' + st.clues.length + ' 条线索' + (st.clock.round > 0 ? '（进度保留在第 ' + st.clock.round + ' 轮）' : '') + '。',
                    next: st.config.author_mode ? '在「线索预览」确认内容，然后点亮。' : '确认无误就点亮。'
                };
            case 'lit': {
                var current = activeClue(st);
                var sent = st.clock.cursor;
                var floorNow = 0;
                try { floorNow = (ctx().chat || []).length; } catch (e) { }
                var floorTag = floorNow ? '（酒馆第 ' + floorNow + ' 楼）' : '';
                var base = st.config.run_mode === 'supervise'
                    ? ('第 ' + st.clock.round + ' 轮' + floorTag + ' · God 已递 ' + sent + ' 程光')
                    : ('第 ' + st.clock.round + ' 轮' + floorTag + ' · 已送 ' + sent + '/' + st.clues.length + ' 条');
                if (st.clock.round === 0) {
                    return { text: base + ' · 已点亮。', next: '你的下一条消息就是第一束光的机会，不用等间隔。' };
                }
                if (current && current.delivered_count > 0) {
                    return { text: base + ' · 一条线索正在演出中。', next: '正常继续对话即可；重抽也会带着它。' };
                }
                if (current) {
                    return { text: base + ' · 一条线索已上台，等待下一次回复。', next: '等 AI 回复，或直接继续。' };
                }
                var smartNote = '';
                if (st.config.run_mode === 'smart') {
                    smartNote = (st.clock.planned && st.clock.planned.for_round === st.clock.round + 1)
                        ? ' 调度员已选好下一张牌。' : ' 调度员将在空档里选牌。';
                }
                if (st.config.run_mode === 'supervise') {
                    var p = st.clock.planned;
                    smartNote = (p && p.for_round === st.clock.round + 1)
                        ? (p.god_text ? ' God 已设计好下一程。' : ' God 裁决暂缓。')
                        : ' God 将在空档里裁决。';
                }
                var gap = Math.max(0, st.clock.next_due - st.clock.round);
                return { text: base + ' · 下一条预计在第 ' + st.clock.next_due + ' 轮（还差你 ' + gap + ' 条消息）。', next: '正常玩就好，到点它自己来。' + smartNote };
            }
            case 'finished':
                return { text: '所有 ' + st.clues.length + ' 条线索都已送完。', next: '想再来一轮就「重置进度」，或「清空」开新故事。' };
        }
        return { text: '状态：' + st.status, next: '' };
    }

    function renderPanel() {
        var $root = $('#' + PANEL_ID);
        if (!$root.length) return;
        var st = story();
        var line = statusLine();
        $root.find('.lcl2-status-text').text(line.text);
        $root.find('.lcl2-status-next').text(line.next ? '→ ' + line.next : '');
        (function () {
            var $bar = $root.find('.lcl2-bar');
            if (!st || (st.status !== 'lit' && st.status !== 'finished')) { $bar.hide(); return; }
            var pct = 0, label = '';
            if (st.config.run_mode === 'supervise') {
                var totalR = clamp(parseInt(st.config.total_rounds, 10) || 100, 1, 9999);
                pct = Math.min(100, Math.round(st.clock.round / totalR * 100));
                label = '轮数 ' + st.clock.round + ' / ' + totalR;
            } else {
                var totalC = st.clues.length || 1;
                pct = Math.min(100, Math.round(st.clock.cursor / totalC * 100));
                label = '线索 ' + st.clock.cursor + ' / ' + totalC;
            }
            $bar.show();
            $bar.find('.lcl2-bar-fill').css('width', pct + '%');
            $bar.find('.lcl2-bar-label').text(label);
        }());

        // 表单值（仅当无焦点时回填，避免打字被覆盖）
        if (st) {
            fillIfIdle('#lcl2_secret', st.hidden_secret);
            fillIfIdle('#lcl2_banned', st.banned_words.join('，'));
            fillIfIdle('#lcl2_total', st.config.total_rounds);
            fillIfIdle('#lcl2_interval', st.config.interval);
            fillIfIdle('#lcl2_count', st.config.clue_count);
            $('#lcl2_intensity').val(st.config.intensity);
            $('input[name=lcl2_runmode][value="' + (st.config.run_mode || 'uniform') + '"]').prop('checked', true);
            $('#lcl2_author').prop('checked', !!st.config.author_mode);
        }
        var s = settings();
        fillIfIdle('#lcl2_api_url', s.api.url);
        fillIfIdle('#lcl2_api_key', s.api.key);
        fillIfIdle('#lcl2_api_model', s.api.model);
        fillIfIdle('#lcl2_api_timeout', s.api.timeout_s);
        fillIfIdle('#lcl2_api_maxtok', s.api.max_tokens);
        fillIfIdle('#lcl2_depth', s.depth);
        fillIfIdle('#lcl2_api2_url', s.api2.url);
        fillIfIdle('#lcl2_api2_key', s.api2.key);
        fillIfIdle('#lcl2_api2_model', s.api2.model);
        fillIfIdle('#lcl2_ctx_strip', s.ctx_strip);
        fillIfIdle('#lcl2_ctx_prefer', s.ctx_prefer);
        $('#lcl2_use_tavern').prop('checked', !!s.use_tavern);

        renderClueList();
        renderLog();
        renderButtons();
    }

    function fillIfIdle(sel, value) {
        var $el = $(sel);
        if ($el.length && !$el.is(':focus')) $el.val(value == null ? '' : value);
    }

    function renderButtons() {
        var st = story();
        var lit = st && st.status === 'lit';
        var compiled = st && st.status === 'compiled';
        var busy = compileState.running;
        $('#lcl2_btn_compile').prop('disabled', busy || lit).toggle(!busy);
        $('#lcl2_btn_stop').toggle(busy);
        $('#lcl2_btn_light').prop('disabled', !compiled || busy);
        $('#lcl2_btn_off').prop('disabled', !lit);
        $('#lcl2_btn_rewind').prop('disabled', !lit);
    }

    function renderClueList(force) {
        var $list = $('#lcl2_clues');
        if (!$list.length) return;
        /* 用户正在某条线索里打字时绝不重建列表——
         * innerHTML 重写会连光标带内容一起抹掉（iOS WebView 尤其致命）。
         * 与 fillIfIdle 同一套纪律：有焦点就让位，等失焦后的下一次渲染再补。 */
        if (!force && $list.find('textarea:focus').length) { clueListDirty = true; return; }
        clueListDirty = false;
        var st = story();
        if (!st || !st.clues.length) { $list.html('<div class="lcl2-dim">（还没有编译好的线索）</div>'); return; }
        if (!st.config.author_mode) {
            var sent = 0;
            for (var i = 0; i < st.clues.length; i++) if (st.clues[i].used) sent++;
            $list.html('<div class="lcl2-dim">盲玩模式：共 ' + st.clues.length + ' 条已备好，已送出 ' + sent + ' 条。内容保密，惊喜留给你自己。</div>');
            return;
        }
        var html = '';
        for (var j = 0; j < st.clues.length; j++) {
            var clue = st.clues[j];
            var badge = clue.dropped ? '<span class="lcl2-badge lcl2-badge-dropped">已弃</span>'
                : clue.used ? '<span class="lcl2-badge lcl2-badge-used">已送</span>'
                : (st.clock.active_id === clue.id ? '<span class="lcl2-badge lcl2-badge-active">台上</span>'
                    : '<span class="lcl2-badge">排队</span>');
            var canDispatch = !clue.used && st.status === 'lit' && !st.clock.active_id && st.config.run_mode !== 'supervise';
            html += '<div class="lcl2-clue" data-id="' + esc(clue.id) + '">'
                + '<div class="lcl2-clue-head">#' + (j + 1) + ' ' + badge
                + (canDispatch ? '<span class="lcl2-clue-fire" title="立即投放这条">🕯 投</span>' : '')
                + '<span class="lcl2-clue-del" title="删除这条">✕</span></div>'
                + '<textarea class="lcl2-clue-text text_pole" rows="2">' + esc(clue.text) + '</textarea>'
                + '</div>';
        }
        $list.html(html);
    }

    var clueListDirty = false;   // 因用户正在打字而跳过的重建，失焦后补上

    var logRenderTimer = null;
    function renderLogSoon() {
        if (logRenderTimer) return;
        logRenderTimer = setTimeout(function () { logRenderTimer = null; renderLog(); }, 150);
    }

    function renderLog() {
        var $log = $('#lcl2_log');
        if (!$log.length) return;
        var st = story();
        if (!st || !st.log.length) { $log.html('<div class="lcl2-dim">（暂无记录）</div>'); return; }
        var html = '';
        for (var i = st.log.length - 1; i >= 0; i--) {
            var e = st.log[i];
            var time = String(e.t).slice(11, 19);
            html += '<div class="lcl2-log-line"><span class="lcl2-log-time">' + esc(time) + '</span>' + esc(e.msg) + '</div>';
        }
        $log.html(html);
    }

    function setCompileUi(running, text) {
        $('#lcl2_progress').text(text || '');
        renderButtons();
    }

    function readFormIntoStory() {
        var st = story();
        if (!st) return null;
        st.hidden_secret = String($('#lcl2_secret').val() || '');
        st.banned_words = String($('#lcl2_banned').val() || '').split(/[,，\n]/).map(trim).filter(Boolean);
        st.config.total_rounds = clamp(parseInt($('#lcl2_total').val(), 10) || 100, 1, 9999);
        st.config.interval = clamp(parseInt($('#lcl2_interval').val(), 10) || 10, 1, 999);
        var manualCount = parseInt($('#lcl2_count').val(), 10);
        st.config.clue_count = clamp(manualCount || Math.ceil(st.config.total_rounds / st.config.interval), 1, 200);
        st.config.intensity = String($('#lcl2_intensity').val() || 'standard');
        var rm = String($('input[name=lcl2_runmode]:checked').val() || st.config.run_mode || 'uniform');
        if (rm === 'uniform' || rm === 'smart' || rm === 'supervise') st.config.run_mode = rm;
        st.config.author_mode = $('#lcl2_author').prop('checked');
        saveStory();
        return st;
    }

    function readFormIntoSettings() {
        var s = settings();
        s.api.url = trim($('#lcl2_api_url').val());
        s.api.key = trim($('#lcl2_api_key').val());
        s.api.model = trim($('#lcl2_api_model').val());
        s.api.timeout_s = clamp(parseInt($('#lcl2_api_timeout').val(), 10) || 240, 30, 900);
        s.api.max_tokens = clamp(parseInt($('#lcl2_api_maxtok').val(), 10) || 4000, 500, 32000);
        s.use_tavern = $('#lcl2_use_tavern').prop('checked');
        s.depth = clamp(parseInt($('#lcl2_depth').val(), 10) || 1, 0, 20);
        s.api2.url = trim($('#lcl2_api2_url').val());
        s.api2.key = trim($('#lcl2_api2_key').val());
        s.api2.model = trim($('#lcl2_api2_model').val());
        s.ctx_strip = String($('#lcl2_ctx_strip').val() || '');
        s.ctx_prefer = String($('#lcl2_ctx_prefer').val() || '');
        saveSettings();
        return s;
    }

    function testConnection() {
        readFormIntoSettings();
        $('#lcl2_test_result').text('测试中……');
        callCompilerApi(
            '你是连通性测试。只输出 {"clues":["ok"]}，不要任何别的字。',
            '请输出。',
            null
        ).then(function (raw) {
            var ok = false;
            try { ok = parseCluesJson(raw).length > 0; } catch (e) { }
            $('#lcl2_test_result').text(ok ? '✓ 通了，且模型能按格式回话。' : '△ 通了，但模型没按格式回话（编译时有本地修复兜底，可先试试）。');
        }).catch(function (err) {
            $('#lcl2_test_result').text('✗ ' + (err && err.message || err));
        });
    }

    function panelHtml() {
        return '' +
        '<div id="' + PANEL_ID + '" class="lcl2-panel" style="display:none">' +
        '  <div class="lcl2-head">' +
        '    <b>🕯 小萤火 · 帷幕沙漏</b>' +
        '    <span class="lcl2-head-ver">2.0</span>' +
        '    <span id="lcl2_close" class="lcl2-close" title="关闭">✕</span>' +
        '  </div>' +
        '  <div class="lcl2-body">' +

        '      <div class="lcl2-mode-row">' +
        '        <button class="lcl2-mode lcl2-mode-on">⏳ 帷幕沙漏<small>第一幕 · 进行中</small></button>' +
        '        <button class="lcl2-mode" disabled title="第二幕，敬请期待">✨ 星星点灯<small>第二幕 · 敬请期待</small></button>' +
        '        <button class="lcl2-mode" disabled title="第三幕，敬请期待">🌫 迷雾森林<small>第三幕 · 敬请期待</small></button>' +
        '      </div>' +

        '      <div class="lcl2-status">' +
        '        <div class="lcl2-status-text"></div>' +
        '        <div class="lcl2-status-next"></div>' +
        '        <div class="lcl2-bar" style="display:none"><div class="lcl2-bar-fill"></div><span class="lcl2-bar-label"></span></div>' +
        '      </div>' +

        '      <details class="lcl2-sec" open><summary>① 故事</summary>' +
        '        <label class="lcl2-label">隐藏脉络（写给小萤火的完整秘密，演员永远看不到这里）</label>' +
        '        <textarea id="lcl2_secret" class="text_pole lcl2-secret" rows="6" placeholder="例：她并非将军府的亲生小姐。二十年前生母把她托付至此，只留下半枚玉袖扣。她隐瞒身世，是为了护住一个还活着的人……"></textarea>' +
        '        <label class="lcl2-label">绝对禁词（线索里绝不能出现的词，逗号分隔，可留空）</label>' +
        '        <input id="lcl2_banned" class="text_pole" type="text" placeholder="例：亲生，生母的名字">' +
        '        <div class="lcl2-grid">' +
        '          <div><label class="lcl2-label">预计总轮数</label><input id="lcl2_total" class="text_pole" type="number" min="1"></div>' +
        '          <div><label class="lcl2-label">每隔几轮一条</label><input id="lcl2_interval" class="text_pole" type="number" min="1"></div>' +
        '          <div><label class="lcl2-label">线索条数<small class="lcl2-dim">（建议多备些当余量）</small></label><input id="lcl2_count" class="text_pole" type="number" min="1" placeholder="自动"></div>' +
        '          <div><label class="lcl2-label">线索力度</label><select id="lcl2_intensity" class="text_pole">' +
        '            <option value="gentle">轻柔</option><option value="standard" selected>标准</option><option value="clear">清晰</option>' +
        '          </select></div>' +
        '        </div>' +
        '        <label class="lcl2-label">运行方式</label>' +
        '        <div class="lcl2-run-row">' +
        '          <label class="lcl2-run"><input type="radio" name="lcl2_runmode" value="uniform" checked><span><b>⏳ 均匀散落</b><small>提前排好 · 按时发牌 · 运行零 API</small></span></label>' +
        '          <label class="lcl2-run"><input type="radio" name="lcl2_runmode" value="smart"><span><b>🃏 智能调度</b><small>小模型现场选牌 · 失败自动按顺序兜底</small></span></label>' +
        '          <label class="lcl2-run"><input type="radio" name="lcl2_runmode" value="supervise"><span><b>👁 AI 监督</b><small>God 现场设计每一程光 · 无需编译 · 建议连强模型</small></span></label>' +
        '        </div>' +
        '        <label class="checkbox_label"><input id="lcl2_author" type="checkbox" checked><span>作者模式（可预览和修改线索；关掉即盲玩）</span></label>' +
        '        <div class="lcl2-row">' +
        '          <button id="lcl2_btn_compile" class="menu_button">✦ 编译</button>' +
        '          <button id="lcl2_btn_stop" class="menu_button" style="display:none">停止</button>' +
        '          <span id="lcl2_progress" class="lcl2-dim"></span>' +
        '        </div>' +
        '      </details>' +

        '      <details class="lcl2-sec"><summary>② 线索预览</summary>' +
        '        <div id="lcl2_clues"></div>' +
        '      </details>' +

        '      <details class="lcl2-sec" open><summary>③ 点亮</summary>' +
        '        <div class="lcl2-row">' +
        '          <button id="lcl2_btn_light" class="menu_button">🕯 点亮</button>' +
        '          <button id="lcl2_btn_off" class="menu_button">熄灭</button>' +
        '          <button id="lcl2_btn_rewind" class="menu_button" title="删过楼可以用这个校正轮数">回拨一轮</button>' +
        '          <button id="lcl2_btn_conclude" class="menu_button" title="剧情走到头了就收——没发完的线索安静退场">完结</button>' +
        '        </div>' +
        '        <div class="lcl2-row">' +
        '          <button id="lcl2_btn_manual" class="menu_button lcl2-manual">✚ 再来一束光</button>' +
        '          <span class="lcl2-dim">嫌节奏慢就点一下：立即投放下一条，不等间隔</span>' +
        '        </div>' +
        '        <div class="lcl2-row">' +
        '          <button id="lcl2_btn_reset" class="menu_button lcl2-danger-soft">重置进度</button>' +
        '          <button id="lcl2_btn_wipe" class="menu_button lcl2-danger">清空本聊天故事</button>' +
        '        </div>' +
        '      </details>' +

        '      <details class="lcl2-sec"><summary>④ 连接（仅编译时使用）</summary>' +
        '        <label class="checkbox_label"><input id="lcl2_use_tavern" type="checkbox"><span>使用酒馆当前连接（非流式，长编译可能被中转掐断；建议优先用下方独立 API）</span></label>' +
        '        <label class="lcl2-label">独立 API 地址</label>' +
        '        <input id="lcl2_api_url" class="text_pole" type="text" placeholder="例：https://api.deepseek.com 或中转地址">' +
        '        <label class="lcl2-label">密钥</label>' +
        '        <input id="lcl2_api_key" class="text_pole" type="password" placeholder="sk-...">' +
        '        <label class="lcl2-label">模型名</label>' +
        '        <div class="lcl2-model-row">' +
        '          <input id="lcl2_api_model" class="text_pole" type="text" placeholder="例：deepseek-chat / claude-sonnet-4-6">' +
        '          <button id="lcl2_btn_models" class="menu_button" title="从 API 拉取可用模型列表">拉取模型</button>' +
        '        </div>' +
        '        <div class="lcl2-grid">' +
        '          <div><label class="lcl2-label">超时（秒）</label><input id="lcl2_api_timeout" class="text_pole" type="number" min="30" max="900"></div>' +
        '          <div><label class="lcl2-label">单批 max_tokens</label><input id="lcl2_api_maxtok" class="text_pole" type="number" min="500"></div>' +
        '          <div><label class="lcl2-label">注入深度</label><input id="lcl2_depth" class="text_pole" type="number" min="0" max="20"></div>' +
        '        </div>' +
        '        <div class="lcl2-row">' +
        '          <button id="lcl2_btn_test" class="menu_button">测试连接</button>' +
        '          <span id="lcl2_test_result" class="lcl2-dim"></span>' +
        '        </div>' +
        '        <hr class="lcl2-hr">' +
        '        <label class="lcl2-label"><b>调度员 / God 连接</b>（智能调度可填便宜快模型；AI 监督建议强模型；三项留空 = 复用上方编译连接）</label>' +
        '        <input id="lcl2_api2_url" class="text_pole" type="text" placeholder="调度员 API 地址（可留空）">' +
        '        <input id="lcl2_api2_key" class="text_pole" type="password" placeholder="调度员密钥（可留空）" style="margin-top:6px">' +
        '        <div class="lcl2-model-row" style="margin-top:6px">' +
        '          <input id="lcl2_api2_model" class="text_pole" type="text" placeholder="调度员/God 模型名（可留空）">' +
        '          <button id="lcl2_btn_models2" class="menu_button" title="从调度员 API 拉取模型列表">拉取模型</button>' +
        '        </div>' +
        '        <div class="lcl2-row">' +
        '          <button id="lcl2_btn_test2" class="menu_button">测试调度员</button>' +
        '          <span id="lcl2_test2_result" class="lcl2-dim"></span>' +
        '        </div>' +
        '        <hr class="lcl2-hr">' +
        '        <label class="lcl2-label"><b>上下文清洗</b>（编译取材与调度员/God 读楼层前先清洗，避免思维链噪音）</label>' +
        '        <label class="lcl2-label">剔除这些标签块（逗号分隔）</label>' +
        '        <input id="lcl2_ctx_strip" class="text_pole" type="text" placeholder="thinking, cot, 思维链">' +
        '        <label class="lcl2-label">只取这些标签块的内容（可留空；填了且楼层里有，就只读块内文本，如你预设的正文/摘要标签）</label>' +
        '        <input id="lcl2_ctx_prefer" class="text_pole" type="text" placeholder="例：正文, summary">' +
        '      </details>' +

        '      <details class="lcl2-sec"><summary>⑤ 日志</summary>' +
        '        <div id="lcl2_log" class="lcl2-log"></div>' +
        '      </details>' +

        '      <div class="lcl2-footer">' +
        '        <span class="lcl2-footer-fly">🕯</span>' +
        '        <span>小萤火由三双手点亮 —— 江 · 波哥 Claude · 猫g GPT</span>' +
        '      </div>' +

        '  </div>' +
        '</div>';
    }

    function showPanel() { $('#' + PANEL_ID).show(); renderPanel(); }
    function hidePanel() { $('#' + PANEL_ID).hide(); }
    function togglePanel() {
        var $p = $('#' + PANEL_ID);
        if ($p.is(':visible')) $p.hide(); else showPanel();
    }

    function bindPanelEvents() {
        var $root = $('#' + PANEL_ID);

        $root.on('click', '#lcl2_close', hidePanel);

        $root.on('change input', '#lcl2_secret, #lcl2_banned, #lcl2_total, #lcl2_interval, #lcl2_count, #lcl2_intensity, #lcl2_author', function () {
            readFormIntoStory();
            if (this.id === 'lcl2_author') renderClueList();
        });
        $root.on('change', 'input[name=lcl2_runmode]', function () {
            var st = readFormIntoStory();
            if (st) log('运行方式切换为：' + ({ uniform: '均匀散落', smart: '智能调度', supervise: 'AI 监督' }[st.config.run_mode] || st.config.run_mode));
            renderPanel();
        });
        $root.on('change input', '#lcl2_api_url, #lcl2_api_key, #lcl2_api_model, #lcl2_api_timeout, #lcl2_api_maxtok, #lcl2_use_tavern, #lcl2_depth, #lcl2_api2_url, #lcl2_api2_key, #lcl2_api2_model', function () {
            readFormIntoSettings();
        });
        /* 自绘模型选择器：iOS WebView 不支持 datalist 下拉，只能自己画。
         * 弹出带搜索过滤的列表浮层，点哪个填哪个。 */
        function showModelPicker(targetSel, ids) {
            closeModelPicker();
            var html = '<div id="lcl2_picker" class="lcl2-picker">'
                + '<div class="lcl2-picker-head">'
                + '<input id="lcl2_picker_filter" class="text_pole" type="text" placeholder="输入过滤，共 ' + ids.length + ' 个模型">'
                + '<span id="lcl2_picker_close" class="lcl2-close">✕</span>'
                + '</div>'
                + '<div id="lcl2_picker_list" class="lcl2-picker-list"></div>'
                + '</div>';
            $('#' + PANEL_ID).append(html);
            function renderList(filter) {
                var f = trim(filter).toLowerCase();
                var out = '';
                var shown = 0;
                for (var i = 0; i < ids.length && shown < 200; i++) {
                    if (f && ids[i].toLowerCase().indexOf(f) < 0) continue;
                    out += '<div class="lcl2-picker-item" data-v="' + esc(ids[i]) + '">' + esc(ids[i]) + '</div>';
                    shown++;
                }
                $('#lcl2_picker_list').html(out || '<div class="lcl2-dim" style="padding:8px">没有匹配的模型</div>');
            }
            renderList('');
            $('#lcl2_picker_filter').on('input', function () { renderList($(this).val()); });
            $('#lcl2_picker_close').on('click', closeModelPicker);
            $('#lcl2_picker_list').on('click', '.lcl2-picker-item', function () {
                $(targetSel).val($(this).attr('data-v'));
                readFormIntoSettings();
                closeModelPicker();
                toast('已选择：' + $(this).attr('data-v'), 'success');
            });
        }
        function closeModelPicker() { $('#lcl2_picker').remove(); }

        $root.on('click', '#lcl2_btn_models', function () {
            var s = readFormIntoSettings();
            var $btn = $(this).prop('disabled', true).text('拉取中…');
            fetchModelList(s.api.url, s.api.key).then(function (ids) {
                showModelPicker('#lcl2_api_model', ids);
            }).catch(function (err) {
                toast('拉取失败：' + (err && err.message || err), 'error');
            }).then(function () { $btn.prop('disabled', false).text('拉取模型'); });
        });
        $root.on('click', '#lcl2_btn_models2', function () {
            var s = readFormIntoSettings();
            var url = trim(s.api2.url) || s.api.url;
            var key = trim(s.api2.key) || s.api.key;
            var $btn = $(this).prop('disabled', true).text('拉取中…');
            fetchModelList(url, key).then(function (ids) {
                showModelPicker('#lcl2_api2_model', ids);
            }).catch(function (err) {
                toast('拉取失败：' + (err && err.message || err), 'error');
            }).then(function () { $btn.prop('disabled', false).text('拉取模型'); });
        });
        $root.on('click', '#lcl2_btn_test2', function () {
            readFormIntoSettings();
            $('#lcl2_test2_result').text('测试中……');
            callSchedulerApi('连通性测试。只输出：PING_OK', '请输出。')
                .then(function (raw) {
                    $('#lcl2_test2_result').text(String(raw).indexOf('PING_OK') >= 0 ? '✓ 调度员在线。' : '△ 通了，但回话不规矩（选牌解析只搜编号，问题不大）。');
                })
                .catch(function (err) { $('#lcl2_test2_result').text('✗ ' + (err && err.message || err)); });
        });

        $root.on('click', '#lcl2_btn_compile', function () {
            var st = readFormIntoStory();
            if (!st) return toast('请先打开一个聊天', 'warning');
            readFormIntoSettings();
            compileStory().catch(function () { });
        });
        $root.on('click', '#lcl2_btn_stop', function () {
            compileState.cancel = true;
            log('已请求停止，本批完成后停下（草稿会保住）。');
        });
        $root.on('click', '#lcl2_btn_light', lightUp);
        $root.on('click', '#lcl2_btn_off', extinguish);
        $root.on('click', '#lcl2_btn_rewind', rewindOneRound);
        $root.on('click', '#lcl2_btn_manual', function () { manualDispatch(null); });
        $root.on('click', '#lcl2_btn_conclude', function () {
            if (window.confirm('给这个故事收尾？没发完的线索会安静退场（不删除，作者模式仍可查看）。')) concludeStory();
        });
        $root.on('click', '#lcl2_btn_reset', function () {
            if (window.confirm('把进度归零？线索会完整保留。')) resetProgress();
        });
        $root.on('click', '#lcl2_btn_wipe', function () {
            if (window.confirm('清空本聊天的整个故事（秘密、线索、日志）？此操作不可恢复。')) wipeStory();
        });
        $root.on('click', '#lcl2_btn_test', testConnection);

        // 作者模式：线索编辑与删除
        $root.on('change', '.lcl2-clue-text', function () {
            var st = story();
            if (!st) return;
            var id = $(this).closest('.lcl2-clue').data('id');
            var clue = findClue(st, id);
            if (!clue) return;
            var newText = String($(this).val() || '');
            var vetted = vetClues([newText], st);
            if (!vetted.pass.length) {
                toast('这条改动被安检拦下：' + vetted.rejected[0].reason, 'warning');
                $(this).val(clue.text);
                return;
            }
            clue.text = newText;
            // 台上的线索被现场改文 → 立即刷新注入
            if (st.clock.active_id === id && st.status === 'lit') injectText(newText);
            saveStory();
        });
        // 打字期间被推迟的重建，在失焦后补上（此时抹掉输入框已无害）
        $root.on('blur', '.lcl2-clue-text', function () {
            setTimeout(function () {
                if (clueListDirty && !$('#lcl2_clues').find('textarea:focus').length) renderClueList(true);
            }, 0);
        });
        $root.on('click', '.lcl2-clue-fire', function () {
            var id = $(this).closest('.lcl2-clue').data('id');
            manualDispatch(id);
        });
        $root.on('click', '.lcl2-clue-del', function () {
            var st = story();
            if (!st) return;
            var id = $(this).closest('.lcl2-clue').data('id');
            if (st.clock.active_id === id) return toast('这条正在台上，先熄灭或等它退场再删', 'warning');
            for (var i = 0; i < st.clues.length; i++) {
                if (st.clues[i].id === id) { st.clues.splice(i, 1); break; }
            }
            st.clock.cursor = usedCount(st);
            saveStory();
            renderPanel();
        });
    }

    /* ================================================================
     * 9. 启动
     * ================================================================ */

    function mountPanel() {
        var $body = $('body');
        if (!$body.length) return false;
        if (!$('#' + PANEL_ID).length) {
            $body.append(panelHtml());
            bindPanelEvents();
        }
        makeFloater();
        makeSettingsEntry();
        makeWandEntry();
        renderPanel();
        return true;
    }

    /* 萤火虫浮标：默认停在 #sheld 右下，可拖动；
     * 结构与停泊属性兼容避风塘（Harbor Bar 会将其收进 #extensionHarborDock）。 */
    function makeFloater() {
        if ($('#lcl2_floater').length) return;
        var host = $('#sheld');
        var el = $('<div id="lcl2_floater" class="lcl2-floater" title="小萤火"></div>');
        if (!host.length) { host = $('body'); el.addClass('lcl2-floater-fixed'); }
        el.append('<span class="lcl2-firefly" aria-hidden="true"></span>');
        host.append(el);
        if (!settings().show_floater) el.hide();

        var dragging = false, moved = false, ox = 0, oy = 0;
        function start(x, y) { dragging = true; moved = false; var off = el.offset(); ox = x - off.left; oy = y - off.top; }
        function move(x, y) {
            if (!dragging) return;
            // 被避风塘停泊时不允许拖走
            if (el.closest('#extensionHarborDock').length) { dragging = false; return; }
            moved = true;
            el.css({ left: (x - ox) + 'px', top: (y - oy) + 'px', right: 'auto', bottom: 'auto' });
        }
        function end() { if (dragging && !moved) togglePanel(); dragging = false; }
        el.on('mousedown', function (e) { start(e.pageX, e.pageY); e.preventDefault(); });
        $(document).on('mousemove.lcl2', function (e) { move(e.pageX, e.pageY); }).on('mouseup.lcl2', end);
        el.on('touchstart', function (e) { var t = e.originalEvent.touches[0]; start(t.pageX, t.pageY); });
        el.on('touchmove', function (e) { var t = e.originalEvent.touches[0]; move(t.pageX, t.pageY); e.preventDefault(); });
        el.on('touchend', end);
    }

    /* 扩展设置区只留一个两行小入口，避免长内容与其他扩展叠版 */
    function makeSettingsEntry() {
        if ($('#lcl2_drawer').length) return;
        var $host = $('#extensions_settings2');
        if (!$host.length) $host = $('#extensions_settings');
        if (!$host.length) return;
        $host.append(
            '<div id="lcl2_drawer" class="inline-drawer">' +
            '  <div class="inline-drawer-toggle inline-drawer-header"><b>🕯 小萤火 2.0</b>' +
            '    <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div></div>' +
            '  <div class="inline-drawer-content"><div class="lcl2-drawer-inner">' +
            '    <button id="lcl2_open_panel" class="menu_button">打开小萤火面板</button>' +
            '    <label class="checkbox_label"><input id="lcl2_show_floater" type="checkbox"><span>显示萤火虫浮标</span></label>' +
            '  </div></div>' +
            '</div>');
        $('#lcl2_open_panel').on('click', showPanel);
        $('#lcl2_show_floater').prop('checked', !!settings().show_floater).on('change', function () {
            var s = settings();
            s.show_floater = $(this).prop('checked');
            saveSettings();
            $('#lcl2_floater').toggle(s.show_floater);
        });
    }

    /* 魔杖菜单入口 */
    function makeWandEntry() {
        if ($('#lcl2_wand').length) return;
        var menu = $('#extensionsMenu');
        if (!menu.length) return;
        var item = $('<div id="lcl2_wand" class="list-group-item flex-container flexGap5 interactable" tabindex="0"><span class="lcl2-wand-dot"></span><span>小萤火</span></div>');
        item.on('click', showPanel);
        menu.append(item);
    }

    function bindChatEvents() {
        var c = ctx();
        var ev = c.eventSource;
        var t = c.eventTypes || c.event_types;
        if (!ev || !t) return false;
        ev.on(t.MESSAGE_SENT, function () { try { onUserMessage(); } catch (e) { log('✗ 运行异常：' + (e && e.message)); } });
        ev.on(t.MESSAGE_RECEIVED, function () { try { onAiMessage(); } catch (e) { log('✗ 运行异常：' + (e && e.message)); } });
        ev.on(t.CHAT_CHANGED, function () { try { onChatChanged(); } catch (e) { } });
        return true;
    }

    function boot(attempt) {
        attempt = attempt || 0;
        var ready = false;
        try {
            ready = !!(window.SillyTavern && SillyTavern.getContext && ctx());
        } catch (e) { ready = false; }
        if (!ready || !mountPanel()) {
            if (attempt < 40) return void setTimeout(function () { boot(attempt + 1); }, 500);
            return;
        }
        var caps = capabilityReport();
        if (!caps.core_ok) {
            toast('小萤火无法启动：本酒馆版本缺少 ' + caps.missing.join('、'), 'error');
            return;
        }
        bindChatEvents();
        clearInjection();     // 开机先清一次，防止上次会话残留
        onChatChanged();      // 用现场还原逻辑完成首次装载
        // 串场守卫自检：写进人话日志，手机上不用开控制台也能确认
        var tk = chatToken();
        if (tk) log('🛡 串场守卫已启用（聊天身份来源：' + chatTokenSource + '）。');
        else log('⚠ 串场守卫未启用：这个酒馆版本取不到聊天身份。行为与旧版一致，但编译中途切聊天可能丢结果——请尽量等编译完再切。');
        console.log('[Luciole 2.0] 小萤火已就位。守卫来源：' + (chatTokenSource || '无'));
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { boot(0); });
    } else {
        boot(0);
    }
}());
