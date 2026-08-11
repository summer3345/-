/* ============================================================
 * 小萤火 v1.1.0 — 叙事节奏控制器
 * 把长线从模型手里收走：机器管节奏，模型管演技。
 * 纪律：ES5 全程；零全局补丁；只用官方 SillyTavern API。
 * v1.1.0：判读 API 方案制（跟随酒馆 / 独立 URL+Key+模型，多方案保存切换）；
 *          楼层对表机制（删楼/重roll/编辑自动倒带，落地改为推导态）。
 * ============================================================ */
(function () {
    'use strict';

    var MODULE = 'luciole';
    var INJECT_KEY = 'luciole_drop';

    /* ---------------- 基础存取 ---------------- */

    function ctx() {
        return SillyTavern.getContext();
    }

    function defaults() {
        return {
            enabled: true,
            depth: 2,
            judge: false,
            showFloater: true,
            api: {
                mode: 'current',      // current = 跟随酒馆当前连接 / custom = 独立 API
                activeIndex: -1,
                profiles: []          // { name, url, key, model }
            },
            chats: {}
        };
    }

    function settings() {
        var c = ctx();
        if (!c.extensionSettings[MODULE]) {
            c.extensionSettings[MODULE] = defaults();
        }
        var s = c.extensionSettings[MODULE];
        if (typeof s.enabled !== 'boolean') s.enabled = true;
        if (!s.chats) s.chats = {};
        if (!s.depth) s.depth = 2;
        if (!s.api) s.api = defaults().api;
        if (!s.api.profiles) s.api.profiles = [];
        if (typeof s.showFloater !== 'boolean') s.showFloater = true;
        return s;
    }

    function save() {
        ctx().saveSettingsDebounced();
    }

    function chatKey() {
        var c = ctx();
        var id = null;
        try {
            id = (typeof c.getCurrentChatId === 'function') ? c.getCurrentChatId() : c.chatId;
        } catch (e) { id = null; }
        if (id === null || id === undefined || id === '') return null;
        return String(id);
    }

    function store() {
        var key = chatKey();
        if (!key) return null;
        var s = settings();
        if (!s.chats[key]) {
            s.chats[key] = { worldNote: '', ladders: [] };
        }
        if (!s.chats[key].ladders) s.chats[key].ladders = [];
        return s.chats[key];
    }

    function floorNow() {
        var c = ctx();
        return (c.chat && c.chat.length) ? c.chat.length : 0;
    }

    /* ---------------- 工具函数 ---------------- */

    function esc(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function splitKeywords(str) {
        if (!str) return [];
        var arr = String(str).split(/[,，、]/);
        var out = [];
        for (var i = 0; i < arr.length; i++) {
            var k = arr[i].replace(/^\s+|\s+$/g, '');
            if (k) out.push(k);
        }
        return out;
    }

    function textHasAny(text, keywords) {
        if (!keywords.length) return false;
        var low = String(text || '').toLowerCase();
        for (var i = 0; i < keywords.length; i++) {
            if (low.indexOf(keywords[i].toLowerCase()) !== -1) return true;
        }
        return false;
    }

    /* 事件态视野：近 N 楼正文 + 摘要（若在场）。关键词射程只画在这里。 */
    function eventText(nFloors) {
        var c = ctx();
        var parts = [];
        var chat = c.chat || [];
        var start = Math.max(0, chat.length - nFloors);
        for (var i = start; i < chat.length; i++) {
            if (chat[i] && chat[i].mes) parts.push(chat[i].mes);
        }
        parts.push(summaryText());
        return parts.join('\n');
    }

    function summaryText() {
        try {
            var c = ctx();
            var ep = c.extensionPrompts || {};
            for (var k in ep) {
                if (k.toLowerCase().indexOf('memory') !== -1 && ep[k] && ep[k].value) {
                    return String(ep[k].value);
                }
            }
        } catch (e) { }
        return '';
    }

    /* ---------------- 梯子核心 ---------------- */

    function newLadderFromForm(form) {
        return {
            id: 'xyh_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
            title: form.title || '未命名的线',
            secret: form.secret || '',
            gap: Math.max(1, parseInt(form.gap, 10) || 6),
            paused: false,
            frags: form.frags,
            cursor: 0,
            lastDropFloor: -1
        };
    }

    /* 每行：碎片文本 | 落地关键词 | 前置关键词 | 必 */
    function parseFragLines(raw) {
        var lines = String(raw || '').split('\n');
        var frags = [];
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].replace(/^\s+|\s+$/g, '');
            if (!line) continue;
            var cols = line.split('|');
            frags.push({
                text: (cols[0] || '').replace(/^\s+|\s+$/g, ''),
                land: (cols[1] || '').replace(/^\s+|\s+$/g, ''),
                pre: (cols[2] || '').replace(/^\s+|\s+$/g, ''),
                must: /必/.test(cols[3] || ''),
                state: 0,       // 0 待掉 / 1 已掉·飘着 / 2 已落地
                dropFloor: -1
            });
        }
        return frags;
    }

    function fragsToLines(frags) {
        var out = [];
        for (var i = 0; i < frags.length; i++) {
            var f = frags[i];
            out.push([f.text, f.land || '', f.pre || '', f.must ? '必' : ''].join(' | '));
        }
        return out.join('\n');
    }

    /* ============ 对表机制（v1.1 核心） ============
     * 记账原则：掉落是台账（记楼层戳），落地是推导态（从现存正文重算）。
     * 删楼、重roll、编辑之后，账自动对齐现存的戏。 */
    function reconcile() {
        var st = store();
        if (!st) return;
        var c = ctx();
        var chat = c.chat || [];
        var floor = chat.length;
        var changed = false;

        for (var i = 0; i < st.ladders.length; i++) {
            var lad = st.ladders[i];

            /* 一、倒带：掉落楼层戳比当前楼还靠后 = 那次掉落已被删进未来，撤回 */
            for (var j = 0; j < lad.frags.length; j++) {
                var f = lad.frags[j];
                if (f.state >= 1 && f.dropFloor > floor) {
                    f.state = 0;
                    f.dropFloor = -1;
                    changed = true;
                }
            }

            /* 二、落地重算：对每颗已掉碎片，从掉落楼往后的现存正文里重新扫 */
            for (var k = 0; k < lad.frags.length; k++) {
                var g = lad.frags[k];
                if (g.state < 1) continue;
                var kws = splitKeywords(g.land);
                var landed = false;
                if (!kws.length) {
                    /* 无关键词：掉落楼之后存在任意 AI 楼即算落地 */
                    for (var m = g.dropFloor; m < chat.length; m++) {
                        if (chat[m] && !chat[m].is_user) { landed = true; break; }
                    }
                } else {
                    for (var n = Math.max(0, g.dropFloor); n < chat.length; n++) {
                        if (chat[n] && chat[n].mes && textHasAny(chat[n].mes, kws)) {
                            landed = true; break;
                        }
                    }
                }
                var newState = landed ? 2 : 1;
                if (g.state !== newState) { g.state = newState; changed = true; }
            }

            /* 三、游标与楼距基准重算（掉落按序，倒带只发生在尾部，前缀性质成立） */
            var cnt = 0;
            var lastDrop = -1;
            for (var q = 0; q < lad.frags.length; q++) {
                if (lad.frags[q].state >= 1) {
                    cnt++;
                    if (lad.frags[q].dropFloor > lastDrop) lastDrop = lad.frags[q].dropFloor;
                }
            }
            if (lad.cursor !== cnt) { lad.cursor = cnt; changed = true; }
            if (lad.lastDropFloor !== lastDrop) { lad.lastDropFloor = lastDrop; changed = true; }
        }

        if (changed) save();
    }

    /* 掉落评估：便宜闸门当保安，判读当法官（可选） */
    function evaluateDrops() {
        var s = settings();
        var st = store();
        if (!s.enabled || !st) return Promise.resolve();
        reconcile();
        var floor = floorNow();
        var chain = Promise.resolve();

        for (var i = 0; i < st.ladders.length; i++) {
            (function (lad) {
                chain = chain.then(function () {
                    return tryDropLadder(lad, floor);
                });
            })(st.ladders[i]);
        }
        return chain.then(function () {
            save();
            updateInjection();
        });
    }

    function tryDropLadder(lad, floor) {
        if (lad.paused) return Promise.resolve();
        if (lad.cursor >= lad.frags.length) return Promise.resolve();

        /* 闸门一：上一颗必须落地 */
        if (lad.cursor > 0 && lad.frags[lad.cursor - 1].state === 1) return Promise.resolve();
        /* 闸门二：楼距地板 */
        if (lad.lastDropFloor >= 0 && (floor - lad.lastDropFloor) < lad.gap) return Promise.resolve();

        var frag = lad.frags[lad.cursor];
        /* 闸门三：前置关键词（射程 = 近 30 楼正文 + 摘要，卡与世界书不进） */
        var preKws = splitKeywords(frag.pre);
        if (preKws.length && !textHasAny(eventText(30), preKws)) return Promise.resolve();

        /* 法官：判读（关着或失败都放行——失败退回纯楼距模式） */
        if (!settings().judge) {
            dropFrag(lad, frag, floor);
            return Promise.resolve();
        }
        return askJudge(frag).then(function (verdict) {
            if (verdict !== '等') dropFrag(lad, frag, floor);
        }, function () {
            dropFrag(lad, frag, floor);
        });
    }

    function dropFrag(lad, frag, floor) {
        frag.state = 1;
        frag.dropFloor = floor;
        lad.cursor += 1;
        lad.lastDropFloor = floor;
        toast('🌟 Luciole：「' + lad.title + '」掉落了一颗线索');
    }

    /* ---------------- 判读 API（方案制） ---------------- */

    function charCardText() {
        try {
            var c = ctx();
            var ch = c.characters && c.characters[c.characterId];
            if (!ch) return '';
            var parts = [];
            if (ch.description) parts.push(ch.description);
            if (ch.personality) parts.push(ch.personality);
            return parts.join('\n').slice(0, 2000);
        } catch (e) { return ''; }
    }

    function personaText() {
        try {
            var c = ctx();
            var p = c.powerUserSettings && c.powerUserSettings.persona_description;
            return p ? String(p).slice(0, 800) : '';
        } catch (e) { return ''; }
    }

    function judgePrompt(frag) {
        var st = store();
        return [
            '你是场记，判断此刻是否适合在剧情中投放一条线索。只回答一个字：掉 或 等。',
            '【角色设定】', charCardText() || '（无）',
            '【用户人设】', personaText() || '（无）',
            '【世界观要点】', (st && st.worldNote) || '（无）',
            '【近期摘要】', summaryText().slice(0, 1500) || '（无）',
            '【最近两楼正文】', eventText(2).slice(0, 3000) || '（无）',
            '【待投放的线索】', frag.text,
            '规则：若当下戏剧氛围与该线索的浮现方式贴合，回答"掉"；若此刻投放会打断当前情绪节奏或显得突兀，回答"等"。只输出一个字。'
        ].join('\n');
    }

    /* URL 自动补全：兼容 中转站 / Gemini openai 端点 / 裸域名 */
    function normalizeUrl(url) {
        var u = String(url || '').replace(/\s+/g, '');
        if (!u) return '';
        u = u.replace(/\/+$/, '');
        if (u.indexOf('completions') !== -1) return u;
        if (/\/v1$|\/v1beta$|\/openai$/.test(u)) return u + '/chat/completions';
        return u + '/v1/chat/completions';
    }

    function activeProfile() {
        var api = settings().api;
        if (api.activeIndex < 0 || api.activeIndex >= api.profiles.length) return null;
        return api.profiles[api.activeIndex];
    }

    function callCustomApi(prompt) {
        var prof = activeProfile();
        if (!prof || !prof.url) {
            return Promise.reject(new Error('未配置独立 API 方案'));
        }
        var url = normalizeUrl(prof.url);
        return fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + (prof.key || '')
            },
            body: JSON.stringify({
                model: prof.model || '',
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 10,
                temperature: 0
            })
        }).then(function (res) {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.json();
        }).then(function (data) {
            var msg = data && data.choices && data.choices[0] && data.choices[0].message;
            return String((msg && msg.content) || '');
        });
    }

    function callCurrentApi(prompt) {
        return new Promise(function (resolve, reject) {
            var c = ctx();
            if (typeof c.generateQuietPrompt !== 'function') { reject(new Error('no api')); return; }
            var p;
            try {
                p = c.generateQuietPrompt({ quietPrompt: prompt });
            } catch (e) {
                try { p = c.generateQuietPrompt(prompt, false, true); }
                catch (e2) { reject(e2); return; }
            }
            Promise.resolve(p).then(function (res) { resolve(String(res || '')); }, reject);
        });
    }

    function askJudge(frag) {
        var prompt = judgePrompt(frag);
        var call = (settings().api.mode === 'custom') ? callCustomApi(prompt) : callCurrentApi(prompt);
        return call.then(function (res) {
            return String(res).indexOf('等') !== -1 ? '等' : '掉';
        });
    }

    /* ---------------- 注入 ---------------- */

    function updateInjection() {
        var c = ctx();
        var s = settings();
        var st = store();
        var lines = [];
        if (s.enabled && st) {
            for (var i = 0; i < st.ladders.length; i++) {
                var lad = st.ladders[i];
                for (var j = 0; j < lad.frags.length; j++) {
                    var f = lad.frags[j];
                    if (f.state === 1) {
                        lines.push('- ' + (f.must ? '（本轮回复必须出现）' : '') + f.text);
                    }
                }
            }
        }
        var text = '';
        if (lines.length) {
            text = '【线索递送】以下线索应在后续剧情中自然浮现。漏，非撬：通过细节、行为与只言片语流露，不得直接说破其背后的含义或真相，不得让角色表现出刻意的暗示感。\n' + lines.join('\n');
        }
        try {
            c.setExtensionPrompt(INJECT_KEY, text, 1, s.depth, false, 0);
        } catch (e) {
            try { c.setExtensionPrompt(INJECT_KEY, text, 1, s.depth); } catch (e2) { }
        }
    }

    /* ---------------- UI ---------------- */

    function toast(msg) {
        try { toastr.info(msg, '', { timeOut: 2500 }); } catch (e) { }
    }

    var editingId = null;

    function panelHtml() {
        return '' +
        '<div id="xyh_panel" class="xyh-panel" style="display:none;">' +
        '  <div class="xyh-head">' +
        '    <span class="xyh-title"><span class="xyh-dot xyh-dot-lit"></span> Luciole</span>' +
        '    <span class="xyh-close" id="xyh_close">×</span>' +
        '  </div>' +
        '  <div class="xyh-body">' +
        '    <div class="xyh-row xyh-toggles">' +
        '      <label><input type="checkbox" id="xyh_enabled"> 启用</label>' +
        '      <label><input type="checkbox" id="xyh_judge"> 判读（掉得更准，多一次 API 调用）</label>' +
        '      <label>深度 <input type="number" id="xyh_depth" min="0" max="20" class="xyh-num"></label>' +
        '    </div>' +
        '    <div class="xyh-row xyh-api" id="xyh_api_box">' +
        '      <div class="xyh-label">判读用哪路 API</div>' +
        '      <div class="xyh-toggles" style="margin-bottom:8px;">' +
        '        <label><input type="radio" name="xyh_api_mode" value="current"> 跟随酒馆当前连接</label>' +
        '        <label><input type="radio" name="xyh_api_mode" value="custom"> 独立 API</label>' +
        '      </div>' +
        '      <div id="xyh_api_custom" style="display:none;">' +
        '        <div class="xyh-inline" style="margin-bottom:8px;">' +
        '          <select id="xyh_api_select" class="xyh-select"></select>' +
        '          <span class="xyh-btn xyh-danger" id="xyh_api_del">删除方案</span>' +
        '        </div>' +
        '        <input type="text" id="xyh_api_name" placeholder="方案名（如：我的Gemini / 某中转）">' +
        '        <input type="text" id="xyh_api_url" placeholder="API 地址（贴到 /v1 即可，自动补全）">' +
        '        <input type="text" id="xyh_api_key" placeholder="API Key">' +
        '        <input type="text" id="xyh_api_model" placeholder="模型名（如 gemini-2.5-flash / claude-haiku-4-5）">' +
        '        <div class="xyh-form-btns">' +
        '          <button id="xyh_api_save" class="menu_button">保存方案</button>' +
        '          <button id="xyh_api_test" class="menu_button">测试连接</button>' +
        '        </div>' +
        '      </div>' +
        '    </div>' +
        '    <div class="xyh-row">' +
        '      <div class="xyh-label">世界观要点（只喂给判读，不注入正文，可空）</div>' +
        '      <textarea id="xyh_worldnote" rows="2" placeholder="给判读法官的背景速览，比如：赤霄会是反派组织，主角尚不知情"></textarea>' +
        '    </div>' +
        '    <div id="xyh_ladders" class="xyh-ladders"></div>' +
        '    <div class="xyh-form">' +
        '      <div class="xyh-label" id="xyh_form_title">种一条新线</div>' +
        '      <input type="text" id="xyh_f_title" placeholder="这条线叫什么（如：女主的阵营秘密）">' +
        '      <input type="text" id="xyh_f_secret" placeholder="终点备注：真相是什么（只有你看得见，永不注入）">' +
        '      <label class="xyh-inline">最少隔几楼掉一颗 <input type="number" id="xyh_f_gap" value="6" min="1" class="xyh-num"></label>' +
        '      <textarea id="xyh_f_frags" rows="6" placeholder="一行一颗碎片，从早到晚排。格式：\n碎片内容 | 落地关键词(可空) | 前置关键词(可空) | 必\n\n例：\n她听到赤霄会三个字时有一瞬间的停顿 | 停顿,愣 | |\n她深夜发出过一条没头没尾的讯息 | 讯息,消息 | 停顿 |\n她与灰衣人在巷口碰面被目击 | 灰衣,巷口 | | 必"></textarea>' +
        '      <div class="xyh-form-btns">' +
        '        <button id="xyh_f_save" class="menu_button">种下</button>' +
        '        <button id="xyh_f_cancel" class="menu_button" style="display:none;">取消编辑</button>' +
        '      </div>' +
        '    </div>' +
        '  </div>' +
        '</div>';
    }

    function fireflyRow(lad) {
        var html = '<span class="xyh-flies">';
        for (var i = 0; i < lad.frags.length; i++) {
            var f = lad.frags[i];
            var cls = f.state === 2 ? 'xyh-dot-lit' : (f.state === 1 ? 'xyh-dot-blink' : 'xyh-dot-dim');
            html += '<span class="xyh-dot ' + cls + '" title="' + esc(f.text) + '"></span>';
        }
        html += '</span>';
        return html;
    }

    function renderLadders() {
        var st = store();
        var box = $('#xyh_ladders');
        if (!box.length) return;
        if (!st || !st.ladders.length) {
            box.html('<div class="xyh-empty">还没有线。把卡里的秘密剪出来，种在下面——卡里记得删掉原句，留在卡里的秘密谁也藏不住。</div>');
            return;
        }
        var html = '';
        for (var i = 0; i < st.ladders.length; i++) {
            var lad = st.ladders[i];
            var done = 0;
            for (var j = 0; j < lad.frags.length; j++) if (lad.frags[j].state === 2) done++;
            var floating = (lad.cursor > 0 && lad.frags[lad.cursor - 1] && lad.frags[lad.cursor - 1].state === 1);
            html += '<div class="xyh-ladder' + (lad.paused ? ' xyh-paused' : '') + '" data-id="' + lad.id + '">' +
                '<div class="xyh-ladder-top">' +
                '  <span class="xyh-ladder-name">' + esc(lad.title) + '</span>' +
                fireflyRow(lad) +
                '</div>' +
                '<div class="xyh-ladder-meta">' + done + '/' + lad.frags.length + ' 已落地' +
                (floating ? ' · 有一颗飘着' : '') +
                (lad.paused ? ' · 已暂停' : '') +
                ' · 楼距 ' + lad.gap + '</div>' +
                '<div class="xyh-ladder-btns">' +
                '  <span class="xyh-btn" data-act="drop">手动掉一颗</span>' +
                '  <span class="xyh-btn" data-act="back">回退一格</span>' +
                '  <span class="xyh-btn" data-act="land">标记落地</span>' +
                '  <span class="xyh-btn" data-act="pause">' + (lad.paused ? '继续' : '暂停') + '</span>' +
                '  <span class="xyh-btn" data-act="edit">编辑</span>' +
                '  <span class="xyh-btn xyh-danger" data-act="del">删除</span>' +
                '</div>' +
                '</div>';
        }
        box.html(html);
    }

    function findLadder(id) {
        var st = store();
        if (!st) return null;
        for (var i = 0; i < st.ladders.length; i++) {
            if (st.ladders[i].id === id) return st.ladders[i];
        }
        return null;
    }

    /* ---- API 方案 UI ---- */

    function renderApiUI() {
        var api = settings().api;
        $('input[name="xyh_api_mode"][value="' + api.mode + '"]').prop('checked', true);
        $('#xyh_api_custom').toggle(api.mode === 'custom');
        var sel = $('#xyh_api_select');
        sel.empty();
        if (!api.profiles.length) {
            sel.append('<option value="-1">（还没有方案）</option>');
        } else {
            for (var i = 0; i < api.profiles.length; i++) {
                sel.append('<option value="' + i + '"' + (i === api.activeIndex ? ' selected' : '') + '>' +
                    esc(api.profiles[i].name || ('方案' + (i + 1))) + '</option>');
            }
        }
        fillApiFields();
    }

    function fillApiFields() {
        var prof = activeProfile();
        $('#xyh_api_name').val(prof ? prof.name : '');
        $('#xyh_api_url').val(prof ? prof.url : '');
        $('#xyh_api_key').val(prof ? prof.key : '');
        $('#xyh_api_model').val(prof ? prof.model : '');
    }

    function bindApiUI() {
        $('input[name="xyh_api_mode"]').on('change', function () {
            var api = settings().api;
            api.mode = $(this).val();
            $('#xyh_api_custom').toggle(api.mode === 'custom');
            save();
        });
        $('#xyh_api_select').on('change', function () {
            var api = settings().api;
            api.activeIndex = parseInt($(this).val(), 10);
            save();
            fillApiFields();
        });
        $('#xyh_api_save').on('click', function () {
            var api = settings().api;
            var prof = {
                name: $('#xyh_api_name').val() || ('方案' + (api.profiles.length + 1)),
                url: $('#xyh_api_url').val(),
                key: $('#xyh_api_key').val(),
                model: $('#xyh_api_model').val()
            };
            if (!prof.url) { toast('API 地址不能为空'); return; }
            /* 同名覆盖，否则新增 */
            var idx = -1;
            for (var i = 0; i < api.profiles.length; i++) {
                if (api.profiles[i].name === prof.name) { idx = i; break; }
            }
            if (idx >= 0) { api.profiles[idx] = prof; api.activeIndex = idx; }
            else { api.profiles.push(prof); api.activeIndex = api.profiles.length - 1; }
            save();
            renderApiUI();
            toast('方案「' + prof.name + '」已保存并启用');
        });
        $('#xyh_api_del').on('click', function () {
            var api = settings().api;
            if (api.activeIndex < 0 || !api.profiles.length) return;
            var name = api.profiles[api.activeIndex].name;
            if (!confirm('删除方案「' + name + '」？')) return;
            api.profiles.splice(api.activeIndex, 1);
            api.activeIndex = api.profiles.length ? 0 : -1;
            save();
            renderApiUI();
        });
        $('#xyh_api_test').on('click', function () {
            var prof = {
                name: 'test',
                url: $('#xyh_api_url').val(),
                key: $('#xyh_api_key').val(),
                model: $('#xyh_api_model').val()
            };
            if (!prof.url) { toast('先填 API 地址'); return; }
            toast('测试中……');
            fetch(normalizeUrl(prof.url), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + (prof.key || '')
                },
                body: JSON.stringify({
                    model: prof.model || '',
                    messages: [{ role: 'user', content: '回复"通"一个字' }],
                    max_tokens: 5,
                    temperature: 0
                })
            }).then(function (res) {
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return res.json();
            }).then(function () {
                toast('✅ 连接通了');
            }, function (err) {
                toast('❌ 没通：' + err.message);
            });
        });
    }

    function bindPanel() {
        var s = settings();
        $('#xyh_enabled').prop('checked', s.enabled).on('change', function () {
            s.enabled = $(this).prop('checked'); save(); updateInjection();
        });
        $('#xyh_judge').prop('checked', s.judge).on('change', function () {
            s.judge = $(this).prop('checked'); save();
            $('#xyh_api_box').toggle(s.judge);
        });
        $('#xyh_api_box').toggle(s.judge);
        $('#xyh_depth').val(s.depth).on('change', function () {
            s.depth = Math.max(0, parseInt($(this).val(), 10) || 2); save(); updateInjection();
        });
        $('#xyh_worldnote').on('change', function () {
            var st = store(); if (st) { st.worldNote = $(this).val(); save(); }
        });
        $('#xyh_close').on('click', function () { $('#xyh_panel').hide(); });

        bindApiUI();

        $('#xyh_f_save').on('click', function () {
            var frags = parseFragLines($('#xyh_f_frags').val());
            if (!frags.length) { toast('至少种一颗碎片'); return; }
            var form = {
                title: $('#xyh_f_title').val(),
                secret: $('#xyh_f_secret').val(),
                gap: $('#xyh_f_gap').val(),
                frags: frags
            };
            var st = store();
            if (!st) { toast('先打开一个聊天'); return; }
            if (editingId) {
                var lad = findLadder(editingId);
                if (lad) {
                    lad.title = form.title || lad.title;
                    lad.secret = form.secret;
                    lad.gap = Math.max(1, parseInt(form.gap, 10) || lad.gap);
                    for (var i = 0; i < frags.length; i++) {
                        if (lad.frags[i]) {
                            frags[i].state = lad.frags[i].state;
                            frags[i].dropFloor = lad.frags[i].dropFloor;
                        }
                    }
                    lad.frags = frags;
                    if (lad.cursor > frags.length) lad.cursor = frags.length;
                }
                editingId = null;
                $('#xyh_f_cancel').hide();
                $('#xyh_form_title').text('种一条新线');
            } else {
                st.ladders.push(newLadderFromForm(form));
            }
            $('#xyh_f_title').val(''); $('#xyh_f_secret').val('');
            $('#xyh_f_frags').val(''); $('#xyh_f_gap').val('6');
            save(); reconcile(); renderLadders(); updateInjection();
        });

        $('#xyh_f_cancel').on('click', function () {
            editingId = null;
            $(this).hide();
            $('#xyh_form_title').text('种一条新线');
            $('#xyh_f_title').val(''); $('#xyh_f_secret').val('');
            $('#xyh_f_frags').val(''); $('#xyh_f_gap').val('6');
        });

        $('#xyh_ladders').on('click', '.xyh-btn', function () {
            var id = $(this).closest('.xyh-ladder').attr('data-id');
            var act = $(this).attr('data-act');
            var lad = findLadder(id);
            var st = store();
            if (!lad || !st) return;

            if (act === 'drop') {
                if (lad.cursor < lad.frags.length) {
                    dropFrag(lad, lad.frags[lad.cursor], floorNow());
                }
            } else if (act === 'back') {
                if (lad.cursor > 0) {
                    lad.cursor -= 1;
                    var f = lad.frags[lad.cursor];
                    f.state = 0; f.dropFloor = -1;
                }
            } else if (act === 'land') {
                for (var i = 0; i < lad.frags.length; i++) {
                    if (lad.frags[i].state === 1) lad.frags[i].state = 2;
                }
            } else if (act === 'pause') {
                lad.paused = !lad.paused;
            } else if (act === 'edit') {
                editingId = lad.id;
                $('#xyh_f_title').val(lad.title);
                $('#xyh_f_secret').val(lad.secret);
                $('#xyh_f_gap').val(lad.gap);
                $('#xyh_f_frags').val(fragsToLines(lad.frags));
                $('#xyh_form_title').text('编辑：' + lad.title);
                $('#xyh_f_cancel').show();
            } else if (act === 'del') {
                if (!confirm('删除「' + lad.title + '」？这条线的进度会一并消失。')) return;
                for (var k = 0; k < st.ladders.length; k++) {
                    if (st.ladders[k].id === id) { st.ladders.splice(k, 1); break; }
                }
            }
            save(); renderLadders(); updateInjection();
        });
    }

    function refreshPanel() {
        var st = store();
        $('#xyh_worldnote').val(st ? (st.worldNote || '') : '');
        renderApiUI();
        renderLadders();
    }

    /* 浮标：可拖动，可停避风塘 */
    function makeFloater() {
        var el = $('<div id="xyh_floater" class="xyh-floater" title="Luciole"><span class="xyh-dot xyh-dot-lit xyh-floater-dot"></span></div>');
        $('body').append(el);
        if (!settings().showFloater) el.hide();
        var dragging = false, moved = false, ox = 0, oy = 0;

        function start(x, y) {
            dragging = true; moved = false;
            var off = el.offset();
            ox = x - off.left; oy = y - off.top;
        }
        function move(x, y) {
            if (!dragging) return;
            moved = true;
            el.css({ left: (x - ox) + 'px', top: (y - oy) + 'px', right: 'auto', bottom: 'auto' });
        }
        function end() {
            if (dragging && !moved) {
                var p = $('#xyh_panel');
                if (p.is(':visible')) p.hide();
                else { p.show(); refreshPanel(); }
            }
            dragging = false;
        }

        el.on('mousedown', function (e) { start(e.pageX, e.pageY); e.preventDefault(); });
        $(document).on('mousemove', function (e) { move(e.pageX, e.pageY); });
        $(document).on('mouseup', end);
        el.on('touchstart', function (e) {
            var t = e.originalEvent.touches[0]; start(t.pageX, t.pageY);
        });
        el.on('touchmove', function (e) {
            var t = e.originalEvent.touches[0]; move(t.pageX, t.pageY); e.preventDefault();
        });
        el.on('touchend', end);
    }

    /* 抽屉入口：挂进扩展程序面板，跟其他插件排排坐 */
    function makeDrawer() {
        var html = '' +
        '<div id="xyh_drawer" class="inline-drawer">' +
        '  <div class="inline-drawer-toggle inline-drawer-header">' +
        '    <b>🌟 Luciole</b>' +
        '    <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>' +
        '  </div>' +
        '  <div class="inline-drawer-content">' +
        '    <div class="xyh-drawer-inner">' +
        '      <button id="xyh_open_from_drawer" class="menu_button">打开 Luciole 面板</button>' +
        '      <label class="checkbox_label"><input type="checkbox" id="xyh_show_floater"> 显示浮标（可停避风塘）</label>' +
        '    </div>' +
        '  </div>' +
        '</div>';
        var target = $('#extensions_settings2');
        if (!target.length) target = $('#extensions_settings');
        if (!target.length) return;
        target.append(html);
        $('#xyh_open_from_drawer').on('click', function () {
            $('#xyh_panel').show();
            refreshPanel();
        });
        $('#xyh_show_floater').prop('checked', settings().showFloater).on('change', function () {
            var s = settings();
            s.showFloater = $(this).prop('checked');
            save();
            $('#xyh_floater').toggle(s.showFloater);
        });
    }

    /* ---------------- 事件接线 ---------------- */

    function onUserMessage() {
        return evaluateDrops();
    }

    function onAiMessage() {
        reconcile();
        updateInjection();
        renderLadders();
    }

    function onStoryRewrite() {
        /* 删楼 / 重roll / 编辑：对表倒带 */
        reconcile();
        updateInjection();
        renderLadders();
    }

    function onChatChanged() {
        reconcile();
        refreshPanel();
        updateInjection();
    }

    function init() {
        console.log('[Luciole] init 开始');
        var c;
        try { c = ctx(); } catch (e) { console.log('[Luciole] getContext 失败', e); return; }
        try {
            $('body').append(panelHtml());
            makeFloater();
            makeDrawer();
            bindPanel();
            refreshPanel();
            reconcile();
            updateInjection();
        } catch (e) {
            console.log('[Luciole] init 出错：', e && e.message, e);
            return;
        }

        var ev = c.eventSource;
        var t = c.eventTypes;
        ev.on(t.MESSAGE_SENT, onUserMessage);
        ev.on(t.MESSAGE_RECEIVED, onAiMessage);
        ev.on(t.CHAT_CHANGED, onChatChanged);
        /* 改写类事件：不同 ST 版本暴露面不同，逐个探测，有则接 */
        if (t.MESSAGE_DELETED) ev.on(t.MESSAGE_DELETED, onStoryRewrite);
        if (t.MESSAGE_SWIPED) ev.on(t.MESSAGE_SWIPED, onStoryRewrite);
        if (t.MESSAGE_EDITED) ev.on(t.MESSAGE_EDITED, onStoryRewrite);
        if (t.MESSAGE_UPDATED) ev.on(t.MESSAGE_UPDATED, onStoryRewrite);
        if (t.CHAT_DELETED) ev.on(t.CHAT_DELETED, onStoryRewrite);

        console.log('[Luciole] v1.1.1 点灯');
    }

    jQuery(function () {
        var tries = 0;
        var timer = setInterval(function () {
            tries++;
            var ok = false;
            try { ok = !!(window.SillyTavern && SillyTavern.getContext && SillyTavern.getContext().eventSource); } catch (e) { }
            if (ok) { clearInterval(timer); init(); }
            else if (tries > 100) { clearInterval(timer); console.log('[Luciole] 未等到 ST 就绪'); }
        }, 300);
    });
})();
