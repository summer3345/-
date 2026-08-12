/* ============================================================
 * Luciole v1.5.0 — 上帝视角剧本引擎 · 帷幕期
 * 真相由 God 持有，演员只接收插件本地渲染的安全当程光。
 * 纪律：ES5 语法；零原型补丁；只用 SillyTavern 官方上下文 API。
 * ============================================================ */
(function () {
    'use strict';

    var MODULE = 'luciole';
    var INJECT_KEY = 'luciole_curtain';
    var LEGACY_INJECT_KEY = 'luciole_drop';
    var DATA_VERSION = 15;
    var MAX_LADDERS = 4;
    var STAGES = ['dormant', 'trace', 'suspect', 'verifiable', 'critical', 'revealed'];
    var LAYERS = ['fact', 'motive', 'emotion'];
    var AWARENESS = ['full', 'partial', 'unknowing', 'false_memory'];
    var ACTIONS = ['hold', 'release', 'advance', 'release_and_advance', 'override'];
    var RELEASE_POLICIES = [null, 'immediate', 'if_topic_touched', 'if_pressed', 'scene_permitting'];
    var BOUNDARY_POLICIES = ['honest_by_awareness', 'as_public_only', 'limit_to_disclosed',
        'admit_evidenced_surface', 'pressured_no_new', 'post_reveal_fact_only'];
    var REASON_CODES = ['pace', 'tension_high', 'aftermath_pending', 'conditions_unmet',
        'conditions_met', 'evidence_direct', 'retry_undelivered'];
    var MISSING = { __luciole_missing: true };
    var FOCUS_PACKET_BUDGET = 760;
    var editingDraft = null;
    var runtimeBusy = false;

    /* ---------------- 基础上下文与存取 ---------------- */

    function ctx() {
        return SillyTavern.getContext();
    }

    function defaults() {
        return {
            dataVersion: DATA_VERSION,
            enabled: true,
            depth: 2,
            showFloater: true,
            theme: 'dark',
            api: { mode: 'current', activeIndex: -1, profiles: [] },
            chats: {}
        };
    }

    function settings() {
        var c = ctx();
        if (!c.extensionSettings[MODULE]) c.extensionSettings[MODULE] = defaults();
        var s = c.extensionSettings[MODULE];
        if (typeof s.enabled !== 'boolean') s.enabled = true;
        if (typeof s.showFloater !== 'boolean') s.showFloater = true;
        if (s.theme !== 'light' && s.theme !== 'dark') s.theme = 'dark';
        if (!s.depth && s.depth !== 0) s.depth = 2;
        if (!s.api) s.api = defaults().api;
        if (!s.api.profiles) s.api.profiles = [];
        if (s.api.mode !== 'custom') s.api.mode = 'current';
        if (typeof s.api.activeIndex !== 'number') s.api.activeIndex = -1;
        if (!s.chats) s.chats = {};
        s.dataVersion = DATA_VERSION;
        return s;
    }

    function save() {
        try { ctx().saveSettingsDebounced(); } catch (e) { }
    }

    function chatKey() {
        var c = ctx();
        var id = null;
        try { id = typeof c.getCurrentChatId === 'function' ? c.getCurrentChatId() : c.chatId; }
        catch (e) { id = null; }
        if (id === null || id === undefined || id === '') return null;
        return String(id);
    }

    function blankChatStore() {
        return {
            schema_version: DATA_VERSION,
            worldNote: '',
            ladders: [],
            legacy_v14: { pending: false, ladders: [], imported_at: null }
        };
    }

    function clone(value) {
        if (value === undefined) return undefined;
        return JSON.parse(JSON.stringify(value));
    }

    function convertLegacyChat(raw) {
        var next = blankChatStore();
        next.worldNote = raw && raw.worldNote ? String(raw.worldNote) : '';
        next.legacy_v14 = {
            pending: !!(raw && raw.ladders && raw.ladders.length),
            ladders: clone((raw && raw.ladders) || []),
            imported_at: new Date().toISOString()
        };
        return next;
    }

    function normalizeChatStore(st) {
        if (!st.ladders) st.ladders = [];
        if (!st.legacy_v14) st.legacy_v14 = { pending: false, ladders: [], imported_at: null };
        if (!st.legacy_v14.ladders) st.legacy_v14.ladders = [];
        st.legacy_v14.pending = st.legacy_v14.ladders.length > 0;
        st.schema_version = DATA_VERSION;
        var foundFocus = false;
        for (var i = 0; i < st.ladders.length; i++) {
            normalizeLadderRuntime(st.ladders[i]);
            if (st.ladders[i].meta && st.ladders[i].meta.focus && !foundFocus) foundFocus = true;
            else if (st.ladders[i].meta) st.ladders[i].meta.focus = false;
        }
        return st;
    }

    function store() {
        var key = chatKey();
        if (!key) return null;
        var s = settings();
        if (!s.chats[key]) s.chats[key] = blankChatStore();
        if (s.chats[key].schema_version !== DATA_VERSION) {
            s.chats[key] = convertLegacyChat(s.chats[key]);
            save();
        }
        return normalizeChatStore(s.chats[key]);
    }

    /* ---------------- 小工具 ---------------- */

    function isArray(v) { return Object.prototype.toString.call(v) === '[object Array]'; }
    function isObject(v) { return !!v && typeof v === 'object' && !isArray(v); }
    function trim(v) { return String(v == null ? '' : v).replace(/^\s+|\s+$/g, ''); }
    function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
    function stageIndex(stage) { return STAGES.indexOf(stage); }
    function layerIndex(layer) { return LAYERS.indexOf(layer); }
    function nowIso() { return new Date().toISOString(); }
    function uid(prefix) {
        return prefix + '_' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 1679616).toString(36);
    }

    function esc(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function uniqueStrings(list) {
        var seen = {};
        var out = [];
        for (var i = 0; i < (list || []).length; i++) {
            var value = trim(list[i]);
            var key = value.toLowerCase();
            if (value && !seen[key]) { seen[key] = true; out.push(value); }
        }
        return out;
    }

    function containsCI(text, needle) {
        return String(text || '').toLowerCase().indexOf(String(needle || '').toLowerCase()) !== -1;
    }

    function validId(value) {
        return /^[A-Za-z][A-Za-z0-9_-]{0,39}$/.test(String(value || ''));
    }

    function fnv1a(text) {
        var str = String(text || '');
        var hash = 2166136261;
        for (var i = 0; i < str.length; i++) {
            hash ^= str.charCodeAt(i);
            hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
        }
        return ('00000000' + (hash >>> 0).toString(16)).slice(-8);
    }

    function exactKeys(obj, allowed) {
        if (!isObject(obj)) return false;
        var map = {};
        for (var i = 0; i < allowed.length; i++) map[allowed[i]] = true;
        var keys = Object.keys(obj);
        if (keys.length !== allowed.length) return false;
        for (var j = 0; j < keys.length; j++) if (!map[keys[j]]) return false;
        return true;
    }

    function allowedKeys(obj, allowed) {
        if (!isObject(obj)) return false;
        var map = {};
        for (var i = 0; i < allowed.length; i++) map[allowed[i]] = true;
        var keys = Object.keys(obj);
        for (var j = 0; j < keys.length; j++) if (!map[keys[j]]) return false;
        return true;
    }

    function hasKeys(obj, required) {
        if (!isObject(obj)) return false;
        for (var i = 0; i < required.length; i++) {
            if (!Object.prototype.hasOwnProperty.call(obj, required[i])) return false;
        }
        return true;
    }

    function indexBy(list, key) {
        var out = {};
        for (var i = 0; i < (list || []).length; i++) {
            if (list[i] && list[i][key] != null) out[String(list[i][key])] = list[i];
        }
        return out;
    }

    function safeJson(value) {
        try { return JSON.stringify(value); } catch (e) { return '{}'; }
    }

    function takeWholeItems(items, charBudget) {
        var out = [];
        var used = 2;
        for (var i = 0; i < (items || []).length; i++) {
            var size = safeJson(items[i]).length + (out.length ? 1 : 0);
            if (used + size > charBudget) continue;
            out.push(clone(items[i]));
            used += size;
        }
        return out;
    }

    function toast(msg, kind) {
        try {
            if (kind === 'error' && toastr.error) toastr.error(msg, '', { timeOut: 5000 });
            else if (kind === 'success' && toastr.success) toastr.success(msg, '', { timeOut: 3000 });
            else toastr.info(msg, '', { timeOut: 3000 });
        } catch (e) { }
    }

    function audit(ladder, type, detail) {
        if (!ladder) return;
        if (!ladder.audit_log) ladder.audit_log = [];
        ladder.audit_log.push({ id: uid('AUD'), type: type, detail: clone(detail || {}), ts: nowIso() });
        if (ladder.audit_log.length > 200) ladder.audit_log.splice(0, ladder.audit_log.length - 200);
    }

    /* ---------------- 聊天视野与谱系原料 ---------------- */

    function floorNow() {
        var c = ctx();
        return c.chat && c.chat.length ? c.chat.length : 0;
    }

    function summaryText() {
        try {
            var ep = ctx().extensionPrompts || {};
            for (var k in ep) {
                if (Object.prototype.hasOwnProperty.call(ep, k) &&
                    k.toLowerCase().indexOf('memory') !== -1 && ep[k] && ep[k].value) {
                    return String(ep[k].value);
                }
            }
        } catch (e) { }
        return '';
    }

    function recentMessages(limit, charLimit) {
        var chat = ctx().chat || [];
        var start = Math.max(0, chat.length - limit);
        var out = [];
        var used = 0;
        for (var i = chat.length - 1; i >= start; i--) {
            if (!chat[i]) continue;
            var role = chat[i].is_user ? 'USER: ' : 'ASSISTANT: ';
            var line = role + String(chat[i].mes || '');
            if (line.length > charLimit) line = role + '（本楼超过上下文预算，整楼未下发）';
            if (used + line.length + (out.length ? 1 : 0) > charLimit) continue;
            out.unshift(line);
            used += line.length + (out.length > 1 ? 1 : 0);
        }
        return out.join('\n');
    }

    function latestUserText() {
        var chat = ctx().chat || [];
        for (var i = chat.length - 1; i >= 0; i--) {
            if (chat[i] && chat[i].is_user) return String(chat[i].mes || '');
        }
        return '';
    }

    function boundedWholeText(text, limit, label) {
        var value = String(text || '');
        if (!limit || value.length <= limit) return value;
        return '（' + (label || '内容') + '超过上下文预算，未截断下发）';
    }

    function charCardText(limit) {
        try {
            var c = ctx();
            var ch = c.characters && c.characters[c.characterId];
            if (!ch) return '';
            var parts = [];
            if (ch.name) parts.push('姓名：' + ch.name);
            if (ch.description) parts.push(ch.description);
            if (ch.personality) parts.push(ch.personality);
            if (ch.scenario) parts.push(ch.scenario);
            var whole = parts.join('\n');
            return boundedWholeText(whole, limit, '角色卡');
        } catch (e) { return ''; }
    }

    function personaText(limit) {
        try {
            var c = ctx();
            var p = c.powerUserSettings && c.powerUserSettings.persona_description;
            return p ? boundedWholeText(String(p), limit, '用户人设') : '';
        } catch (e) { return ''; }
    }

    function collectReadableStrings(value, out, seen, depth) {
        if (value === null || value === undefined || depth > 7) return;
        if (typeof value === 'string') { out.push(value); return; }
        if (typeof value !== 'object') return;
        for (var s = 0; s < seen.length; s++) if (seen[s] === value) return;
        seen.push(value);
        if (isArray(value)) {
            for (var i = 0; i < value.length; i++) collectReadableStrings(value[i], out, seen, depth + 1);
            return;
        }
        var keys = Object.keys(value);
        for (var k = 0; k < keys.length; k++) collectReadableStrings(value[keys[k]], out, seen, depth + 1);
    }

    function readableWorldBookText() {
        try {
            var c = ctx();
            var roots = [c.worldInfo, c.world_info, c.worldInfoEntries, c.world_info_entries];
            var out = [];
            var seen = [];
            for (var i = 0; i < roots.length; i++) collectReadableStrings(roots[i], out, seen, 0);
            return out.join('\n');
        } catch (e) { return ''; }
    }

    function charCardAllText() {
        try {
            var c = ctx();
            var ch = c.characters && c.characters[c.characterId];
            var out = [];
            collectReadableStrings(ch, out, [], 0);
            return out.join('\n');
        } catch (e) { return ''; }
    }

    function messageRole(msg) { return msg && msg.is_user ? 'user' : 'assistant'; }

    function messageUid(msg, index) {
        if (!msg) return 'msg:' + index;
        var extra = msg.extra || {};
        return String(msg.message_uid || msg.message_id || extra.message_uid || extra.message_id ||
            ('idx:' + index + ':' + messageRole(msg)));
    }

    function variantUid(msg) {
        if (!msg) return '0';
        var extra = msg.extra || {};
        var v = msg.variant_uid;
        if (v === undefined || v === null) v = msg.swipe_id;
        if (v === undefined || v === null) v = extra.variant_uid;
        if (v === undefined || v === null) v = extra.swipe_id;
        return String(v === undefined || v === null ? '0' : v);
    }

    function lineageNow() {
        var chat = ctx().chat || [];
        var out = [];
        for (var i = 0; i < chat.length; i++) {
            var msg = chat[i] || {};
            var role = messageRole(msg);
            var vuid = variantUid(msg);
            out.push({
                turn_id: i + 1,
                message_uid: messageUid(msg, i),
                role: role,
                content_hash: fnv1a(role + '|' + String(msg.mes || '')),
                variant_uid: vuid
            });
        }
        return out;
    }

    /* ---------------- API 方案 ---------------- */

    function normalizeUrl(url) {
        var u = String(url || '').replace(/\s+/g, '').replace(/\/+$/, '');
        if (!u) return '';
        if (u.indexOf('completions') !== -1) return u;
        if (/\/v1$|\/v1beta$|\/openai$/.test(u)) return u + '/chat/completions';
        return u + '/v1/chat/completions';
    }

    function modelsUrl(url) { return normalizeUrl(url).replace(/\/chat\/completions$/, '/models'); }

    function activeProfile() {
        var api = settings().api;
        if (api.activeIndex < 0 || api.activeIndex >= api.profiles.length) return null;
        return api.profiles[api.activeIndex];
    }

    function callCustomApi(prompt, maxTokens, temperature) {
        var prof = activeProfile();
        if (!prof || !prof.url) return Promise.reject(new Error('未配置独立 API 方案'));
        return fetch(normalizeUrl(prof.url), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + (prof.key || '')
            },
            body: JSON.stringify({
                model: prof.model || '',
                messages: [{ role: 'user', content: prompt }],
                max_tokens: maxTokens || 1800,
                temperature: temperature == null ? 0 : temperature
            })
        }).then(function (res) {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.json();
        }).then(function (data) {
            var msg = data && data.choices && data.choices[0] && data.choices[0].message;
            if (msg && isArray(msg.content)) {
                var chunks = [];
                for (var i = 0; i < msg.content.length; i++) {
                    if (msg.content[i] && msg.content[i].text) chunks.push(msg.content[i].text);
                }
                return chunks.join('');
            }
            return String((msg && msg.content) || '');
        });
    }

    function callCurrentApi(prompt) {
        return new Promise(function (resolve, reject) {
            var c = ctx();
            if (typeof c.generateQuietPrompt !== 'function') {
                reject(new Error('当前酒馆连接没有 quiet prompt 能力'));
                return;
            }
            var p;
            try { p = c.generateQuietPrompt({ quietPrompt: prompt }); }
            catch (e) {
                try { p = c.generateQuietPrompt(prompt, false, true); }
                catch (e2) { reject(e2); return; }
            }
            Promise.resolve(p).then(function (res) { resolve(String(res || '')); }, reject);
        });
    }

    function callModel(prompt, maxTokens, temperature) {
        return settings().api.mode === 'custom'
            ? callCustomApi(prompt, maxTokens, temperature)
            : callCurrentApi(prompt);
    }

    function extractJson(text) {
        var raw = trim(text).replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
        var start = raw.indexOf('{');
        var end = raw.lastIndexOf('}');
        if (start < 0 || end <= start) throw new Error('模型没有返回 JSON 对象');
        return JSON.parse(raw.slice(start, end + 1));
    }

    /* ---------------- 编译契约 ---------------- */

    function compileStagePlanExample() {
        return [
            { stage_id: 'dormant', entry: { condition_ids: [], logic: 'all' }, min_gap: 2, override_condition_ids: [], clue_ids: [] },
            { stage_id: 'trace', entry: { condition_ids: [], logic: 'all' }, min_gap: 3, override_condition_ids: [], clue_ids: ['CL01'] },
            { stage_id: 'suspect', entry: { condition_ids: [], logic: 'all' }, min_gap: 4, override_condition_ids: [], clue_ids: [] },
            { stage_id: 'verifiable', entry: { condition_ids: ['K01'], logic: 'all' }, min_gap: 5, override_condition_ids: [], clue_ids: [] },
            { stage_id: 'critical', entry: { condition_ids: ['K02'], logic: 'all' }, min_gap: 5, override_condition_ids: ['K02'], clue_ids: [] },
            { stage_id: 'revealed', entry: { condition_ids: ['K03'], logic: 'all' }, min_gap: 6, override_condition_ids: ['K03'], clue_ids: [] }
        ];
    }

    function compilePrompt(input) {
        return [
            '你是 Luciole 的编译期 God。把一个完整秘密编译成可验证的帷幕剧本线。',
            '只输出一个 JSON 对象，不要 Markdown，不要解释。不得省略必填数组。',
            '核心纪律：claims 是唯一真值；演员将永远看不到 source_secret 或 claims。',
            'safe 文本只能描边、投放获准命题，不得提前兑现同层结局或更深层动机。',
            '六档固定：dormant, trace, suspect, verifiable, critical, revealed。',
            '三层固定：fact, motive, emotion。每条 claim 只属一层，fingerprints 1-6 个，优先使用至少4字的专名或稳定短语。',
            '每条 clue：allowed_claim_ids 最多3个；stage 不得早于这些 claim 的 earliest_stage；safe_variants 1-3个。',
            '每个 variant 必须含 variant_id、surface(<=200字)、anchor_text(<=60字)、probe。',
            'probe groups 1-6；每组 phrases 1-3；logic=all|any；hit_threshold 合法；exclude 最多4。',
            '若 probe 含少于4字的中文短词，hit_threshold 必须>=3，且使用互不重复的独立语义槽。',
            'tell_pool 与 exposure_response 只能是零命题行为，不得泄露事实；subjective_script/anchor 只写角色相信什么，不反写答案。',
            '每个有 claims 的 layer 必须给齐六档 stage_plans；verifiable/critical/revealed 的 entry.condition_ids 不得为空。',
            'conditions kind 只能 evidence|keyword_event|relation|world_event；spec 与 kind 对应。',
            'JSON 结构：',
            safeJson({
                claims: [{ claim_id: 'C01', text: '命题', layer: 'fact', earliest_stage: 'verifiable', fingerprints: ['稳定短语'] }],
                initial_public_version: '角色和玩家开局可安全知道的表层',
                initial_public_anchor: '不超过80字的公开短锚',
                public_atoms: [{ atom_id: 'P01', text: '公开词', source: 'author' }],
                wake_aliases: ['公开表面话题'],
                jurisdiction: ['本秘密相关的物证与披露'],
                persona_safe: {
                    awareness_by_layer: { fact: 'full', motive: 'partial', emotion: 'partial' },
                    stance_by_layer: { fact: '守住公开说法', motive: '不主动解释', emotion: '照角色本性行动' },
                    concealment_style: '坦然转回公开事实',
                    tell_pool: ['继续手上的日常动作，不额外解释'],
                    exposure_response: ['只回应已经摆到台面上的部分'],
                    subjective_script_by_layer: { fact: '角色只按自己的认知理解此事', motive: '角色保留未公开理由', emotion: '角色不替自己下结论' },
                    subjective_anchor_by_layer: { fact: '沿用角色当前认知', motive: '理由仍未公开', emotion: '感受仍由角色自己承担' }
                },
                conditions: [
                    { cond_id: 'K01', kind: 'keyword_event', spec: { aliases: ['公开话题'], logic: 'any' }, target: { layer: 'fact', stage: 'verifiable' }, override_targets: [], sticky: true },
                    { cond_id: 'K02', kind: 'relation', spec: { text: '相关人物愿意核对证词' }, target: { layer: 'fact', stage: 'critical' }, override_targets: [{ layer: 'fact', max_stage: 'critical' }], sticky: true },
                    { cond_id: 'K03', kind: 'evidence', spec: { clue_ids: ['CL01'], logic: 'all' }, target: { layer: 'fact', stage: 'revealed' }, override_targets: [{ layer: 'fact', max_stage: 'revealed' }], sticky: true }
                ],
                stage_plans: { fact: compileStagePlanExample(), motive: [], emotion: [] },
                clues: [{ clue_id: 'CL01', layer: 'fact', stage: 'trace', priority: 'normal', nature: 'observation', allowed_claim_ids: [], safe_variants: [{ variant_id: 'V01', surface: '可演的安全迹象', anchor_text: '已公开迹象', probe: { groups: [{ phrases: ['稳定短语'], logic: 'any' }], hit_threshold: 1, exclude: [] } }] }]
            }),
            '节奏档：' + input.pace,
            '玩法：' + input.play_mode,
            '作者给的公开表层提示：' + (input.public_hint || '（无，需你生成安全表层）'),
            '角色卡仅作画像参考：\n' + (charCardText(3500) || '（无）'),
            '用户人设仅作关系参考：\n' + (personaText(1200) || '（无）'),
            '世界观安全备注：\n' + (input.world_note || '（无）'),
            '【绝密 source_secret】\n' + input.source_secret,
            '再次强调：只输出 JSON；不要输出 source_secret 字段；不要让 initial_public、persona_safe 或早期 clue 直接复述真相。'
        ].join('\n');
    }

    function normalizeCompileDraft(raw) {
        var d = isObject(raw) ? clone(raw) : {};
        d.claims = isArray(d.claims) ? d.claims : [];
        d.public_atoms = isArray(d.public_atoms) ? d.public_atoms : [];
        d.wake_aliases = isArray(d.wake_aliases) ? d.wake_aliases : [];
        d.jurisdiction = isArray(d.jurisdiction) ? d.jurisdiction : [];
        d.conditions = isArray(d.conditions) ? d.conditions : [];
        d.clues = isArray(d.clues) ? d.clues : [];
        d.stage_plans = isObject(d.stage_plans) ? d.stage_plans : {};
        d.persona_safe = isObject(d.persona_safe) ? d.persona_safe : {};
        d.initial_public_version = trim(d.initial_public_version);
        d.initial_public_anchor = trim(d.initial_public_anchor);

        for (var i = 0; i < d.claims.length; i++) {
            if (!isObject(d.claims[i])) d.claims[i] = {};
            if (!d.claims[i].claim_id) d.claims[i].claim_id = 'C' + ('0' + (i + 1)).slice(-2);
            d.claims[i].text = trim(d.claims[i].text);
            d.claims[i].fingerprints = uniqueStrings(d.claims[i].fingerprints || []);
        }
        for (var p = 0; p < d.public_atoms.length; p++) {
            if (!isObject(d.public_atoms[p])) d.public_atoms[p] = {};
            if (!d.public_atoms[p].atom_id) d.public_atoms[p].atom_id = 'P' + ('0' + (p + 1)).slice(-2);
            d.public_atoms[p].text = trim(d.public_atoms[p].text);
            if (d.public_atoms[p].source !== 'user_text') d.public_atoms[p].source = 'author';
        }
        d.wake_aliases = uniqueStrings(d.wake_aliases);
        d.jurisdiction = uniqueStrings(d.jurisdiction);

        for (var c = 0; c < d.conditions.length; c++) {
            if (!isObject(d.conditions[c])) d.conditions[c] = {};
            if (!d.conditions[c].cond_id) d.conditions[c].cond_id = 'K' + ('0' + (c + 1)).slice(-2);
            if (typeof d.conditions[c].sticky !== 'boolean') d.conditions[c].sticky = true;
            if (!d.conditions[c].override_targets) d.conditions[c].override_targets = [];
        }
        for (var q = 0; q < d.clues.length; q++) {
            if (!isObject(d.clues[q])) d.clues[q] = {};
            var clue = d.clues[q];
            if (!clue.clue_id) clue.clue_id = 'CL' + ('0' + (q + 1)).slice(-2);
            if (clue.priority !== 'urgent') clue.priority = 'normal';
            clue.allowed_claim_ids = uniqueStrings(clue.allowed_claim_ids || []);
            clue.safe_variants = isArray(clue.safe_variants) ? clue.safe_variants : [];
            for (var v = 0; v < clue.safe_variants.length; v++) {
                if (!isObject(clue.safe_variants[v])) clue.safe_variants[v] = {};
                var variant = clue.safe_variants[v];
                if (!variant.variant_id) variant.variant_id = clue.clue_id + '_V' + (v + 1);
                variant.surface = trim(variant.surface);
                variant.anchor_text = trim(variant.anchor_text);
                if (!isObject(variant.probe)) variant.probe = { groups: [], hit_threshold: 1, exclude: [] };
                variant.probe.groups = isArray(variant.probe.groups) ? variant.probe.groups : [];
                variant.probe.exclude = uniqueStrings(variant.probe.exclude || []);
            }
        }

        var ps = d.persona_safe;
        ps.awareness_by_layer = isObject(ps.awareness_by_layer) ? ps.awareness_by_layer : {};
        ps.stance_by_layer = isObject(ps.stance_by_layer) ? ps.stance_by_layer : {};
        ps.concealment_style = trim(ps.concealment_style);
        ps.tell_pool = uniqueStrings(ps.tell_pool || []);
        ps.exposure_response = uniqueStrings(ps.exposure_response || []);
        ps.subjective_script_by_layer = isObject(ps.subjective_script_by_layer) ? ps.subjective_script_by_layer : {};
        ps.subjective_anchor_by_layer = isObject(ps.subjective_anchor_by_layer) ? ps.subjective_anchor_by_layer : {};
        for (var l = 0; l < LAYERS.length; l++) {
            var layer = LAYERS[l];
            if (AWARENESS.indexOf(ps.awareness_by_layer[layer]) < 0) ps.awareness_by_layer[layer] = 'partial';
            ps.stance_by_layer[layer] = trim(ps.stance_by_layer[layer]);
            ps.subjective_script_by_layer[layer] = trim(ps.subjective_script_by_layer[layer]);
            ps.subjective_anchor_by_layer[layer] = trim(ps.subjective_anchor_by_layer[layer]);
            d.stage_plans[layer] = isArray(d.stage_plans[layer]) ? d.stage_plans[layer] : [];
        }
        return d;
    }

    function duplicateIds(items, key) {
        var seen = {};
        var dup = [];
        for (var i = 0; i < items.length; i++) {
            var id = String(items[i] && items[i][key] || '');
            if (!id) continue;
            if (seen[id]) dup.push(id);
            seen[id] = true;
        }
        return uniqueStrings(dup);
    }

    function scanUnlicensed(text, claims, allowedIds) {
        var allowed = {};
        var hits = [];
        for (var i = 0; i < (allowedIds || []).length; i++) allowed[String(allowedIds[i])] = true;
        for (var c = 0; c < claims.length; c++) {
            var claim = claims[c];
            if (allowed[claim.claim_id]) continue;
            for (var f = 0; f < claim.fingerprints.length; f++) {
                if (claim.fingerprints[f] && containsCI(text, claim.fingerprints[f])) {
                    hits.push(claim.claim_id + ':' + claim.fingerprints[f]);
                }
            }
        }
        return uniqueStrings(hits);
    }

    function validateProbe(probe, path, errors) {
        if (!isObject(probe)) { errors.push(path + ' 缺 probe'); return; }
        var groups = probe.groups;
        if (!isArray(groups) || !groups.length || groups.length > 6) {
            errors.push(path + '.groups 必须为1-6组'); return;
        }
        var threshold = parseInt(probe.hit_threshold, 10);
        if (threshold < 1 || threshold > groups.length) errors.push(path + '.hit_threshold 越界');
        if (!isArray(probe.exclude) || probe.exclude.length > 4) errors.push(path + '.exclude 最多4项');
        var hasShort = false;
        var phraseSeen = {};
        for (var g = 0; g < groups.length; g++) {
            var group = groups[g];
            if (!isObject(group) || (group.logic !== 'all' && group.logic !== 'any')) {
                errors.push(path + '.groups[' + g + '] logic 非法'); continue;
            }
            if (!isArray(group.phrases) || !group.phrases.length || group.phrases.length > 3) {
                errors.push(path + '.groups[' + g + '] phrases 必须为1-3项'); continue;
            }
            if (group.logic === 'all' && group.phrases.length < 2) errors.push(path + '.groups[' + g + '] all组至少2词');
            for (var p = 0; p < group.phrases.length; p++) {
                var phrase = trim(group.phrases[p]);
                if (!phrase) errors.push(path + '.groups[' + g + '] 有空短语');
                if (phrase.length < 4) hasShort = true;
                var key = phrase.toLowerCase();
                if (phraseSeen[key]) errors.push(path + ' 跨组重复短语：' + phrase);
                phraseSeen[key] = true;
            }
        }
        if (hasShort && threshold < 3) errors.push(path + ' 含短词时 threshold 必须≥3');
        if (!hasShort && threshold < 3) {
            for (var a = 0; a < groups.length; a++) {
                if (groups[a].logic === 'any') {
                    for (var b = 0; b < groups[a].phrases.length; b++) {
                        if (trim(groups[a].phrases[b]).length < 4) errors.push(path + ' 低阈值 any 短语须≥4字');
                    }
                }
            }
        }
    }

    function validateCompileShape(d, errors) {
        if (!exactKeys(d, ['claims', 'initial_public_version', 'initial_public_anchor', 'public_atoms',
            'wake_aliases', 'jurisdiction', 'persona_safe', 'conditions', 'stage_plans', 'clues'])) {
            errors.push('编译顶层字段不完整或含额外通道');
        }
        for (var i = 0; i < d.claims.length; i++) {
            if (!exactKeys(d.claims[i], ['claim_id', 'text', 'layer', 'earliest_stage', 'fingerprints'])) errors.push('claim 字段非法：' + (d.claims[i].claim_id || i));
        }
        for (var a = 0; a < d.public_atoms.length; a++) {
            if (!exactKeys(d.public_atoms[a], ['atom_id', 'text', 'source'])) errors.push('public_atom 字段非法：' + (d.public_atoms[a].atom_id || a));
        }
        var persona = d.persona_safe;
        if (!exactKeys(persona, ['awareness_by_layer', 'stance_by_layer', 'concealment_style', 'tell_pool',
            'exposure_response', 'subjective_script_by_layer', 'subjective_anchor_by_layer'])) errors.push('persona_safe 字段非法');
        var personaMaps = ['awareness_by_layer', 'stance_by_layer', 'subjective_script_by_layer', 'subjective_anchor_by_layer'];
        for (var pm = 0; pm < personaMaps.length; pm++) {
            if (!exactKeys(persona[personaMaps[pm]], LAYERS)) errors.push('persona_safe.' + personaMaps[pm] + ' 必须恰含三层');
        }
        for (var c = 0; c < d.conditions.length; c++) {
            var condition = d.conditions[c];
            if (!exactKeys(condition, ['cond_id', 'kind', 'spec', 'target', 'override_targets', 'sticky'])) errors.push('condition 字段非法：' + (condition.cond_id || c));
            if (!exactKeys(condition.target, ['layer', 'stage'])) errors.push('condition target 字段非法：' + (condition.cond_id || c));
            var specKeys = condition.kind === 'evidence' ? ['clue_ids', 'logic']
                : (condition.kind === 'keyword_event' ? ['aliases', 'logic'] : ['text']);
            if (!exactKeys(condition.spec, specKeys)) errors.push('condition spec 字段非法：' + (condition.cond_id || c));
            for (var ot = 0; ot < (isArray(condition.override_targets) ? condition.override_targets : []).length; ot++) {
                if (!exactKeys(condition.override_targets[ot], ['layer', 'max_stage'])) errors.push('override_target 字段非法：' + (condition.cond_id || c));
            }
        }
        if (!exactKeys(d.stage_plans, LAYERS)) errors.push('stage_plans 必须恰含三层');
        for (var l = 0; l < LAYERS.length; l++) {
            var plans = d.stage_plans[LAYERS[l]] || [];
            for (var sp = 0; sp < plans.length; sp++) {
                if (!exactKeys(plans[sp], ['stage_id', 'entry', 'min_gap', 'override_condition_ids', 'clue_ids'])) errors.push(LAYERS[l] + ' stage_plan 字段非法：' + sp);
                if (!exactKeys(plans[sp] && plans[sp].entry, ['condition_ids', 'logic'])) errors.push(LAYERS[l] + ' stage_plan.entry 字段非法：' + sp);
            }
        }
        for (var q = 0; q < d.clues.length; q++) {
            var clue = d.clues[q];
            if (!exactKeys(clue, ['clue_id', 'layer', 'stage', 'priority', 'nature', 'allowed_claim_ids', 'safe_variants'])) errors.push('clue 字段非法：' + (clue.clue_id || q));
            for (var v = 0; v < clue.safe_variants.length; v++) {
                var variant = clue.safe_variants[v];
                if (!exactKeys(variant, ['variant_id', 'surface', 'anchor_text', 'probe'])) errors.push('variant 字段非法：' + (variant.variant_id || v));
                if (!exactKeys(variant.probe, ['groups', 'hit_threshold', 'exclude'])) errors.push('probe 字段非法：' + (variant.variant_id || v));
                var groups = variant.probe && variant.probe.groups || [];
                for (var g = 0; g < groups.length; g++) if (!exactKeys(groups[g], ['phrases', 'logic'])) errors.push('probe group 字段非法：' + (variant.variant_id || v));
            }
        }
    }

    function validateCompileDraft(draft, sourceSecret) {
        var errors = [];
        var warnings = [];
        if (!isObject(draft)) return { errors: ['编译结果不是对象'], warnings: [] };
        var d = normalizeCompileDraft(draft);
        validateCompileShape(d, errors);
        if (!sourceSecret || sourceSecret.length > 2000) errors.push('source_secret 必须为1-2000字');
        if (!d.initial_public_version || d.initial_public_version.length > 500) errors.push('initial_public_version 必须为1-500字');
        if (!d.initial_public_anchor || d.initial_public_anchor.length > 80) errors.push('initial_public_anchor 必须为1-80字');
        if (!d.claims.length || d.claims.length > 24) errors.push('claims 必须为1-24条');
        if (d.public_atoms.length > 40) errors.push('public_atoms 最多40条');
        if (d.wake_aliases.length > 20) errors.push('wake_aliases 最多20项');
        if (d.jurisdiction.length > 20) errors.push('jurisdiction 最多20项');
        if (d.clues.length > 36) errors.push('clues 最多36条');
        if (d.conditions.length > 40) errors.push('conditions 最多40条');
        for (var ju = 0; ju < d.jurisdiction.length; ju++) {
            if (!d.jurisdiction[ju] || d.jurisdiction[ju].length > 60) errors.push('jurisdiction 单项必须为1-60字');
        }

        var dupClaims = duplicateIds(d.claims, 'claim_id');
        var dupClues = duplicateIds(d.clues, 'clue_id');
        var dupConds = duplicateIds(d.conditions, 'cond_id');
        var dupAtoms = duplicateIds(d.public_atoms, 'atom_id');
        if (dupClaims.length) errors.push('重复 claim_id：' + dupClaims.join(','));
        if (dupClues.length) errors.push('重复 clue_id：' + dupClues.join(','));
        if (dupConds.length) errors.push('重复 cond_id：' + dupConds.join(','));
        if (dupAtoms.length) errors.push('重复 atom_id：' + dupAtoms.join(','));
        var claimMap = indexBy(d.claims, 'claim_id');
        var clueMap = indexBy(d.clues, 'clue_id');
        var condMap = indexBy(d.conditions, 'cond_id');

        for (var i = 0; i < d.claims.length; i++) {
            var claim = d.claims[i];
            if (!validId(claim.claim_id)) errors.push('claim_id 非法：' + claim.claim_id);
            if (!claim.text || claim.text.length > 120) errors.push('claim ' + claim.claim_id + ' text 必须为1-120字');
            if (layerIndex(claim.layer) < 0) errors.push('claim ' + claim.claim_id + ' layer 非法');
            if (stageIndex(claim.earliest_stage) < 0) errors.push('claim ' + claim.claim_id + ' earliest_stage 非法');
            if (!claim.fingerprints.length || claim.fingerprints.length > 6) errors.push('claim ' + claim.claim_id + ' fingerprints 必须为1-6项');
            for (var fp = 0; fp < claim.fingerprints.length; fp++) {
                if (!claim.fingerprints[fp] || claim.fingerprints[fp].length > 60) errors.push('claim ' + claim.claim_id + ' fingerprint 必须为1-60字');
                if (claim.fingerprints[fp].length < 4) warnings.push('claim ' + claim.claim_id + ' 含短指纹“' + claim.fingerprints[fp] + '”，请作者重点预览');
            }
        }

        for (var pa = 0; pa < d.public_atoms.length; pa++) {
            var atom = d.public_atoms[pa];
            if (!validId(atom.atom_id)) errors.push('atom_id 非法：' + atom.atom_id);
            if (!atom.text || atom.text.length > 60) errors.push('public_atom ' + atom.atom_id + ' 必须为1-60字');
            if (atom.source !== 'author' && atom.source !== 'user_text') errors.push('public_atom ' + atom.atom_id + ' source 非法');
        }
        for (var wa = 0; wa < d.wake_aliases.length; wa++) if (d.wake_aliases[wa].length > 30) errors.push('wake_alias 超过30字');

        var publicTexts = [d.initial_public_version, d.initial_public_anchor];
        for (var pt = 0; pt < d.public_atoms.length; pt++) publicTexts.push(d.public_atoms[pt].text);
        for (var px = 0; px < publicTexts.length; px++) {
            var pHits = scanUnlicensed(publicTexts[px], d.claims, []);
            if (pHits.length) errors.push('公开文本命中隐藏指纹：' + pHits.join(','));
        }

        for (var co = 0; co < d.conditions.length; co++) {
            var condition = d.conditions[co];
            if (!validId(condition.cond_id)) errors.push('cond_id 非法：' + condition.cond_id);
            if (['evidence', 'keyword_event', 'relation', 'world_event'].indexOf(condition.kind) < 0) errors.push('condition ' + condition.cond_id + ' kind 非法');
            if (!isObject(condition.target) || layerIndex(condition.target.layer) < 0 || stageIndex(condition.target.stage) < 0) errors.push('condition ' + condition.cond_id + ' target 非法');
            if (!isArray(condition.override_targets) || condition.override_targets.length > 3) errors.push('condition ' + condition.cond_id + ' override_targets 非法');
            for (var oo = 0; oo < (isArray(condition.override_targets) ? condition.override_targets : []).length; oo++) {
                var overrideTarget = condition.override_targets[oo];
                if (!isObject(overrideTarget) || overrideTarget.layer !== 'fact' || stageIndex(overrideTarget.max_stage) < 0) {
                    errors.push('condition ' + condition.cond_id + ' 越闸只能指向合法事实层档位');
                }
            }
            if (!isObject(condition.spec)) errors.push('condition ' + condition.cond_id + ' spec 缺失');
            else if (condition.kind === 'evidence') {
                if (!isArray(condition.spec.clue_ids) || !condition.spec.clue_ids.length || condition.spec.clue_ids.length > 5) errors.push('condition ' + condition.cond_id + ' evidence.clue_ids 非法');
                if (condition.spec.logic !== 'all' && condition.spec.logic !== 'any') errors.push('condition ' + condition.cond_id + ' evidence.logic 非法');
                for (var ec = 0; ec < (isArray(condition.spec.clue_ids) ? condition.spec.clue_ids : []).length; ec++) {
                    if (!clueMap[condition.spec.clue_ids[ec]]) errors.push('condition ' + condition.cond_id + ' 引用未知 clue ' + condition.spec.clue_ids[ec]);
                }
            } else if (condition.kind === 'keyword_event') {
                if (!isArray(condition.spec.aliases) || !condition.spec.aliases.length || condition.spec.aliases.length > 5) errors.push('condition ' + condition.cond_id + ' keyword aliases 非法');
                if (condition.spec.logic !== 'all' && condition.spec.logic !== 'any') errors.push('condition ' + condition.cond_id + ' keyword logic 非法');
                for (var ka = 0; ka < (isArray(condition.spec.aliases) ? condition.spec.aliases : []).length; ka++) {
                    if (!trim(condition.spec.aliases[ka]) || trim(condition.spec.aliases[ka]).length > 30) errors.push('condition ' + condition.cond_id + ' keyword alias 必须为1-30字');
                }
            } else if ((condition.kind === 'relation' || condition.kind === 'world_event') && (!trim(condition.spec.text) || trim(condition.spec.text).length > 60)) {
                errors.push('condition ' + condition.cond_id + ' text 必须为1-60字');
            }
        }

        for (var ci = 0; ci < d.clues.length; ci++) {
            var clue = d.clues[ci];
            if (!validId(clue.clue_id)) errors.push('clue_id 非法：' + clue.clue_id);
            if (layerIndex(clue.layer) < 0 || stageIndex(clue.stage) < 0) errors.push('clue ' + clue.clue_id + ' layer/stage 非法');
            if (['fact', 'rumor', 'statement', 'observation'].indexOf(clue.nature) < 0) errors.push('clue ' + clue.clue_id + ' nature 非法');
            if (clue.priority !== 'normal' && clue.priority !== 'urgent') errors.push('clue ' + clue.clue_id + ' priority 非法');
            if (clue.allowed_claim_ids.length > 3) errors.push('clue ' + clue.clue_id + ' allowed_claim_ids 超过3');
            var maxEarliest = -1;
            for (var ac = 0; ac < clue.allowed_claim_ids.length; ac++) {
                var allowedClaim = claimMap[clue.allowed_claim_ids[ac]];
                if (!allowedClaim) errors.push('clue ' + clue.clue_id + ' 引用未知 claim ' + clue.allowed_claim_ids[ac]);
                else {
                    if (allowedClaim.layer !== clue.layer) errors.push('clue ' + clue.clue_id + ' 跨层引用 claim ' + allowedClaim.claim_id);
                    maxEarliest = Math.max(maxEarliest, stageIndex(allowedClaim.earliest_stage));
                }
            }
            if (maxEarliest > stageIndex(clue.stage)) errors.push('clue ' + clue.clue_id + ' 早于 claim 最早档位');
            if (!clue.safe_variants.length || clue.safe_variants.length > 3) errors.push('clue ' + clue.clue_id + ' variants 必须为1-3项');
            var variantIds = duplicateIds(clue.safe_variants, 'variant_id');
            if (variantIds.length) errors.push('clue ' + clue.clue_id + ' 有重复 variant_id');
            var probeShape = null;
            for (var vi = 0; vi < clue.safe_variants.length; vi++) {
                var variant = clue.safe_variants[vi];
                if (!validId(variant.variant_id)) errors.push('variant_id 非法：' + variant.variant_id);
                if (!variant.surface || variant.surface.length > 200) errors.push(clue.clue_id + '/' + variant.variant_id + ' surface 必须为1-200字');
                if (!variant.anchor_text || variant.anchor_text.length > 60) errors.push(clue.clue_id + '/' + variant.variant_id + ' anchor_text 必须为1-60字');
                var surfaceHits = scanUnlicensed(variant.surface + '\n' + variant.anchor_text, d.claims, clue.allowed_claim_ids);
                if (surfaceHits.length) errors.push(clue.clue_id + '/' + variant.variant_id + ' 命中未许可指纹：' + surfaceHits.join(','));
                validateProbe(variant.probe, clue.clue_id + '/' + variant.variant_id, errors);
                if (isObject(variant.probe) && isArray(variant.probe.groups)) {
                    var shape = safeJson({
                        group_logic: variant.probe.groups.map(function (group) { return group && group.logic; }),
                        hit_threshold: variant.probe.hit_threshold
                    });
                    if (probeShape === null) probeShape = shape;
                    else if (shape !== probeShape) errors.push('clue ' + clue.clue_id + ' 各变体须共享语义槽结构与阈值');
                }
            }
        }

        var persona = d.persona_safe;
        var plannedClues = {};
        if (persona.concealment_style.length > 60) errors.push('concealment_style 最多60字');
        if (persona.tell_pool.length > 6) errors.push('tell_pool 最多6项');
        if (persona.exposure_response.length > 4) errors.push('exposure_response 最多4项');
        for (var tp = 0; tp < persona.tell_pool.length; tp++) if (persona.tell_pool[tp].length > 80) errors.push('tell_pool 单项最多80字');
        for (var er = 0; er < persona.exposure_response.length; er++) if (persona.exposure_response[er].length > 80) errors.push('exposure_response 单项最多80字');
        var personaTexts = [persona.concealment_style].concat(persona.tell_pool, persona.exposure_response);
        for (var li = 0; li < LAYERS.length; li++) {
            var layerName = LAYERS[li];
            if (AWARENESS.indexOf(persona.awareness_by_layer[layerName]) < 0) errors.push(layerName + ' awareness 非法');
            if ((persona.stance_by_layer[layerName] || '').length > 30) errors.push(layerName + ' stance 最多30字');
            if ((persona.subjective_script_by_layer[layerName] || '').length > 300) errors.push(layerName + ' subjective_script 超过300字');
            if ((persona.subjective_anchor_by_layer[layerName] || '').length > 30) errors.push(layerName + ' subjective_anchor 超过30字');
            personaTexts.push(persona.stance_by_layer[layerName] || '');
            personaTexts.push(persona.subjective_script_by_layer[layerName] || '');
            personaTexts.push(persona.subjective_anchor_by_layer[layerName] || '');

            var hasLayerClaims = false;
            for (var hc = 0; hc < d.claims.length; hc++) if (d.claims[hc].layer === layerName) hasLayerClaims = true;
            var plans = d.stage_plans[layerName];
            if (hasLayerClaims && plans.length !== 6) errors.push(layerName + ' stage_plans 必须恰好6档');
            if (plans.length) {
                var planMap = indexBy(plans, 'stage_id');
                for (var si = 0; si < STAGES.length; si++) {
                    var plan = planMap[STAGES[si]];
                    if (!plan) { errors.push(layerName + ' 缺 stage_plan ' + STAGES[si]); continue; }
                    var entry = isObject(plan.entry) ? plan.entry : null;
                    if (!entry || !isArray(entry.condition_ids) || (entry.logic !== 'all' && entry.logic !== 'any')) errors.push(layerName + '/' + STAGES[si] + ' entry 非法');
                    if (si >= 3 && (!entry || !entry.condition_ids || !entry.condition_ids.length)) errors.push(layerName + '/' + STAGES[si] + ' entry 不得为空');
                    if (entry && entry.condition_ids && entry.condition_ids.length > 10) errors.push(layerName + '/' + STAGES[si] + ' entry 条件过多');
                    if (typeof plan.min_gap !== 'number' || plan.min_gap % 1 || plan.min_gap < 0 || plan.min_gap > 50) errors.push(layerName + '/' + STAGES[si] + ' min_gap 非法');
                    if (!isArray(plan.override_condition_ids) || plan.override_condition_ids.length > 10) errors.push(layerName + '/' + STAGES[si] + ' override_condition_ids 非法');
                    if (!isArray(plan.clue_ids) || plan.clue_ids.length > 12) errors.push(layerName + '/' + STAGES[si] + ' clue_ids 非法');
                    var entryRefs = entry && entry.condition_ids || [];
                    var overrideRefs = isArray(plan.override_condition_ids) ? plan.override_condition_ids : [];
                    var refs = entryRefs.concat(overrideRefs);
                    for (var rr = 0; rr < refs.length; rr++) if (!condMap[refs[rr]]) errors.push(layerName + '/' + STAGES[si] + ' 引用未知 condition ' + refs[rr]);
                    for (var et = 0; et < entryRefs.length; et++) {
                        var entryCondition = condMap[entryRefs[et]];
                        if (entryCondition && (!entryCondition.target || entryCondition.target.layer !== layerName || entryCondition.target.stage !== STAGES[si])) {
                            errors.push(layerName + '/' + STAGES[si] + ' entry 条件目标不一致：' + entryRefs[et]);
                        }
                    }
                    for (var orf = 0; orf < overrideRefs.length; orf++) {
                        var overrideCondition = condMap[overrideRefs[orf]];
                        var covers = false;
                        for (var ort = 0; overrideCondition && ort < (overrideCondition.override_targets || []).length; ort++) {
                            var candidateTarget = overrideCondition.override_targets[ort];
                            if (candidateTarget.layer === layerName && stageIndex(candidateTarget.max_stage) >= si) covers = true;
                        }
                        if (overrideCondition && !covers) errors.push(layerName + '/' + STAGES[si] + ' 越闸条件不覆盖该档：' + overrideRefs[orf]);
                    }
                    for (var rc = 0; rc < (isArray(plan.clue_ids) ? plan.clue_ids : []).length; rc++) {
                        var planClue = clueMap[plan.clue_ids[rc]];
                        if (!planClue) errors.push(layerName + '/' + STAGES[si] + ' 引用未知 clue ' + plan.clue_ids[rc]);
                        else {
                            if (planClue.layer !== layerName || planClue.stage !== STAGES[si]) errors.push(layerName + '/' + STAGES[si] + ' clue 归属不一致：' + planClue.clue_id);
                            if (plannedClues[planClue.clue_id]) errors.push('clue 被重复编入阶段计划：' + planClue.clue_id);
                            plannedClues[planClue.clue_id] = true;
                        }
                    }
                }
            }
        }
        for (var pc = 0; pc < d.clues.length; pc++) if (!plannedClues[d.clues[pc].clue_id]) errors.push('clue 未编入对应 stage_plan：' + d.clues[pc].clue_id);
        for (var tx = 0; tx < personaTexts.length; tx++) {
            var hiddenHits = scanUnlicensed(personaTexts[tx], d.claims, []);
            if (hiddenHits.length) errors.push('persona_safe 命中隐藏指纹：' + hiddenHits.join(','));
        }
        return { errors: uniqueStrings(errors), warnings: uniqueStrings(warnings) };
    }

    function channelLeakErrors(draft) {
        var sources = [
            { name: '角色卡', text: charCardAllText() },
            { name: '用户人设', text: personaText() },
            { name: '可读世界书', text: readableWorldBookText() }
        ];
        var errors = [];
        for (var i = 0; i < sources.length; i++) {
            if (!sources[i].text) continue;
            var hits = scanUnlicensed(sources[i].text, draft.claims, []);
            if (hits.length) errors.push(sources[i].name + '仍含受保护命题指纹：' + hits.join(','));
        }
        return errors;
    }

    function validateCompileForActivation(draft, sourceSecret) {
        var normalized = normalizeCompileDraft(draft);
        var result = validateCompileDraft(normalized, sourceSecret);
        result.errors = uniqueStrings(result.errors.concat(channelLeakErrors(normalized)));
        return result;
    }

    function compileInput(input) {
        return callModel(compilePrompt(input), 7000, 0.2).then(function (text) {
            var draft = normalizeCompileDraft(extractJson(text));
            return { draft: draft, validation: validateCompileForActivation(draft, input.source_secret) };
        });
    }

    /* ---------------- v1.5 数据装配 ---------------- */

    function defaultShieldTemplates() {
        return {
            standard: {
                honest_by_awareness: '只按角色当前确知内容回应；不知道的部分不得猜成事实。',
                as_public_only: '只沿用开局公开信息，不新增受保护范围内的事实。',
                limit_to_disclosed: '仅限已公开和已揭示内容，不确认其余推断。',
                admit_evidenced_surface: '可以承认已被证据坐实的表层事实，不解释更深理由。',
                pressured_no_new: '承受当下压力，但不以失态替代证据，也不新增事实。',
                post_reveal_fact_only: '事实层已可承认；动机与情感仍限于已释放内容。'
            },
            compact: {
                honest_by_awareness: '按当前认知回答，不把未知写成事实。',
                as_public_only: '只沿用公开信息，不新增受保护事实。',
                limit_to_disclosed: '只说已公开与已揭示内容。',
                admit_evidenced_surface: '只承认证据坐实的表层。',
                pressured_no_new: '可承压，不新增事实。',
                post_reveal_fact_only: '只开事实层，更深层仍封存。'
            }
        };
    }

    function publicAtomsMap(atoms) {
        var out = {};
        for (var i = 0; i < atoms.length; i++) out[atoms[i].atom_id] = clone(atoms[i]);
        return out;
    }

    function conditionsMap(conditions) {
        var out = {};
        for (var i = 0; i < conditions.length; i++) {
            var c = clone(conditions[i]);
            c.state = 'unmet';
            out[c.cond_id] = c;
        }
        return out;
    }

    function normalizedStagePlan(plans, pace) {
        var map = indexBy(plans || [], 'stage_id');
        var gaps = pace === 'fast' ? [1, 2, 2, 3, 3, 3]
            : (pace === 'slow' ? [3, 5, 6, 7, 7, 8] : [2, 3, 4, 5, 5, 6]);
        var out = [];
        for (var i = 0; i < STAGES.length; i++) {
            var p = clone(map[STAGES[i]] || {});
            p.stage_id = STAGES[i];
            if (!isObject(p.entry)) p.entry = { condition_ids: [], logic: 'all' };
            if (!isArray(p.entry.condition_ids)) p.entry.condition_ids = [];
            if (p.entry.logic !== 'any') p.entry.logic = 'all';
            p.min_gap = Math.max(0, parseInt(p.min_gap, 10));
            if (isNaN(p.min_gap)) p.min_gap = gaps[i];
            if (!isArray(p.override_condition_ids)) p.override_condition_ids = [];
            if (!isArray(p.clue_ids)) p.clue_ids = [];
            out.push(p);
        }
        return out;
    }

    function legacyBaseline(legacy) {
        var refs = {};
        var ledger = [];
        if (!legacy || !isArray(legacy.lights)) return { refs: refs, ledger: ledger };
        for (var i = 0; i < legacy.lights.length; i++) {
            var light = legacy.lights[i];
            var surface = trim(light && light.text);
            if (!surface || surface.length > 200) continue;
            var clueId = 'LGC' + ('000' + (i + 1)).slice(-3);
            var variantId = 'LGV' + ('000' + (i + 1)).slice(-3);
            var disclosureId = 'LGD' + ('000' + (i + 1)).slice(-3);
            var anchor = surface;
            if (anchor.length > 60) anchor = '迁移前已公开的一程光（详见迁移基线）';
            refs[clueId] = {
                legacy_variant_id: variantId,
                layer: layerIndex(light.layer) >= 0 ? light.layer : 'fact',
                surface: surface,
                anchor_text: anchor,
                readonly: true
            };
            ledger.push({
                disclosure_id: disclosureId,
                text: surface,
                source_clue: clueId,
                release_variant_id: variantId,
                delivered_claim_ids: [],
                nature: 'statement',
                anchor_text: anchor,
                origin: 'legacy_baseline',
                status: 'active',
                mesid: null,
                variant_uid: null,
                turn: null
            });
        }
        return { refs: refs, ledger: ledger };
    }

    function buildLadderFromDraft(input, draft, legacy) {
        var baseline = legacyBaseline(legacy);
        var hasFocus = false;
        var st = store();
        if (st) {
            for (var f = 0; f < st.ladders.length; f++) if (st.ladders[f].meta.focus) hasFocus = true;
        }
        var layers = {};
        for (var i = 0; i < LAYERS.length; i++) {
            var layer = LAYERS[i];
            var active = false;
            for (var c = 0; c < draft.claims.length; c++) if (draft.claims[c].layer === layer) active = true;
            layers[layer] = {
                active: active,
                stage: 'dormant',
                exposure_pressure: 0,
                stage_plan: normalizedStagePlan(draft.stage_plans[layer], input.pace),
                last_release_floor: -1
            };
        }
        var ladder = {
            schema_version: DATA_VERSION,
            meta: {
                id: uid('LAD'),
                title: trim(input.title) || '未命名的帷幕',
                play_mode: input.play_mode === 'runtime_blind' ? 'runtime_blind' : 'author',
                lifecycle_status: 'ready',
                focus: !hasFocus,
                protected: true,
                pace: input.pace,
                created_at: nowIso()
            },
            hidden_store: {
                source_secret: input.source_secret,
                claims: clone(draft.claims),
                persona_hidden: { compiler_version: DATA_VERSION, compiled_at: nowIso() }
            },
            safe_store: {
                initial_public_version: draft.initial_public_version,
                initial_public_anchor: draft.initial_public_anchor,
                public_atom_ids: draft.public_atoms.map(function (a) { return a.atom_id; }),
                public_atoms: publicAtomsMap(draft.public_atoms),
                wake_aliases: clone(draft.wake_aliases),
                clues: clone(draft.clues),
                persona_safe: clone(draft.persona_safe),
                legacy_refs: baseline.refs,
                shield_templates: defaultShieldTemplates()
            },
            control: { jurisdiction: clone(draft.jurisdiction) },
            runtime: {
                revision: 0,
                layers: layers,
                conditions: conditionsMap(draft.conditions),
                disclosures: {},
                public_ledger: baseline.ledger,
                pending: null,
                tell_usage: {},
                lineage: lineageNow(),
                manual_wake: false,
                retry_reason: null,
                needs_rebuild: false
            },
            domain_events: [],
            audit_log: [],
            derived: { actor_packet: null, packet_text: '', last_decision: null }
        };
        audit(ladder, 'compile_accept', {
            warnings: input.play_mode === 'runtime_blind' ? { count: (input.warnings || []).length } : clone(input.warnings || []),
            legacy: !!legacy
        });
        return ladder;
    }

    function normalizeLadderRuntime(ladder) {
        if (!ladder || !ladder.meta) return ladder;
        if (!ladder.runtime) ladder.runtime = {};
        if (typeof ladder.runtime.revision !== 'number') ladder.runtime.revision = 0;
        if (!ladder.runtime.layers) ladder.runtime.layers = {};
        if (!ladder.runtime.conditions) ladder.runtime.conditions = {};
        if (!ladder.runtime.disclosures) ladder.runtime.disclosures = {};
        if (!ladder.runtime.public_ledger) ladder.runtime.public_ledger = [];
        if (!ladder.runtime.tell_usage) ladder.runtime.tell_usage = {};
        if (!ladder.runtime.lineage) ladder.runtime.lineage = lineageNow();
        if (typeof ladder.runtime.retry_reason === 'string') ladder.runtime.retry_reason = { code: ladder.runtime.retry_reason };
        if (!ladder.domain_events) ladder.domain_events = [];
        if (!ladder.audit_log) ladder.audit_log = [];
        if (!ladder.derived) ladder.derived = { actor_packet: null, packet_text: '', last_decision: null };
        if (!ladder.safe_store.shield_templates) ladder.safe_store.shield_templates = defaultShieldTemplates();
        if (!ladder.safe_store.legacy_refs) ladder.safe_store.legacy_refs = {};
        if (!ladder.meta.lifecycle_status) ladder.meta.lifecycle_status = 'ready';
        ladder.meta.protected = true;
        return ladder;
    }

    function findLadder(id) {
        var st = store();
        if (!st) return null;
        for (var i = 0; i < st.ladders.length; i++) if (st.ladders[i].meta.id === id) return st.ladders[i];
        return null;
    }

    function focusedLadder() {
        var st = store();
        if (!st) return null;
        for (var i = 0; i < st.ladders.length; i++) {
            var lad = st.ladders[i];
            if (lad.meta.focus && lad.meta.lifecycle_status === 'ready') return lad;
        }
        return null;
    }

    function clueById(ladder, clueId) {
        var clues = ladder.safe_store.clues || [];
        for (var i = 0; i < clues.length; i++) if (clues[i].clue_id === clueId) return clues[i];
        return null;
    }

    function variantById(clue, variantId) {
        if (!clue) return null;
        for (var i = 0; i < clue.safe_variants.length; i++) {
            if (clue.safe_variants[i].variant_id === variantId) return clue.safe_variants[i];
        }
        return null;
    }

    function stagePlan(layerState, stage) {
        var plans = layerState && layerState.stage_plan || [];
        for (var i = 0; i < plans.length; i++) if (plans[i].stage_id === stage) return plans[i];
        return null;
    }

    /* ---------------- 条件、候选与 God 输入 ---------------- */

    function disclosureDelivered(ladder, clueId) {
        var d = ladder.runtime.disclosures[clueId];
        return !!(d && d.state === 'delivered');
    }

    function conditionMetLocal(ladder, condition, userText) {
        if (condition.kind === 'evidence') {
            var ids = condition.spec.clue_ids || [];
            var hits = 0;
            for (var i = 0; i < ids.length; i++) if (disclosureDelivered(ladder, ids[i])) hits++;
            return condition.spec.logic === 'all' ? hits === ids.length : hits > 0;
        }
        if (condition.kind === 'keyword_event') {
            var aliases = condition.spec.aliases || [];
            var found = 0;
            for (var j = 0; j < aliases.length; j++) if (containsCI(userText, aliases[j])) found++;
            return condition.spec.logic === 'all' ? found === aliases.length : found > 0;
        }
        return null;
    }

    function localConditionChanges(ladder, userText) {
        var changes = [];
        var conditions = ladder.runtime.conditions;
        var keys = Object.keys(conditions);
        for (var i = 0; i < keys.length; i++) {
            var cond = conditions[keys[i]];
            var met = conditionMetLocal(ladder, cond, userText);
            if (met === null) continue;
            var next = met ? 'met' : 'unmet';
            if (cond.sticky && cond.state === 'met') next = 'met';
            if (next !== cond.state) changes.push({ cond_id: cond.cond_id, state: next, local: true });
        }
        return changes;
    }

    function effectiveConditionState(ladder, condId, changes, godVerdicts) {
        var all = (changes || []).concat(godVerdicts || []);
        for (var i = all.length - 1; i >= 0; i--) if (all[i].cond_id === condId) return all[i].state;
        var cond = ladder.runtime.conditions[condId];
        return cond ? cond.state : 'unmet';
    }

    function entryMet(ladder, plan, changes, godVerdicts) {
        if (!plan || !plan.entry) return false;
        var ids = plan.entry.condition_ids || [];
        if (!ids.length) return true;
        var met = 0;
        for (var i = 0; i < ids.length; i++) {
            if (effectiveConditionState(ladder, ids[i], changes, godVerdicts) === 'met') met++;
        }
        return plan.entry.logic === 'any' ? met > 0 : met === ids.length;
    }

    function paceReady(layerState, targetPlan) {
        var last = layerState.last_release_floor;
        var gap = targetPlan ? targetPlan.min_gap : 0;
        if (last < 0) return floorNow() >= gap;
        return floorNow() - last >= gap;
    }

    function planAllowsClue(layerState, clue) {
        var plan = stagePlan(layerState, clue.stage);
        return !!(plan && (plan.clue_ids || []).indexOf(clue.clue_id) >= 0);
    }

    function eligibleClues(ladder, localChanges) {
        var out = [];
        var pendingId = ladder.runtime.pending && ladder.runtime.pending.packet_plan.release_clue_id;
        var clues = ladder.safe_store.clues || [];
        for (var i = 0; i < clues.length; i++) {
            var clue = clues[i];
            var layerState = ladder.runtime.layers[clue.layer];
            if (!layerState || !layerState.active || disclosureDelivered(ladder, clue.clue_id)) continue;
            if (!planAllowsClue(layerState, clue)) continue;
            if (pendingId && pendingId === clue.clue_id) continue;
            var current = stageIndex(layerState.stage);
            var target = stageIndex(clue.stage);
            var legal = target <= current && paceReady(layerState, stagePlan(layerState, clue.stage));
            if (!legal && target === current + 1) {
                var nextPlan = stagePlan(layerState, clue.stage);
                legal = entryMet(ladder, nextPlan, localChanges, []) && paceReady(layerState, nextPlan);
            }
            if (legal) out.push(clone(clue));
        }
        out.sort(function (a, b) {
            if (a.priority !== b.priority) return a.priority === 'urgent' ? -1 : 1;
            return stageIndex(a.stage) - stageIndex(b.stage);
        });
        return out.slice(0, 12);
    }

    function reviewableConditions(ladder) {
        var out = [];
        var conditions = ladder.runtime.conditions;
        var ids = Object.keys(conditions);
        for (var i = 0; i < ids.length; i++) {
            var cond = conditions[ids[i]];
            if (cond.kind === 'relation' || cond.kind === 'world_event') out.push(clone(cond));
        }
        return out.slice(0, 12);
    }

    function candidateOverrideConditions(ladder, localChanges) {
        var ids = {};
        var out = [];
        for (var l = 0; l < LAYERS.length; l++) {
            var layerState = ladder.runtime.layers[LAYERS[l]];
            if (!layerState || !layerState.active) continue;
            var plans = layerState.stage_plan || [];
            for (var p = 0; p < plans.length; p++) {
                var refs = plans[p].override_condition_ids || [];
                for (var r = 0; r < refs.length; r++) {
                    var id = refs[r];
                    var condition = ladder.runtime.conditions[id];
                    var reviewable = condition && (condition.kind === 'relation' || condition.kind === 'world_event');
                    if (!ids[id] && condition && (reviewable || effectiveConditionState(ladder, id, localChanges, []) === 'met')) {
                        ids[id] = true;
                        out.push(clone(condition));
                    }
                }
            }
        }
        return out.slice(0, 12);
    }

    function wakeReasons(ladder, localChanges) {
        var reasons = [];
        var text = latestUserText();
        var aliases = ladder.safe_store.wake_aliases || [];
        for (var i = 0; i < aliases.length; i++) {
            if (containsCI(text, aliases[i])) { reasons.push('keyword'); break; }
        }
        if (localChanges.length) reasons.push('local_condition');
        if (ladder.runtime.retry_reason) reasons.push('retry_undelivered');
        if (ladder.runtime.manual_wake) reasons.push('manual');
        var layers = ladder.runtime.layers;
        for (var l = 0; l < LAYERS.length; l++) {
            var state = layers[LAYERS[l]];
            if (!state || !state.active) continue;
            var current = stageIndex(state.stage);
            var nextPlan = current < STAGES.length - 1 ? stagePlan(state, STAGES[current + 1]) : null;
            if (nextPlan && paceReady(state, nextPlan)) { reasons.push('pace'); break; }
            var clues = ladder.safe_store.clues || [];
            for (var c = 0; c < clues.length; c++) {
                if (clues[c].layer === LAYERS[l] && stageIndex(clues[c].stage) <= current && !disclosureDelivered(ladder, clues[c].clue_id)) {
                    var cluePlan = stagePlan(state, clues[c].stage);
                    if (paceReady(state, cluePlan)) { reasons.push('pace'); break; }
                }
            }
            if (reasons.indexOf('pace') >= 0) break;
        }
        return uniqueStrings(reasons);
    }

    var GOD_OUTPUT_SCHEMA = {
        type: 'object', additionalProperties: false, required: ['verdict', 'patch', 'packet_plan'],
        properties: {
            verdict: {
                type: 'object', additionalProperties: false, required: ['action', 'reason_code'],
                properties: { action: { 'enum': ACTIONS }, reason_code: { 'enum': REASON_CODES } }
            },
            patch: {
                type: 'object', additionalProperties: false,
                properties: {
                    stage_moves: {
                        type: 'array', maxItems: 2, items: {
                            type: 'object', additionalProperties: false, required: ['layer', 'from', 'to', 'via'],
                            properties: {
                                layer: { 'enum': LAYERS }, from: { 'enum': STAGES }, to: { 'enum': STAGES },
                                via: { 'enum': ['adjacent', 'override'] }, override_cond_id: { type: 'string' }
                            }
                        }
                    },
                    pressure_set: {
                        type: 'array', maxItems: 3, items: {
                            type: 'object', additionalProperties: false, required: ['layer', 'value'],
                            properties: { layer: { 'enum': LAYERS }, value: { type: 'integer', minimum: 0, maximum: 10 } }
                        }
                    },
                    condition_verdicts: {
                        type: 'array', maxItems: 6, items: {
                            type: 'object', additionalProperties: false, required: ['cond_id', 'state'],
                            properties: { cond_id: { type: 'string' }, state: { 'enum': ['met', 'unmet'] } }
                        }
                    }
                }
            },
            packet_plan: {
                type: 'object', additionalProperties: false,
                required: ['release_clue_id', 'release_variant_id', 'release_policy', 'boundary_policy', 'anchor_scope', 'focus_layer'],
                properties: {
                    release_clue_id: { type: ['string', 'null'] },
                    release_variant_id: { type: ['string', 'null'] },
                    release_policy: { 'enum': RELEASE_POLICIES },
                    focus_layer: { 'enum': LAYERS },
                    boundary_policy: { 'enum': BOUNDARY_POLICIES },
                    behavior_refs: { type: 'array', maxItems: 2, items: { type: 'integer', minimum: 0 } },
                    anchor_scope: { 'enum': ['initial_only', 'initial_plus_disclosed'] }
                }
            }
        }
    };

    function buildGodContext(ladder) {
        var localChanges = localConditionChanges(ladder, latestUserText());
        var retryLocal = ladder.runtime.retry_reason && ladder.runtime.retry_reason.local_condition_changes || [];
        var localById = {};
        for (var rl = 0; rl < localChanges.length; rl++) localById[localChanges[rl].cond_id] = true;
        for (var ri = 0; ri < retryLocal.length; ri++) {
            var retryCondition = ladder.runtime.conditions[retryLocal[ri].cond_id];
            if (!localById[retryLocal[ri].cond_id] && retryCondition && retryCondition.sticky && retryLocal[ri].state === 'met') {
                localChanges.push({ cond_id: retryLocal[ri].cond_id, state: 'met', local: true, retry: true });
                localById[retryLocal[ri].cond_id] = true;
            }
        }
        var eligible = eligibleClues(ladder, localChanges);
        var reviewable = takeWholeItems(reviewableConditions(ladder), 2000);
        var overrides = takeWholeItems(candidateOverrideConditions(ladder, localChanges), 1600);
        var claimMap = indexBy(ladder.hidden_store.claims, 'claim_id');
        var needed = {};
        var claims = [];
        var candidateView = [];
        var candidates = [];
        var candidateChars = 2;
        var claimChars = 2;
        for (var q = 0; q < eligible.length; q++) {
            var clue = eligible[q];
            var view = {
                clue_id: clue.clue_id, layer: clue.layer, stage: clue.stage,
                priority: clue.priority, nature: clue.nature,
                allowed_claim_ids: clone(clue.allowed_claim_ids),
                variants: clue.safe_variants.map(function (v) {
                    return { variant_id: v.variant_id, surface: v.surface, anchor_text: v.anchor_text };
                })
            };
            var candidateSize = safeJson(view).length + (candidateView.length ? 1 : 0);
            var addedClaims = [];
            var addedClaimSize = 0;
            for (var ac = 0; ac < clue.allowed_claim_ids.length; ac++) {
                var allowedId = clue.allowed_claim_ids[ac];
                if (!needed[allowedId] && claimMap[allowedId]) {
                    addedClaims.push(claimMap[allowedId]);
                    addedClaimSize += safeJson(claimMap[allowedId]).length + (claims.length + addedClaims.length > 1 ? 1 : 0);
                }
            }
            if (candidateChars + candidateSize > 3600 || claimChars + addedClaimSize > 5000) continue;
            candidateView.push(view);
            candidates.push(clone(clue));
            candidateChars += candidateSize;
            for (var nc = 0; nc < addedClaims.length; nc++) {
                needed[addedClaims[nc].claim_id] = true;
                claims.push(clone(addedClaims[nc]));
            }
            claimChars += addedClaimSize;
        }
        for (var c = 0; c < ladder.hidden_store.claims.length; c++) {
            var claim = ladder.hidden_store.claims[c];
            var layerState = ladder.runtime.layers[claim.layer];
            var claimSize = safeJson(claim).length + (claims.length ? 1 : 0);
            if (!needed[claim.claim_id] && layerState && layerState.active && claimChars + claimSize <= 5000) {
                claims.push(clone(claim));
                claimChars += claimSize;
            }
        }
        return {
            local_changes: localChanges,
            candidates: candidates,
            candidate_view: candidateView,
            candidate_ids: candidateView.map(function (x) { return x.clue_id; }),
            reviewable: reviewable,
            reviewable_ids: reviewable.map(function (x) { return x.cond_id; }),
            candidate_overrides: overrides,
            override_ids: overrides.map(function (x) { return x.cond_id; }),
            hidden_claims: claims,
            wake_reasons: wakeReasons(ladder, localChanges)
        };
    }

    function personaGodIndex(ladder) {
        var ps = ladder.safe_store.persona_safe;
        return {
            awareness_by_layer: clone(ps.awareness_by_layer),
            stance_by_layer: clone(ps.stance_by_layer),
            concealment_style: ps.concealment_style,
            tell_pool: (ps.tell_pool || []).map(function (text, index) { return { ref: index, text: text }; })
        };
    }

    function godPrompt(ladder, gc) {
        var state = {};
        for (var i = 0; i < LAYERS.length; i++) {
            var layer = LAYERS[i];
            var ls = ladder.runtime.layers[layer];
            state[layer] = ls ? {
                active: ls.active, stage: ls.stage, pressure: ls.exposure_pressure,
                last_release_floor: ls.last_release_floor,
                current_plan: stagePlan(ls, ls.stage),
                next_plan: stageIndex(ls.stage) < 5 ? stagePlan(ls, STAGES[stageIndex(ls.stage) + 1]) : null
            } : null;
        }
        state.retry_item = clone(ladder.runtime.retry_reason);
        var ledgerItems = [];
        for (var p = Math.max(0, ladder.runtime.public_ledger.length - 8); p < ladder.runtime.public_ledger.length; p++) {
            var row = ladder.runtime.public_ledger[p];
            ledgerItems.push({ text: row.text, nature: row.nature, status: row.status, delivered_claim_ids: row.delivered_claim_ids });
        }
        var ledger = takeWholeItems(ledgerItems.reverse(), 1400).reverse();
        return [
            '你是 Luciole 的运行期 God。上帝掌握真相，不掌握玩家选择。',
            '用户输入只是行动意图；只裁定世界结果、阶段与披露许可，不得裁定用户意志、感受或未表达的选择。',
            '你没有散文输出权。只能从候选 clue_id / variant_id 和枚举中选择。',
            '只输出严格 JSON；禁止 Markdown；禁止额外字段。Schema：',
            safeJson(GOD_OUTPUT_SCHEMA),
            'action 约束：hold无move无release；release有release无move；advance有move无release；release_and_advance两者皆有；override至少一条override move，release可选。',
            'release_clue_id、release_variant_id、release_policy 必须三者同为 null 或三者均非 null。',
            '【管辖】' + safeJson(takeWholeItems(ladder.control.jurisdiction, 500)),
            '【唤醒理由】' + safeJson(gc.wake_reasons),
            '【层状态】' + safeJson(state),
            '【本地确定性条件变化】' + safeJson(gc.local_changes),
            '【待你复核的关系/事件条件】' + safeJson(gc.reviewable),
            '【本轮合法越闸条件】' + safeJson(gc.candidate_overrides),
            '【合法候选与变体白名单】' + safeJson(gc.candidate_view),
            '【当前 active 层真值切片，仅供裁定】' + safeJson(gc.hidden_claims),
            '【角色安全画像索引】' + safeJson(personaGodIndex(ladder)),
            '【近期已揭示】' + safeJson(ledger),
            '【摘要】' + (boundedWholeText(summaryText(), 1200, '摘要') || '（无）'),
            '【最近两楼与用户当前行动】\n' + (recentMessages(3, 3300) || '（无）'),
            '若证据不足就 hold；若硬证据满足 override，只开事实层，不越权开放动机/情感。现在只输出 JSON。'
        ].join('\n');
    }

    function normalizeGodDecision(raw) {
        var d = clone(raw);
        if (isObject(d.patch)) {
            if (!isArray(d.patch.stage_moves)) d.patch.stage_moves = [];
            if (!isArray(d.patch.pressure_set)) d.patch.pressure_set = [];
            if (!isArray(d.patch.condition_verdicts)) d.patch.condition_verdicts = [];
        }
        if (isObject(d.packet_plan) && !isArray(d.packet_plan.behavior_refs)) d.packet_plan.behavior_refs = [];
        return d;
    }

    function validateGodDecision(ladder, raw, gc) {
        var errors = [];
        if (!exactKeys(raw, ['verdict', 'patch', 'packet_plan'])) return { errors: ['God 顶层字段非法'] };
        if (!exactKeys(raw.verdict, ['action', 'reason_code'])) errors.push('verdict 字段非法');
        if (!allowedKeys(raw.patch, ['stage_moves', 'pressure_set', 'condition_verdicts'])) errors.push('patch 字段非法');
        if (!allowedKeys(raw.packet_plan, ['release_clue_id', 'release_variant_id', 'release_policy', 'focus_layer', 'boundary_policy', 'behavior_refs', 'anchor_scope']) ||
            !hasKeys(raw.packet_plan, ['release_clue_id', 'release_variant_id', 'release_policy', 'focus_layer', 'boundary_policy', 'anchor_scope'])) errors.push('packet_plan 字段非法');
        if (errors.length) return { errors: errors };
        var d = normalizeGodDecision(raw);
        if (ACTIONS.indexOf(d.verdict.action) < 0) errors.push('action 非法');
        if (REASON_CODES.indexOf(d.verdict.reason_code) < 0) errors.push('reason_code 非法');
        var p = d.packet_plan;
        var triple = [p.release_clue_id, p.release_variant_id, p.release_policy];
        var nulls = 0;
        for (var t = 0; t < triple.length; t++) if (triple[t] === null) nulls++;
        if (nulls !== 0 && nulls !== 3) errors.push('release 三元组必须同空同有');
        if (RELEASE_POLICIES.indexOf(p.release_policy) < 0) errors.push('release_policy 非法');
        if (layerIndex(p.focus_layer) < 0) errors.push('focus_layer 非法');
        else if (!ladder.runtime.layers[p.focus_layer] || !ladder.runtime.layers[p.focus_layer].active) errors.push('focus_layer 必须是 active 层');
        if (BOUNDARY_POLICIES.indexOf(p.boundary_policy) < 0) errors.push('boundary_policy 非法');
        if (['initial_only', 'initial_plus_disclosed'].indexOf(p.anchor_scope) < 0) errors.push('anchor_scope 非法');
        if (!isArray(p.behavior_refs) || p.behavior_refs.length > 2) errors.push('behavior_refs 非法');
        var tellPool = ladder.safe_store.persona_safe.tell_pool || [];
        var behaviorSeen = {};
        for (var br = 0; br < (p.behavior_refs || []).length; br++) {
            if (typeof p.behavior_refs[br] !== 'number' || p.behavior_refs[br] < 0 || p.behavior_refs[br] >= tellPool.length) errors.push('behavior_ref 越界');
            if (behaviorSeen[p.behavior_refs[br]]) errors.push('behavior_ref 重复');
            behaviorSeen[p.behavior_refs[br]] = true;
            var used = ladder.runtime.tell_usage[p.behavior_refs[br]];
            if (typeof used === 'number' && floorNow() - used < 4) errors.push('behavior_ref 尚在冷却');
        }
        var hasRelease = nulls === 0;
        var moves = d.patch.stage_moves;
        if (moves.length > 2) errors.push('stage_moves 超过2');
        if (d.patch.pressure_set.length > 3) errors.push('pressure_set 超过3');
        if (d.patch.condition_verdicts.length > 6) errors.push('condition_verdicts 超过6');
        var action = d.verdict.action;
        if (action === 'hold' && (moves.length || hasRelease)) errors.push('hold 组合非法');
        if (action === 'release' && (!hasRelease || moves.length)) errors.push('release 组合非法');
        if (action === 'advance' && (hasRelease || !moves.length)) errors.push('advance 组合非法');
        if (action === 'release_and_advance' && (!hasRelease || !moves.length)) errors.push('release_and_advance 组合非法');
        if (action === 'override') {
            var hasOverride = false;
            for (var ov = 0; ov < moves.length; ov++) if (moves[ov].via === 'override') hasOverride = true;
            if (!moves.length || !hasOverride) errors.push('override 组合非法');
        }
        var verdictIds = {};
        for (var cv = 0; cv < d.patch.condition_verdicts.length; cv++) {
            var verdict = d.patch.condition_verdicts[cv];
            if (!exactKeys(verdict, ['cond_id', 'state'])) { errors.push('condition_verdict 字段非法'); continue; }
            if ((gc.reviewable_ids || []).indexOf(verdict.cond_id) < 0 || (verdict.state !== 'met' && verdict.state !== 'unmet')) errors.push('condition_verdict 越权');
            if (verdictIds[verdict.cond_id]) errors.push('condition_verdict 重复');
            verdictIds[verdict.cond_id] = true;
            var condition = ladder.runtime.conditions[verdict.cond_id];
            if (condition && condition.sticky && verdict.state === 'unmet') errors.push('sticky condition 不可判为 unmet');
        }
        var moveLayers = {};
        for (var sm = 0; sm < moves.length; sm++) {
            var move = moves[sm];
            if (!isObject(move)) { errors.push('stage_move 字段非法'); continue; }
            var requiredMoveKeys = move && move.via === 'override'
                ? ['layer', 'from', 'to', 'via', 'override_cond_id']
                : ['layer', 'from', 'to', 'via'];
            if (!exactKeys(move, requiredMoveKeys)) { errors.push('stage_move 字段非法'); continue; }
            if (moveLayers[move.layer]) errors.push('同层 stage_move 重复');
            moveLayers[move.layer] = true;
            var ls = ladder.runtime.layers[move.layer];
            if (!ls || move.from !== ls.stage) errors.push('stage_move.from 与当前态不符');
            var moveEnumsValid = layerIndex(move.layer) >= 0 && stageIndex(move.from) >= 0 && stageIndex(move.to) >= 0 &&
                (move.via === 'adjacent' || move.via === 'override');
            if (!moveEnumsValid) errors.push('stage_move 枚举非法');
            if (!ls || !moveEnumsValid) continue;
            if (move.via === 'adjacent') {
                if (stageIndex(move.to) !== stageIndex(move.from) + 1) errors.push('adjacent 必须前进一档');
                var targetPlan = stagePlan(ls, move.to);
                if (!entryMet(ladder, targetPlan, gc.local_changes, d.patch.condition_verdicts)) errors.push('目标阶段 entry 未满足');
                if (!paceReady(ls, targetPlan)) errors.push('目标阶段 min_gap 未满足');
            } else {
                var cond = ladder.runtime.conditions[move.override_cond_id];
                if ((gc.override_ids || []).indexOf(move.override_cond_id) < 0) errors.push('override condition 不在本轮白名单');
                if (!cond || effectiveConditionState(ladder, move.override_cond_id, gc.local_changes, d.patch.condition_verdicts) !== 'met') errors.push('override 条件未满足');
                var targetOk = false;
                for (var ot = 0; cond && ot < (cond.override_targets || []).length; ot++) {
                    var target = cond.override_targets[ot];
                    if (target.layer === move.layer && stageIndex(move.to) <= stageIndex(target.max_stage)) targetOk = true;
                }
                if (!targetOk) errors.push('override 目标越权');
            }
        }
        var pressureLayers = {};
        for (var ps = 0; ps < d.patch.pressure_set.length; ps++) {
            var pressure = d.patch.pressure_set[ps];
            if (!exactKeys(pressure, ['layer', 'value'])) { errors.push('pressure_set 非法'); continue; }
            if (layerIndex(pressure.layer) < 0 || typeof pressure.value !== 'number' ||
                pressure.value % 1 || pressure.value < 0 || pressure.value > 10) errors.push('pressure_set 非法');
            if (pressureLayers[pressure.layer]) errors.push('pressure_set 同层重复');
            pressureLayers[pressure.layer] = true;
        }
        if (hasRelease) {
            var clue = clueById(ladder, p.release_clue_id);
            if (!clue || (gc.candidate_ids || []).indexOf(p.release_clue_id) < 0 || disclosureDelivered(ladder, p.release_clue_id)) errors.push('release clue 不在白名单');
            if (clue && !planAllowsClue(ladder.runtime.layers[clue.layer], clue)) errors.push('release clue 不在 stage_plan 白名单');
            var variant = variantById(clue, p.release_variant_id);
            if (!variant) errors.push('release variant 不在白名单');
            if (clue && clue.layer !== p.focus_layer) errors.push('focus_layer 与 clue.layer 不符');
            if (clue) {
                var afterStage = ladder.runtime.layers[clue.layer].stage;
                for (var mm = 0; mm < moves.length; mm++) if (moves[mm].layer === clue.layer) afterStage = moves[mm].to;
                if (stageIndex(clue.stage) > stageIndex(afterStage)) errors.push('release clue 尚未取得阶段许可');
            }
        }
        var awareness = ladder.safe_store.persona_safe.awareness_by_layer[p.focus_layer];
        if ((awareness === 'unknowing' || awareness === 'false_memory') && p.boundary_policy !== 'honest_by_awareness') errors.push('awareness 与 boundary_policy 不兼容');
        if (p.boundary_policy === 'admit_evidenced_surface' && awareness !== 'full' && awareness !== 'partial') errors.push('admit_evidenced_surface 越权');
        if (errors.length) return { errors: uniqueStrings(errors), decision: d };
        var existingVerdicts = {};
        for (var ev = 0; ev < d.patch.condition_verdicts.length; ev++) existingVerdicts[d.patch.condition_verdicts[ev].cond_id] = true;
        for (var lc = 0; lc < gc.local_changes.length; lc++) {
            if (!existingVerdicts[gc.local_changes[lc].cond_id]) d.patch.condition_verdicts.push({ cond_id: gc.local_changes[lc].cond_id, state: gc.local_changes[lc].state });
        }
        return { errors: [], decision: d };
    }

    function askRuntimeGod(ladder, gc) {
        return callModel(godPrompt(ladder, gc), 1800, 0).then(function (text) {
            var raw = extractJson(text);
            var checked = validateGodDecision(ladder, raw, gc);
            if (checked.errors.length) {
                audit(ladder, 'schema_reject', { errors: checked.errors });
                throw new Error('God 输出未通过契约：' + checked.errors.slice(0, 3).join('；'));
            }
            return checked.decision;
        });
    }

    /* ---------------- 本地 actor_packet 渲染 ---------------- */

    function boundaryText(ladder, policy, compact) {
        var set = ladder.safe_store.shield_templates[compact ? 'compact' : 'standard'];
        return set[policy] || set.honest_by_awareness;
    }

    function releaseCondition(policy) {
        if (policy === 'immediate') return '本轮内自然呈现';
        if (policy === 'if_topic_touched') return '当话题触及相关内容时呈现';
        if (policy === 'if_pressed') return '仅在被直接追问时呈现';
        if (policy === 'scene_permitting') return '在场景节奏允许的间隙呈现';
        return '';
    }

    function phaseText(ladder, layer, compact) {
        var ps = ladder.safe_store.persona_safe;
        var awareness = ps.awareness_by_layer[layer];
        var stance = trim(ps.stance_by_layer[layer]);
        if (compact) {
            if (awareness === 'unknowing') return '并不知情，按自身认知行动。';
            if (awareness === 'false_memory') return trim(ps.subjective_anchor_by_layer[layer]) || '沿用角色相信的版本。';
            return stance || '照自身立场行动，不新增事实。';
        }
        if (awareness === 'unknowing') return '角色并不知情；如实按自身认知行动，不用心虚或回避替秘密作证。';
        if (awareness === 'false_memory') return (trim(ps.subjective_anchor_by_layer[layer]) || '沿用角色相信的版本') + '；不越出这份认知替世界下结论。';
        return (stance || '照自身立场行动') + '；按人物本性演，不以固定失态暗示秘密。';
    }

    function ledgerLayer(ladder, row) {
        var clue = clueById(ladder, row.source_clue);
        if (clue) return clue.layer;
        var legacy = ladder.safe_store.legacy_refs[row.source_clue];
        return legacy ? legacy.layer : 'fact';
    }

    function publicAnchors(ladder, layer, scope) {
        var out = [ladder.safe_store.initial_public_anchor];
        if (scope === 'initial_only') return out;
        var ledger = ladder.runtime.public_ledger;
        for (var i = ledger.length - 1; i >= 0 && out.length < 6; i--) {
            if (ledger[i].status === 'active' && ledgerLayer(ladder, ledger[i]) === layer) out.push(ledger[i].anchor_text);
        }
        return out;
    }

    function packetLength(packet) {
        var total = packet.phase_state.length + packet.behavior_guide.length + packet.knowledge_boundary.length;
        for (var i = 0; i < packet.public_anchor.length; i++) total += packet.public_anchor[i].length;
        if (packet.release_allowance) total += packet.release_allowance.variant_surface.length + packet.release_allowance.condition.length;
        return total;
    }

    function allowedPacketClaims(ladder, clue) {
        var out = [];
        var ledger = ladder.runtime.public_ledger;
        for (var i = 0; i < ledger.length; i++) {
            if (ledger[i].status === 'active') out = out.concat(ledger[i].delivered_claim_ids || []);
        }
        if (clue) out = out.concat(clue.allowed_claim_ids || []);
        return uniqueStrings(out);
    }

    function packetFirewall(ladder, packet, clue) {
        var text = packet.phase_state + '\n' + packet.public_anchor.join('\n') + '\n' + packet.behavior_guide + '\n' +
            (packet.release_allowance ? packet.release_allowance.variant_surface + '\n' + packet.release_allowance.condition : '') + '\n' + packet.knowledge_boundary;
        return scanUnlicensed(text, ladder.hidden_store.claims, allowedPacketClaims(ladder, clue));
    }

    function buildActorPacket(ladder, decision) {
        var plan = decision.packet_plan;
        var clue = plan.release_clue_id ? clueById(ladder, plan.release_clue_id) : null;
        var variant = clue ? variantById(clue, plan.release_variant_id) : null;
        var tell = ladder.safe_store.persona_safe.tell_pool || [];
        var guides = [];
        for (var i = 0; i < plan.behavior_refs.length; i++) if (tell[plan.behavior_refs[i]]) guides.push(tell[plan.behavior_refs[i]]);
        var packet = {
            phase_state: phaseText(ladder, plan.focus_layer, false),
            public_anchor: publicAnchors(ladder, plan.focus_layer, plan.anchor_scope),
            behavior_guide: guides.join('；'),
            release_allowance: variant ? { variant_surface: variant.surface, condition: releaseCondition(plan.release_policy) } : null,
            knowledge_boundary: boundaryText(ladder, plan.boundary_policy, false)
        };
        while (packetLength(packet) > FOCUS_PACKET_BUDGET && packet.public_anchor.length > 1) packet.public_anchor.pop();
        if (packetLength(packet) > FOCUS_PACKET_BUDGET) {
            packet.phase_state = phaseText(ladder, plan.focus_layer, true);
            packet.knowledge_boundary = boundaryText(ladder, plan.boundary_policy, true);
            if (packet.behavior_guide.length > 100) packet.behavior_guide = '沿用已选的人物行为，不新增受保护事实。';
        }
        while (packetLength(packet) > FOCUS_PACKET_BUDGET && packet.public_anchor.length > 1) packet.public_anchor.pop();
        if (packet.phase_state.length > 60 || packet.behavior_guide.length > 200 || packet.knowledge_boundary.length > 200) {
            throw new Error('actor_packet 单栏超过安全上限');
        }
        if (packetLength(packet) > FOCUS_PACKET_BUDGET) throw new Error('actor_packet 超过安全预算且无法整项降级');
        var hits = packetFirewall(ladder, packet, clue);
        if (hits.length) {
            audit(ladder, 'firewall_block', {
                hits: ladder.meta.play_mode === 'runtime_blind' ? hits.map(function (hit) { return hit.split(':')[0]; }) : hits,
                clue_id: clue && clue.clue_id
            });
            throw new Error('actor_packet 安检拦截：' + hits.join(','));
        }
        return packet;
    }

    function packetText(packet, title) {
        var lines = ['【Luciole·' + title + '】'];
        if (packet.phase_state) lines.push('当前演法：' + packet.phase_state);
        if (packet.public_anchor.length) lines.push('公开锚点：' + packet.public_anchor.join('；'));
        if (packet.behavior_guide) lines.push('行为指引：' + packet.behavior_guide);
        if (packet.release_allowance) lines.push('本轮获准呈现：' + packet.release_allowance.variant_surface + '（' + packet.release_allowance.condition + '）');
        lines.push('知识边界：' + packet.knowledge_boundary);
        return lines.join('\n');
    }

    function standbyBoundary(ladder) {
        var layer = 'fact';
        for (var i = 0; i < LAYERS.length; i++) if (ladder.runtime.layers[LAYERS[i]] && ladder.runtime.layers[LAYERS[i]].active) { layer = LAYERS[i]; break; }
        var awareness = ladder.safe_store.persona_safe.awareness_by_layer[layer];
        if (awareness === 'false_memory') return trim(ladder.safe_store.persona_safe.subjective_anchor_by_layer[layer]) || '沿用角色当前相信的版本，不新增未知因果。';
        if (awareness === 'unknowing') return '角色按自身认知如实回答，不引入未知因果。';
        return '仅限已公开与已揭示内容，不新增受保护事实。';
    }

    function firstActiveLayer(ladder) {
        for (var i = 0; i < LAYERS.length; i++) {
            if (ladder.runtime.layers[LAYERS[i]] && ladder.runtime.layers[LAYERS[i]].active) return LAYERS[i];
        }
        return 'fact';
    }

    function updateInjection() {
        var c = ctx();
        var s = settings();
        var st = store();
        var blocks = [];
        if (s.enabled && st) {
            var focus = focusedLadder();
            if (focus) {
                var packet = focus.derived && focus.derived.actor_packet;
                if (!packet) {
                    var fallbackLayer = firstActiveLayer(focus);
                    var fallbackAwareness = focus.safe_store.persona_safe.awareness_by_layer[fallbackLayer];
                    var fallbackDecision = {
                        packet_plan: {
                            release_clue_id: null, release_variant_id: null, release_policy: null,
                            focus_layer: fallbackLayer,
                            boundary_policy: (fallbackAwareness === 'unknowing' || fallbackAwareness === 'false_memory') ? 'honest_by_awareness' : 'limit_to_disclosed',
                            behavior_refs: [], anchor_scope: 'initial_plus_disclosed'
                        }
                    };
                    try { packet = buildActorPacket(focus, fallbackDecision); } catch (e) { packet = null; }
                }
                if (packet) blocks.push(packetText(packet, '焦点'));
            }
            var standby = [];
            var standbySeen = {};
            for (var i = 0; i < st.ladders.length; i++) {
                var lad = st.ladders[i];
                if (lad.meta.lifecycle_status !== 'ready' || (focus && lad.meta.id === focus.meta.id)) continue;
                var boundary = standbyBoundary(lad);
                if (!standbySeen[boundary]) { standbySeen[boundary] = true; standby.push(boundary); }
            }
            var standbyText = standby.join('\n');
            if (standbyText.length > 100) {
                standbyText = '其余帷幕均按角色当前认知回应，只沿用已公开与已揭示内容，不新增受保护事实。';
            }
            if (standbyText) blocks.push('【其余受保护线】\n' + standbyText);
        }
        var text = blocks.join('\n\n');
        if (text.length > 900 && blocks.length > 1) {
            blocks[1] = '【其余受保护线】\n按当前认知回应，不新增受保护事实。';
            text = blocks.join('\n\n');
        }
        if (text.length > 900) {
            audit(focusedLadder(), 'firewall_block', { reason: 'combined_injection_over_budget', length: text.length });
            text = '【Luciole】\n仅沿用已公开与已揭示内容，不新增任何受保护事实。';
        }
        try { c.setExtensionPrompt(INJECT_KEY, text, 1, s.depth, false, 0); }
        catch (e) { try { c.setExtensionPrompt(INJECT_KEY, text, 1, s.depth); } catch (e2) { } }
    }

    function clearLegacyInjection() {
        try { ctx().setExtensionPrompt(LEGACY_INJECT_KEY, '', 1, settings().depth, false, 0); }
        catch (e) { try { ctx().setExtensionPrompt(LEGACY_INJECT_KEY, '', 1, settings().depth); } catch (e2) { } }
    }

    /* ---------------- 事务、探针与事件流水 ---------------- */

    function isMissing(value) { return isObject(value) && value.__luciole_missing === true && Object.keys(value).length === 1; }
    function pathEscape(value) { return String(value).replace(/~/g, '~0').replace(/\//g, '~1'); }
    function pathUnescape(value) { return String(value).replace(/~1/g, '/').replace(/~0/g, '~'); }

    function valuesEqual(a, b) {
        if (a === b) return true;
        return safeJson(a) === safeJson(b);
    }

    function diffValues(oldValue, newValue, path, out) {
        if (valuesEqual(oldValue, newValue)) return;
        if (isMissing(oldValue) || isMissing(newValue)) {
            out.push({ path: path || '/', old: clone(oldValue), 'new': clone(newValue) });
            return;
        }
        var oldObj = isObject(oldValue);
        var newObj = isObject(newValue);
        if (oldObj && newObj) {
            var keys = {};
            var ok = Object.keys(oldValue);
            var nk = Object.keys(newValue);
            var i;
            for (i = 0; i < ok.length; i++) keys[ok[i]] = true;
            for (i = 0; i < nk.length; i++) keys[nk[i]] = true;
            var all = Object.keys(keys).sort();
            for (i = 0; i < all.length; i++) {
                var key = all[i];
                var hasOld = Object.prototype.hasOwnProperty.call(oldValue, key);
                var hasNew = Object.prototype.hasOwnProperty.call(newValue, key);
                diffValues(hasOld ? oldValue[key] : MISSING, hasNew ? newValue[key] : MISSING,
                    path + '/' + pathEscape(key), out);
            }
            return;
        }
        out.push({ path: path || '/', old: clone(oldValue), 'new': clone(newValue) });
    }

    function computeDiff(oldValue, newValue) {
        var out = [];
        diffValues(oldValue, newValue, '', out);
        return out;
    }

    function applyDiffValue(root, path, value) {
        if (path === '/' || path === '') return clone(value);
        var parts = path.split('/');
        parts.shift();
        var cursor = root;
        for (var i = 0; i < parts.length - 1; i++) {
            var key = pathUnescape(parts[i]);
            if (!isObject(cursor[key])) cursor[key] = {};
            cursor = cursor[key];
        }
        var last = pathUnescape(parts[parts.length - 1]);
        if (isMissing(value)) delete cursor[last];
        else cursor[last] = clone(value);
        return root;
    }

    function applyDiffList(snapshot, diffs, direction) {
        var out = clone(snapshot);
        for (var i = 0; i < diffs.length; i++) {
            out = applyDiffValue(out, diffs[i].path, direction === 'old' ? diffs[i].old : diffs[i]['new']);
        }
        return out;
    }

    function domainSnapshot(runtime) {
        return {
            layers: clone(runtime.layers),
            conditions: clone(runtime.conditions),
            disclosures: clone(runtime.disclosures),
            public_ledger: clone(runtime.public_ledger),
            tell_usage: clone(runtime.tell_usage)
        };
    }

    function installDomainSnapshot(runtime, snapshot) {
        runtime.layers = clone(snapshot.layers);
        runtime.conditions = clone(snapshot.conditions);
        runtime.disclosures = clone(snapshot.disclosures);
        runtime.public_ledger = clone(snapshot.public_ledger);
        runtime.tell_usage = clone(snapshot.tell_usage);
    }

    function appendDomainEvent(ladder, kind, diffs, binding, meta, revertsEventId) {
        var rt = ladder.runtime;
        var event = {
            event_id: uid('EVT'),
            schema_ver: 1,
            turn_id: binding ? binding.turn_id : floorNow(),
            base_revision: rt.revision,
            new_revision: rt.revision + 1,
            diff: clone(diffs),
            kind: kind,
            reverts_event_id: revertsEventId || null,
            binding: binding ? clone(binding) : null,
            meta: clone(meta || {}),
            ts: nowIso()
        };
        rt.revision = event.new_revision;
        ladder.domain_events.push(event);
        return event;
    }

    function commitDomainMutation(ladder, mutate, binding, meta) {
        var before = domainSnapshot(ladder.runtime);
        var after = clone(before);
        mutate(after);
        var diffs = computeDiff(before, after);
        if (!diffs.length) return null;
        installDomainSnapshot(ladder.runtime, after);
        return appendDomainEvent(ladder, 'commit', diffs, binding, meta, null);
    }

    function patchHasChanges(patch) {
        return !!(patch.stage_moves.length || patch.pressure_set.length || patch.condition_verdicts.length);
    }

    function latestAssistantBinding() {
        var line = lineageNow();
        if (!line.length || line[line.length - 1].role !== 'assistant') return null;
        return line[line.length - 1];
    }

    function applyFrozenPatch(snapshot, ladder, pending, binding) {
        var patch = pending.patch_frozen;
        var i;
        for (i = 0; i < patch.stage_moves.length; i++) {
            snapshot.layers[patch.stage_moves[i].layer].stage = patch.stage_moves[i].to;
        }
        for (i = 0; i < patch.pressure_set.length; i++) {
            snapshot.layers[patch.pressure_set[i].layer].exposure_pressure = patch.pressure_set[i].value;
        }
        for (i = 0; i < patch.condition_verdicts.length; i++) {
            var verdict = patch.condition_verdicts[i];
            if (snapshot.conditions[verdict.cond_id]) snapshot.conditions[verdict.cond_id].state = verdict.state;
        }
        var plan = pending.packet_plan;
        if (plan.release_clue_id) {
            var clue = clueById(ladder, plan.release_clue_id);
            var variant = variantById(clue, plan.release_variant_id);
            var disclosureId = pending.disclosure_id;
            snapshot.disclosures[clue.clue_id] = {
                state: 'delivered',
                release_variant_id: variant.variant_id,
                delivered_claim_ids: clone(clue.allowed_claim_ids),
                mesid: binding.turn_id - 1,
                variant_uid: binding.variant_uid,
                authorized_turn: pending.turn_id,
                ttl_left: pending.ttl_left,
                disclosure_id: disclosureId
            };
            snapshot.public_ledger.push({
                disclosure_id: disclosureId,
                text: variant.surface,
                source_clue: clue.clue_id,
                release_variant_id: variant.variant_id,
                delivered_claim_ids: clone(clue.allowed_claim_ids),
                nature: clue.nature,
                anchor_text: variant.anchor_text,
                origin: 'runtime',
                status: 'active',
                mesid: binding.turn_id - 1,
                variant_uid: binding.variant_uid,
                turn: binding.turn_id
            });
            snapshot.layers[clue.layer].last_release_floor = binding.turn_id;
        }
        for (i = 0; i < pending.packet_plan.behavior_refs.length; i++) {
            snapshot.tell_usage[pending.packet_plan.behavior_refs[i]] = binding.turn_id;
        }
    }

    function commitPending(ladder, binding, manual) {
        var rt = ladder.runtime;
        var pending = rt.pending;
        if (!pending) return false;
        if (pending.base_revision !== rt.revision) {
            audit(ladder, 'schema_reject', { reason: 'base_revision_mismatch', pending: pending.pending_id });
            discardPending(ladder, 'revision_mismatch');
            return false;
        }
        var releaseMeta = null;
        if (pending.packet_plan.release_clue_id) {
            releaseMeta = {
                clue_id: pending.packet_plan.release_clue_id,
                disclosure_id: pending.disclosure_id
            };
        }
        var event = commitDomainMutation(ladder, function (snapshot) {
            applyFrozenPatch(snapshot, ladder, pending, binding);
        }, binding, {
            origin: 'pending_commit',
            action: pending.action,
            pending_id: pending.pending_id,
            release: releaseMeta,
            manual_confirm: !!manual
        });
        pending.status = 'committed';
        rt.pending = null;
        rt.retry_reason = null;
        rt.manual_wake = false;
        ladder.derived.actor_packet = null;
        ladder.derived.packet_text = '';
        rt.lineage = lineageNow();
        if (event) audit(ladder, manual ? 'manual_confirm' : 'commit', { event_id: event.event_id, action: pending.action });
        save();
        updateInjection();
        renderLadders();
        return true;
    }

    function discardPending(ladder, reason) {
        var pending = ladder.runtime.pending;
        if (!pending) return;
        pending.status = 'discarded';
        if (pending.packet_plan.release_clue_id && ladder.runtime.disclosures[pending.packet_plan.release_clue_id]) {
            ladder.runtime.disclosures[pending.packet_plan.release_clue_id].state = 'discarded';
        }
        audit(ladder, 'retry', { pending_id: pending.pending_id, result: 'discarded', reason: reason });
        ladder.runtime.pending = null;
        ladder.derived.actor_packet = null;
        ladder.derived.packet_text = '';
    }

    function supersedePending(ladder, reason) {
        var pending = ladder.runtime.pending;
        if (!pending) return;
        pending.status = reason === 'ttl' ? 'expired' : 'superseded';
        if (pending.packet_plan.release_clue_id && ladder.runtime.disclosures[pending.packet_plan.release_clue_id]) {
            ladder.runtime.disclosures[pending.packet_plan.release_clue_id].state = pending.status;
        }
        audit(ladder, reason === 'ttl' ? 'probe_miss' : 'retry', {
            pending_id: pending.pending_id, result: pending.status, miss_count: pending.miss_count
        });
        ladder.runtime.pending = null;
        var localRetry = [];
        for (var cv = 0; cv < pending.patch_frozen.condition_verdicts.length; cv++) {
            var frozenVerdict = pending.patch_frozen.condition_verdicts[cv];
            var frozenCondition = ladder.runtime.conditions[frozenVerdict.cond_id];
            if (frozenCondition && (frozenCondition.kind === 'evidence' || frozenCondition.kind === 'keyword_event')) {
                localRetry.push(clone(frozenVerdict));
            }
        }
        ladder.runtime.retry_reason = {
            code: 'retry_undelivered',
            clue_id: pending.packet_plan.release_clue_id,
            variant_id: pending.packet_plan.release_variant_id,
            release_policy: pending.packet_plan.release_policy,
            miss_count: pending.miss_count,
            previous_status: pending.status,
            local_condition_changes: localRetry
        };
        ladder.runtime.manual_wake = true;
        ladder.derived.actor_packet = null;
        ladder.derived.packet_text = '';
        save();
        updateInjection();
        renderLadders();
    }

    function probeGroupHit(text, group) {
        var hits = 0;
        for (var i = 0; i < group.phrases.length; i++) if (containsCI(text, group.phrases[i])) hits++;
        return group.logic === 'all' ? hits === group.phrases.length : hits > 0;
    }

    function probeMatches(text, probe) {
        for (var x = 0; x < probe.exclude.length; x++) if (containsCI(text, probe.exclude[x])) return false;
        var groupsHit = 0;
        for (var i = 0; i < probe.groups.length; i++) if (probeGroupHit(text, probe.groups[i])) groupsHit++;
        return groupsHit >= probe.hit_threshold;
    }

    function handleAssistantDelivery(ladder) {
        var pending = ladder.runtime.pending;
        if (!pending) return false;
        var binding = latestAssistantBinding();
        if (!binding || binding.turn_id < pending.turn_id) return false;
        var chat = ctx().chat || [];
        var msg = chat[binding.turn_id - 1];
        if (!msg || msg.is_user) return false;
        var probeHash = binding.content_hash + '|' + binding.variant_uid;
        if (pending.last_probe_hash === probeHash) return false;
        pending.last_probe_hash = probeHash;
        pending.message_uid = binding.message_uid;
        pending.variant_uid = binding.variant_uid;

        if (!pending.packet_plan.release_clue_id) return commitPending(ladder, binding, false);
        pending.status = 'awaiting_delivery';
        var disclosure = ladder.runtime.disclosures[pending.packet_plan.release_clue_id];
        if (disclosure) disclosure.state = 'awaiting_delivery';
        var clue = clueById(ladder, pending.packet_plan.release_clue_id);
        var variant = variantById(clue, pending.packet_plan.release_variant_id);
        if (variant && probeMatches(String(msg.mes || ''), variant.probe)) {
            return commitPending(ladder, binding, false);
        }
        pending.miss_count += 1;
        audit(ladder, 'probe_miss', { pending_id: pending.pending_id, miss_count: pending.miss_count, binding: binding });
        if (ladder.meta.play_mode === 'runtime_blind' && pending.miss_count >= 2) {
            supersedePending(ladder, 'two_misses');
        } else {
            save();
            updateInjection();
            renderLadders();
        }
        return false;
    }

    function authorizeDecision(ladder, decision) {
        var packet = buildActorPacket(ladder, decision);
        var patch = decision.patch;
        var hasRelease = decision.packet_plan.release_clue_id !== null;
        var needsPending = hasRelease || patchHasChanges(patch);
        ladder.derived.actor_packet = packet;
        ladder.derived.packet_text = packetText(packet, ladder.meta.title);
        ladder.derived.last_decision = clone(decision);
        ladder.runtime.manual_wake = false;
        if (!needsPending) {
            save();
            updateInjection();
            renderLadders();
            return;
        }
        var pending = {
            pending_id: uid('PEN'),
            turn_id: floorNow(),
            base_revision: ladder.runtime.revision,
            action: decision.verdict.action,
            patch_frozen: clone(patch),
            packet_plan: clone(decision.packet_plan),
            actor_packet: clone(packet),
            status: 'frozen',
            miss_count: 0,
            ttl_left: 4,
            message_uid: null,
            variant_uid: null,
            last_probe_hash: null,
            disclosure_id: hasRelease ? uid('DIS') : null
        };
        ladder.runtime.pending = pending;
        if (hasRelease) {
            ladder.runtime.disclosures[decision.packet_plan.release_clue_id] = {
                state: 'authorized',
                release_variant_id: decision.packet_plan.release_variant_id,
                delivered_claim_ids: [],
                mesid: null,
                variant_uid: null,
                authorized_turn: pending.turn_id,
                ttl_left: 4,
                disclosure_id: pending.disclosure_id
            };
        }
        save();
        updateInjection();
        renderLadders();
    }

    /* ---------------- 谱系回滚与恢复 ---------------- */

    function sameLineageEntry(a, b) {
        return !!a && !!b && a.message_uid === b.message_uid && a.role === b.role &&
            a.content_hash === b.content_hash && a.variant_uid === b.variant_uid;
    }

    function eventActivity(ladder) {
        var active = {};
        for (var i = 0; i < ladder.domain_events.length; i++) {
            var event = ladder.domain_events[i];
            if (event.kind === 'commit') active[event.event_id] = true;
            else if (event.kind === 'compensate') active[event.reverts_event_id] = false;
            else if (event.kind === 'restore') active[event.reverts_event_id] = true;
        }
        return active;
    }

    function retractedTarget(current, original) {
        var target = applyDiffList(current, original.diff, 'old');
        var release = original.meta && original.meta.release;
        if (release) {
            var currentDisclosure = current.disclosures[release.clue_id];
            if (currentDisclosure) {
                target.disclosures[release.clue_id] = clone(currentDisclosure);
                target.disclosures[release.clue_id].state = 'retracted';
            }
            var currentRow = null;
            for (var i = 0; i < current.public_ledger.length; i++) {
                if (current.public_ledger[i].disclosure_id === release.disclosure_id) currentRow = current.public_ledger[i];
            }
            if (currentRow) {
                var nextRow = clone(currentRow);
                nextRow.status = 'retracted';
                var replaced = false;
                for (var j = 0; j < target.public_ledger.length; j++) {
                    if (target.public_ledger[j].disclosure_id === release.disclosure_id) {
                        target.public_ledger[j] = nextRow; replaced = true; break;
                    }
                }
                if (!replaced) target.public_ledger.push(nextRow);
            }
        }
        return target;
    }

    function compensateEvent(ladder, original) {
        var current = domainSnapshot(ladder.runtime);
        var target = retractedTarget(current, original);
        var diffs = computeDiff(current, target);
        if (!diffs.length) return null;
        installDomainSnapshot(ladder.runtime, target);
        var event = appendDomainEvent(ladder, 'compensate', diffs, latestAssistantBinding(),
            { origin: 'lineage_rollback', target_event_id: original.event_id }, original.event_id);
        audit(ladder, 'retry', { result: 'retracted', event_id: original.event_id, compensation: event.event_id });
        return event;
    }

    function restoreEvent(ladder, original) {
        var current = domainSnapshot(ladder.runtime);
        var target = applyDiffList(current, original.diff, 'new');
        var diffs = computeDiff(current, target);
        if (!diffs.length) return null;
        installDomainSnapshot(ladder.runtime, target);
        var event = appendDomainEvent(ladder, 'restore', diffs, latestAssistantBinding(),
            { origin: 'lineage_restore', target_event_id: original.event_id }, original.event_id);
        audit(ladder, 'retry', { result: 'restored', event_id: original.event_id, restore: event.event_id });
        return event;
    }

    function syncLineage(ladder, reason) {
        var oldLine = ladder.runtime.lineage || [];
        var actual = lineageNow();
        var common = 0;
        while (common < oldLine.length && common < actual.length && sameLineageEntry(oldLine[common], actual[common])) common++;
        if (common === oldLine.length && actual.length >= oldLine.length) {
            ladder.runtime.lineage = actual;
            return { changed: false, append: actual.length > oldLine.length };
        }
        var tailDelete = actual.length < oldLine.length && common === actual.length;
        var latestOnly = actual.length === oldLine.length && common === actual.length - 1 &&
            actual[common] && actual[common].role === 'assistant';
        if (ladder.runtime.pending && !latestOnly) discardPending(ladder, 'lineage_diverged');

        var active = eventActivity(ladder);
        for (var i = ladder.domain_events.length - 1; i >= 0; i--) {
            var event = ladder.domain_events[i];
            if (event.kind === 'commit' && active[event.event_id] && event.turn_id > common) compensateEvent(ladder, event);
        }
        if (latestOnly) {
            active = eventActivity(ladder);
            var last = actual[actual.length - 1];
            for (var r = ladder.domain_events.length - 1; r >= 0; r--) {
                var original = ladder.domain_events[r];
                if (original.kind === 'commit' && active[original.event_id] === false && original.binding &&
                    sameLineageEntry(original.binding, last)) { restoreEvent(ladder, original); break; }
            }
        }
        ladder.runtime.lineage = actual;
        if (!tailDelete && !latestOnly) {
            ladder.runtime.needs_rebuild = true;
            audit(ladder, 'retry', { result: 'branch_rebuild_required', first_divergence: common, reason: reason });
        }
        ladder.derived.actor_packet = ladder.runtime.pending ? clone(ladder.runtime.pending.actor_packet) : null;
        save();
        return { changed: true, tailDelete: tailDelete, latestOnly: latestOnly, first: common };
    }

    function syncAllLineages(reason) {
        var st = store();
        if (!st) return [];
        var results = [];
        for (var i = 0; i < st.ladders.length; i++) results.push(syncLineage(st.ladders[i], reason));
        updateInjection();
        renderLadders();
        return results;
    }

    /* ---------------- 每轮顺序：意图→裁定→冻结→演出→提交 ---------------- */

    function handleExistingPending(ladder) {
        var pending = ladder.runtime.pending;
        if (!pending) return false;
        pending.ttl_left -= 1;
        if (pending.packet_plan.release_clue_id && ladder.runtime.disclosures[pending.packet_plan.release_clue_id]) {
            ladder.runtime.disclosures[pending.packet_plan.release_clue_id].ttl_left = pending.ttl_left;
        }
        if (pending.ttl_left <= 0) {
            supersedePending(ladder, 'ttl');
            return false;
        }
        ladder.derived.actor_packet = clone(pending.actor_packet);
        updateInjection();
        save();
        return true;
    }

    function processUserTurn() {
        if (runtimeBusy) return Promise.resolve();
        syncAllLineages('message_sent');
        var s = settings();
        var ladder = focusedLadder();
        if (!s.enabled || !ladder || ladder.meta.lifecycle_status !== 'ready') {
            updateInjection();
            return Promise.resolve();
        }
        if (handleExistingPending(ladder)) {
            renderLadders();
            return Promise.resolve();
        }
        var gc = buildGodContext(ladder);
        if (!gc.wake_reasons.length) {
            updateInjection();
            return Promise.resolve();
        }
        runtimeBusy = true;
        return askRuntimeGod(ladder, gc).then(function (decision) {
            authorizeDecision(ladder, decision);
        }).catch(function (err) {
            audit(ladder, 'god_error', { message: err && err.message ? err.message : String(err) });
            toast('萤火暂时没有裁定：' + (err && err.message ? err.message : 'API 未通'), 'error');
            updateInjection();
        }).then(function () {
            runtimeBusy = false;
            save();
        }, function () {
            runtimeBusy = false;
            save();
        });
    }

    function manualWake(ladder) {
        var st = store();
        if (!st || !ladder) return;
        var current = focusedLadder();
        if (current && current.meta.id !== ladder.meta.id && current.runtime.pending) {
            toast('当前焦点还有待提交裁定，不能切换');
            return;
        }
        if (ladder.runtime.pending) { toast('先清结当前待提交裁定'); return; }
        for (var i = 0; i < st.ladders.length; i++) st.ladders[i].meta.focus = st.ladders[i].meta.id === ladder.meta.id;
        ladder.runtime.manual_wake = true;
        save();
        processUserTurn();
    }

    function authorConfirmDelivery(ladder) {
        if (!ladder || !ladder.runtime.pending) return;
        var binding = latestAssistantBinding();
        if (!binding) { toast('没有可绑定的助手正文'); return; }
        commitPending(ladder, binding, true);
    }

    function authorRejectDelivery(ladder) {
        if (!ladder || !ladder.runtime.pending) return;
        supersedePending(ladder, 'author_reject');
    }

    function authorLater(ladder) {
        if (!ladder || !ladder.runtime.pending) return;
        ladder.runtime.pending.ttl_left = Math.max(1, ladder.runtime.pending.ttl_left);
        save();
        renderLadders();
    }

    /* ---------------- 面板 UI ---------------- */

    var pendingLegacyId = null;

    function panelHtml() {
        return '' +
        '<div id="xyh_panel" class="xyh-panel" style="display:none;position:fixed;top:6vh;left:50%;transform:translateX(-50%);width:min(520px,95vw);max-height:86vh;overflow-y:auto;z-index:30001;background:rgba(5,24,31,0.97);color:#e8f2ea;border:1px solid rgba(160,210,160,0.28);border-radius:18px;padding-bottom:4px;">' +
        ' <div class="xyh-head"><span class="xyh-brand"><span class="xyh-title"><span class="xyh-dot xyh-dot-lit"></span> Luciole</span><span class="xyh-subtitle">把玩家从编剧席送回角色席</span></span>' +
        ' <span class="xyh-head-btns"><span class="xyh-lamp" id="xyh_lamp" title="开关灯">💡</span><span class="xyh-close" id="xyh_close">×</span></span></div>' +
        ' <div class="xyh-body">' +
        '  <div class="xyh-row xyh-control-card"><div class="xyh-toggles xyh-main-toggles">' +
        '   <label><input type="checkbox" id="xyh_enabled"> 启用帷幕</label><label><input type="checkbox" id="xyh_floater_toggle"> 浮标</label></div>' +
        '   <label class="xyh-depth-control"><span>注入深度</span><input type="number" id="xyh_depth" min="0" max="20" class="xyh-num"></label></div>' +
        '  <div class="xyh-row xyh-card xyh-api" id="xyh_api_box">' +
        '   <div class="xyh-section-head"><span class="xyh-section-title">God 航道</span><small>编译与掉落窗口使用</small></div>' +
        '   <div class="xyh-toggles xyh-api-modes"><label><input type="radio" name="xyh_api_mode" value="current"> 跟随酒馆当前连接</label>' +
        '   <label><input type="radio" name="xyh_api_mode" value="custom"> 独立 API</label></div>' +
        '   <div id="xyh_api_custom" style="display:none;">' +
        '    <div class="xyh-inline xyh-profile-row"><select id="xyh_api_select" class="xyh-select"></select><span class="xyh-btn xyh-danger" id="xyh_api_del">删除方案</span></div>' +
        '    <input type="text" id="xyh_api_name" placeholder="方案名（如：God / Gemini）">' +
        '    <input type="text" id="xyh_api_url" placeholder="API 地址（贴到 /v1 即可）">' +
        '    <input type="password" id="xyh_api_key" placeholder="API Key（保存在酒馆扩展设置）">' +
        '    <div class="xyh-inline xyh-model-row"><input type="text" id="xyh_api_model" placeholder="模型名" style="flex:1;margin-bottom:0;"><button type="button" id="xyh_api_fetch_models" class="menu_button">拉取模型</button></div>' +
        '    <select id="xyh_api_model_sel" style="display:none;width:100%;box-sizing:border-box;margin-bottom:8px;"></select>' +
        '    <div class="xyh-form-btns xyh-api-actions"><button type="button" id="xyh_api_test" class="menu_button xyh-action-secondary">测试连接</button><button type="button" id="xyh_api_save" class="menu_button xyh-action-primary">保存方案</button></div>' +
        '   </div>' +
        '  </div>' +
        '  <div class="xyh-row xyh-card xyh-world-card"><div class="xyh-section-head"><span class="xyh-section-title">世界观安全备注</span><small>给 God · 不直达演员</small></div>' +
        '   <textarea id="xyh_worldnote" rows="2" maxlength="2000" placeholder="只写可供裁定的背景速览（最多2000字）"></textarea></div>' +
        '  <div id="xyh_migration" class="xyh-migration"></div>' +
        '  <div class="xyh-section-divider"><span>帷幕账本</span></div><div id="xyh_ladders" class="xyh-ladders"></div>' +
        '  <div class="xyh-form xyh-card" id="xyh_compile_form">' +
        '   <div class="xyh-section-head"><span class="xyh-section-title">编译一条新线</span><small>真相锁定 · 路径开放</small></div>' +
        '   <input type="text" id="xyh_f_title" maxlength="60" placeholder="线名（如：旧照背后的身世）">' +
        '   <div class="xyh-toggles xyh-mode-row"><label><input type="radio" name="xyh_play_mode" value="author" checked> 作者模式 <small>可看结构与仲裁</small></label>' +
        '   <label><input type="radio" name="xyh_play_mode" value="runtime_blind"> 盲玩模式 <small>激活后隐藏未交付内容</small></label></div>' +
        '   <label class="xyh-stack-label"><span>节奏档</span><select id="xyh_f_pace" class="xyh-select"><option value="fast">快</option><option value="medium" selected>中</option><option value="slow">慢</option></select></label>' +
        '   <textarea id="xyh_f_public" rows="2" placeholder="开局公开表层（可空，由 God 起草；不要在这里写秘密答案）"></textarea>' +
        '   <textarea id="xyh_f_source" rows="8" maxlength="2000" placeholder="把完整秘密、故事脉络、层层真相交给 God。这里永不注入演员。"></textarea>' +
        '   <div class="xyh-form-btns"><button type="button" id="xyh_compile" class="menu_button xyh-action-primary">让 God 编译</button><button type="button" id="xyh_compile_clear" class="menu_button xyh-action-secondary">清空</button></div>' +
        '  </div>' +
        '  <div id="xyh_compile_preview" class="xyh-card xyh-compile-preview" style="display:none;">' +
        '   <div class="xyh-section-head"><span class="xyh-section-title">作者预览与安检</span><small>确认后锁定</small></div>' +
        '   <div id="xyh_compile_summary" class="xyh-compile-summary"></div>' +
        '   <div id="xyh_legacy_preview" class="xyh-legacy-preview" style="display:none;"></div>' +
        '   <textarea id="xyh_compile_json" rows="18" spellcheck="false"></textarea>' +
        '   <div class="xyh-form-btns"><button type="button" id="xyh_compile_recheck" class="menu_button xyh-action-secondary">重新校验</button><button type="button" id="xyh_compile_confirm" class="menu_button xyh-action-primary">确认并锁定</button><button type="button" id="xyh_compile_cancel" class="menu_button xyh-action-secondary">取消</button></div>' +
        '  </div>' +
        '  <div class="xyh-signature" aria-label="联合创作署名"><span class="xyh-signature-dot"></span><span>GPT</span><b>×</b><span>Claude</span><b>×</b><span>ripple</span></div>' +
        ' </div>' +
        '</div>';
    }

    function stageLabel(stage) {
        return { dormant: '沉睡', trace: '留痕', suspect: '可疑', verifiable: '可验证', critical: '临界', revealed: '揭晓' }[stage] || stage;
    }

    function layerLabel(layer) {
        return { fact: '事实', motive: '动机', emotion: '情感真相' }[layer] || layer;
    }

    function renderCompileSummary(validation, draft, blind) {
        var html = '';
        if (validation.errors.length && blind) html += '<div class="xyh-validation xyh-validation-error"><b>结构或通道核查阻塞 ' + validation.errors.length + ' 项</b><br>盲玩模式不展示未交付内容；请重新编译，或切到作者模式逐项修订。</div>';
        else if (validation.errors.length) html += '<div class="xyh-validation xyh-validation-error"><b>阻塞 ' + validation.errors.length + ' 项</b><br>' + esc(validation.errors.join('\n')) + '</div>';
        else html += '<div class="xyh-validation xyh-validation-ok"><b>结构安检通过</b> · 可以锁定</div>';
        if (validation.warnings.length && blind) html += '<div class="xyh-validation xyh-validation-warn"><b>有 ' + validation.warnings.length + ' 项近似扫描提醒</b> · 内容已隐藏</div>';
        else if (validation.warnings.length) html += '<div class="xyh-validation xyh-validation-warn"><b>作者复核</b><br>' + esc(validation.warnings.join('\n')) + '</div>';
        html += '<div class="xyh-compile-counts">' + draft.claims.length + ' 条命题 · ' + draft.clues.length + ' 张线索 · ' + draft.conditions.length + ' 个条件 · ' + draft.wake_aliases.length + ' 个唤醒词</div>';
        if (blind) {
            var publicAtoms = [];
            for (var pa = 0; pa < draft.public_atoms.length; pa++) publicAtoms.push(draft.public_atoms[pa].text);
            html += '<div class="xyh-public-preview"><b>盲玩可见的开局公开层</b><p>' + esc(draft.initial_public_version) + '</p>' +
                '<small>公开锚点：' + esc(draft.initial_public_anchor) + '</small>' +
                (publicAtoms.length ? '<small>公开原子：' + esc(publicAtoms.join('；')) + '</small>' : '') +
                '<small>管辖边界：' + esc(draft.jurisdiction.join('；')) + '</small></div>';
        }
        $('#xyh_compile_summary').html(html.replace(/\n/g, '<br>'));
        $('#xyh_compile_confirm').prop('disabled', validation.errors.length > 0);
    }

    function resetCompileForm() {
        editingDraft = null;
        pendingLegacyId = null;
        $('#xyh_f_title').val('');
        $('#xyh_f_source').val('');
        $('#xyh_f_public').val('');
        $('#xyh_f_pace').val('medium');
        $('input[name="xyh_play_mode"][value="author"]').prop('checked', true);
        $('#xyh_compile_preview').hide();
        $('#xyh_compile_json').val('');
        $('#xyh_legacy_preview').hide().empty();
        $('#xyh_compile_json, #xyh_compile_recheck').show();
        $('#xyh_compile').prop('disabled', false).text('让 God 编译');
    }

    function compileFormInput() {
        var st = store();
        return {
            title: trim($('#xyh_f_title').val()),
            source_secret: trim($('#xyh_f_source').val()),
            public_hint: trim($('#xyh_f_public').val()),
            pace: $('#xyh_f_pace').val() || 'medium',
            play_mode: $('input[name="xyh_play_mode"]:checked').val() || 'author',
            world_note: st ? st.worldNote : ''
        };
    }

    function beginCompile() {
        var st = store();
        if (!st) { toast('先打开一个聊天'); return; }
        if (st.ladders.length >= MAX_LADDERS) { toast('每个聊天最多四条受保护线'); return; }
        var input = compileFormInput();
        if (!input.source_secret) { toast('先把完整秘密交给 God'); return; }
        if (input.source_secret.length > 2000) { toast('source_secret 不能超过2000字'); return; }
        if (input.world_note.length > 2000) { toast('世界观备注超过2000字，请先整段精简'); return; }
        if (input.title.length > 60) { toast('线名不能超过60字'); return; }
        $('#xyh_compile').prop('disabled', true).text('God 编译中……');
        compileInput(input).then(function (result) {
            var legacy = null;
            if (pendingLegacyId && st.legacy_v14) {
                for (var i = 0; i < st.legacy_v14.ladders.length; i++) {
                    if (String(st.legacy_v14.ladders[i].id || i) === pendingLegacyId) legacy = clone(st.legacy_v14.ladders[i]);
                }
            }
            editingDraft = { input: input, draft: result.draft, validation: result.validation, legacy: legacy, legacy_id: pendingLegacyId };
            var blind = input.play_mode === 'runtime_blind';
            $('#xyh_compile_json').val(blind ? '' : JSON.stringify(result.draft, null, 2)).toggle(!blind);
            $('#xyh_compile_recheck').toggle(!blind);
            renderCompileSummary(result.validation, result.draft, blind);
            renderLegacyBaselinePreview(legacy);
            $('#xyh_compile_preview').show();
            $('#xyh_compile').prop('disabled', false).text('重新编译');
            $('#xyh_compile_preview')[0].scrollIntoView({ behavior: 'smooth', block: 'start' });
        }).catch(function (err) {
            $('#xyh_compile').prop('disabled', false).text('让 God 编译');
            toast('编译没有完成：' + (err && err.message ? err.message : String(err)), 'error');
        });
    }

    function recheckCompile() {
        if (!editingDraft) return;
        try {
            var blind = editingDraft.input.play_mode === 'runtime_blind';
            var draft = blind ? normalizeCompileDraft(editingDraft.draft)
                : normalizeCompileDraft(JSON.parse($('#xyh_compile_json').val()));
            var validation = validateCompileForActivation(draft, editingDraft.input.source_secret);
            editingDraft.draft = draft;
            editingDraft.validation = validation;
            if (!blind) $('#xyh_compile_json').val(JSON.stringify(draft, null, 2));
            renderCompileSummary(validation, draft, blind);
        } catch (e) {
            $('#xyh_compile_summary').html('<div class="xyh-validation xyh-validation-error">JSON 解析失败：' + esc(e.message) + '</div>');
            $('#xyh_compile_confirm').prop('disabled', true);
        }
    }

    function confirmCompile() {
        if (!editingDraft) return;
        recheckCompile();
        if (!editingDraft || editingDraft.validation.errors.length) return;
        var st = store();
        if (!st || st.ladders.length >= MAX_LADDERS) { toast('帷幕数量已经到上限'); return; }
        editingDraft.input.warnings = editingDraft.validation.warnings;
        var legacyInfo = null;
        if (editingDraft.legacy) {
            var lights = [];
            var frags = editingDraft.legacy.frags || [];
            $('#xyh_legacy_preview .xyh-legacy-light').each(function () {
                var row = $(this);
                if (!row.find('input[type="checkbox"]').prop('checked')) return;
                var index = parseInt(row.attr('data-frag-index'), 10);
                var text = frags[index] && trim(frags[index].text);
                var layer = row.find('select').val();
                if (text && text.length <= 200 && layerIndex(layer) >= 0) lights.push({ text: text, layer: layer });
            });
            legacyInfo = { lights: lights };
        }
        var ladder = buildLadderFromDraft(editingDraft.input, editingDraft.draft, legacyInfo);
        st.ladders.push(ladder);
        if (editingDraft.legacy_id && st.legacy_v14) {
            for (var j = st.legacy_v14.ladders.length - 1; j >= 0; j--) {
                if (String(st.legacy_v14.ladders[j].id || j) === editingDraft.legacy_id) st.legacy_v14.ladders.splice(j, 1);
            }
            st.legacy_v14.pending = st.legacy_v14.ladders.length > 0;
        }
        save();
        toast('🪔 「' + ladder.meta.title + '」已经锁入帷幕', 'success');
        resetCompileForm();
        refreshPanel();
        updateInjection();
    }

    function legacySource(lad) {
        var parts = [];
        if (lad.secret) parts.push('旧版终点备注：' + lad.secret);
        if (lad.arc) parts.push('旧版剧情脉络：' + lad.arc);
        if (lad.frags && lad.frags.length) {
            var clues = [];
            for (var i = 0; i < lad.frags.length; i++) {
                var frag = lad.frags[i] || {};
                var meta = [];
                if (frag.land) meta.push('旧落地词：' + frag.land);
                if (frag.pre) meta.push('旧前置词：' + frag.pre);
                if (frag.must) meta.push('旧优先级：urgent');
                clues.push('- ' + trim(frag.text) + (meta.length ? '（' + meta.join('；') + '）' : ''));
            }
            if (lad.mode === 'script') parts.push('旧版已放的光（仅作历史与编译材料，不得直通演员）：\n' + clues.join('\n'));
            else parts.push('旧版耕田碎片候选（逐条转线索草稿；落地词供 probe、前置词供 keyword_event、必落只转 urgent）：\n' + clues.join('\n'));
        }
        return parts.join('\n\n');
    }

    function renderLegacyBaselinePreview(legacy) {
        var box = $('#xyh_legacy_preview');
        if (!box.length || !legacy) { box.hide().empty(); return; }
        var frags = legacy.frags || [];
        var rows = [];
        for (var i = 0; i < frags.length; i++) {
            var frag = frags[i] || {};
            if (frag.state < 1 || !trim(frag.text)) continue;
            var tooLong = trim(frag.text).length > 200;
            var landed = frag.state === 2;
            rows.push('<label class="xyh-legacy-light" data-frag-index="' + i + '">' +
                '<span class="xyh-legacy-check"><input type="checkbox"' + (landed && !tooLong ? ' checked' : '') + (tooLong ? ' disabled' : '') + '> ' +
                (landed ? '旧版已落地' : '旧版已放、尚未核实') + '</span>' +
                '<span class="xyh-legacy-surface">' + esc(frag.text) + '</span>' +
                '<select class="xyh-select"><option value="fact">事实层</option><option value="motive">动机层</option><option value="emotion">情感层</option></select>' +
                (tooLong ? '<small>超过200字，不写入迁移基线；仍保留在编译材料中。</small>' : '') +
                '</label>');
        }
        if (!rows.length) { box.hide().empty(); return; }
        box.html('<div class="xyh-section-head"><span class="xyh-section-title">迁移基线逐条确认</span><small>只勾选玩家确实看见过的光</small></div>' +
            '<p>已落地项默认勾选；“已放未核实”默认不勾，避免把漏演写成既成事实。</p>' + rows.join('')).show();
    }

    function renderMigration() {
        var st = store();
        var box = $('#xyh_migration');
        if (!box.length || !st || !st.legacy_v14 || !st.legacy_v14.ladders.length) { box.hide().empty(); return; }
        var html = '<div class="xyh-card xyh-migration-card"><div class="xyh-section-head"><span class="xyh-section-title">v1.4 迁移隔离区</span><small>旧线不会继续注入</small></div>' +
            '<p>检测到 ' + st.legacy_v14.ladders.length + ' 条旧线。逐条送进新编译管线，确认后才会点灯。</p>';
        for (var i = 0; i < st.legacy_v14.ladders.length; i++) {
            var lad = st.legacy_v14.ladders[i];
            var legacyId = String(lad.id || i);
            html += '<div class="xyh-legacy-row" data-legacy-id="' + esc(legacyId) + '"><span><b>' + esc(lad.title || '旧线') + '</b><small>' + esc(lad.mode === 'script' ? '编剧线' : '耕田线') + '</small></span><button type="button" class="menu_button xyh-migrate-one">送去编译</button></div>';
        }
        html += '</div>';
        box.html(html).show();
    }

    function ladderInspectHtml(ladder) {
        if (ladder.meta.play_mode === 'runtime_blind') {
            return esc(JSON.stringify({
                title: ladder.meta.title,
                revision: ladder.runtime.revision,
                public_ledger: ladder.runtime.public_ledger.filter(function (r) { return r.status === 'active'; }),
                audit: ladder.audit_log.slice(-12)
            }, null, 2));
        }
        return esc(JSON.stringify({
            hidden_store: ladder.hidden_store,
            safe_store: ladder.safe_store,
            control: ladder.control,
            runtime: ladder.runtime,
            domain_events: ladder.domain_events,
            audit_log: ladder.audit_log
        }, null, 2));
    }

    function renderLadders() {
        var st = store();
        var box = $('#xyh_ladders');
        if (!box.length) return;
        if (!st || !st.ladders.length) {
            box.html('<div class="xyh-empty">还没有 v1.5 帷幕。把完整秘密交给下方 God 编译，演员不会拿到原文。</div>');
            return;
        }
        var html = '';
        for (var i = 0; i < st.ladders.length; i++) {
            var lad = st.ladders[i];
            var pending = lad.runtime.pending;
            var delivered = 0;
            for (var k in lad.runtime.disclosures) if (Object.prototype.hasOwnProperty.call(lad.runtime.disclosures, k) && lad.runtime.disclosures[k].state === 'delivered') delivered++;
            var stateText = lad.meta.play_mode === 'runtime_blind' ? '帷幕运转中' : LAYERS.map(function (layer) {
                var state = lad.runtime.layers[layer];
                return state && state.active ? layerLabel(layer) + '·' + stageLabel(state.stage) : null;
            }).filter(function (x) { return x; }).join(' / ');
            html += '<div class="xyh-ladder' + (lad.meta.focus ? ' xyh-focus-ladder' : '') + '" data-id="' + esc(lad.meta.id) + '">' +
                '<div class="xyh-ladder-top"><span class="xyh-ladder-name">' + (lad.meta.focus ? '🪔 ' : '◌ ') + esc(lad.meta.title) +
                ' <small class="xyh-mode-badge">' + (lad.meta.play_mode === 'runtime_blind' ? '盲玩' : '作者') + '</small></span>' +
                '<span class="xyh-focus-badge">' + (lad.meta.focus ? 'FOCUS' : 'STANDBY') + '</span></div>' +
                '<div class="xyh-ladder-meta">' + esc(stateText || '等待启用') + ' · 已揭示 ' + delivered + ' · revision ' + lad.runtime.revision +
                (pending ? ' · 待提交' : '') + (lad.runtime.needs_rebuild ? ' · 需重新推进' : '') + '</div>' +
                (pending && pending.status === 'awaiting_delivery' && lad.meta.play_mode === 'author' ?
                    '<div class="xyh-arbitration"><b>探针尚未确认交付</b><span class="xyh-btn" data-act="confirm-delivery">确实交付</span><span class="xyh-btn" data-act="reject-delivery">未交付撤销</span><span class="xyh-btn" data-act="later">稍后</span></div>' : '') +
                '<div class="xyh-ladder-btns">' +
                (lad.meta.focus ? '' : '<span class="xyh-btn" data-act="focus">设为焦点</span>') +
                '<span class="xyh-btn" data-act="wake">召唤 God</span><span class="xyh-btn" data-act="inspect">查看账本</span>' +
                (lad.runtime.needs_rebuild ? '<span class="xyh-btn" data-act="ack-rebuild">从当前继续</span>' : '') +
                '<span class="xyh-btn xyh-danger" data-act="del">删除</span></div>' +
                '<pre class="xyh-inspect" style="display:none;">' + ladderInspectHtml(lad) + '</pre></div>';
        }
        box.html(html);
    }

    /* ---------------- API 与面板绑定 ---------------- */

    function renderApiUI() {
        var api = settings().api;
        $('input[name="xyh_api_mode"][value="' + api.mode + '"]').prop('checked', true);
        $('#xyh_api_custom').toggle(api.mode === 'custom');
        var sel = $('#xyh_api_select');
        sel.empty();
        if (!api.profiles.length) sel.append('<option value="-1">（还没有方案）</option>');
        else {
            for (var i = 0; i < api.profiles.length; i++) sel.append('<option value="' + i + '"' + (i === api.activeIndex ? ' selected' : '') + '>' + esc(api.profiles[i].name || ('方案' + (i + 1))) + '</option>');
        }
        fillApiFields();
    }

    function fillApiFields() {
        var prof = activeProfile();
        $('#xyh_api_name').val(prof ? prof.name : '');
        $('#xyh_api_url').val(prof ? prof.url : '');
        $('#xyh_api_key').val(prof ? prof.key : '');
        $('#xyh_api_model').val(prof ? prof.model : '');
        $('#xyh_api_model_sel').hide().empty();
    }

    function bindApiUI() {
        $('input[name="xyh_api_mode"]').on('change', function () {
            settings().api.mode = $(this).val();
            $('#xyh_api_custom').toggle(settings().api.mode === 'custom');
            save();
        });
        $('#xyh_api_select').on('change', function () {
            settings().api.activeIndex = parseInt($(this).val(), 10);
            save(); fillApiFields();
        });
        $('#xyh_api_save').on('click', function () {
            var api = settings().api;
            var profile = { name: trim($('#xyh_api_name').val()) || ('方案' + (api.profiles.length + 1)), url: trim($('#xyh_api_url').val()), key: $('#xyh_api_key').val(), model: trim($('#xyh_api_model').val()) };
            if (!profile.url) { toast('API 地址不能为空'); return; }
            var index = -1;
            for (var i = 0; i < api.profiles.length; i++) if (api.profiles[i].name === profile.name) index = i;
            if (index >= 0) api.profiles[index] = profile;
            else { api.profiles.push(profile); index = api.profiles.length - 1; }
            api.activeIndex = index;
            save(); renderApiUI(); toast('方案已保存', 'success');
        });
        $('#xyh_api_del').on('click', function () {
            var api = settings().api;
            if (api.activeIndex < 0 || !api.profiles.length) return;
            if (!confirm('删除这个 API 方案？')) return;
            api.profiles.splice(api.activeIndex, 1);
            api.activeIndex = api.profiles.length ? 0 : -1;
            save(); renderApiUI();
        });
        $('#xyh_api_fetch_models').on('click', function () {
            var url = trim($('#xyh_api_url').val());
            var key = $('#xyh_api_key').val();
            if (!url) { toast('先填 API 地址'); return; }
            fetch(modelsUrl(url), { method: 'GET', headers: { Authorization: 'Bearer ' + (key || '') } }).then(function (res) {
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return res.json();
            }).then(function (data) {
                var list = data && data.data || [];
                var ids = [];
                for (var i = 0; i < list.length; i++) if (list[i] && list[i].id) ids.push(String(list[i].id));
                ids.sort();
                var select = $('#xyh_api_model_sel').empty().append('<option value="">— 选择模型 —</option>');
                for (var j = 0; j < ids.length; j++) select.append($('<option></option>').attr('value', ids[j]).text(ids[j]));
                select.show(); toast('拉到 ' + ids.length + ' 个模型');
            }).catch(function (err) { toast('拉取失败：' + err.message, 'error'); });
        });
        $('#xyh_api_model_sel').on('change', function () { if ($(this).val()) $('#xyh_api_model').val($(this).val()); });
        $('#xyh_api_test').on('click', function () {
            var profile = { url: trim($('#xyh_api_url').val()), key: $('#xyh_api_key').val(), model: trim($('#xyh_api_model').val()) };
            if (!profile.url) { toast('先填 API 地址'); return; }
            fetch(normalizeUrl(profile.url), {
                method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (profile.key || '') },
                body: JSON.stringify({ model: profile.model, messages: [{ role: 'user', content: '只回复“通”' }], max_tokens: 5, temperature: 0 })
            }).then(function (res) { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); })
                .then(function () { toast('连接通了', 'success'); }).catch(function (err) { toast('没通：' + err.message, 'error'); });
        });
    }

    function applyTheme() {
        var light = settings().theme === 'light';
        $('#xyh_panel').toggleClass('xyh-light', light);
        $('#xyh_lamp').text(light ? '☾' : '☀').attr('title', light ? '切到萤火溪夜' : '切到林间日光');
    }

    function bindPanel() {
        var s = settings();
        $('#xyh_enabled').prop('checked', s.enabled).on('change', function () { s.enabled = $(this).prop('checked'); save(); updateInjection(); });
        $('#xyh_floater_toggle').prop('checked', s.showFloater).on('change', function () {
            s.showFloater = $(this).prop('checked'); save(); $('#xyh_floater').toggle(s.showFloater); $('#xyh_show_floater').prop('checked', s.showFloater);
        });
        $('#xyh_depth').val(s.depth).on('change', function () { s.depth = clamp(parseInt($(this).val(), 10) || 2, 0, 20); save(); updateInjection(); });
        $('#xyh_worldnote').on('change', function () {
            var st = store();
            var value = String($(this).val() || '');
            if (value.length > 2000) { toast('世界观备注超过2000字，请整段精简后再保存'); return; }
            if (st) { st.worldNote = value; save(); }
        });
        $('#xyh_lamp').on('click', function () { s.theme = s.theme === 'light' ? 'dark' : 'light'; save(); applyTheme(); });
        $('#xyh_close').on('click', function () { $('#xyh_panel').hide(); });
        $('#xyh_compile').on('click', beginCompile);
        $('#xyh_compile_clear').on('click', resetCompileForm);
        $('#xyh_compile_recheck').on('click', recheckCompile);
        $('#xyh_compile_confirm').on('click', confirmCompile);
        $('#xyh_compile_cancel').on('click', function () { editingDraft = null; $('#xyh_compile_preview').hide(); });

        $('#xyh_migration').on('click', '.xyh-migrate-one', function () {
            var id = $(this).closest('.xyh-legacy-row').attr('data-legacy-id');
            var st = store();
            var legacy = null;
            for (var i = 0; st && i < st.legacy_v14.ladders.length; i++) if (String(st.legacy_v14.ladders[i].id || i) === id) legacy = st.legacy_v14.ladders[i];
            if (!legacy) return;
            pendingLegacyId = id;
            $('#xyh_f_title').val(legacy.title || '迁移线');
            $('#xyh_f_source').val(legacySource(legacy));
            $('#xyh_f_public').val('以下旧线已经进入迁移隔离，未确认前不再向演员注入。');
            $('#xyh_f_pace').val((legacy.gap || 6) <= 3 ? 'fast' : ((legacy.gap || 6) >= 8 ? 'slow' : 'medium'));
            $('#xyh_compile_form')[0].scrollIntoView({ behavior: 'smooth', block: 'start' });
            toast('旧线已装入编译台；检查后点“让 God 编译”');
        });

        $('#xyh_ladders').on('click', '.xyh-btn', function () {
            var card = $(this).closest('.xyh-ladder');
            var ladder = findLadder(card.attr('data-id'));
            var act = $(this).attr('data-act');
            var st = store();
            if (!ladder || !st) return;
            if (act === 'focus') {
                var current = focusedLadder();
                if (current && current.runtime.pending) { toast('当前焦点还有待提交裁定，先清结'); return; }
                for (var i = 0; i < st.ladders.length; i++) st.ladders[i].meta.focus = st.ladders[i].meta.id === ladder.meta.id;
                save(); renderLadders(); updateInjection();
            } else if (act === 'wake') manualWake(ladder);
            else if (act === 'inspect') card.find('.xyh-inspect').toggle();
            else if (act === 'confirm-delivery') authorConfirmDelivery(ladder);
            else if (act === 'reject-delivery') authorRejectDelivery(ladder);
            else if (act === 'later') authorLater(ladder);
            else if (act === 'ack-rebuild') {
                ladder.runtime.needs_rebuild = false;
                ladder.runtime.lineage = lineageNow();
                ladder.runtime.manual_wake = true;
                save(); renderLadders(); toast('已回到分叉点后的当前世界；请召唤 God 重新推进');
            } else if (act === 'del') {
                if (!confirm('删除「' + ladder.meta.title + '」？世界账本与真相库会一并移除。')) return;
                for (var d = st.ladders.length - 1; d >= 0; d--) if (st.ladders[d].meta.id === ladder.meta.id) st.ladders.splice(d, 1);
                if (ladder.meta.focus && st.ladders.length) st.ladders[0].meta.focus = true;
                save(); renderLadders(); updateInjection();
            }
        });
        bindApiUI();
    }

    function refreshPanel() {
        var st = store();
        $('#xyh_worldnote').val(st ? st.worldNote || '' : '');
        $('#xyh_enabled').prop('checked', settings().enabled);
        $('#xyh_floater_toggle').prop('checked', settings().showFloater);
        $('#xyh_depth').val(settings().depth);
        applyTheme(); renderApiUI(); renderMigration(); renderLadders();
    }

    /* ---------------- 三入口 ---------------- */

    function makeFloater() {
        var el = $('<div id="xyh_floater" class="xyh-floater" title="Luciole"></div>');
        var host = $('#sheld');
        var pos = host.length ? 'position:absolute;right:10px;bottom:90px;' : 'position:fixed;right:12px;bottom:140px;';
        if (!host.length) host = $('body');
        el.attr('style', pos + 'width:40px;height:40px;border-radius:50%;z-index:30000;cursor:pointer;touch-action:none;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle,rgba(205,230,128,.12) 0%,rgba(118,180,139,.04) 45%,transparent 72%);border:0;box-shadow:none;isolation:isolate;user-select:none;-webkit-tap-highlight-color:transparent;');
        el.append($('<span class="xyh-floater-firefly" aria-hidden="true"></span>').attr('style', 'display:block;position:relative;width:18px;height:18px;border-radius:50%;pointer-events:none;background:radial-gradient(circle at 38% 32%,rgba(255,255,245,1) 0%,rgba(255,250,190,.98) 18%,rgba(248,220,105,.92) 38%,rgba(215,229,124,.62) 57%,rgba(131,187,142,.24) 75%,rgba(84,144,129,0) 100%);box-shadow:0 1px 2px rgba(30,50,42,.3),0 0 4px 1px rgba(255,241,148,.76),0 0 11px 4px rgba(218,231,126,.4),0 0 24px 8px rgba(98,168,137,.16);'));
        host.append(el);
        if (!settings().showFloater) el.hide();
        var dragging = false, moved = false, ox = 0, oy = 0;
        function start(x, y) { dragging = true; moved = false; var off = el.offset(); ox = x - off.left; oy = y - off.top; }
        function move(x, y) { if (!dragging) return; moved = true; el.css({ left: (x - ox) + 'px', top: (y - oy) + 'px', right: 'auto', bottom: 'auto' }); }
        function end() { if (dragging && !moved) { var panel = $('#xyh_panel'); if (panel.is(':visible')) panel.hide(); else { panel.show(); refreshPanel(); } } dragging = false; }
        el.on('mousedown', function (e) { start(e.pageX, e.pageY); e.preventDefault(); });
        $(document).on('mousemove', function (e) { move(e.pageX, e.pageY); }).on('mouseup', end);
        el.on('touchstart', function (e) { var t = e.originalEvent.touches[0]; start(t.pageX, t.pageY); });
        el.on('touchmove', function (e) { var t = e.originalEvent.touches[0]; move(t.pageX, t.pageY); e.preventDefault(); });
        el.on('touchend', end);
    }

    function makeWandEntry() {
        var menu = $('#extensionsMenu');
        if (!menu.length) return;
        var item = $('<div id="xyh_wand" class="list-group-item flex-container flexGap5 interactable" tabindex="0"><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#ffd76a;box-shadow:0 0 6px 2px rgba(255,215,106,.5);"></span><span>Luciole</span></div>');
        item.on('click', function () { $('#xyh_panel').show(); refreshPanel(); });
        menu.append(item);
    }

    function makeDrawer() {
        var target = $('#extensions_settings2');
        if (!target.length) target = $('#extensions_settings');
        if (!target.length) return;
        target.append('<div id="xyh_drawer" class="inline-drawer"><div class="inline-drawer-toggle inline-drawer-header"><b>🪔 Luciole</b><div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div></div><div class="inline-drawer-content"><div class="xyh-drawer-inner"><button id="xyh_open_from_drawer" class="menu_button">打开 Luciole 面板</button><label class="checkbox_label"><input type="checkbox" id="xyh_show_floater"> 显示浮标</label></div></div></div>');
        $('#xyh_open_from_drawer').on('click', function () { $('#xyh_panel').show(); refreshPanel(); });
        $('#xyh_show_floater').prop('checked', settings().showFloater).on('change', function () {
            settings().showFloater = $(this).prop('checked'); save(); $('#xyh_floater').toggle(settings().showFloater); $('#xyh_floater_toggle').prop('checked', settings().showFloater);
        });
    }

    /* ---------------- 事件接线 ---------------- */

    function onUserMessage() { return processUserTurn(); }

    function onAiMessage() {
        syncAllLineages('message_received');
        var st = store();
        if (st) for (var i = 0; i < st.ladders.length; i++) if (st.ladders[i].runtime.pending) handleAssistantDelivery(st.ladders[i]);
        updateInjection(); renderLadders(); save();
    }

    function onStoryRewrite() {
        syncAllLineages('story_rewrite');
        var st = store();
        if (st) for (var i = 0; i < st.ladders.length; i++) if (st.ladders[i].runtime.pending) handleAssistantDelivery(st.ladders[i]);
        updateInjection(); renderLadders(); save();
    }

    function onChatChanged() {
        runtimeBusy = false;
        clearLegacyInjection();
        store();
        syncAllLineages('chat_changed');
        refreshPanel(); updateInjection();
    }

    function init() {
        console.log('[Luciole] v1.5 init 开始');
        var c;
        try { c = ctx(); } catch (e) { console.log('[Luciole] getContext 失败', e); return; }
        try {
            clearLegacyInjection();
            $('body').append(panelHtml());
            makeFloater(); makeDrawer(); makeWandEntry(); bindPanel();
            store(); refreshPanel(); syncAllLineages('init'); updateInjection();
        } catch (e2) {
            console.log('[Luciole] init 出错', e2);
            return;
        }
        var ev = c.eventSource;
        var t = c.eventTypes;
        ev.on(t.MESSAGE_SENT, onUserMessage);
        ev.on(t.MESSAGE_RECEIVED, onAiMessage);
        ev.on(t.CHAT_CHANGED, onChatChanged);
        if (t.MESSAGE_DELETED) ev.on(t.MESSAGE_DELETED, onStoryRewrite);
        if (t.MESSAGE_SWIPED) ev.on(t.MESSAGE_SWIPED, onStoryRewrite);
        if (t.MESSAGE_EDITED) ev.on(t.MESSAGE_EDITED, onStoryRewrite);
        if (t.MESSAGE_UPDATED) ev.on(t.MESSAGE_UPDATED, onStoryRewrite);
        if (t.CHAT_DELETED) ev.on(t.CHAT_DELETED, onStoryRewrite);
        console.log('[Luciole] v1.5.0 帷幕点灯');
    }

    if (typeof window !== 'undefined' && window.__LUCIOLE_TEST__) {
        window.__LUCIOLE_INTERNALS__ = {
            normalizeCompileDraft: normalizeCompileDraft,
            validateCompileDraft: validateCompileDraft,
            validateCompileForActivation: validateCompileForActivation,
            validateProbe: validateProbe,
            scanUnlicensed: scanUnlicensed,
            probeMatches: probeMatches,
            computeDiff: computeDiff,
            applyDiffList: applyDiffList,
            validateGodDecision: validateGodDecision,
            normalizeGodDecision: normalizeGodDecision,
            convertLegacyChat: convertLegacyChat,
            buildLadderFromDraft: buildLadderFromDraft,
            legacyBaseline: legacyBaseline,
            buildActorPacket: buildActorPacket,
            packetLength: packetLength,
            standbyBoundary: standbyBoundary,
            firstActiveLayer: firstActiveLayer,
            domainSnapshot: domainSnapshot,
            applyFrozenPatch: applyFrozenPatch,
            retractedTarget: retractedTarget,
            eventActivity: eventActivity,
            sameLineageEntry: sameLineageEntry,
            authorizeDecision: authorizeDecision,
            handleAssistantDelivery: handleAssistantDelivery,
            handleExistingPending: handleExistingPending,
            commitPending: commitPending,
            syncLineage: syncLineage,
            eligibleClues: eligibleClues,
            buildGodContext: buildGodContext,
            godPrompt: godPrompt,
            channelLeakErrors: channelLeakErrors,
            fnv1a: fnv1a,
            exactKeys: exactKeys,
            stages: STAGES,
            layers: LAYERS
        };
    }

    if (typeof jQuery === 'function') {
        jQuery(function () {
            var tries = 0;
            var timer = setInterval(function () {
                tries++;
                var ready = false;
                try { ready = !!(window.SillyTavern && SillyTavern.getContext && SillyTavern.getContext().eventSource); } catch (e) { }
                if (ready) { clearInterval(timer); init(); }
                else if (tries > 100) { clearInterval(timer); console.log('[Luciole] 未等到 ST 就绪'); }
            }, 300);
        });
    }
})();
