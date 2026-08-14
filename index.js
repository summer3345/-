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
            batch_size: DEFAULT_BATCH
        };
    }

    function settings() {
        var c = ctx();
        var root = c.extensionSettings || (c.extensionSettings = {});
        if (!isObject(root[EXT_NAME])) root[EXT_NAME] = defaultSettings();
        var s = root[EXT_NAME];
        var d = defaultSettings();
        if (!isObject(s.api)) s.api = d.api;
        var k;
        for (k in d.api) if (s.api[k] === undefined) s.api[k] = d.api[k];
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
                author_mode: true
            },
            clues: [],                 // { id, text, used, delivered_count }
            clock: {
                round: 0,              // 相对轮：点亮 = 第 0 轮，此后每条玩家消息 +1
                next_due: 1,           // 下一次投放的相对轮（点亮后第一条玩家消息即首个机会）
                cursor: 0,             // 下一条待投线索下标
                active_id: null,       // 台上线索 id
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
            return { text: boundedText(texts.join('\n---\n'), limit), sources: sources, missed: missed };
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
            });
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
            });
        }
        return Promise.reject(new Error('当前酒馆版本没有 raw / quiet 生成能力，请改用独立 API。'));
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
        if (st.status === 'lit') return Promise.reject(new Error('故事正在点亮中。请先熄灭，再重新编译。'));

        var target = clamp(parseInt(st.config.clue_count, 10) || 10, 1, 200);
        st.config.clue_count = target;
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

        var materials = { card: '', world: '', missed: [] };

        return Promise.resolve().then(function () {
            materials.card = characterCardText(4000);
            return readCharacterWorldBooks(6000);
        }).then(function (wb) {
            materials.world = wb.text;
            materials.missed = wb.missed;
            if (wb.sources.length) log('取材完成：角色卡 + ' + wb.sources.join('、'));
            else log('取材完成：角色卡（未发现角色世界书，属正常）');
            for (var m = 0; m < wb.missed.length; m++) log('⚠ ' + wb.missed[m]);
            return runBatches();
        }).then(function () {
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
            // 保草稿：已定稿部分不丢
            if (doneClues.length) {
                st.draft = { clues: doneClues, secret_hash: simpleHash(st.hidden_secret) };
                saveStory();
                log('编译中断，已保住 ' + doneClues.length + ' 条草稿。修好问题后再点编译即可续跑。');
            }
            log('✗ 编译失败：' + (err && err.message || err));
            toast('编译失败：' + (err && err.message || err), 'error');
            renderPanel();
            throw err;
        });

        function runBatches() {
            if (compileState.cancel) throw new Error('已手动停止。');
            if (doneClues.length >= target) return Promise.resolve();
            var need = Math.min(batchSize, target - doneClues.length);
            var batchNo = Math.floor(doneClues.length / batchSize) + 1;
            setCompileUi(true, '正在生成第 ' + (doneClues.length + 1) + '～' + (doneClues.length + need) + ' 条（共 ' + target + ' 条）……');
            return callBatchWithRetry(need, 2).then(function (accepted) {
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
                if (retriesLeft > 0 && !compileState.cancel) {
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
                st.clock.cursor += 1;
                clearInjection();
                log('第 ' + st.clock.cursor + ' 条已完成使命，退场。');
            } else {
                // 从未进入任何一次生成（玩家连发消息）——原地等待，不浪费
            }
        }

        // 2) 轮钟前进
        st.clock.round += 1;

        // 3) 到点且台上无人且还有存货 → 下一条上台
        if (!st.clock.active_id && st.clock.cursor < st.clues.length && st.clock.round >= st.clock.next_due) {
            var next = st.clues[st.clock.cursor];
            st.clock.active_id = next.id;
            next.delivered_count = 0;
            injectText(next.text);
            st.clock.next_due = st.clock.round + clamp(parseInt(st.config.interval, 10) || 10, 1, 999);
            log('第 ' + st.clock.round + ' 轮：第 ' + (st.clock.cursor + 1) + '/' + st.clues.length + ' 条线索上台，将随下一次回复送出。');
        }

        // 4) 存货耗尽收尾（不等下一个到点，退役即收）
        if (!st.clock.active_id && st.clock.cursor >= st.clues.length && st.status !== 'finished') {
            st.status = 'finished';
            clearInjection();
            log('所有线索都已送完。故事的真相，现在交给你们自己走完。');
            toast('小萤火的线索已全部送完', 'success');
        }
        saveStory();
        renderPanel();
    }

    /* AI 回复落地（含每一次重抽的落地） */
    function onAiMessage() {
        var st = story();
        if (!st || st.status !== 'lit') return;
        var current = activeClue(st);
        if (!current) return;
        current.delivered_count += 1;
        if (current.delivered_count === 1) {
            log('线索已随本次回复进入演出。（重抽会继续带着它，直到你再次发言）');
        }
        saveStory();
        renderPanel();
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
                    st.clock.cursor += 1;
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
        if (st.status !== 'compiled') return toast('先完成编译并确认线索，才能点亮', 'warning');
        if (!st.clues.length) return toast('没有可用线索', 'warning');
        st.status = 'lit';
        if (!st.clock.lit_at) {
            st.clock.lit_at = nowIso();
            st.clock.round = 0;
            st.clock.next_due = 1;   // 点亮后的第一条玩家消息即是第一次机会（宪法 5.4）
        }
        saveStory();
        log('🕯 故事点亮。你的下一次行动，就是第一束光的机会。');
        toast('小萤火已点亮', 'success');
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
        for (var i = 0; i < st.clues.length; i++) { st.clues[i].used = false; st.clues[i].delivered_count = 0; }
        st.clock = blankStory().clock;
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
                var base = '第 ' + st.clock.round + ' 轮 · 已送 ' + sent + '/' + st.clues.length + ' 条';
                if (current && current.delivered_count > 0) {
                    return { text: base + ' · 一条线索正在演出中。', next: '正常继续对话即可；重抽也会带着它。' };
                }
                if (current) {
                    return { text: base + ' · 一条线索已上台，等待下一次回复。', next: '等 AI 回复，或直接继续。' };
                }
                return { text: base + ' · 下一条预计在第 ' + st.clock.next_due + ' 轮。', next: '正常玩就好，到点它自己来。' };
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

        // 表单值（仅当无焦点时回填，避免打字被覆盖）
        if (st) {
            fillIfIdle('#lcl2_secret', st.hidden_secret);
            fillIfIdle('#lcl2_banned', st.banned_words.join('，'));
            fillIfIdle('#lcl2_total', st.config.total_rounds);
            fillIfIdle('#lcl2_interval', st.config.interval);
            fillIfIdle('#lcl2_count', st.config.clue_count);
            $('#lcl2_intensity').val(st.config.intensity);
            $('#lcl2_author').prop('checked', !!st.config.author_mode);
        }
        var s = settings();
        fillIfIdle('#lcl2_api_url', s.api.url);
        fillIfIdle('#lcl2_api_key', s.api.key);
        fillIfIdle('#lcl2_api_model', s.api.model);
        fillIfIdle('#lcl2_api_timeout', s.api.timeout_s);
        fillIfIdle('#lcl2_api_maxtok', s.api.max_tokens);
        fillIfIdle('#lcl2_depth', s.depth);
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

    function renderClueList() {
        var $list = $('#lcl2_clues');
        if (!$list.length) return;
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
            var badge = clue.used ? '<span class="lcl2-badge lcl2-badge-used">已送</span>'
                : (st.clock.active_id === clue.id ? '<span class="lcl2-badge lcl2-badge-active">台上</span>'
                    : '<span class="lcl2-badge">排队</span>');
            html += '<div class="lcl2-clue" data-id="' + esc(clue.id) + '">'
                + '<div class="lcl2-clue-head">#' + (j + 1) + ' ' + badge
                + '<span class="lcl2-clue-del" title="删除这条">✕</span></div>'
                + '<textarea class="lcl2-clue-text text_pole" rows="2">' + esc(clue.text) + '</textarea>'
                + '</div>';
        }
        $list.html(html);
    }

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
        '<div id="' + PANEL_ID + '" class="lcl2-root">' +
        '  <div class="inline-drawer">' +
        '    <div class="inline-drawer-toggle inline-drawer-header">' +
        '      <b>🕯 小萤火 · 帷幕沙漏</b>' +
        '      <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>' +
        '    </div>' +
        '    <div class="inline-drawer-content">' +

        '      <div class="lcl2-status">' +
        '        <div class="lcl2-status-text"></div>' +
        '        <div class="lcl2-status-next"></div>' +
        '      </div>' +

        '      <details class="lcl2-sec" open><summary>① 故事</summary>' +
        '        <label class="lcl2-label">隐藏脉络（写给小萤火的完整秘密，演员永远看不到这里）</label>' +
        '        <textarea id="lcl2_secret" class="text_pole lcl2-secret" rows="6" placeholder="例：她并非本地人。十年前的那场大火……真正的纵火者是……她一直隐瞒的原因是……"></textarea>' +
        '        <label class="lcl2-label">绝对禁词（线索里绝不能出现的词，逗号分隔，可留空）</label>' +
        '        <input id="lcl2_banned" class="text_pole" type="text" placeholder="例：纵火，凶手的名字">' +
        '        <div class="lcl2-grid">' +
        '          <div><label class="lcl2-label">预计总轮数</label><input id="lcl2_total" class="text_pole" type="number" min="1"></div>' +
        '          <div><label class="lcl2-label">每隔几轮一条</label><input id="lcl2_interval" class="text_pole" type="number" min="1"></div>' +
        '          <div><label class="lcl2-label">线索条数</label><input id="lcl2_count" class="text_pole" type="number" min="1" placeholder="自动"></div>' +
        '          <div><label class="lcl2-label">线索力度</label><select id="lcl2_intensity" class="text_pole">' +
        '            <option value="gentle">轻柔</option><option value="standard" selected>标准</option><option value="clear">清晰</option>' +
        '          </select></div>' +
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
        '        </div>' +
        '        <div class="lcl2-row">' +
        '          <button id="lcl2_btn_reset" class="menu_button lcl2-danger-soft">重置进度</button>' +
        '          <button id="lcl2_btn_wipe" class="menu_button lcl2-danger">清空本聊天故事</button>' +
        '        </div>' +
        '      </details>' +

        '      <details class="lcl2-sec"><summary>④ 连接（仅编译时使用）</summary>' +
        '        <label class="checkbox_label"><input id="lcl2_use_tavern" type="checkbox"><span>使用酒馆当前连接（非流式，长编译可能被中转掐断；建议优先用下方独立 API）</span></label>' +
        '        <label class="lcl2-label">独立 API 地址</label>' +
        '        <input id="lcl2_api_url" class="text_pole" type="text" placeholder="https://api.example.com/v1">' +
        '        <label class="lcl2-label">密钥</label>' +
        '        <input id="lcl2_api_key" class="text_pole" type="password" placeholder="sk-...">' +
        '        <label class="lcl2-label">模型名</label>' +
        '        <input id="lcl2_api_model" class="text_pole" type="text" placeholder="例：claude-sonnet-4-6 / gemini-2.5-pro">' +
        '        <div class="lcl2-grid">' +
        '          <div><label class="lcl2-label">超时（秒）</label><input id="lcl2_api_timeout" class="text_pole" type="number" min="30" max="900"></div>' +
        '          <div><label class="lcl2-label">单批 max_tokens</label><input id="lcl2_api_maxtok" class="text_pole" type="number" min="500"></div>' +
        '          <div><label class="lcl2-label">注入深度</label><input id="lcl2_depth" class="text_pole" type="number" min="0" max="20"></div>' +
        '        </div>' +
        '        <div class="lcl2-row">' +
        '          <button id="lcl2_btn_test" class="menu_button">测试连接</button>' +
        '          <span id="lcl2_test_result" class="lcl2-dim"></span>' +
        '        </div>' +
        '      </details>' +

        '      <details class="lcl2-sec"><summary>⑤ 日志</summary>' +
        '        <div id="lcl2_log" class="lcl2-log"></div>' +
        '      </details>' +

        '    </div>' +
        '  </div>' +
        '</div>';
    }

    function bindPanelEvents() {
        var $root = $('#' + PANEL_ID);

        $root.on('change input', '#lcl2_secret, #lcl2_banned, #lcl2_total, #lcl2_interval, #lcl2_count, #lcl2_intensity, #lcl2_author', function () {
            readFormIntoStory();
            if (this.id === 'lcl2_author') renderClueList();
        });
        $root.on('change input', '#lcl2_api_url, #lcl2_api_key, #lcl2_api_model, #lcl2_api_timeout, #lcl2_api_maxtok, #lcl2_use_tavern, #lcl2_depth', function () {
            readFormIntoSettings();
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
        $root.on('click', '.lcl2-clue-del', function () {
            var st = story();
            if (!st) return;
            var id = $(this).closest('.lcl2-clue').data('id');
            if (st.clock.active_id === id) return toast('这条正在台上，先熄灭或等它退场再删', 'warning');
            for (var i = 0; i < st.clues.length; i++) {
                if (st.clues[i].id === id) {
                    // 修正游标：删掉游标之前的已送线索时，游标同步左移
                    if (i < st.clock.cursor) st.clock.cursor -= 1;
                    st.clues.splice(i, 1);
                    break;
                }
            }
            saveStory();
            renderPanel();
        });
    }

    /* ================================================================
     * 9. 启动
     * ================================================================ */

    function mountPanel() {
        var $host = $('#extensions_settings');
        if (!$host.length) $host = $('#extensions_settings2');
        if (!$host.length) return false;
        if ($('#' + PANEL_ID).length) return true;
        $host.append(panelHtml());
        bindPanelEvents();
        renderPanel();
        return true;
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
        console.log('[Luciole 2.0] 小萤火已就位。');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { boot(0); });
    } else {
        boot(0);
    }
}());
