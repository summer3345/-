
/*
 * Arrebol D 暗河红霞导演系统 v1.10.0｜ripple & GPT & Claude
 * v1.12.0 卡的生命周期：专属／通用／NSFW 三格各自勾选，三段抽；择池 API 并入预设机器；刷新不再覆盖编辑区（施工：波哥 Claude Fable 5）
 * v1.13.0 放养模式：手动放养自动归队——一键撕下当前导演稿，轮换照常走，到下个换稿点自动生成归队；双导演各自独立放养（施工：波哥 Claude Fable 5）
 * v1.13.1 DS 视野随节奏走：兑现判定回看范围挂钩半衰期、择池挂钩投卡间隔，不再钉死 4/6 轮；下限不缩水，上限 12 轮/8000 字（提议：ripple；施工：波哥 Claude Fable 5）
 * v1.13.2 口径免疫：计数改为数楼不数字，预设正则开关不再扳动导演节奏；离谱差值静默对齐由一次性改为常任守卫（报告：MoMo；施工：波哥 Claude Fable 5）
 * v1.14.0 改头换面第一刀：分析按钮二合一（补充指令空=普通分析）；进阶开关与校对诊断分层入抽屉且开合有记忆；一键横幅瘦身；圆/方开关形状语法；右缘留缝防误触（产品：ripple；施工：波哥 Claude Fable 5）
 * v1.14.1 人话文案包：全部按钮与开关说明改直白话，逐条经 ripple 批签，一个不驳回（文案：波哥；批签：ripple）
 * v1.14.2 命中区收身：开关 label 不再拉满整行，点击区只包住圆圈+文字，空白区不再误触（报告：ripple）
 * v1.16.3 删楼不罚楼：no-shrink 铁律误伤真删除，删楼即进度清零且被双重罚楼；现真删除时基准线随差值平移、进度原地保住，
 *          MESSAGE_DELETED 事件直连+轮询缩水兜底旧酒馆，抽卡小能手基准线同步位移；partial 小读数保护原样保留（报告：ripple；施工：波哥 Claude Fable 5）
 * v1.17.0 三仓库多选+一库一槽：仓库槽从单选下拉改为点选芯片可挂多副；库文本拼接入池，三段抽/张数统计零改动吃到多库；
 *          挂进某槽的库从其余槽候选剔除；旧单库存档归一成数组无痛迁移，改名/删除/导入全链路同步（提议：ripple；施工：波哥 Claude Fable 5）
 * v1.17.1 导入落点补漏：落点下拉无持久化，iOS 文件选择往返重绘面板即复位，"导入并挂载"静默落空；
 *          改为账号级落盘+导入读存档不读 DOM+双面板镜像（报告：ripple；施工：波哥 Claude Fable 5）
 * v1.17.2 落点管保存：用户直觉是"选落点→保存＝挂载"，工具迎合直觉——保存未挂载的库时按落点自动挂进仓库并启用；
 *          已挂载的库保持原位不搬家；回执明说挂载去向（三连现场报告：ripple；施工：波哥 Claude Fable 5）
 * v1.18.0 归属制：概念纠偏——"挂入"从"点亮启用"改为"放进箱子"。每副库有账号级永久归属，只出现在自家仓库格；
 *          点亮/熄灭降级为"这局用不用"的聊天级开关，熄灭不流放；未分箱库虚线显示、点亮即认箱，落点保存/导入即入住/搬家；
 *          老存档首次读取自动按当前点亮认箱（概念设计：ripple；施工：波哥 Claude Fable 5）
 * 抽屉内嵌稳定版：
 * - 情感导演 / 统筹 双页面
 * - 双 API / 双模型 / 双预设 / 双侧独立 API 档案
 * - 拉取模型
 * - 本地测试
 * - 直接分析
 * - 自动注入到当前聊天，下一轮可读到
 */

(function () {
    "use strict";

    var EXT = "arrebol-d-final-v1040-stable-settings";
    var EMOTION_PRESET = "你是 RP 情感导演。请阅读最近的聊天内容和用户补充信息，只分析情感曲线与人设稳定，不写正文。\n\n你需要判断：\n1. 当前关系阶段是什么。\n2. 情绪温度是否过热、过冷、空转或错拍。\n3. 角色是否出现 OOC 风险。\n4. 是否存在秒爱、秒软、秒承诺、隐藏深情化。\n5. 是否把照顾误写成占有，把心疼误写成告白。\n6. 是否过度代演用户的心理与选择。\n7. 当前角色根据人设应该如何承接情绪。\n8. 下一阶段情感应该升温、降温、维持、错拍，还是延迟。\n\n输出必须短，不超过 300 字。不要写分析过程。不要写正文。只给下一阶段情感方向，要给可执行动作与明确禁区。\n\n固定输出格式：\n【情感方向】\n……\n\n【人设边界】\n……\n\n【避免】\n……";
    var PLOT_PRESET = "你是 RP 剧组统筹。请阅读最近的聊天内容、跟组记录与投卡史，一次调用完成四件事，不写正文。\n\n一、派人：调度 NPC 进出场；把久未出场的冷板凳角色捞回场上；给最近投放的无专名事件卡选角——把「某人/口信/来客」铸成戏里真实存在的具体角色。\n二、顺场：检查转场衔接与叙事流畅，指出哪里硌牙、怎么顺。\n三、收线：盘点既有伏笔与已投的事件卡，点名哪条该兑现、哪条再压一压；撒出去的钩子不许无限堆积。\n四、急诊与验收：若因 NG 会诊被请来，先诊断重 roll 原因；若有此前指导，先用一两句评估执行情况。\n\n输出纪律（硬性）：每条意见必须带名字带条目——「让欠主角人情的老周把口信送到」合格；「推进剧情」「增加张力」这类纯口号视为不合格输出，禁止出现。\n不要替用户决定行动。不要写正文。不要写分析过程。输出必须短，不超过 350 字。\n\n固定输出格式：\n【派人】\n……\n\n【顺场】\n……\n\n【收线】\n……\n\n【本轮重点】\n……";
    // v1.10.0：红霞转岗统筹（派人/顺场/收线/急诊验收四职打包）。旧版预设原文留档，仅用于化石合并。
    var PLOT_PRESET_LEGACY = "你是 RP 剧情导演。请阅读最近的聊天内容和用户补充信息，只分析剧情推进、事件张力、伏笔与场景调度，不写正文。\n\n你需要判断：\n1. 当前剧情是否停滞、空转或重复。\n2. 场景是否需要推进、转场、插入事件、制造阻碍，还是维持压抑。\n3. 哪些伏笔可以轻轻回收，哪些伏笔不能急着揭开。\n4. NPC、环境、现实阻尼是否应该介入。\n5. 当前剧情的下一步应该发生什么“可执行事件”。\n6. 避免强行相遇、强行表白、强行救场、巧合堆叠。\n7. 不要替用户决定行动，只给世界和角色侧的推进方向。\n\n输出必须短，不超过 300 字。不要写正文。不要写分析过程。只给下一阶段剧情方向。\n\n固定输出格式：\n【剧情推进】\n……\n\n【事件抓手】\n……\n\n【避免】\n……";
    var DEFAULTS = {
        activeTab: "emotion",
        masterEnabled: true,
        autoInjectEmotion: true,
        autoInjectPlot: true,
        injectMode: "visible",
        showFloatingWindow: true,
        dawnTheme: false,           // v1.14.4 开灯：浮窗朝霞浅色皮，默认关（暗河红霞）
        showAutoTriggerPopup: true,
        directorLogEnabled: true,
        ngDetectEnabled: true,
        floatInjectEnabled: true,
        floatDepth: 2,
        fabLeft: null,
        fabTop: null,
        autoTriggerEmotion: false,
        autoTriggerPlot: false,
        autoTriggerEmotionRange: "20",
        autoTriggerPlotRange: "20",
        autoTriggerEmotionCustomRange: 0,
        autoTriggerPlotCustomRange: 0,
        lastAutoTriggerChatKey: "",
        lastAutoTriggerEmotionCount: -1,
        lastAutoTriggerPlotCount: -1,

        range: "30",
        customRange: 0,
        supplementMemory: "",
        contentTagNames: "content",

        emotionApiEndpoint: "",
        emotionApiKey: "",
        emotionModel: "",
        emotionPreset: EMOTION_PRESET,
        emotionPreview: "",

        plotApiEndpoint: "",
        plotApiKey: "",
        plotModel: "",
        plotPreset: PLOT_PRESET,
        plotPreview: "",

        // v1.10.0 抽卡剧情小能手（账号级；卡库本体走 adrCdLibraries() 懒初始化，避免 DEFAULTS 对象引用共享；
        // cdEnvelope 空串表示使用出厂信封 ADR_CD_DEFAULT_ENVELOPE）
        cdEnabled: false,
        cdN: 5,
        cdCooldown: 8,
        cdDepth: 2,
        cdMode: "blind",
        // v1.11 三仓库槽的账号级默认值（新聊天开局继承这一份；聊天级覆盖存 chat_metadata）
        cdSlotDefaults: null,
        cdSlotOnDefaults: null,
        cdEnvelope: "",
        cdEnvelopeFaded: "",
        // v1.12 卡的生命周期
        cdEnvelopes: null,          // 信封预设仓库（懒初始化，避免 DEFAULTS 对象引用共享）
        cdEnvelopeCurrent: "标准",
        cdHalfLife: true,           // 半衰期：挂过 N/2 楼自动降级为背景
        cdAutoDone: false,          // 到半衰期时问一次 DS「兑现没」，默认关（要花钱）
        cdApiEndpoint: "",
        cdApiKey: "",
        cdModel: "deepseek-chat"
    };

    var initialized = false;
    var processing = false;
    var aborter = null;
    var adrDAbortWasManual = false;

    // v1.9.26：自动触发失败保拍后的首报/退避状态。
    // 只服务于“这一拍没结算时稍后重试”，不参与 baseline 数学。
    var adrDAutoFailureReportedByBeat = {};
    var adrDAutoRetryByBeat = {};
    var ADR_D_AUTO_RETRY_DELAYS = [45000, 90000, 120000, 180000];

    var ADR048_FAB_REGISTRY_KEY = "__arrebolD_fab_owner_v1922__";
    var ADR048_FAB_INSTANCE_ID = "adr048-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);

    function rootWin() {
        try {
            if (window.top && window.top.document) return window.top;
        } catch (e) {}
        return window;
    }

    function rootDoc() {
        try {
            var w = rootWin();
            if (w && w.document) return w.document;
        } catch (e) {}
        return document;
    }

    function ctx() {
        return SillyTavern.getContext();
    }

    function q(sel) {
        var d = rootDoc();
        try {
            var el = d.querySelector(sel);
            if (el) return el;
        } catch (e) {}
        try { return document.querySelector(sel); } catch (e2) {}
        return null;
    }

    function esc(s) {
        var d = rootDoc();
        var div = d.createElement("div");
        div.textContent = s == null ? "" : String(s);
        return div.innerHTML;
    }


    var ADR_D_LOCAL_BACKUP_KEY = "arrebol_d_settings_stable_v1";
    var ADR_D_OLD_BACKUP_KEYS = [
        "arrebol_d_final_v1035_settings_backup",
        "arrebol_d_final_v1036_settings_backup",
        "arrebol_d_final_v1037_settings_backup",
        "arrebol_d_final_v1038_settings_backup",
        "arrebol_d_final_v1039_settings_backup",
        "arrebol_d_final_v1035_save_fix_settings_backup",
        "arrebol_d_final_v1036_fold_br_fix_settings_backup",
        "arrebol_d_final_v1037_mystery_sync_fix_settings_backup",
        "arrebol_d_final_v1038_comment_only_inject_settings_backup",
        "arrebol_d_final_v1039_plain_marker_inject_settings_backup"
    ];

    function adrDLoadLocalBackup() {
        try {
            var raw = rootWin().localStorage.getItem(ADR_D_LOCAL_BACKUP_KEY);
            if (raw) {
                var obj = JSON.parse(raw);
                return obj && typeof obj === "object" ? obj : {};
            }

            // 迁移旧版备份：以后升级插件不再丢 API / 模型 / 预设。
            for (var i = 0; i < ADR_D_OLD_BACKUP_KEYS.length; i++) {
                var oldRaw = rootWin().localStorage.getItem(ADR_D_OLD_BACKUP_KEYS[i]);
                if (!oldRaw) continue;
                try {
                    var oldObj = JSON.parse(oldRaw);
                    if (oldObj && typeof oldObj === "object") {
                        rootWin().localStorage.setItem(ADR_D_LOCAL_BACKUP_KEY, JSON.stringify(oldObj));
                        return oldObj;
                    }
                } catch (e0) {}
            }
        } catch (e) {}
        return {};
    }

    function adrDSaveLocalBackup(obj) {
        try {
            rootWin().localStorage.setItem(ADR_D_LOCAL_BACKUP_KEY, JSON.stringify(obj || {}));
        } catch (e) {}
    }

    function settings() {
        var c = ctx();
        if (!c.extensionSettings[EXT]) c.extensionSettings[EXT] = {};

        var backup = adrDLoadLocalBackup();
        var st = c.extensionSettings[EXT];

        if (backup && typeof backup === "object") {
            for (var bk in backup) {
                // 只在字段真正缺失时从本地备份恢复。
                // 空字符串是用户主动清空文本框/API/模板的合法值，不能被旧备份“复活”。
                if (st[bk] === undefined) {
                    st[bk] = backup[bk];
                }
            }
        }

        for (var k in DEFAULTS) {
            if (st[k] === undefined) st[k] = DEFAULTS[k];
        }
        if (!st.emotionPreset) st.emotionPreset = EMOTION_PRESET;
        if (!st.plotPreset) st.plotPreset = PLOT_PRESET;
        // v1.10.0：统筹转岗化石合并。存量若与旧默认逐字相同，就地升级；用户自改过的预设一律不动。
        if (st.plotPreset === PLOT_PRESET_LEGACY) st.plotPreset = PLOT_PRESET;
        // v1.9.29：注入方式化石合并。hidden 与 folded 自统一以来行为完全一致，存量值就地迁移。
        if (st.injectMode === "hidden") st.injectMode = "folded";
        return st;
    }

    function save(key, val) {
        try {
            settings()[key] = val;
            var c = ctx();
            if (typeof c.saveSettingsDebounced === "function") c.saveSettingsDebounced();
        } catch (e) {}
    }

    function saveNow() {
        try { adrDSaveLocalBackup(settings()); } catch (e0) {}

        try {
            var c = ctx();
            if (typeof c.saveSettings === "function") c.saveSettings();
            if (typeof c.saveSettingsDebounced === "function") c.saveSettingsDebounced();
        } catch (e) {}
    }

    // v1.9.29：状态行内存暂存。浮窗每次打开都会拆除重建 DOM，
    // 分析中/完成/失败的状态文字与按钮禁用态原本只活在旧 DOM 里，重建即失忆。
    var adrDLastStatus = { emotion: null, plot: null };

    function status(type, text, color) {
        try {
            adrDLastStatus[prefixOf(type)] = { text: String(text || ""), color: color || "" };
        } catch (eStore) {}
        var el = qForm("adr044-" + type + "-status");
        if (el) {
            el.textContent = text;
            if (color) el.style.color = color;
        }
    }

    function adrDRestorePanelRuntimeState() {
        // 重建面板后回灌：状态行文字 + 按钮禁用态（processing 是全局真值，直接重放即可）。
        try {
            ["emotion", "plot"].forEach(function (t) {
                var s = adrDLastStatus[t];
                if (!s || !s.text) return;
                Array.prototype.slice.call(rootDoc().querySelectorAll("#adr044-" + t + "-status")).forEach(function (el) {
                    if (!el) return;
                    el.textContent = s.text;
                    if (s.color) el.style.color = s.color;
                });
            });
        } catch (e1) {}
        try { setButtons(currentType()); } catch (e2) {}
    }

    function adrDToast(msg) {
        // v1.9.0：收尾兜底。提示函数绝不允许反向拖崩保存流程。
        try {
            var text = String(msg || "");
            var root = (typeof window !== "undefined") ? window : globalThis;
            var t = root && root.toastr;
            if (t && typeof t.success === "function") { t.success(text); return; }
            if (t && typeof t.info === "function") { t.info(text); return; }
            try { status("emotion", text, "#8ed99d"); } catch (e1) {}
            try { status("plot", text, "#8ed99d"); } catch (e2) {}
            try { console.log("[Arrebol D] " + text); } catch (e3) {}
        } catch (e) {}
    }

    function adrDAutoTriggerPopup(items, count) {
        // v1.9.4：自动分析开始瞬间给用户一个非阻塞提示，避免分析未完成前过快输入。
        // 只做页面提示，不改变计数、触发、注入、API 调用逻辑。
        try {
            var d = rootDoc();
            if (!d || !d.body) return;

            var list = Array.isArray(items) ? items : [];
            var names = list.map(function (it) { return labelOf(it && it.type); }).filter(Boolean).join("、") || "小红霞";
            var old = d.getElementById("adr044-auto-trigger-popup");
            if (old && old.parentNode) old.parentNode.removeChild(old);

            var box = d.createElement("div");
            box.id = "adr044-auto-trigger-popup";
            box.setAttribute("role", "status");
            box.setAttribute("aria-live", "polite");
            box.innerHTML = ''
                + '<div class="adr044-auto-trigger-popup-title">小红霞开始自动分析</div>'
                + '<div class="adr044-auto-trigger-popup-text">' + esc(names) + '已到触发轮次，正在读取上下文。分析完成前先别太快输入，等注入完成更稳。</div>'
                + '<button type="button" class="adr044-auto-trigger-popup-close" aria-label="关闭提示">×</button>';

            d.body.appendChild(box);

            var close = box.querySelector(".adr044-auto-trigger-popup-close");
            if (close) {
                close.addEventListener("click", function () {
                    try { if (box && box.parentNode) box.parentNode.removeChild(box); } catch (eClose) {}
                });
            }

            try {
                box.setAttribute("data-open", "1");
            } catch (eOpen) {}

            setTimeout(function () {
                try {
                    if (!box || !box.parentNode) return;
                    box.setAttribute("data-open", "0");
                    setTimeout(function () {
                        try { if (box && box.parentNode) box.parentNode.removeChild(box); } catch (eRemove) {}
                    }, 260);
                } catch (eTimeout) {}
            }, 12000);

            try { console.log("[Arrebol D] auto analysis popup", names, "count=", count); } catch (eLog) {}
        } catch (e) {}
    }


    function adrDPopupMessage(title, text, kind) {
        // v1.9.26：复用自动触发提示组件显示失败首报；失败告警不受“开始分析提示”开关控制。
        try {
            var d = rootDoc();
            if (!d || !d.body) return;
            var old = d.getElementById("adr044-auto-trigger-popup");
            if (old && old.parentNode) old.parentNode.removeChild(old);

            var box = d.createElement("div");
            box.id = "adr044-auto-trigger-popup";
            box.setAttribute("role", "status");
            box.setAttribute("aria-live", "polite");
            box.setAttribute("data-kind", kind || "info");
            box.innerHTML = ''
                + '<div class="adr044-auto-trigger-popup-title">' + esc(title || "小红霞提示") + '</div>'
                + '<div class="adr044-auto-trigger-popup-text">' + esc(text || "") + '</div>'
                + '<button type="button" class="adr044-auto-trigger-popup-close" aria-label="关闭提示">×</button>';
            d.body.appendChild(box);

            var close = box.querySelector(".adr044-auto-trigger-popup-close");
            if (close) {
                close.addEventListener("click", function () {
                    try { if (box && box.parentNode) box.parentNode.removeChild(box); } catch (eClose) {}
                });
            }
            try { box.setAttribute("data-open", "1"); } catch (eOpen) {}
            setTimeout(function () {
                try {
                    if (!box || !box.parentNode) return;
                    box.setAttribute("data-open", "0");
                    setTimeout(function () {
                        try { if (box && box.parentNode) box.parentNode.removeChild(box); } catch (eRemove) {}
                    }, 260);
                } catch (eTimeout) {}
            }, kind === "error" ? 18000 : 12000);
        } catch (e) {}
    }

    function adrDAutoFailureMessage(kind, type, detail) {
        var label = labelOf(type);
        var tail = "这一拍不会被结算，小红霞会稍后自动重试。";
        if (kind === "timeout") {
            return {
                title: "小红霞请求超时",
                text: "【" + label + "】API 长时间未返回，可能是中转站、网络或模型响应过慢。" + tail
            };
        }
        if (kind === "inject") {
            return {
                title: "小红霞自动注入失败",
                text: "【" + label + "】分析已完成，但没有成功写入当前助手楼。" + tail + "如果持续出现，请检查聊天楼层状态。"
            };
        }
        if (kind === "save") {
            return {
                title: "小红霞保存注入失败",
                text: "【" + label + "】分析和写入已完成，但聊天保存返回失败。" + tail + "请检查网络或稍后重试。"
            };
        }
        return {
            title: "小红霞自动分析失败",
            text: "【" + label + "】可能是 API Key、余额、Endpoint、中转站、网络或模型返回异常。" + tail + (detail ? "\n原因：" + String(detail).slice(0, 120) : "")
        };
    }

    function adrDReportFailure(kind, type, detail, beatKey) {
        // 自动触发：同一待结算拍子只首报一次；手动触发：每次失败都可提示。
        try {
            if (beatKey) {
                if (adrDAutoFailureReportedByBeat[beatKey]) return;
                adrDAutoFailureReportedByBeat[beatKey] = Date.now();
                var msg = adrDAutoFailureMessage(kind, type, detail);
                adrDPopupMessage(msg.title, msg.text, "error");
                return;
            }

            var label = labelOf(type);
            var title = "小红霞分析失败";
            var text = "【" + label + "】请检查 API Key、余额、Endpoint、中转站、网络或模型返回。" + (detail ? "\n原因：" + String(detail).slice(0, 120) : "");
            if (kind === "timeout") {
                title = "小红霞请求超时";
                text = "【" + label + "】API 长时间未返回，请检查中转站、网络或稍后重试。";
            } else if (kind === "inject") {
                title = "小红霞自动注入失败";
                text = "【" + label + "】分析完成，但没有成功写入当前助手楼。你可以手动复制，或检查当前聊天楼层状态。";
            } else if (kind === "save") {
                title = "小红霞保存注入失败";
                text = "【" + label + "】分析和写入已完成，但聊天保存返回失败。请检查网络或稍后重试。";
            }
            adrDPopupMessage(title, text, "error");
        } catch (e) {}
    }

    function adrDAutoBeatKey(type, count, n) {
        return [adrDChatKey(), type === "plot" ? "plot" : "emotion", Number(count) || 0, Number(n) || 0].join("::");
    }

    function adrDClearAutoBeatState(beatKey) {
        if (!beatKey) return;
        try { delete adrDAutoFailureReportedByBeat[beatKey]; } catch (e1) {}
        try { delete adrDAutoRetryByBeat[beatKey]; } catch (e2) {}
    }

    function adrDNoteAutoRetryResult(beatKey, ok) {
        if (!beatKey) return;
        if (ok) { adrDClearAutoBeatState(beatKey); return; }
        try {
            var item = adrDAutoRetryByBeat[beatKey] || { fails: 0, nextAt: 0 };
            item.fails = Math.max(0, Number(item.fails) || 0) + 1;
            var idx = Math.min(item.fails - 1, ADR_D_AUTO_RETRY_DELAYS.length - 1);
            item.nextAt = Date.now() + ADR_D_AUTO_RETRY_DELAYS[idx];
            adrDAutoRetryByBeat[beatKey] = item;
        } catch (e) {}
    }

    function currentType() {
        var st = settings();
        return st.activeTab === "plot" ? "plot" : "emotion";
    }

    // ===== v1.9.28 总开关 =====
    function adrDMasterEnabled() {
        try { return settings().masterEnabled !== false; }
        catch (e) { return true; }
    }

    function adrDMasterToggleLabel() {
        return adrDMasterEnabled()
            ? "🌸 小红霞：运行中｜点击一键关闭"
            : "⏸️ 小红霞：已暂停｜点击一键启动";
    }

    function adrDRefreshMasterToggleUI() {
        try {
            var nodes = Array.prototype.slice.call(rootDoc().querySelectorAll("#adr044-master-toggle"));
            var on = adrDMasterEnabled();
            nodes.forEach(function (el) {
                if (!el) return;
                el.textContent = adrDMasterToggleLabel();
                el.setAttribute("data-master-on", on ? "1" : "0");
            });
        } catch (e) {}
    }

    async function adrDToggleMaster() {
        try {
            var next = !adrDMasterEnabled();
            save("masterEnabled", next);
            saveNow();
            try { adrDSaveLocalBackup(settings()); } catch (eBk) {}
            adrDRefreshMasterToggleUI();
            try { adrCdRestoreFloat("master-toggle"); } catch (eCdM) {} // v1.10.0：总开关同时管抽卡耳机

            if (!next) {
                adrDToast("小红霞已暂停：自动分析与重试全部停止，手动按钮不受影响");
                adrDUpdateAutoCounters();
                return;
            }

            // 一键启动：baseline 校准到当前进度，关闭期间积累的楼层不补拍，从零重新累积。
            adrDToast("小红霞已启动：从当前进度重新计数");
            try {
                var count = await adrDRefreshFullAssistantRoundCount("master-on");
                if (adrDCountReady() && adrDChatKeyReady()) {
                    adrDSetAutoBaseline("emotion", count);
                    adrDSetAutoBaseline("plot", count);
                    var st = settings();
                    st.lastAutoTriggerChatKey = adrDChatKey();
                    st.lastAutoTriggerEmotionCount = count;
                    st.lastAutoTriggerPlotCount = count;
                    st.lastAutoTriggerEmotionAt = Date.now();
                    st.lastAutoTriggerPlotAt = Date.now();
                    saveNow();
                    try { adrDPersistAutoBaselineFields(st); } catch (ePersist) {}
                }
                // count/chatKey 未就绪时不强写 baseline；首次被动检查的脏 gap 安全网会静默对齐。
            } catch (eCal) {}
            adrDUpdateAutoCounters();
        } catch (e) {
            console.error("[Arrebol D] master toggle failed", e);
        }
    }
    // ===== 总开关结束 =====

    function labelOf(type) {
        if (type === "cd") return "抽卡择池";
        return type === "plot" ? "统筹" : "情感导演";
    }

    function prefixOf(type) {
        // v1.11：cd（抽卡择池）复用同一套 API 字段规约 cdApiEndpoint / cdApiKey / cdModel。
        if (type === "cd") return "cd";
        return type === "plot" ? "plot" : "emotion";
    }

    function field(type, name) {
        var p = prefixOf(type);
        return p + name.charAt(0).toUpperCase() + name.slice(1);
    }

    function setPreview(type, text) {
        var pv = qForm("adr044-" + type + "-preview");
        if (pv) pv.value = text || "";
        save(field(type, "preview"), text || "");
    }

    function normalizeBase(base) {
        var url = (base || "").trim();
        if (!url) return "";
        while (url.length > 1 && url.charAt(url.length - 1) === "/") url = url.slice(0, -1);
        if (url.indexOf("/chat/completions") >= 0) url = url.replace(/\/chat\/completions\/?$/, "");
        if (url.indexOf("/models") >= 0) url = url.replace(/\/models\/?$/, "");
        if (!url.endsWith("/v1")) url += "/v1";
        return url;
    }

    function chatUrl(base) {
        var b = normalizeBase(base);
        return b ? b + "/chat/completions" : "";
    }

    function modelsUrl(base) {
        var b = normalizeBase(base);
        return b ? b + "/models" : "";
    }

    function activeRange() {
        var st = settings();
        if (String(st.range) === "custom") {
            var n = Number(st.customRange || 0);
            return n > 0 ? n : 30;
        }
        var r = Number(st.range || 30);
        return r > 0 ? r : 30;
    }

    function autoTriggerRange(type) {
        var st = settings();
        var key = type === "plot" ? "autoTriggerPlotRange" : "autoTriggerEmotionRange";
        var customKey = type === "plot" ? "autoTriggerPlotCustomRange" : "autoTriggerEmotionCustomRange";
        var val = String(st[key] || (type === "plot" ? "10" : "20"));

        if (val === "off") return 0;
        if (val === "custom") {
            var n = Number(st[customKey] || 0);
            return n > 0 ? n : 10;
        }

        var r = Number(val || 0);
        return r > 0 ? r : 10;
    }

    function cleanMessage(text) {
        text = String(text || "").trim();
        text = text.replace(/image###[\s\S]*?###/g, "").trim();
        text = text.replace(/<!--ARREBOL_DIRECTOR_START-->[\s\S]*?<!--ARREBOL_DIRECTOR_END-->/g, "").trim();
        text = text.replace(/<!--\s*ARREBOL_D_START:(?:emotion|plot)\s*-->[\s\S]*?<!--\s*ARREBOL_D_END:(?:emotion|plot)\s*-->/g, "").trim();
        text = text.replace(/<!--\s*ARREBOL_D_START:(?:emotion|plot)[\s\S]*?ARREBOL_D_END:(?:emotion|plot)\s*-->/g, "").trim();
        text = text.replace(/<details[^>]*class=["']arrebol-d-(?:injection|card)["'][^>]*>[\s\S]*?<\/details>/g, "").trim();
        text = text.replace(/\n?arrebol_d(?:_visible)?(?::(?:emotion|plot))?###[\s\S]*?###/g, "").trim();
        return text;
    }

    function recentChat(rounds) {
        var chat;
        try { chat = ctx().chat; } catch (e) { return ""; }
        if (!chat || !chat.length) return "";

        var limit = rounds * 2;
        var arr = [];
        var count = 0;

        for (var i = chat.length - 1; i >= 0 && count < limit; i--) {
            var m = chat[i];
            if (!m || m.is_system) continue;

            var role = m.is_user ? "用户" : (m.name || "角色");
            var text = cleanMessage(m.mes);
            if (!text) continue;

            arr.unshift("[" + role + "] " + text);
            count++;
        }

        return arr.join("\n\n");
    }

    function syncShared() {
        var st = settings();

        var range = qForm("adr044-range");
        if (range) save("range", range.value || "30");

        var custom = qForm("adr044-custom");
        if (custom) save("customRange", Number(custom.value || 0));

        var memory = qForm("adr044-memory");
        if (memory) save("supplementMemory", memory.value || "");

        var ctags = qForm("adr044-content-tags");
        if (ctags) save("contentTagNames", String(ctags.value || "").trim() || "content");

        var mode = qForm("adr044-inject-mode");
        if (mode) save("injectMode", mode.value || "visible");

        var aiE = qForm("adr044-auto-inject-emotion");
        if (aiE) save("autoInjectEmotion", !!aiE.checked);

        var aiP = qForm("adr044-auto-inject-plot");
        if (aiP) save("autoInjectPlot", !!aiP.checked);

        var sfw = qForm("adr044-show-floating-window");
        if (sfw) save("showFloatingWindow", !!sfw.checked);

        var satp = qForm("adr044-show-auto-trigger-popup");
        if (satp) save("showAutoTriggerPopup", !!satp.checked);

        var flt = qForm("adr044-float-inject");
        if (flt) save("floatInjectEnabled", !!flt.checked);

        var fd = qForm("adr044-float-depth");
        if (fd) save("floatDepth", Number(fd.value || 2));

        var dlog = qForm("adr044-director-log");
        if (dlog) save("directorLogEnabled", !!dlog.checked);

        var ngd = qForm("adr044-ng-detect");
        if (ngd) save("ngDetectEnabled", !!ngd.checked);

        saveNow();
        try { adrDRestoreFloatForCurrentChat("settings-change"); } catch (eF34) {}
    }

    function syncType(type) {
        var p = prefixOf(type);

        var endpoint = qForm("adr044-" + type + "-endpoint");
        var key = qForm("adr044-" + type + "-key");
        var model = qForm("adr044-" + type + "-model");
        var preset = qForm("adr044-" + type + "-preset");
        var preview = qForm("adr044-" + type + "-preview");

        if (endpoint) save(p + "ApiEndpoint", endpoint.value || "");
        if (key) save(p + "ApiKey", key.value || "");
        if (model) save(p + "Model", model.value || "");
        if (preset) save(p + "Preset", preset.value || "");
        if (preview) save(p + "Preview", preview.value || "");

        var autoTrigger = qForm("adr044-auto-trigger-" + type);
        if (autoTrigger) save(type === "plot" ? "autoTriggerPlot" : "autoTriggerEmotion", !!autoTrigger.checked);

        var autoRange = qForm("adr044-auto-trigger-range-" + type);
        if (autoRange) save(type === "plot" ? "autoTriggerPlotRange" : "autoTriggerEmotionRange", autoRange.value || (type === "plot" ? "10" : "20"));

        var autoCustom = qForm("adr044-auto-trigger-custom-" + type);
        if (autoCustom) save(type === "plot" ? "autoTriggerPlotCustomRange" : "autoTriggerEmotionCustomRange", Number(autoCustom.value || 0));

        saveNow();
    }

    function syncAll() {
        syncShared();
        syncType("emotion");
        syncType("plot");
    }

    function adrDForceSaveSettings(type) {
        adrDBlurActiveElement();

        try {
            syncShared();
            if (type === "emotion" || type === "plot") syncType(type);
            else syncAll();

            // 强制读取当前面板字段，写入设置与本地备份。
            ["emotion", "plot"].forEach(function (t) {
                var p = prefixOf(t);
                var endpoint = qForm("adr044-" + t + "-endpoint");
                var key = qForm("adr044-" + t + "-key");
                var model = qForm("adr044-" + t + "-model");
                var preset = qForm("adr044-" + t + "-preset");

                if (endpoint) save(p + "ApiEndpoint", endpoint.value || "");
                if (key) save(p + "ApiKey", key.value || "");
                if (model) save(p + "Model", model.value || "");
                if (preset) save(p + "Preset", preset.value || "");
            });

            adrDSaveLocalBackup(settings());
            saveNow();
            adrDRefreshAllFieldsFromSettings();
            adrDToast("暗河红霞设置已保存");
            return true;
        } catch (e) {
            console.error("[Arrebol D] force save failed", e);
            return false;
        }
    }

    function getCurrentCharacterObject() {
        var c;
        try { c = ctx(); } catch (e) { return null; }

        var id = null;
        try {
            if (c.characterId !== undefined && c.characterId !== null) id = c.characterId;
            else if (c.this_chid !== undefined && c.this_chid !== null) id = c.this_chid;
            else if (c.chid !== undefined && c.chid !== null) id = c.chid;
        } catch (e1) {}

        try {
            if (c.characters && id !== null && id !== undefined && c.characters[id]) return c.characters[id];
        } catch (e2) {}

        try {
            if (c.character) return c.character;
        } catch (e3) {}

        try {
            if (c.characters && Array.isArray(c.characters) && c.name1) {
                for (var i = 0; i < c.characters.length; i++) {
                    if (c.characters[i] && c.characters[i].name === c.name1) return c.characters[i];
                }
            }
        } catch (e4) {}

        return null;
    }

    function asCleanText(v, max) {
        if (v === undefined || v === null) return "";
        var s = "";
        if (typeof v === "string") s = v;
        else {
            try { s = JSON.stringify(v, null, 2); }
            catch (e) { s = String(v); }
        }
        s = s.replace(/\r/g, "").trim();
        if (!s) return "";
        if (max && s.length > max) s = s.slice(0, max) + "…";
        return s;
    }

    function getNested(obj, path) {
        try {
            var cur = obj;
            for (var i = 0; i < path.length; i++) {
                if (!cur) return undefined;
                cur = cur[path[i]];
            }
            return cur;
        } catch (e) { return undefined; }
    }

    function extractCharacterCardText() {
        var ch = getCurrentCharacterObject();
        if (!ch) return "";

        var parts = [];
        var seen = {};

        function add(label, value, max) {
            var s = asCleanText(value, max || 6000);
            if (!s) return;
            var key = label + "::" + s.slice(0, 80);
            if (seen[key]) return;
            seen[key] = true;
            parts.push("【" + label + "】\n" + s);
        }

        add("角色名称", ch.name || getNested(ch, ["data", "name"]), 500);
        add("角色描述", ch.description || getNested(ch, ["data", "description"]), 9000);
        add("角色性格", ch.personality || getNested(ch, ["data", "personality"]), 5000);
        add("场景设定", ch.scenario || getNested(ch, ["data", "scenario"]), 5000);
        add("首条消息", ch.first_mes || getNested(ch, ["data", "first_mes"]), 2500);
        add("示例对话", ch.mes_example || getNested(ch, ["data", "mes_example"]), 5000);
        add("创作者注释", ch.creatorcomment || ch.creator_notes || getNested(ch, ["data", "creator_notes"]) || getNested(ch, ["data", "creatorcomment"]), 3000);
        add("系统提示", ch.system_prompt || getNested(ch, ["data", "system_prompt"]), 3000);
        add("后历史指令", ch.post_history_instructions || getNested(ch, ["data", "post_history_instructions"]), 3000);

        return parts.join("\n\n");
    }

    function extractCharacterBookText() {
        var ch = getCurrentCharacterObject();
        if (!ch) return "";

        var candidates = [];

        function pushCandidate(label, obj) {
            if (obj !== undefined && obj !== null) candidates.push({ label: label, obj: obj });
        }

        pushCandidate("data.character_book", getNested(ch, ["data", "character_book"]));
        pushCandidate("character_book", ch.character_book);
        pushCandidate("json_data.data.character_book", getNested(ch, ["json_data", "data", "character_book"]));
        pushCandidate("json_data.character_book", getNested(ch, ["json_data", "character_book"]));
        pushCandidate("data.extensions.character_book", getNested(ch, ["data", "extensions", "character_book"]));
        pushCandidate("data.extensions.world", getNested(ch, ["data", "extensions", "world"]));
        pushCandidate("data.extensions.world_info", getNested(ch, ["data", "extensions", "world_info"]));
        pushCandidate("data.extensions.lorebook", getNested(ch, ["data", "extensions", "lorebook"]));

        var parts = [];

        function entryText(entry, i) {
            if (!entry) return "";
            var keys = entry.keys || entry.key || entry.keywords || entry.primary_keys || [];
            if (Array.isArray(keys)) keys = keys.join(", ");
            var comment = entry.comment || entry.name || entry.title || "";
            var content = entry.content || entry.text || entry.value || entry.entry || "";
            var enabled = entry.enabled;
            if (enabled === false || entry.disable === true) return "";

            var s = "";
            if (comment) s += "条目 " + (i + 1) + "｜" + comment + "\n";
            else s += "条目 " + (i + 1) + "\n";
            if (keys) s += "关键词：" + keys + "\n";
            if (content) s += asCleanText(content, 3000);
            return s.trim();
        }

        candidates.forEach(function (cand) {
            var obj = cand.obj;
            if (!obj) return;

            var entries = null;
            if (Array.isArray(obj)) entries = obj;
            else if (Array.isArray(obj.entries)) entries = obj.entries;
            else if (obj.entries && typeof obj.entries === "object") {
                entries = [];
                Object.keys(obj.entries).forEach(function (k) { entries.push(obj.entries[k]); });
            }

            if (entries && entries.length) {
                var texts = [];
                entries.forEach(function (e, i) {
                    var t = entryText(e, i);
                    if (t) texts.push(t);
                });
                if (texts.length) {
                    parts.push("【角色卡世界书：" + cand.label + "】\n" + texts.join("\n\n"));
                }
            } else {
                var raw = asCleanText(obj, 3000);
                if (raw && raw !== "{}" && raw !== "[]") {
                    parts.push("【角色卡世界书候选：" + cand.label + "】\n" + raw);
                }
            }
        });

        return parts.join("\n\n");
    }

    function extractPersonaText() {
        var c;
        try { c = ctx(); } catch (e) { return ""; }

        var parts = [];

        function add(label, value) {
            var s = asCleanText(value, 3000);
            if (!s) return;
            // 过滤掉探针里出现的 jQuery 事件对象这类误判。
            if (s.indexOf("jQuery") >= 0 && s.indexOf("events") >= 0) return;
            if (s === "{}" || s === "[]") return;
            parts.push("【" + label + "】\n" + s);
        }

        add("用户名称", c.name2);

        try {
            var p = c.powerUserSettings || {};
            add("powerUserSettings.persona_description", p.persona_description);
            add("powerUserSettings.personaDescription", p.personaDescription);
            add("powerUserSettings.user_description", p.user_description);
            add("powerUserSettings.userDescription", p.userDescription);
        } catch (e1) {}

        try {
            var rw = rootWin();
            if (typeof rw.persona_description === "string") add("window.persona_description", rw.persona_description);
            if (typeof rw.user_description === "string") add("window.user_description", rw.user_description);
            if (rw.power_user) {
                add("window.power_user.persona_description", rw.power_user.persona_description);
                add("window.power_user.user_description", rw.power_user.user_description);
            }
        } catch (e2) {}

        return parts.join("\n\n");
    }

    /* v1.16.0 正文标签开口子：正文用什么标签是预设层的决定，插件只管结构。
       设置里可逗号分隔多个名字；消毒 + 正则转义，反向引用保证开闭配对，乱填不炸。 */
    function adrDContentTagNames() {
        var raw = "";
        try { raw = String(settings().contentTagNames || ""); } catch (e) {}
        var names = raw.split(",").map(function (sName) {
            return sName.trim().replace(/[<>\/"'`\s]/g, "");
        }).filter(function (sName) { return !!sName; });
        if (!names.length) names = ["content"];
        return names;
    }

    function adrDContentTagRegex() {
        var names = adrDContentTagNames().filter(function (sName) { return sName !== "*"; });
        if (!names.length) names = ["content"];
        names = names.map(function (sName) {
            return sName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        });
        return new RegExp("<(" + names.join("|") + ")(?=[\\s/>])[^>]*>([\\s\\S]*?)<\\/\\1>", "gi"); // \b 不认汉字边界，改显式前瞻
    }

    /* v1.16.1 无标签兜底：标签名里含 * 时，没匹配到标签的助手楼整层当正文读。 */
    function adrDContentTagWholeFloorEnabled() {
        return adrDContentTagNames().indexOf("*") !== -1;
    }

    async function recentContentBlocks(rounds) {
        var chat;
        try {
            chat = await adrDGetFullChatMessagesForRead("recent-content");
        } catch (e0) {
            try { chat = ctx().chat; } catch (e1) { return ""; }
        }
        if (!chat || !chat.length) return "";

        var limit = rounds * 2;
        var arr = [];
        var count = 0;

        for (var i = chat.length - 1; i >= 0 && count < limit; i--) {
            var m = chat[i];
            if (!m) continue;

            var roleRaw = String(m.role || "").toLowerCase();
            var isUser = m.is_user === true || roleRaw === "user";
            // 全量历史读取时，旧楼层可能因“小幽灵/隐藏助手”被标成 is_system。
            // 复盘范围要读“真实历史正文”，所以只跳过没有 name 的纯 system 通知，不因 is_system=true 直接丢掉角色/用户楼层。
            if (roleRaw === "system" && !m.name && !isUser) continue;

            var role = isUser ? "用户" : (m.name || "角色");
            var raw = m.message;
            if (raw == null) raw = m.mes;
            var text = String(raw || "");
            text = cleanMessage(text);

            var blocks = [];
            var re = adrDContentTagRegex();
            var match;
            while ((match = re.exec(text)) !== null) {
                var v = (match[2] || "").trim();
                if (v) blocks.push(v);
            }

// v1.16.1 无标签兔底：含 * 时，没匹配到标签的助手楼整层当正文（已 cleanMessage，截 2500 字）。
            if (!blocks.length && !isUser && adrDContentTagWholeFloorEnabled()) {
                var whole = text.trim();
                if (whole) blocks.push(whole.length > 2500 ? whole.slice(0, 2500) + "…" : whole);
            }

            // 用户消息通常没有 <content>，保留用户原文作为必要上下文，但限制长度。
            if (!blocks.length && isUser) {
                var u = text.trim();
                if (u) blocks.push(u.length > 1200 ? u.slice(0, 1200) + "…" : u);
            }

            if (blocks.length) {
                arr.unshift("[" + role + "]\n" + blocks.join("\n\n"));
            }

            count++;
        }

        return arr.join("\n\n---\n\n");
    }

    function buildPreciseContext() {
        var parts = [];
        var charText = extractCharacterCardText();
        var bookText = extractCharacterBookText();
        var personaText = extractPersonaText();
        var st = settings();

        if (charText) parts.push("【当前角色卡】\n" + charText);
        if (bookText) parts.push("【角色卡世界书 / Lorebook】\n" + bookText);
        if (personaText) parts.push("【User 人设 / Persona】\n" + personaText);
        if (st.supplementMemory && st.supplementMemory.trim()) {
            parts.push("【手动补充】\n" + st.supplementMemory.trim());
        }

        return parts.join("\n\n");
    }



    function adrDGetExtraInstruction(type) {
        try {
            var el = qForm("adr044-" + type + "-extra");
            return el ? String(el.value || "").trim() : "";
        } catch (e) {
            return "";
        }
    }

    function adrDClearExtraInstruction(type) {
        try {
            Array.prototype.slice.call(rootDoc().querySelectorAll("#adr044-" + type + "-extra")).forEach(function (el) {
                if (!el) return;
                el.value = "";
                try { el.dispatchEvent(new Event("input", { bubbles: true })); } catch (e1) {}
                try { el.dispatchEvent(new Event("change", { bubbles: true })); } catch (e2) {}
            });
            try {
                syncType(type);
                adrDSaveLocalBackup(settings());
            } catch (e3) {}
        } catch (e4) {}
    }

    function adrDExtraInstructionBlock(type, explicitExtra) {
        var extra = String(explicitExtra || adrDGetExtraInstruction(type) || "").trim();
        if (!extra) return "";
        return [
            "【最高优先级一次性补充指令】",
            "以下是用户本轮临时补充的导演需求。它的优先级高于通用导演框架、模板与常规分析偏好；请第一时间吸收，并围绕它构建本次情感/剧情指导。",
            "这是一条一次性指令：本次生成后会自动清空。不要把它当作长期设定，不要在后续轮次继续沿用，除非用户再次填写。",
            extra,
            "【一次性补充指令结束】"
        ].join("\n");
    }

    async function buildPrompt(type, extra) {
        var r = activeRange();
        var out = "";

        var extraBlock = adrDExtraInstructionBlock(type, extra);
        if (extraBlock) {
            out += extraBlock + "\n\n";
        }

        var contextText = buildPreciseContext();
        if (contextText) {
            out += contextText + "\n\n";
        }

        var directorLog = adrDDirectorLogBlock(type);
        if (directorLog) {
            out += directorLog + "\n\n";
        }

        // v1.10.0：统筹采买清单新增投卡史（账房盘账得看得见牌桌）。
        if (type === "plot") {
            var cdHist = adrCdHistoryBlock();
            if (cdHist) {
                out += cdHist + "\n\n";
            }
        }

        var recent = await recentContentBlocks(r);
        out += "【最近 " + r + " 轮正文｜精准读取】\n" + (recent || "（未提取到正文标签内容；用户消息会作为上下文保留）") + "\n\n";

        if (type === "plot") {
            out += "请根据以上内容输出统筹调度。只输出分析结果，不要复述分析过程，不要写正文。";
        } else {
            out += "请根据以上内容输出情感导演方向。只输出分析结果，不要复述分析过程，不要写正文。";
        }

        return out;
    }

    function parseResponse(data) {
        if (!data) return "";

        if (data.choices && data.choices[0]) {
            var ch = data.choices[0];

            if (ch.message) {
                var msg = ch.message;
                if (typeof msg.content === "string" && msg.content.trim()) return msg.content.trim();

                if (msg.content && Array.isArray(msg.content)) {
                    var parts = [];
                    msg.content.forEach(function (p) {
                        if (!p) return;
                        if (typeof p === "string") parts.push(p);
                        else if (p.text) parts.push(p.text);
                        else if (p.type === "text" && p.text) parts.push(p.text);
                    });
                    if (parts.join("").trim()) return parts.join("\n").trim();
                }
            }

            if (ch.text) return String(ch.text).trim();
        }

        if (data.response) return String(data.response).trim();
        if (data.text) return String(data.text).trim();
        return "";
    }

    /* v1.15.1 分析忙碌脉冲：导演分析进行中给胶囊浮标点灯（挂类，样式在 style.css） */
    function adr048SetFabBusy(on) {
        try {
            var els = rootDoc().querySelectorAll("#adr048-fab");
            for (var i = 0; i < els.length; i++) {
                try {
                    if (on) els[i].classList.add("adr048-analyzing");
                    else els[i].classList.remove("adr048-analyzing");
                } catch (e) {}
            }
        } catch (e) {}
    }

    async function callAPI(type, extra) {
        var st = settings();
        var p = prefixOf(type);

        var endpoint = st[p + "ApiEndpoint"] || "";
        var key = st[p + "ApiKey"] || "";
        var model = st[p + "Model"] || "";
        var preset = st[p + "Preset"] || (type === "plot" ? PLOT_PRESET : EMOTION_PRESET);

        if (!endpoint) throw new Error("请先填写 " + labelOf(type) + " API 地址");
        if (!model) throw new Error("请先填写 " + labelOf(type) + " 模型名");

        var url = chatUrl(endpoint);
        if (!url) throw new Error("API 地址无效");

        var headers = { "Content-Type": "application/json" };
        if (key) headers.Authorization = "Bearer " + key;

        adrDAbortWasManual = false;
        if (typeof AbortController !== "undefined") aborter = new AbortController();
        else aborter = null;
        var localAborter = aborter;

        var body = {
            model: model,
            messages: [
                { role: "system", content: preset },
                { role: "user", content: await buildPrompt(type, extra || "") }
            ],
            temperature: 0.6,
            stream: false
        };

        var opts = {
            method: "POST",
            headers: headers,
            body: JSON.stringify(body)
        };
        if (localAborter) opts.signal = localAborter.signal;

        var timeoutId = null;
        var didTimeout = false;
        if (localAborter && typeof setTimeout === "function") {
            timeoutId = setTimeout(function () {
                didTimeout = true;
                try { localAborter.abort(); } catch (eAbort) {}
            }, 120000);
        }

        var res;
        var raw;
        try {
            res = await fetch(url, opts);
            raw = await res.text();
        } catch (eFetch) {
            if (didTimeout && eFetch && eFetch.name === "AbortError") {
                var timeoutErr = new Error("请求超时，请检查 API、中转站或稍后重试");
                timeoutErr.name = "TimeoutError";
                throw timeoutErr;
            }
            throw eFetch;
        } finally {
            if (timeoutId) clearTimeout(timeoutId);
        }

        if (!res.ok) throw new Error("API " + res.status + "：" + String(raw || "").slice(0, 220));

        var data;
        try { data = JSON.parse(raw); }
        catch (e) { throw new Error("API 返回非 JSON：" + raw.slice(0, 180)); }

        var out = parseResponse(data);
        if (!out) throw new Error("无法解析响应：" + raw.slice(0, 220));
        return out;
    }

    function setButtons(type) {
        ["emotion", "plot"].forEach(function (t) {
            var g = qForm("adr044-" + t + "-generate");
            var r = qForm("adr044-" + t + "-reroll");
            var s = qForm("adr044-" + t + "-stop");
            var c = qForm("adr044-" + t + "-copy");
            var inj = qForm("adr044-" + t + "-inject");
            var pv = qForm("adr044-" + t + "-preview");
            var has = pv && pv.value;

            if (g) g.disabled = processing;
            if (r) r.disabled = processing;
            if (s) s.disabled = !processing;
            if (c) c.disabled = !has;
            if (inj) inj.disabled = !has;
        });
    }

    async function run(type, extra, opts) {
        if (processing) return false;

        opts = opts || {};
        var isAutoRun = !!opts.autoTrigger;
        var beatKey = opts.beatKey || "";

        syncShared();
        syncType(type);

        processing = true;
        setButtons(type);
        adr048SetFabBusy(true);
        status(type, "正在分析…", "#8ed99d");

        var success = false;
        var failureKind = "api";
        var failureMsg = "";
        try {
            var out = await callAPI(type, extra || "");
            setPreview(type, out);
            adrDClearExtraInstruction(type);
            status(type, "分析完成 ✓（补充指令已清空）", "#8ed99d");

            var st = settings();
            var autoKey = type === "plot" ? "autoInjectPlot" : "autoInjectEmotion";
            if (st[autoKey]) {
                var ok = isAutoRun ? await injectDirectorAsync(type, out) : injectDirector(type, out);
                if (ok) {
                    success = true;
                    status(type, "分析完成并已注入当前聊天 ✓", "#8ed99d");
                } else {
                    success = false;
                    failureKind = "inject";
                    failureMsg = "自动注入失败";
                    status(type, isAutoRun ? "分析完成，但自动注入失败；已保留本拍，稍后自动重试" : "分析完成，但自动注入失败，请手动复制", "#d6b177");
                }
            } else {
                success = true;
            }
        } catch (e) {
            failureMsg = e && e.message ? e.message : String(e);
            if (e && e.name === "TimeoutError") failureKind = "timeout";
            else if (e && e.name === "SaveChatError") failureKind = "save";
            else if (e && e.name === "AbortError" && adrDAbortWasManual) failureKind = "manual-abort";
            else if (e && e.name === "AbortError") failureKind = "abort";
            else failureKind = "api";

            var msg = (failureKind === "manual-abort" || failureKind === "abort") ? "请求已打断" : failureMsg;
            status(type, "失败：" + msg, "#d4726a");
            success = false;
        }

        processing = false;
        aborter = null;
        adr048SetFabBusy(false);
        setButtons(type);

        if (!success && failureKind !== "manual-abort" && failureKind !== "abort") {
            adrDReportFailure(failureKind, type, failureMsg, isAutoRun ? beatKey : "");
        }
        return success;
    }

    function abortRun(type) {
        try {
            adrDAbortWasManual = true;
            if (aborter) aborter.abort();
            status(type, "已打断请求", "#d4726a");
        } catch (e) {
            status(type, "打断失败：" + e.message, "#d4726a");
        }
        processing = false;
        aborter = null;
        adr048SetFabBusy(false);
        setButtons(type);
    }

    function copyText(type) {
        var pv = qForm("adr044-" + type + "-preview");
        var text = pv ? pv.value : "";
        if (!text) {
            status(type, "没有内容可复制", "#d4726a");
            return;
        }

        try {
            if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text);
            else {
                pv.focus();
                pv.select();
                document.execCommand("copy");
            }
            status(type, "已复制 ✓", "#8ed99d");
        } catch (e) {
            status(type, "复制失败", "#d4726a");
        }
    }

    function escapeHtmlForDetails(s) {
        s = String(s || "");
        return s
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }

    function adrDSanitizeInjectionBody(body) {
        // v1.9.27：正文消毒。导演输出若自带 "###"，会提前闭合标记块并干扰清理正则。
        // 全部替换为全角 "＃＃＃"，语义可读，永不与标记冲突。
        return String(body || "").trim().replace(/###/g, "＃＃＃");
    }

    function plainMarkerInjection(type, title, body) {
        // 像生图 image###...### 一样的纯文本包裹。
        // 不使用任何 HTML 标签/注释，避免干扰酒馆美化正则。
        // v1.9.27：标记带类型（arrebol_d:emotion### / arrebol_d:plot###）。
        // 情感/剧情各删各的旧块，双导演同拍注入不再互删。
        var t = type === "plot" ? "plot" : "emotion";
        return "\n\narrebol_d:" + t + "###\n"
            + "【暗河红霞 Arrebol D｜" + title + "】\n"
            + adrDSanitizeInjectionBody(body)
            + "\n###";
    }

    // ================= v1.9.34 跟组导演 · 跟随注入 · NG 检测 =================
    // 三件共用 1.9.31 的 per-chat（chatKey）存储地基。
    // 铁律：全程不读写 auto state，基准线体系零接触。

    var ADR_D_DIRECTOR_LOG_KEY = "arrebol_d_director_log_v1";
    var ADR_D_FLOAT_KEY = "arrebol_d_float_note_v1";
    var ADR_D_FLOAT_EP_KEY = "ARREBOL_D_DIRECTOR_FLOAT";
    var ADR_D_DIRECTOR_LOG_MAX = 3;
    var ADR_D_DIRECTOR_LOG_ITEM_CHARS = 1500;
    var ADR_D_NG_THRESHOLD = 3;

    function adrDReadJsonLS(key) {
        try {
            var raw = rootWin().localStorage.getItem(key);
            var obj = raw ? JSON.parse(raw) : null;
            return obj && typeof obj === "object" ? obj : {};
        } catch (e) { return {}; }
    }

    function adrDWriteJsonLS(key, obj) {
        try { rootWin().localStorage.setItem(key, JSON.stringify(obj || {})); } catch (e) {}
    }

    // ---- 跟组导演：按 chatKey::type 滚动存最近 N 条"已注入"的指导 ----
    function adrDDirectorLogList(type) {
        try {
            var all = adrDReadJsonLS(ADR_D_DIRECTOR_LOG_KEY);
            var list = all[adrDChatKey() + "::" + (type === "plot" ? "plot" : "emotion")];
            return Array.isArray(list) ? list : [];
        } catch (e) { return []; }
    }

    function adrDDirectorLogPush(type, text) {
        try {
            if (!settings().directorLogEnabled) return;
            if (!adrDChatKeyReady || !adrDChatKeyReady()) return;
            var body = String(text || "").trim();
            if (!body) return;
            if (body.length > ADR_D_DIRECTOR_LOG_ITEM_CHARS) body = body.slice(0, ADR_D_DIRECTOR_LOG_ITEM_CHARS) + "…";
            var all = adrDReadJsonLS(ADR_D_DIRECTOR_LOG_KEY);
            var k = adrDChatKey() + "::" + (type === "plot" ? "plot" : "emotion");
            var list = Array.isArray(all[k]) ? all[k] : [];
            list.push({ t: Date.now(), floor: adrDAssistantRoundCount(), text: body });
            while (list.length > ADR_D_DIRECTOR_LOG_MAX) list.shift();
            all[k] = list;
            adrDWriteJsonLS(ADR_D_DIRECTOR_LOG_KEY, all);
        } catch (e) {}
    }

    function adrDDirectorLogBlock(type) {
        try {
            if (!settings().directorLogEnabled) return "";
            var list = adrDDirectorLogList(type);
            if (!list.length) return "";
            var lines = list.map(function (it, i) {
                var floorTxt = Number.isFinite(Number(it.floor)) && Number(it.floor) >= 0 ? "（下达于第 " + it.floor + " 楼）" : "";
                return "· 指导 " + (i + 1) + floorTxt + "：\n" + String(it.text || "");
            });
            return "【跟组记录｜你此前已下达的 " + list.length + " 条指导，最早在前】\n"
                + lines.join("\n\n")
                + "\n\n请先衡量最近一条指导的执行情况，连贯后给本轮指导，剧情或情感动线要丝滑，逻辑要完整。";
        } catch (e) { return ""; }
    }

    // ---- 跟随注入：最新指导挂扩展提示词通道，不占楼层，藏楼/摘要正则都碰不到 ----
    function adrDFloatDepth() {
        var d = Number(settings().floatDepth);
        if (!Number.isFinite(d) || d < 0) d = 2;
        if (d > 99) d = 99;
        return Math.round(d);
    }

    function adrDApplyFloatPrompt(text) {
        try {
            var c = ctx();
            if (typeof c.setExtensionPrompt !== "function") return false;
            var EPT = c.extensionPromptTypes || c.extension_prompt_types || {};
            var pos = EPT.IN_CHAT != null ? EPT.IN_CHAT : 1;
            var EPR = c.extensionPromptRoles || c.extension_prompt_roles || {};
            var role = EPR.SYSTEM != null ? EPR.SYSTEM : 0;
            c.setExtensionPrompt(ADR_D_FLOAT_EP_KEY, String(text || ""), pos, adrDFloatDepth(), false, role);
            return true;
        } catch (e) { return false; }
    }

    function adrDFloatText(type, text) {
        var title = type === "plot" ? "统筹" : "情感导演";
        return "【暗河红霞 Arrebol D｜" + title + "·最新指导（常驻）】\n" + String(text || "").trim();
    }

    function adrDUpdateFloatFromInjection(type, text) {
        try {
            var st = settings();
            if (!st.floatInjectEnabled || !adrDMasterEnabled()) return;
            if (!adrDChatKeyReady || !adrDChatKeyReady()) return;
            var body = adrDFloatText(type, text);
            var all = adrDReadJsonLS(ADR_D_FLOAT_KEY);
            all[adrDChatKey()] = { t: Date.now(), type: type, text: body };
            adrDWriteJsonLS(ADR_D_FLOAT_KEY, all);
            adrDApplyFloatPrompt(body);
        } catch (e) {}
    }

    function adrDRestoreFloatForCurrentChat(reason) {
        try { adrCdRestoreFloat(reason); } catch (eCdRestore) {} // v1.10.0：抽卡小能手耳机同车恢复（导演早退路径不影响）
        try {
            var st = settings();
            if (!st.floatInjectEnabled || !adrDMasterEnabled()) {
                adrDApplyFloatPrompt("");
                return;
            }
            var all = adrDReadJsonLS(ADR_D_FLOAT_KEY);
            var item = all[adrDChatKey()];
            adrDApplyFloatPrompt(item && item.text ? item.text : "");
        } catch (e) {}
    }

    // ================= v1.13.0 放养模式：手动放养 · 自动归队 =================
    // 点一下撕掉本类型当前贴耳稿（正文块，浮动稿同类型时一并撤下）。
    // 轮换计数照常走、基准线体系零接触、放养期间零生成；
    // 到下一个换稿点自动触发正常生成并挂上，放养自动结束。
    // 铁律：不读写 auto state，不动 baseline；归队唯一判据 = 该类型任意一次成功注入。

    var ADR_D_GRAZE_KEY = "arrebol_d_graze_v1";

    function adrDGrazeStoreKey(type) {
        return adrDChatKey() + "::" + (type === "plot" ? "plot" : "emotion");
    }

    function adrDGrazeActive(type) {
        try {
            if (!adrDChatKeyReady || !adrDChatKeyReady()) return false;
            var all = adrDReadJsonLS(ADR_D_GRAZE_KEY);
            var item = all[adrDGrazeStoreKey(type)];
            return !!(item && item.on);
        } catch (e) { return false; }
    }

    function adrDGrazeSet(type, on) {
        try {
            if (!adrDChatKeyReady || !adrDChatKeyReady()) return false;
            var all = adrDReadJsonLS(ADR_D_GRAZE_KEY);
            var k = adrDGrazeStoreKey(type);
            if (on) all[k] = { on: true, t: Date.now(), floor: adrDAssistantRoundCount() };
            else if (all[k]) delete all[k];
            adrDWriteJsonLS(ADR_D_GRAZE_KEY, all);
            return true;
        } catch (e) { return false; }
    }

    function adrDGrazeClearOnInjection(type) {
        // 归队唯一入口：本类型稿子真正挂上（自动触发 / 手动注入皆算）。
        try {
            if (adrDGrazeActive(type)) {
                adrDGrazeSet(type, false);
                try { adrDToast((type === "plot" ? "统筹" : "情感导演") + "已归队，新稿已挂上"); } catch (eT) {}
            }
        } catch (e) {}
    }

    function adrDStripDirectorInjectionEverywhere(type) {
        // 全楼层扫一遍，只撕本类型的块；另一类型原地保留。
        // 复用注入函数已验证的清理模式（HTML 注释标记 / 带类型纯文本标记）。
        // 刻意不带 ≤1.9.26 的 $ 锚定旧可见头正则：全楼扫描下它可能吞掉标记后的真实正文。
        var changed = 0;
        try {
            var c = ctx();
            var chat = c.chat;
            if (!chat || !chat.length) return changed;

            var t = type === "plot" ? "plot" : "emotion";
            var startMark = "<!-- ARREBOL_D_START:" + t + " -->";
            var endMark = "<!-- ARREBOL_D_END:" + t + " -->";
            var startMark2 = "<!-- ARREBOL_D_START:" + t;
            var endMark2 = "ARREBOL_D_END:" + t + " -->";
            var reTypedOwn = new RegExp("\\n?arrebol_d(?:_visible)?:" + t + "###[\\s\\S]*?###", "g");

            for (var i = 0; i < chat.length; i++) {
                var m = chat[i];
                if (!m || m.is_user === true) continue;
                var mes = String(m.mes || "");
                if (!mes) continue;
                var before = mes;

                var startAt = mes.indexOf(startMark);
                while (startAt >= 0) {
                    var endAt = mes.indexOf(endMark, startAt);
                    if (endAt < 0) break;
                    mes = mes.slice(0, startAt).trimEnd() + mes.slice(endAt + endMark.length);
                    startAt = mes.indexOf(startMark);
                }
                var startAt2 = mes.indexOf(startMark2);
                while (startAt2 >= 0) {
                    var endAt2 = mes.indexOf(endMark2, startAt2);
                    if (endAt2 < 0) break;
                    mes = mes.slice(0, startAt2).trimEnd() + mes.slice(endAt2 + endMark2.length);
                    startAt2 = mes.indexOf(startMark2);
                }
                mes = mes.replace(reTypedOwn, "");

                if (mes !== before) {
                    chat[i].mes = mes.trimEnd();
                    changed++;
                }
            }
        } catch (e) {
            try { console.error("[Arrebol D] graze strip failed", e); } catch (e2) {}
        }
        return changed;
    }

    function adrDGrazeClearFloatIfType(type) {
        // 常驻浮动稿是全聊天单槽；只有当前挂的是本类型时才撤，另一类型的浮动稿不动。
        try {
            var all = adrDReadJsonLS(ADR_D_FLOAT_KEY);
            var k = adrDChatKey();
            var item = all[k];
            if (item && item.type === (type === "plot" ? "plot" : "emotion")) {
                delete all[k];
                adrDWriteJsonLS(ADR_D_FLOAT_KEY, all);
                adrDApplyFloatPrompt("");
                return true;
            }
        } catch (e) {}
        return false;
    }

    async function adrDStartGraze(type) {
        type = type === "plot" ? "plot" : "emotion";
        var title = type === "plot" ? "统筹" : "情感导演";
        try {
            if (!adrDMasterEnabled()) {
                status(type, "总开关已关闭，导演本来就不在岗", "#d6a26a");
                return false;
            }
            if (!adrDChatKeyReady || !adrDChatKeyReady()) {
                status(type, "聊天还在加载，稍等几秒再放养", "#d6a26a");
                return false;
            }
            if (adrDGrazeActive(type)) {
                status(type, title + "已在放养中，到下个换稿点自动归队", "#d6a26a");
                return false;
            }

            var changed = adrDStripDirectorInjectionEverywhere(type);
            var floatCleared = adrDGrazeClearFloatIfType(type);
            adrDGrazeSet(type, true);

            if (changed > 0 || floatCleared) {
                try { await adrDSaveThenRedrawAfterInject(); } catch (eSave) { try { console.warn("[Arrebol D] graze save failed", eSave); } catch (eW) {} }
            }

            try { adrDUpdateAutoCounters(); } catch (eC) {}
            status(type, title + "已放养 ✓ 当前稿已撤下，到下个换稿点自动归队", "#8ed99d");
            try { console.log("[Arrebol D] graze started", type, "strippedFloors=", changed, "floatCleared=", floatCleared); } catch (eLog) {}
            try { adrDToast(title + "放养中：轮换照常走，到点自动归队"); } catch (eT) {}
            return true;
        } catch (e) {
            try { console.error("[Arrebol D] graze start failed", e); } catch (e2) {}
            try { status(type, "放养失败：" + (e && e.message ? e.message : e), "#d4726a"); } catch (e3) {}
            return false;
        }
    }

    function adrDRequestGraze(type, btn) {
        type = type === "plot" ? "plot" : "emotion";
        return adrDTwoStepConfirm(
            "graze-" + type,
            btn || qForm("adr044-" + type + "-graze"),
            "确定放养？",
            "再点一次确认放养（撤下当前稿，到下个换稿点自动归队）",
            function (msg) { status(type, msg, "#d6a26a"); },
            function () { adrDStartGraze(type); }
        );
    }

    // ---- NG 检测：同一正文楼重 roll 达阈值提示请导演；纯旁观者，只提示不触发 ----
    var adrDNgState = { mesKey: "", notified: false };

    function adrDLastAssistantSwipeInfo() {
        try {
            var chat = ctx().chat;
            if (!chat || !chat.length) return null;
            for (var i = chat.length - 1; i >= 0; i--) {
                var m = chat[i];
                if (!m || m.is_system) continue;
                if (m.is_user === true || String(m.role || "").toLowerCase() === "user") continue;
                return { idx: i, swipes: Array.isArray(m.swipes) ? m.swipes.length : 1 };
            }
            return null;
        } catch (e) { return null; }
    }

    function adrDCheckNg(fromWhere) {
        try {
            if (!settings().ngDetectEnabled || !adrDMasterEnabled()) return;
            var info = adrDLastAssistantSwipeInfo();
            if (!info) return;
            var mesKey = (adrDChatKey ? adrDChatKey() : "") + "#" + info.idx;
            if (adrDNgState.mesKey !== mesKey) {
                adrDNgState = { mesKey: mesKey, notified: false };
                return;
            }
            // swipes 数组含首版：长度 4 = 重 roll 3 次。
            var rerolls = Math.max(0, info.swipes - 1);
            if (!adrDNgState.notified && rerolls >= ADR_D_NG_THRESHOLD) {
                adrDNgState.notified = true;
                adrDPopupMessage(
                    "这条戏 NG " + rerolls + " 次了",
                    "同一楼已连续重 roll " + rerolls + " 次，可能是方向没对上。要不要请统筹会诊？打开面板在统筹页点「分析」，想给方向就先填补充指令。"
                );
                try { console.log("[Arrebol D] NG detected", mesKey, "rerolls=", rerolls, "from=", fromWhere); } catch (eNgLog) {}
            }
        } catch (e) {}
    }

    function injectionText(type, text) {
        var title = type === "plot" ? "统筹" : "情感导演";
        var mode = settings().injectMode || "visible";
        var t = type === "plot" ? "plot" : "emotion";

        if (mode === "hidden" || mode === "folded") {
            return plainMarkerInjection(type, title, text);
        }

        return "\n\narrebol_d_visible:" + t + "###\n【暗河红霞 Arrebol D｜" + title + "】\n" + adrDSanitizeInjectionBody(text) + "\n###";
    }

    function findLastMessageIndex(chat) {
        if (!chat || !chat.length) return -1;

        for (var i = chat.length - 1; i >= 0; i--) {
            var m = chat[i];
            if (!m || m.is_system) continue;
            var role = String(m.role || "").toLowerCase();
            if (m.is_user === true || role === "user") continue;
            if (m.mes && String(m.mes).trim()) return i;
        }

        // 没有可注入的角色/助手楼层时，宁可不注入，也绝不写到 user input 楼。
        return -1;
    }

    function saveChatSafe() {
        try {
            var c = ctx();
            if (typeof c.saveChat === "function") {
                c.saveChat();
                return;
            }
        } catch (e) {}

        try {
            var rw = rootWin();
            if (typeof rw.saveChatConditional === "function") rw.saveChatConditional();
            else if (typeof rw.saveChat === "function") rw.saveChat();
        } catch (e2) {}
    }

    function refreshMessageDom(index) {
        try {
            var rw = rootWin();

            if (typeof rw.reloadCurrentChat === "function") {
                // 太重，先不用。优先改 DOM。
            }

            var d = rootDoc();
            var msg = null;
            var sels = [
                '#chat .mes[mesid="' + index + '"] .mes_text',
                '#chat .mes[mesid="' + index + '"] .mes_block .mes_text',
                '#chat .mes[mesid="' + index + '"]',
                '#chat .mes[data-mesid="' + index + '"] .mes_text',
                '#chat .mes[data-mesid="' + index + '"]'
            ];

            for (var i = 0; i < sels.length; i++) {
                msg = d.querySelector(sels[i]);
                if (msg) break;
            }

            if (msg) {
                var chat = ctx().chat;
                var content = chat && chat[index] ? chat[index].mes : "";
                msg.innerHTML = content;
            }
        } catch (e) {}
    }


    function adrDNativeRedrawNow() {
        try {
            var rw = rootWin();
            var c = ctx();

            try {
                if (typeof rw.reloadCurrentChat === "function") {
                    rw.reloadCurrentChat();
                    return true;
                }
            } catch (e1) {}

            try {
                if (typeof c.reloadCurrentChat === "function") {
                    c.reloadCurrentChat();
                    return true;
                }
            } catch (e2) {}

            try {
                if (c.eventSource && c.event_types && c.event_types.CHAT_CHANGED) {
                    c.eventSource.emit(c.event_types.CHAT_CHANGED);
                    return true;
                }
            } catch (e3) {}

            try {
                if (rw.eventSource && rw.event_types && rw.event_types.CHAT_CHANGED) {
                    rw.eventSource.emit(rw.event_types.CHAT_CHANGED);
                    return true;
                }
            } catch (e4) {}
        } catch (e) {}

        return false;
    }

    function adrDSaveThenRedrawAfterInject() {
        // v1.9.26：温和可观测保存。
        // saveChat 若返回 Promise，则显式 reject 才判失败；不可观测时保守视为成功，避免卡死。
        return new Promise(function (resolve, reject) {
            try {
                var c = ctx();
                var done = false;

                function redrawLater(ms, ok, err) {
                    setTimeout(function () {
                        if (done) return;
                        done = true;
                        try { adrDNativeRedrawNow(); } catch (eRedraw) {}
                        if (ok === false) reject(err || new Error("聊天保存失败"));
                        else resolve(true);
                    }, ms);
                }

                try {
                    if (c && typeof c.saveChat === "function") {
                        var ret = c.saveChat();
                        if (ret && typeof ret.then === "function") {
                            ret.then(function () {
                                redrawLater(180, true);
                            }).catch(function (err) {
                                var e = err instanceof Error ? err : new Error(String(err || "聊天保存失败"));
                                e.name = "SaveChatError";
                                redrawLater(180, false, e);
                            });
                            return;
                        }
                    }
                } catch (e1) {
                    e1.name = e1.name || "SaveChatError";
                    redrawLater(180, false, e1);
                    return;
                }

                // 如果 saveChat 不是 Promise，就给移动端文件保存/IndexedDB 一点时间；不可观测不强判失败。
                redrawLater(1200, true);
            } catch (e) {
                console.warn("[Arrebol D] save then redraw failed", e);
                setTimeout(function () { try { adrDNativeRedrawNow(); } catch (e2) {} }, 1500);
                resolve(true);
            }
        });
    }


    function adrDBlurActiveElement() {
        try {
            var d = rootDoc();
            if (d && d.activeElement && typeof d.activeElement.blur === "function") {
                d.activeElement.blur();
                return true;
            }
        } catch (e1) {}

        try {
            var rw = rootWin();
            if (rw && rw.document && rw.document.activeElement && typeof rw.document.activeElement.blur === "function") {
                rw.document.activeElement.blur();
                return true;
            }
        } catch (e2) {}

        return false;
    }

    function adrDWriteDirectorInjection(type, text) {
        if (!text || !text.trim()) return false;

        try {
            var c = ctx();
            var chat = c.chat;
            if (!chat || !chat.length) return false;

            var idx = findLastMessageIndex(chat);
            if (idx < 0 || !chat[idx]) return false;

            var add = injectionText(type, text);

            // 移除同类型旧注入，避免最后一条消息越堆越多。
            var mes = String(chat[idx].mes || "");
            var startMark = "<!-- ARREBOL_D_START:" + type + " -->";
            var endMark = "<!-- ARREBOL_D_END:" + type + " -->";

            var startAt = mes.indexOf(startMark);
            while (startAt >= 0) {
                var endAt = mes.indexOf(endMark, startAt);
                if (endAt < 0) break;
                mes = mes.slice(0, startAt).trimEnd() + mes.slice(endAt + endMark.length);
                startAt = mes.indexOf(startMark);
            }

            var startMark2 = "<!-- ARREBOL_D_START:" + type;
            var endMark2 = "ARREBOL_D_END:" + type + " -->";
            var startAt2 = mes.indexOf(startMark2);
            while (startAt2 >= 0) {
                var endAt2 = mes.indexOf(endMark2, startAt2);
                if (endAt2 < 0) break;
                mes = mes.slice(0, startAt2).trimEnd() + mes.slice(endAt2 + endMark2.length);
                startAt2 = mes.indexOf(startMark2);
            }

            var visibleName = type === "plot" ? "统筹" : "情感导演";
            var reOldVisible = new RegExp("\\n\\n【(?:红霞导演室|暗河红霞 Arrebol D)(?:｜|\\|)" + visibleName + "】[\\s\\S]*$", "m");
            mes = mes.replace(reOldVisible, "");

            // v1.9.27：只移除“本类型”的带类型标记旧注入。另一类型的块原地保留，双导演同拍共存。
            var t = type === "plot" ? "plot" : "emotion";
            var reTypedOwn = new RegExp("\\n?arrebol_d(?:_visible)?:" + t + "###[\\s\\S]*?###", "g");
            mes = mes.replace(reTypedOwn, "");

            // 迁移兜底：≤1.9.26 的无类型旧标记（arrebol_d### / arrebol_d_visible###）一律清除。
            // 旧格式因互删缺陷至多存活一块，清掉后由各导演在各自下一拍以带类型格式重建。
            mes = mes.replace(/\n?arrebol_d(?:_visible)?###[\s\S]*?###/g, "").trimEnd();

            chat[idx].mes = mes.trimEnd() + add;
            try { adrDDirectorLogPush(type, text); } catch (eLog34) {}
            try { adrDUpdateFloatFromInjection(type, text); } catch (eFloat34) {}
            try { adrDGrazeClearOnInjection(type); } catch (eGraze) {} // v1.13.0：稿子挂上即归队
            return true;
        } catch (e) {
            console.error("[Arrebol D] inject write failed", e);
            return false;
        }
    }

    function injectDirector(type, text) {
        try {
            var ok = adrDWriteDirectorInjection(type, text);
            if (!ok) return false;
            adrDSaveThenRedrawAfterInject().catch(function (e) {
                try { console.warn("[Arrebol D] async save after manual inject failed", e); } catch (eWarn) {}
            });
            return true;
        } catch (e) {
            console.error("[Arrebol D] inject failed", e);
            return false;
        }
    }

    async function injectDirectorAsync(type, text) {
        try {
            var ok = adrDWriteDirectorInjection(type, text);
            if (!ok) return false;
            await adrDSaveThenRedrawAfterInject();
            return true;
        } catch (e) {
            console.error("[Arrebol D] inject async failed", e);
            if (e && !e.name) e.name = "SaveChatError";
            throw e;
        }
    }

    function localTest(type) {
        syncAll();
        var r = activeRange();
        var title = type === "plot" ? "统筹试运行预览" : "情感导演试运行预览";
        var text = "【" + title + "】\n按钮、读取聊天、写入结果框链路可用。\n\n【读取最近 " + r + " 轮】\n" + (recentChat(r).slice(0, 1200) || "（未读取到聊天内容）");
        setPreview(type, text);
        status(type, "试运行成功 ✓（没花钱，导演读到的内容见弹窗）", "#8ed99d");
        setButtons(type);
    }

    function pushModel(list, m) {
        if (!m) return;
        if (typeof m === "string") { list.push(m); return; }
        if (m.id) list.push(m.id);
        else if (m.name) list.push(m.name);
        else if (m.model) list.push(m.model);
        else if (m.slug) list.push(m.slug);
    }

    function extractModels(data) {
        var list = [];

        if (!data) return list;

        if (Array.isArray(data)) data.forEach(function (m) { pushModel(list, m); });
        else if (Array.isArray(data.data)) data.data.forEach(function (m) { pushModel(list, m); });
        else if (Array.isArray(data.models)) data.models.forEach(function (m) { pushModel(list, m); });
        else if (data.id) pushModel(list, data);

        var seen = {};
        var out = [];
        list.forEach(function (x) {
            x = String(x || "").trim();
            if (!x || seen[x]) return;
            seen[x] = true;
            out.push(x);
        });
        out.sort();
        return out;
    }

    function fillModelSelect(type, models) {
        var st = settings();
        var modelKey = field(type, "model");
        var current = st[modelKey] || "";

        var sel = qForm("adr044-" + type + "-model-select");
        if (!sel) return;

        var html = "";
        if (current) html += '<option value="' + esc(current) + '">' + esc(current) + '（当前）</option>';
        else html += '<option value="">加载后选择模型</option>';

        models.forEach(function (m) {
            if (m === current) return;
            html += '<option value="' + esc(m) + '">' + esc(m) + '</option>';
        });

        sel.innerHTML = html;
        if (current) sel.value = current;
    }

    async function loadModels(type) {
        syncType(type);

        var st = settings();
        var p = prefixOf(type);
        var endpoint = st[p + "ApiEndpoint"] || "";
        var key = st[p + "ApiKey"] || "";

        if (!endpoint) {
            status(type, "请先填写 API 地址", "#d4726a");
            return;
        }

        var url = modelsUrl(endpoint);
        if (!url) {
            status(type, "API 地址无效", "#d4726a");
            return;
        }

        var btn = qForm("adr044-" + type + "-load-models");
        if (btn) {
            btn.disabled = true;
            btn.textContent = "加载中…";
        }

        status(type, "正在拉取模型列表…", "#8ed99d");

        try {
            var headers = {};
            if (key) headers.Authorization = "Bearer " + key;

            var res = await fetch(url, { method: "GET", headers: headers });
            var raw = await res.text();

            if (!res.ok) throw new Error("模型接口 " + res.status + "：" + raw.slice(0, 220));

            var data;
            try { data = JSON.parse(raw); }
            catch (e) { throw new Error("模型接口返回非 JSON：" + raw.slice(0, 180)); }

            var models = extractModels(data);
            if (!models.length) throw new Error("没有解析到模型名");

            fillModelSelect(type, models);
            status(type, "已加载 " + models.length + " 个模型 ✓", "#8ed99d");
        } catch (e2) {
            status(type, "加载模型失败：" + (e2.message || String(e2)), "#d4726a");
        }

        if (btn) {
            btn.disabled = false;
            btn.textContent = "加载模型";
        }
    }

    function safeType(v) {
        if (v === null) return "null";
        if (v === undefined) return "undefined";
        if (Array.isArray(v)) return "array(" + v.length + ")";
        return typeof v;
    }

    function shortText(v, max) {
        max = max || 500;
        try {
            var s = typeof v === "string" ? v : JSON.stringify(v, null, 2);
            if (!s) return "";
            if (s.length > max) return s.slice(0, max) + "…";
            return s;
        } catch (e) {
            try { return String(v).slice(0, max); } catch (_) { return ""; }
        }
    }

    function listKeys(obj, max) {
        max = max || 80;
        try {
            if (!obj) return "（无）";
            var keys = Object.keys(obj);
            return keys.slice(0, max).join(", ") + (keys.length > max ? " … 共" + keys.length + "项" : "");
        } catch (e) {
            return "（无法读取 keys：" + e.message + "）";
        }
    }

    function getCurrentCharacterProbe() {
        var c;
        try { c = ctx(); } catch (e) { return { error: e.message }; }

        var info = {
            chid: null,
            characterId: null,
            name1: null,
            charObj: null,
            source: ""
        };

        var ids = ["characterId", "this_chid", "chid", "currentCharacterId"];
        ids.forEach(function (k) {
            if (c[k] !== undefined && info[k === "characterId" ? "characterId" : "chid"] === null) {
                if (k === "characterId") info.characterId = c[k];
                else info.chid = c[k];
            }
        });

        var id = info.characterId;
        if (id === null || id === undefined) id = info.chid;

        try {
            if (c.characters && id !== null && id !== undefined && c.characters[id]) {
                info.charObj = c.characters[id];
                info.source = "ctx.characters[id]";
            }
        } catch (e1) {}

        try {
            if (!info.charObj && c.character) {
                info.charObj = c.character;
                info.source = "ctx.character";
            }
        } catch (e2) {}

        try {
            if (!info.charObj && c.characters && Array.isArray(c.characters) && c.name1) {
                for (var i = 0; i < c.characters.length; i++) {
                    if (c.characters[i] && c.characters[i].name === c.name1) {
                        info.charObj = c.characters[i];
                        info.source = "ctx.characters by name1";
                        break;
                    }
                }
            }
        } catch (e3) {}

        try { info.name1 = c.name1 || (info.charObj && info.charObj.name) || ""; } catch (e4) {}

        return info;
    }

    function extractCoreCharacterText(ch) {
        if (!ch) return "";
        var parts = [];
        var fields = [
            ["name", "名称"],
            ["description", "描述"],
            ["personality", "性格"],
            ["scenario", "场景"],
            ["first_mes", "首条消息"],
            ["mes_example", "示例对话"],
            ["creator_notes", "创作者注释"],
            ["system_prompt", "系统提示"],
            ["post_history_instructions", "后历史指令"]
        ];

        fields.forEach(function (pair) {
            var k = pair[0], label = pair[1];
            if (ch[k]) parts.push("【" + label + "】\n" + String(ch[k]).trim());
        });

        try {
            if (ch.data) {
                fields.forEach(function (pair) {
                    var k = pair[0], label = pair[1];
                    if (ch.data[k] && !ch[k]) parts.push("【data." + label + "】\n" + String(ch.data[k]).trim());
                });
            }
        } catch (e) {}

        return parts.join("\n\n");
    }

    function findPersonaProbe() {
        var c;
        try { c = ctx(); } catch (e) { return { error: e.message }; }

        var candidates = [];
        var keys = [
            "persona",
            "persona_description",
            "personaDescription",
            "user_description",
            "userDescription",
            "power_user",
            "name2"
        ];

        keys.forEach(function (k) {
            try {
                if (c[k] !== undefined) candidates.push({ key: "ctx." + k, type: safeType(c[k]), value: shortText(c[k], 600) });
            } catch (e) {}
        });

        try {
            var rw = rootWin();
            ["persona_description", "power_user", "selected_persona", "name2", "user_avatar"].forEach(function (k) {
                if (rw[k] !== undefined) candidates.push({ key: "window." + k, type: safeType(rw[k]), value: shortText(rw[k], 600) });
            });
        } catch (e2) {}

        return candidates;
    }

    function findWorldProbe() {
        var c;
        try { c = ctx(); } catch (e) { return [{ key: "ctx", error: e.message }]; }

        var out = [];
        var ctxKeys = [
            "world_info",
            "worldInfo",
            "worldInfos",
            "world_names",
            "worldNames",
            "chat_metadata",
            "chatMetadata",
            "characters",
            "groups",
            "extensionSettings"
        ];

        ctxKeys.forEach(function (k) {
            try {
                if (c[k] !== undefined) out.push({ key: "ctx." + k, type: safeType(c[k]), keys: listKeys(c[k], 40), value: shortText(c[k], 500) });
            } catch (e) {}
        });

        try {
            var rw = rootWin();
            [
                "world_info",
                "worldInfo",
                "world_names",
                "world_names_data",
                "selected_world_info",
                "chat_metadata",
                "getWorldInfoPrompt",
                "getWorldInfoPromptData",
                "getWorldInfoSettings",
                "world_info_data"
            ].forEach(function (k) {
                if (rw[k] !== undefined) out.push({ key: "window." + k, type: safeType(rw[k]), keys: listKeys(rw[k], 40), value: shortText(rw[k], 500) });
            });
        } catch (e2) {}

        return out;
    }

    function extractContentBlocksFromText(text) {
        text = String(text || "");
        text = cleanMessage(text);

        var blocks = [];
        var re = adrDContentTagRegex();
        var m;
        while ((m = re.exec(text)) !== null) {
            var v = (m[2] || "").trim();
            if (v) blocks.push(v);
        }

        return blocks;
    }

    function contentBlocksProbe(rounds) {
        var chat;
        try { chat = ctx().chat; } catch (e) { return { error: e.message, blocks: [] }; }
        if (!chat || !chat.length) return { blocks: [], lines: ["（未读取到聊天）"] };

        var limit = rounds * 2;
        var lines = [];
        var blocks = [];
        var count = 0;

        for (var i = chat.length - 1; i >= 0 && count < limit; i--) {
            var msg = chat[i];
            if (!msg || msg.is_system) continue;

            var role = msg.is_user ? "用户" : (msg.name || "角色");
            var found = extractContentBlocksFromText(msg.mes);

            if (found.length) {
                for (var j = 0; j < found.length; j++) {
                    blocks.unshift({
                        index: i,
                        role: role,
                        text: found[j]
                    });
                }
                lines.unshift("消息 #" + i + " [" + role + "] 提取到 " + found.length + " 段 <content>");
            } else {
                lines.unshift("消息 #" + i + " [" + role + "] 无 <content>");
            }

            count++;
        }

        return { blocks: blocks, lines: lines };
    }

    function runContextProbe() {
        syncAll();

        var c;
        try { c = ctx(); } catch (e) {
            setPreview(currentType(), "读取 ctx 失败：" + e.message);
            return;
        }

        var charInfo = getCurrentCharacterProbe();
        var ch = charInfo.charObj;
        var persona = findPersonaProbe();
        var worlds = findWorldProbe();
        var content = contentBlocksProbe(activeRange());

        var out = "";
        out += "【红霞探针 v1.0.5.6.8.1.3.2】\n";
        out += "目的：检测酒馆 1.81 当前环境里角色卡 / 世界书 / user 人设 / <content> 所在字段。\n\n";

        out += "【Context 顶层 keys】\n";
        out += listKeys(c, 120) + "\n\n";

        out += "【当前角色定位】\n";
        out += "characterId: " + shortText(charInfo.characterId, 100) + "\n";
        out += "chid/this_chid: " + shortText(charInfo.chid, 100) + "\n";
        out += "name1/角色名: " + shortText(charInfo.name1, 100) + "\n";
        out += "角色来源: " + (charInfo.source || "未定位") + "\n";
        out += "角色对象类型: " + safeType(ch) + "\n";
        out += "角色对象 keys: " + listKeys(ch, 100) + "\n\n";

        out += "【角色卡核心字段预览】\n";
        var core = extractCoreCharacterText(ch);
        out += (core ? core.slice(0, 1800) : "（未提取到常见角色卡字段）") + "\n\n";

        out += "【User 人设 / Persona 候选】\n";
        if (persona.length) {
            persona.forEach(function (p) {
                out += "- " + p.key + " | " + p.type + "\n";
                if (p.value) out += p.value.slice(0, 500) + "\n";
            });
        } else {
            out += "（未找到明显 persona 字段）\n";
        }
        out += "\n";

        out += "【世界书 / Lorebook 候选】\n";
        if (worlds.length) {
            worlds.forEach(function (w) {
                out += "- " + w.key + " | " + w.type + "\n";
                out += "  keys: " + (w.keys || "（无）") + "\n";
                if (w.value) out += "  preview: " + String(w.value).replace(/\n/g, " ").slice(0, 500) + "\n";
            });
        } else {
            out += "（未找到明显 world/lorebook 字段）\n";
        }
        out += "\n";

        out += "【<content> 提取概览】\n";
        if (content.error) out += "错误：" + content.error + "\n";
        out += "提取段数: " + (content.blocks ? content.blocks.length : 0) + "\n";
        if (content.lines) out += content.lines.slice(0, 80).join("\n") + "\n";

        setPreview(currentType(), out);
        status(currentType(), "上下文探针完成 ✓ 请复制结果给小g", "#8ed99d");
        setButtons(currentType());
    }

    function runContentProbe() {
        syncAll();

        var result = contentBlocksProbe(activeRange());
        var out = "";
        out += "【<content> 精准提取测试】\n";
        out += "范围：最近 " + activeRange() + " 轮，按消息倒序扫描后恢复顺序。\n\n";

        if (result.error) out += "错误：" + result.error + "\n\n";

        out += "【扫描概览】\n";
        out += (result.lines && result.lines.length ? result.lines.join("\n") : "（无扫描结果）") + "\n\n";

        out += "【提取正文】\n";
        if (result.blocks && result.blocks.length) {
            result.blocks.forEach(function (b, i) {
                out += "\n--- content #" + (i + 1) + " / 消息#" + b.index + " / " + b.role + " ---\n";
                out += b.text + "\n";
            });
        } else {
            out += "未提取到 <content>...</content>。如果你的正文没有 content 标签，正式版需要 fallback 策略。\n";
        }

        setPreview(currentType(), out);
        status(currentType(), "<content> 提取测试完成 ✓", "#8ed99d");
        setButtons(currentType());
    }


    // ================= v1.11.0 抽卡剧情小能手（进组模块）=================
    // 定位：每 N 楼向模型贴耳投一张"发生了一半的事"，治长上下文剧情塌缩。
    // v1.11 三仓库：专属剧情库（跟角色卡）／通用库／NSFW 库，各自勾选启用。
    //       三段抽 = 掷仓库（启用者均等）→ 掷卡池（池内均等）→ 掷卡（冷却区不复用）。
    // 纪律：与导演共用全量计数、chatKey 与 API 预设机器；耳机通道独立 key；基准线体系零接触；
    //       失败保拍（不投出不推进 lastDrawAt）；DS 任何异常当场降级盲抽，抽卡器永不停摆。
    //       v1.11 铁则：刷新永不覆盖正在输入的控件；编辑区只在换库/导入/换聊时回灌。
    // 需求与终裁：江 ｜ 架构与施工：波哥（Claude Fable 5）｜ 原体血统：ripple & GPT & Claude

    var ADR_CD_EP_KEY = "ARREBOL_D_CARD_DRAWER"; // 工程铁则：与 ARREBOL_D_DIRECTOR_FLOAT 互异
    var ADR_CD_LS_KEY = "arrebol_d_cd_chat_v1";
    var ADR_CD_META_KEY = "arrebol_d_cd";
    var ADR_CD_HISTORY_MAX = 5;
    var ADR_CD_RECENT_MAX = 32;
    var ADR_CD_PICK_TIMEOUT_MS = 8000;

    // 三个仓库槽位。story 跟角色卡走，common 打底，nsfw 单独一格由住户自己填。
    var ADR_CD_SLOTS = ["story", "common", "nsfw"];
    var ADR_CD_SLOT_LABEL = { story: "专属", common: "通用", nsfw: "NSFW" };
    var ADR_CD_SLOT_FULL = { story: "专属剧情库", common: "通用库", nsfw: "NSFW 库" };

    var ADR_CD_DEFAULT_ENVELOPE = "【场外事实】以下事件已然发生。织入正文；不得复述原文；不得在单楼内全部兑现：{卡面}";
    // v1.12：后半程信封。卡挂过半衰期后自动换成这段——已经落地的事不该再逼着推进。
    var ADR_CD_DEFAULT_ENVELOPE_FADED = "【已发生的背景】此事已经发生过。可以被提及或延续余波，但不必再推进它：{卡面}";

    // 出厂三套信封预设：不同模型吃不同话术
    var ADR_CD_FACTORY_ENVELOPES = {
        "标准": {
            active: ADR_CD_DEFAULT_ENVELOPE,
            faded: ADR_CD_DEFAULT_ENVELOPE_FADED
        },
        "强硬": {
            active: "【剧情变量】以下事件必须发生。转化为剧情巧妙织入正文，**绝对不得复述原句**；不得在单楼内全部兑现：{卡面}",
            faded: "【已发生的背景】此事已经发生过，**不要再重复描写**。可以被提及或延续余波，但不必再推进它：{卡面}"
        },
        "轻柔": {
            active: "（场外，正在发生的一件事，你可以选择让它进入这一幕，也可以让它先在背景里发酵：{卡面}）",
            faded: "（这件事已经发生过了，余波还在：{卡面}）"
        }
    };

    var ADR_CD_FACTORY_LIB = [
        "## 意外",
        "门房捎来一句口信：三天前就该到的人，今晚到了。",
        "后厨传来一声碎响，随后是长得反常的安静。",
        "信封里除了信，还多出一把不认识的钥匙。",
        "雨停了，屋檐下多了一双不属于任何人的鞋。",
        "",
        "## 转折",
        "一直没人坐的那把椅子，今天有人径直坐下了。",
        "原本说定的价钱，对方临场翻了一倍，理由只字不提。",
        "那扇常年上锁的门虚掩着，锁孔里还插着钥匙。",
        "有人当众叫出了一个很久没人敢提的名字。",
        "",
        "## 伏笔",
        "桌角压着半张车票，日期是十天以后。",
        "巷口停了辆车，从昨夜到现在没熄过火。",
        "账本最后一页被撕走了，撕口很新。",
        "墙上的合影少了一个人，相框却没换小。",
        "",
        "## 代价",
        "上次帮忙的人捎话来了：该还的，这两天要还。",
        "旧伤在变天前又疼了，比上一次更深一些。",
        "有人替这边挡了一句话，代价当场没说，记下了。",
        "",
        "## 外力",
        "停电了，整条街只剩一户还亮着灯。",
        "官面上的人来过了，没进门，只在对街站了一炷香。",
        "天气骤变，原定今晚的路走不成了。",
        "",
        "## 狗血",
        "席间有人认错了人，偏偏错得有名有姓。",
        "一封没署名的信，把三个人写在了同一句话里。",
        "旧物摊上摆着一件本不该流出去的东西。"
    ].join("\n");

    var ADR_CD_HELP_TEXT = [
        "卡面家法：一行一张卡。每张卡是一件\"发生了一半的事\"，三特征缺一不可——",
        "· 具体：有人有物有时刻；",
        "· 悬置：谁 / 为何，卡不说，留给演员说；",
        "· 可嫁接：无专名，什么局都能落（专名由统筹在场上现铸）。",
        "写的是意象与事实，不是指令。\"门房捎来一句口信：三天前就该到的人，今晚到了\"合格；\"现在发生一个转折\"不合格。",
        "格式：`## 卡池名` 一行开卡池，一行一张卡，空行随意，`//` 开头是注释行；即改即生效。",
        "三仓库：专属库配角色卡（写这个角色独有的事），通用库打底（什么局都能落），NSFW 库单独一格。启用哪几格就在哪几格之间均等掷——仓库数就是权重，专属库池少也不会被通用库淹掉。",
        "卡面里可以写 {{user}} / {{char}} 等宏，投卡时会替换成当前名字。"
    ].join("\n");

    // ---- 纯函数区（挂 __adrCdTest 供桩测与真机验证）----

    function adrCdParseLibraryText(text) {
        var pools = [];
        var cur = null;
        String(text || "").split(/\r?\n/).forEach(function (line) {
            var s = String(line || "").trim();
            if (!s) return;
            var m = s.match(/^##\s*(.+)$/);
            if (m) {
                cur = { name: m[1].trim(), cards: [] };
                pools.push(cur);
                return;
            }
            if (s.indexOf("//") === 0) return;
            if (!cur) {
                cur = { name: "未分池", cards: [] };
                pools.push(cur);
            }
            cur.cards.push(s);
        });
        return pools.filter(function (p) { return p.cards.length > 0; });
    }

    function adrCdPickFromPool(cards, recentList, cooldownM, rng) {
        rng = typeof rng === "function" ? rng : Math.random;
        cards = Array.isArray(cards) ? cards : [];
        if (!cards.length) return "";
        var M = Math.max(0, Math.floor(Number(cooldownM) || 0));
        // 自动降冷却：单池卡数 <= 冷却量时降到 卡数-1，防抽空死锁
        if (cards.length <= M) M = Math.max(0, cards.length - 1);
        var elig = [];
        while (true) {
            var recent = (recentList || []).slice(-M);
            var set = {};
            recent.forEach(function (c) { set[c] = 1; });
            elig = cards.filter(function (c) { return !set[c]; });
            if (elig.length || M <= 0) break;
            M--;
        }
        if (!elig.length) elig = cards.slice();
        return elig[Math.floor(rng() * elig.length)] || "";
    }

    function adrCdSanitizePickResponse(raw, menu) {
        var s = String(raw || "").trim();
        s = s.replace(/^["'「『【\[\(（\s]+/, "").replace(/["'」』】\]\)）。．.!！\s]+$/, "").trim();
        for (var i = 0; i < (menu || []).length; i++) {
            if (s === String(menu[i])) return menu[i];
        }
        return "";
    }

    function adrCdBuildEnvelope(template, card) {
        var tpl = String(template || "").trim() || ADR_CD_DEFAULT_ENVELOPE;
        if (tpl.indexOf("{卡面}") >= 0) return tpl.split("{卡面}").join(String(card || ""));
        return tpl + String(card || "");
    }

    // 三段抽第一段：把启用槽摊成 [{slot, poolName, cards, menuName}]，供掷槽/掷池与择池菜单共用
    function adrCdBuildSlotPools(slotTexts) {
        var out = [];
        ADR_CD_SLOTS.forEach(function (slot) {
            var text = slotTexts && slotTexts[slot];
            if (typeof text !== "string" || !text.trim()) return;
            adrCdParseLibraryText(text).forEach(function (p) {
                out.push({
                    slot: slot,
                    poolName: p.name,
                    cards: p.cards,
                    menuName: ADR_CD_SLOT_LABEL[slot] + "·" + p.name
                });
            });
        });
        return out;
    }

    try {
        rootWin().__adrCdTest = {
            parseLibraryText: adrCdParseLibraryText,
            pickFromPool: adrCdPickFromPool,
            sanitizePickResponse: adrCdSanitizePickResponse,
            buildEnvelope: adrCdBuildEnvelope,
            buildSlotPools: adrCdBuildSlotPools,
            rollPool: adrCdRollPool,
            factoryLib: ADR_CD_FACTORY_LIB
        };
    } catch (eCdTestHook) {}

    // ---- 账号级设置读取 ----

    function adrCdActive() {
        try { return !!settings().cdEnabled && adrDMasterEnabled(); } catch (e) { return false; }
    }

    function adrCdN() {
        var n = Math.round(Number(settings().cdN));
        if (!Number.isFinite(n)) n = 5;
        return Math.min(20, Math.max(1, n));
    }

    function adrCdDepth() {
        var d = Math.round(Number(settings().cdDepth));
        if (!Number.isFinite(d)) d = 2;
        return Math.min(4, Math.max(0, d));
    }

    function adrCdCooldown() {
        var m = Math.round(Number(settings().cdCooldown));
        if (!Number.isFinite(m) || m < 0) m = 8;
        return Math.min(99, m);
    }

    function adrCdLibraries() {
        var st = settings();
        if (!st.cdLibraries || typeof st.cdLibraries !== "object" || Array.isArray(st.cdLibraries)) {
            st.cdLibraries = {};
        }
        if (!Object.keys(st.cdLibraries).length) {
            st.cdLibraries["通用"] = ADR_CD_FACTORY_LIB;
        }
        return st.cdLibraries;
    }

    function adrCdLibNames() { return Object.keys(adrCdLibraries()); }

    // v1.18.0 归属制：每副库有一个"家箱"（账号级、永久）。分了箱的库只出现在自家格子，
    // 点亮/熄灭只管"这局用不用"，不再影响它住哪。未分箱的库三格可见，点亮即认箱。
    function adrCdLibHomes() {
        var st = settings();
        if (!st.cdLibHomes || typeof st.cdLibHomes !== "object" || Array.isArray(st.cdLibHomes)) st.cdLibHomes = {};
        return st.cdLibHomes;
    }

    function adrCdLibHome(name) {
        var h = String(adrCdLibHomes()[name] || "");
        return ADR_CD_SLOTS.indexOf(h) >= 0 ? h : "";
    }

    function adrCdSetLibHome(name, slot) {
        var homes = adrCdLibHomes();
        if (slot && ADR_CD_SLOTS.indexOf(slot) >= 0) homes[name] = slot;
        else delete homes[name];
        save("cdLibHomes", homes);
    }

    function adrCdEnvelopes() {
        var st = settings();
        if (!st.cdEnvelopes || typeof st.cdEnvelopes !== "object" || Array.isArray(st.cdEnvelopes)) {
            st.cdEnvelopes = {};
        }
        if (!Object.keys(st.cdEnvelopes).length) {
            Object.keys(ADR_CD_FACTORY_ENVELOPES).forEach(function (k) {
                st.cdEnvelopes[k] = {
                    active: ADR_CD_FACTORY_ENVELOPES[k].active,
                    faded: ADR_CD_FACTORY_ENVELOPES[k].faded
                };
            });
        }
        return st.cdEnvelopes;
    }

    function adrCdEnvelopeNames() { return Object.keys(adrCdEnvelopes()); }

    function adrCdCurrentEnvelopeName() {
        var st = settings();
        var all = adrCdEnvelopes();
        var cur = String(st.cdEnvelopeCurrent || "");
        if (cur && all[cur]) return cur;
        return adrCdEnvelopeNames()[0] || "标准";
    }

    // 当前生效的两段模板。面板上手改的 cdEnvelope/cdEnvelopeFaded 优先于预设。
    function adrCdEnvelopePair() {
        var st = settings();
        var pair = adrCdEnvelopes()[adrCdCurrentEnvelopeName()] || {};
        return {
            active: String(st.cdEnvelope || "").trim() || pair.active || ADR_CD_DEFAULT_ENVELOPE,
            faded: String(st.cdEnvelopeFaded || "").trim() || pair.faded || ADR_CD_DEFAULT_ENVELOPE_FADED
        };
    }

    function adrCdHalfLifeFloors() { return Math.max(1, Math.ceil(adrCdN() / 2)); }

    // 账号级槽默认值：新聊天开局继承这一份
    function adrCdSlotDefaults() {
        var st = settings();
        if (!st.cdSlotDefaults || typeof st.cdSlotDefaults !== "object") {
            st.cdSlotDefaults = { story: "", common: "通用", nsfw: "" };
        }
        return st.cdSlotDefaults;
    }

    function adrCdSlotOnDefaults() {
        var st = settings();
        if (!st.cdSlotOnDefaults || typeof st.cdSlotOnDefaults !== "object") {
            st.cdSlotOnDefaults = { story: true, common: true, nsfw: false };
        }
        return st.cdSlotOnDefaults;
    }

    // ---- 聊天级状态：chat_metadata 主档 + localStorage 按 chatKey 镜像 ----

    function adrCdMetaRoot() {
        try {
            var c = ctx();
            var m = c.chatMetadata || c.chat_metadata;
            if (m && typeof m === "object") return m;
        } catch (e) {}
        return null;
    }

    // v1.17.0：仓库槽多选。旧存档是单个字符串，一律归一成数组；不按逗号拆，库名里带逗号也不误伤。
    function adrCdSlotArr(v) {
        var arr = Array.isArray(v) ? v : (v == null || v === "" ? [] : [v]);
        var out = [];
        var seen = {};
        arr.forEach(function (x) {
            var nm = String(x || "").trim();
            if (!nm || seen[nm]) return;
            seen[nm] = true;
            out.push(nm);
        });
        return out;
    }

    function adrCdNormalizeChatState(raw) {
        var o = raw && typeof raw === "object" ? raw : {};
        var defSlots = adrCdSlotDefaults();
        var defOn = adrCdSlotOnDefaults();
        var slots = {};
        var slotOn = {};
        var rawSlots = o.slots && typeof o.slots === "object" ? o.slots : null;
        var rawOn = o.slotOn && typeof o.slotOn === "object" ? o.slotOn : null;
        ADR_CD_SLOTS.forEach(function (s) {
            if (rawSlots && (typeof rawSlots[s] === "string" || Array.isArray(rawSlots[s]))) slots[s] = adrCdSlotArr(rawSlots[s]);
            else slots[s] = adrCdSlotArr(defSlots[s]);
            slotOn[s] = rawOn ? rawOn[s] === true : defOn[s] === true;
        });
        // v1.10 迁移：旧的单库字段 lib 落进通用槽
        if (!rawSlots && typeof o.lib === "string" && o.lib) {
            slots.common = adrCdSlotArr(o.lib);
            slotOn.common = true;
        }
        // v1.17.0 一库一槽：同一卡库若被历史数据挂进多个仓库，只保留最先出现的那个槽。
        var claimed = {};
        ADR_CD_SLOTS.forEach(function (s) {
            slots[s] = slots[s].filter(function (nm) {
                if (claimed[nm]) return false;
                claimed[nm] = true;
                return true;
            });
        });
        // v1.18.0 归属对账：点亮的库若还没分箱，此刻认箱（老存档自动迁移进归属制）；
        // 若归属在别的箱，说明是历史串门数据，从本箱摘下。归属是账号级真相，点亮只是使用开关。
        try {
            ADR_CD_SLOTS.forEach(function (s) {
                slots[s] = slots[s].filter(function (nm) {
                    var home = adrCdLibHome(nm);
                    if (!home) { adrCdSetLibHome(nm, s); return true; }
                    return home === s;
                });
            });
        } catch (eHome) {}
        return {
            lastDrawAt: Number.isFinite(Number(o.lastDrawAt)) ? Number(o.lastDrawAt) : -1,
            slots: slots,
            slotOn: slotOn,
            history: Array.isArray(o.history) ? o.history.slice(-ADR_CD_HISTORY_MAX) : [],
            recent: Array.isArray(o.recent) ? o.recent.slice(-ADR_CD_RECENT_MAX) : [],
            paused: o.paused === true,
            streak: o.streak && typeof o.streak === "object"
                ? { pool: String(o.streak.pool || ""), n: Math.max(0, Number(o.streak.n) || 0) }
                : { pool: "", n: 0 },
            floatText: typeof o.floatText === "string" ? o.floatText : "",
            // v1.12：留原始卡面，才能在半衰期换信封；stage 记录这张卡走到哪一步了
            floatCard: typeof o.floatCard === "string" ? o.floatCard : "",
            floatStage: (o.floatStage === "faded" || o.floatStage === "done") ? o.floatStage : "active"
        };
    }

    function adrCdChatState() {
        try {
            var root = adrCdMetaRoot();
            if (root && root[ADR_CD_META_KEY] && typeof root[ADR_CD_META_KEY] === "object") {
                return adrCdNormalizeChatState(root[ADR_CD_META_KEY]);
            }
        } catch (e0) {}
        try {
            var all = adrDReadJsonLS(ADR_CD_LS_KEY);
            return adrCdNormalizeChatState(all[adrDChatKey()]);
        } catch (e1) {}
        return adrCdNormalizeChatState(null);
    }

    // 返回是否落进了服务器侧主档（供暂停等关键写入回读校验）
    function adrCdSaveChatState(state) {
        var clean = adrCdNormalizeChatState(state);
        var metaOk = false;
        var keyReady = false;
        try { keyReady = adrDChatKeyReady(); } catch (eK) { keyReady = false; }
        try {
            var root = adrCdMetaRoot();
            if (root) {
                root[ADR_CD_META_KEY] = clean;
                metaOk = true;
                var c = ctx();
                if (typeof c.saveMetadataDebounced === "function") c.saveMetadataDebounced();
                else if (typeof c.saveMetadata === "function") c.saveMetadata();
            }
        } catch (eMeta) { metaOk = false; }
        // v1.11：chatKey 未就绪时不再整体放弃——服务器侧内存档照写，只跳过 LS 镜像。
        if (keyReady) {
            try {
                var all = adrDReadJsonLS(ADR_CD_LS_KEY);
                all[adrDChatKey()] = clean;
                adrDWriteJsonLS(ADR_CD_LS_KEY, all);
            } catch (eLs) {}
        }
        return metaOk || keyReady;
    }

    // 槽里选中的库名们 → 库文本拼接；池解析器吃拼接文本，多库的池自然全部入场
    function adrCdSlotText(state, slot) {
        var names = state && state.slots ? adrCdSlotArr(state.slots[slot]) : [];
        if (!names.length) return "";
        var libs = adrCdLibraries();
        var parts = [];
        names.forEach(function (name) {
            if (typeof libs[name] === "string" && libs[name].trim()) parts.push(libs[name]);
        });
        return parts.join("\n\n");
    }

    function adrCdEnabledSlotTexts(state) {
        var out = {};
        ADR_CD_SLOTS.forEach(function (s) {
            if (state.slotOn && state.slotOn[s]) {
                var t = adrCdSlotText(state, s);
                if (t) out[s] = t;
            }
        });
        return out;
    }

    // ---- 耳机通道 ----

    function adrCdSubstitute(text) {
        try {
            var c = ctx();
            if (typeof c.substituteParams === "function") return c.substituteParams(String(text || ""));
        } catch (e) {}
        return String(text || "");
    }

    function adrCdApplyFloat(text) {
        try {
            var c = ctx();
            if (typeof c.setExtensionPrompt !== "function") return false;
            var EPT = c.extensionPromptTypes || c.extension_prompt_types || {};
            var pos = EPT.IN_CHAT != null ? EPT.IN_CHAT : 1;
            var EPR = c.extensionPromptRoles || c.extension_prompt_roles || {};
            var role = EPR.SYSTEM != null ? EPR.SYSTEM : 0;
            // 宏在注入时才替换：存档留原文，换角色/换聊也能正确重算。
            c.setExtensionPrompt(ADR_CD_EP_KEY, adrCdSubstitute(text), pos, adrCdDepth(), false, role);
            return true;
        } catch (e) { return false; }
    }

    function adrCdCurrentFloatLength() {
        try {
            var c = ctx();
            var eps = c.extensionPrompts || c.extension_prompts;
            if (eps && eps[ADR_CD_EP_KEY]) return String(eps[ADR_CD_EP_KEY].value || "").length;
        } catch (e) {}
        return -1;
    }

    function adrCdRestoreFloat(reason) {
        try {
            if (!adrCdActive()) { adrCdApplyFloat(""); adrCdSyncChatControls(); return; }
            var state = adrCdChatState();
            var text = state.floatText || "";
            // v1.12：按当前阶段重建，改过信封模板后也能立刻生效
            if (state.floatCard && state.floatStage !== "done") {
                var pair = adrCdEnvelopePair();
                text = adrCdBuildEnvelope(state.floatStage === "faded" ? pair.faded : pair.active, state.floatCard);
            } else if (state.floatStage === "done") {
                text = "";
            }
            adrCdApplyFloat(state.paused ? "" : text);
            adrCdSyncChatControls();
        } catch (e) {}
    }

    // ---- 择池：DS 只看池名，不看卡面 ----

    function adrCdTruncate(s, max) {
        s = String(s || "");
        return s.length > max ? s.slice(0, max) + "…" : s;
    }

    async function adrCdPickPoolViaDS(slotPools, state) {
        var st = settings();
        var endpoint = st.cdApiEndpoint || "";
        var key = st.cdApiKey || "";
        var model = st.cdModel || "deepseek-chat";
        if (!endpoint) throw new Error("未填写择池 API 地址");
        var url = chatUrl(endpoint);
        if (!url) throw new Error("择池 API 地址无效");

        var menu = slotPools.map(function (p) { return p.menuName; });
        var recentPools = (state.history || []).slice(-3).map(function (h) { return h && h.pool; }).filter(Boolean);

        var sys = "你是抽卡助手的选池器。你只能看到卡池名单，看不到任何卡面内容。"
            + "你的唯一任务：根据当前剧情氛围，从名单中选出此刻最适合投放一张事件卡的卡池。"
            + "只准回复名单中的一个卡池名，一字不差；不加标点、不加解释、不加任何其他文字。多一个字视为无效。";

        var parts = [];
        var precise = "";
        try { precise = buildPreciseContext(); } catch (ePc) {}
        if (precise) parts.push(adrCdTruncate(precise, 4000));
        var recent = "";
        var pickRounds = adrCdPickReadRounds();
        try { recent = await recentContentBlocks(pickRounds); } catch (eRc) {}
        if (recent) parts.push("【最近正文（节选）】\n" + adrCdTruncate(recent, adrCdReadCharCap(pickRounds)));
        parts.push("【卡池名单】\n" + menu.join("\n"));
        if (recentPools.length) parts.push("【最近 3 张已投卡来自的卡池】\n" + recentPools.join("、"));
        parts.push("请从【卡池名单】中回复一个卡池名。");

        var aborterCd = typeof AbortController !== "undefined" ? new AbortController() : null;
        var timeoutId = null;
        var didTimeout = false;
        if (aborterCd) {
            timeoutId = setTimeout(function () {
                didTimeout = true;
                try { aborterCd.abort(); } catch (eA) {}
            }, ADR_CD_PICK_TIMEOUT_MS);
        }

        var headers = { "Content-Type": "application/json" };
        if (key) headers.Authorization = "Bearer " + key;
        var opts = {
            method: "POST",
            headers: headers,
            body: JSON.stringify({
                model: model,
                messages: [
                    { role: "system", content: sys },
                    { role: "user", content: parts.join("\n\n") }
                ],
                temperature: 0.4,
                max_tokens: 30,
                stream: false
            })
        };
        if (aborterCd) opts.signal = aborterCd.signal;

        var raw;
        try {
            var res = await fetch(url, opts);
            raw = await res.text();
            if (!res.ok) throw new Error("择池 API " + res.status + "：" + String(raw || "").slice(0, 160));
        } catch (eFetch) {
            if (didTimeout && eFetch && eFetch.name === "AbortError") throw new Error("择池超时（" + (ADR_CD_PICK_TIMEOUT_MS / 1000) + "s）");
            throw eFetch;
        } finally {
            if (timeoutId) clearTimeout(timeoutId);
        }

        var data;
        try { data = JSON.parse(raw); } catch (eJson) { throw new Error("择池返回非 JSON"); }
        var out = parseResponse(data);
        var pick = adrCdSanitizePickResponse(out, menu);
        if (!pick) throw new Error("点池答复无效：" + adrCdTruncate(out, 40));
        return pick;
    }

    // ---- 三段抽 ----

    // 前两段（掷仓库 → 掷卡池）抽成纯函数：仓库均等是本版核心承诺，必须可验证。
    function adrCdRollPool(slotPools, excludeMenuName, rng) {
        rng = typeof rng === "function" ? rng : Math.random;
        var cand = slotPools || [];
        if (excludeMenuName) {
            var others = cand.filter(function (p) { return p.menuName !== excludeMenuName; });
            if (others.length) cand = others;
        }
        if (!cand.length) return null;
        // 第一段：掷仓库（启用且有卡的仓库之间均等——仓库数即权重，专属库池少也不会被淹）
        var slotsPresent = [];
        cand.forEach(function (p) { if (slotsPresent.indexOf(p.slot) < 0) slotsPresent.push(p.slot); });
        var slot = slotsPresent[Math.floor(rng() * slotsPresent.length)];
        // 第二段：掷卡池（该仓库内均等）
        var inSlot = cand.filter(function (p) { return p.slot === slot; });
        return inSlot[Math.floor(rng() * inSlot.length)] || null;
    }

    function adrCdDrawBlind(slotPools, state, excludeMenuName) {
        var pool = adrCdRollPool(slotPools, excludeMenuName);
        if (!pool) return null;
        // 第三段：掷卡（冷却区不复用）
        var card = adrCdPickFromPool(pool.cards, state.recent, adrCdCooldown());
        return card ? { slot: pool.slot, pool: pool.menuName, card: card } : null;
    }

    var adrCdDrawRunning = false;

    async function adrCdPerformDraw(opts) {
        opts = opts || {};
        var st = settings();
        var state = adrCdChatState();
        var slotPools = adrCdBuildSlotPools(adrCdEnabledSlotTexts(state));
        if (!slotPools.length) return { ok: false, reason: "没有启用的仓库，或启用的仓库里没有卡" };

        var result = null;
        var usedMode = "盲抽";

        if (st.cdMode === "pick" && !opts.preview) {
            var t0 = Date.now();
            try {
                var pick = await adrCdPickPoolViaDS(slotPools, state);
                console.log("[抽卡小能手] DS 点池：" + pick + "（耗时 " + (Date.now() - t0) + "ms）");
                var streakN = (state.streak && state.streak.pool === pick) ? state.streak.n + 1 : 1;
                if (streakN >= 3) {
                    console.log("[抽卡小能手] 卡池「" + pick + "」被连点第 3 次，强制从其余卡池盲抽");
                    state.streak = { pool: "", n: 0 };
                    usedMode = "择池·防惯性盲抽";
                    result = adrCdDrawBlind(slotPools, state, pick);
                } else {
                    state.streak = { pool: pick, n: streakN };
                    var poolObj = null;
                    for (var i = 0; i < slotPools.length; i++) { if (slotPools[i].menuName === pick) { poolObj = slotPools[i]; break; } }
                    if (poolObj) {
                        var cardP = adrCdPickFromPool(poolObj.cards, state.recent, adrCdCooldown());
                        if (cardP) { result = { slot: poolObj.slot, pool: pick, card: cardP }; usedMode = "择池"; }
                    }
                }
            } catch (ePick) {
                console.warn("[抽卡小能手] 择池降级盲抽：" + (ePick && ePick.message ? ePick.message : ePick));
                usedMode = "择池降级盲抽";
            }
        }

        if (!result) result = adrCdDrawBlind(slotPools, state, "");
        if (!result || !result.card) return { ok: false, reason: "无可抽卡面" };

        if (opts.preview) {
            return { ok: true, pool: result.pool, card: result.card, mode: "试抽（盲抽）", preview: true };
        }

        var floor = Number.isFinite(Number(opts.count)) ? Number(opts.count) : adrDAssistantRoundCount();
        state.recent = (state.recent || []).concat([result.card]).slice(-ADR_CD_RECENT_MAX);
        state.history = (state.history || []).concat([{
            pool: result.pool,
            card: adrCdTruncate(result.card, 200),
            floor: floor,
            mode: usedMode,
            t: Date.now(),
            status: "live" // live 挂载中 / done 已兑现 / faded 已退为背景
        }]).slice(-ADR_CD_HISTORY_MAX);
        state.lastDrawAt = floor;
        state.floatCard = result.card;
        state.floatStage = "active";
        state.floatText = adrCdBuildEnvelope(adrCdEnvelopePair().active, result.card);
        adrCdSaveChatState(state);
        adrCdApplyFloat(state.floatText);
        console.log("[抽卡小能手] 投卡", { 模式: usedMode, 卡池: result.pool, 卡面: result.card, 触发楼层: floor });
        adrCdUpdateStatusLine();
        return { ok: true, pool: result.pool, card: result.card, mode: usedMode };
    }

    // ---- 自动触发 ----

    var adrCdFirstPassiveDone = {};

    async function adrCdAutoCheck(count, reason, inStartupGrace) {
        if (!adrCdActive() || adrCdDrawRunning) return;
        var state = adrCdChatState();
        if (state.paused) { adrCdUpdateStatusLine(); return; }
        var n = adrCdN();
        var base = Number(state.lastDrawAt);

        if (!Number.isFinite(base) || base < 0) {
            state.lastDrawAt = count;
            adrCdSaveChatState(state);
            console.log("[抽卡小能手] 首次对齐基准线：" + count);
            adrCdUpdateStatusLine();
            return;
        }

        if (count - base < n) {
            // 还没到投卡点，但可能到了这张卡的半衰期
            await adrCdAdvanceLifecycle(count, state);
            adrCdUpdateStatusLine();
            return;
        }

        var gapDirty = (count - base - n) >= 20;
        var fpKey = adrDChatKey() + "::cd";
        if (adrDIsPassiveAutoCheck(reason) && gapDirty && (inStartupGrace || !adrCdFirstPassiveDone[fpKey])) {
            adrCdFirstPassiveDone[fpKey] = true;
            state.lastDrawAt = count;
            adrCdSaveChatState(state);
            console.warn("[抽卡小能手] 发现脏基准线，只对齐不投卡", { count: count, base: base, n: n, reason: reason || "" });
            adrCdUpdateStatusLine();
            return;
        }

        adrCdDrawRunning = true;
        try {
            var r = await adrCdPerformDraw({ auto: true, count: count });
            if (!r || !r.ok) {
                console.warn("[抽卡小能手] 本拍未投出（" + ((r && r.reason) || "未知") + "）；基准线保留，稍后重试");
                adrCdUpdateStatusLine();
            }
        } catch (eDraw) {
            console.warn("[抽卡小能手] 投卡失败", eDraw);
        }
        adrCdDrawRunning = false;
    }

    // ---- v1.12 卡的生命周期 ----

    // v1.13.1：DS 视野随节奏走，不再钉死。
    // 兑现判定跟半衰期（卡挂了多少楼就回看多少楼），择池跟投卡间隔（上张卡以来的正文都算数）。
    // 下限保持旧默认（4/6 轮）不缩水，上限封 12 轮 / 8000 字防开销与延迟跑飞。
    function adrCdAskReadRounds() {
        return Math.max(4, Math.min(12, adrCdHalfLifeFloors() + 2));
    }

    function adrCdPickReadRounds() {
        return Math.max(6, Math.min(12, adrCdN() + 2));
    }

    function adrCdReadCharCap(rounds) {
        return Math.max(3000, Math.min(8000, rounds * 700));
    }

    // 问 DS 一句「兑现没」。答复只认"是"/"否"，多一个字作废；任何异常按未兑现处理。
    async function adrCdAskFulfilled(card) {
        var st = settings();
        if (!st.cdApiEndpoint) throw new Error("未填写 API 地址");
        var url = chatUrl(st.cdApiEndpoint);
        if (!url) throw new Error("API 地址无效");
        var sys = "你是剧情兑现检查员。你会看到一件已经投放给作者的\"待发生事件\"，以及最近的正文。"
            + "判断这件事是否已经在正文里发生或被写出来了。只回答\"是\"或\"否\"，不加标点、不加解释。多一个字视为无效。";
        var recent = "";
        var askRounds = adrCdAskReadRounds();
        try { recent = await recentContentBlocks(askRounds); } catch (eR) {}
        var body = "【待发生事件】\n" + String(card || "")
            + "\n\n【最近正文】\n" + adrCdTruncate(recent, adrCdReadCharCap(askRounds))
            + "\n\n这件事已经发生了吗？只回答 是 或 否。";

        var ab = typeof AbortController !== "undefined" ? new AbortController() : null;
        var tid = null, timedOut = false;
        if (ab) tid = setTimeout(function () { timedOut = true; try { ab.abort(); } catch (e) {} }, ADR_CD_PICK_TIMEOUT_MS);
        var headers = { "Content-Type": "application/json" };
        if (st.cdApiKey) headers.Authorization = "Bearer " + st.cdApiKey;
        var opts = {
            method: "POST", headers: headers,
            body: JSON.stringify({
                model: st.cdModel || "deepseek-chat",
                messages: [{ role: "system", content: sys }, { role: "user", content: body }],
                temperature: 0, max_tokens: 10, stream: false
            })
        };
        if (ab) opts.signal = ab.signal;
        var raw;
        try {
            var res = await fetch(url, opts);
            raw = await res.text();
            if (!res.ok) throw new Error("兑现检查 API " + res.status);
        } catch (eF) {
            if (timedOut) throw new Error("兑现检查超时");
            throw eF;
        } finally { if (tid) clearTimeout(tid); }
        var data;
        try { data = JSON.parse(raw); } catch (eJ) { throw new Error("兑现检查返回非 JSON"); }
        var out = adrCdSanitizePickResponse(parseResponse(data), ["是", "否"]);
        if (!out) throw new Error("兑现检查答复无效");
        return out === "是";
    }

    function adrCdMarkTopHistory(status) {
        try {
            var state = adrCdChatState();
            var list = state.history || [];
            if (list.length) list[list.length - 1].status = status;
            return state;
        } catch (e) { return null; }
    }

    // 结案：从耳边撤下，但不推进基准线——下一张仍按原节奏来，中间那几楼留白让剧情喘口气
    function adrCdCloseCard(reason, silent) {
        try {
            var state = adrCdChatState();
            if (!state.floatCard || state.floatStage === "done") {
                if (!silent) adrCdSetTextAll("adr044-cd-life-status", "当前耳边没有挂着的卡", "#d6b177");
                return false;
            }
            var list = state.history || [];
            if (list.length) list[list.length - 1].status = "done";
            state.floatStage = "done";
            state.floatText = "";
            adrCdSaveChatState(state);
            adrCdApplyFloat("");
            console.log("[抽卡小能手] 卡已结案（" + (reason || "手动") + "）：" + adrCdTruncate(state.floatCard, 30));
            if (!silent) adrCdSetTextAll("adr044-cd-life-status", "已结案，这张卡从耳边撤下 ✓　下一张仍按原节奏来", "#8ed99d");
            adrCdUpdateStatusLine();
            adrCdRefreshLifePanel();
            return true;
        } catch (e) { return false; }
    }

    // 半衰期：挂过 N/2 楼后，先问一次是否兑现（若开启），未兑现则降级为背景
    async function adrCdAdvanceLifecycle(count, state) {
        try {
            var st = settings();
            if (!st.cdHalfLife) return;
            if (!state.floatCard || state.floatStage !== "active") return;
            var age = count - Number(state.lastDrawAt);
            if (!Number.isFinite(age) || age < adrCdHalfLifeFloors()) return;

            if (st.cdAutoDone) {
                try {
                    var done = await adrCdAskFulfilled(state.floatCard);
                    if (done) {
                        console.log("[抽卡小能手] DS 判定已兑现，自动结案");
                        adrCdCloseCard("DS 自动判定", true);
                        return;
                    }
                    console.log("[抽卡小能手] DS 判定尚未兑现，降级为背景");
                } catch (eAsk) {
                    // 判不了就按未兑现处理，安全降级，绝不误撤
                    console.warn("[抽卡小能手] 兑现检查失败，按未兑现降级：" + (eAsk && eAsk.message ? eAsk.message : eAsk));
                }
            }

            var fresh = adrCdChatState();
            if (!fresh.floatCard || fresh.floatStage !== "active") return;
            fresh.floatStage = "faded";
            fresh.floatText = adrCdBuildEnvelope(adrCdEnvelopePair().faded, fresh.floatCard);
            var list = fresh.history || [];
            if (list.length && list[list.length - 1].status === "live") list[list.length - 1].status = "faded";
            adrCdSaveChatState(fresh);
            if (!fresh.paused) adrCdApplyFloat(fresh.floatText);
            console.log("[抽卡小能手] 卡已过半衰期，降级为背景：" + adrCdTruncate(fresh.floatCard, 30));
            adrCdUpdateStatusLine();
            adrCdRefreshLifePanel();
        } catch (e) {
            try { console.warn("[抽卡小能手] 生命周期推进失败", e); } catch (e2) {}
        }
    }

    // ---- 统筹采买：投卡史 ----

    function adrCdHistoryBlock() {
        try {
            var state = adrCdChatState();
            var list = (state.history || []).slice(-ADR_CD_HISTORY_MAX);
            if (!list.length) return "";
            var lines = list.map(function (h) {
                return "· 第 " + (Number.isFinite(Number(h.floor)) ? h.floor : "?") + " 楼｜卡池：" + (h.pool || "?")
                    + "｜模式：" + (h.mode || "?") + "｜卡面：" + (h.card || "");
            });
            return "【投卡史｜抽卡小能手最近投放的场外事件卡】\n" + lines.join("\n")
                + "\n统筹须知：以上事件卡均已注入戏中。收线时请将其纳入兑现盘点视线范围。";
        } catch (e) { return ""; }
    }

    // ---- v1.11 刷新保护：正在输入的控件永不被覆盖 ----

    function adrCdIsBusyEl(el) {
        try {
            if (!el) return true;
            if (el.__adrCdTyping) return true;
            // v1.11.1：刚被点过的控件 1.5s 内免疫任何刷新。
            // iOS 上原生下拉弹出期间若被改写，选择器会当场关闭，表现为"点不开"。
            if (el.__adrCdTouchedAt && (Date.now() - el.__adrCdTouchedAt) < 1500) return true;
            var d = rootDoc();
            if (d && d.activeElement === el) return true;
        } catch (e) {}
        return false;
    }

    function adrCdTouch(el) {
        try { if (el) el.__adrCdTouchedAt = Date.now(); } catch (e) {}
    }

    // v1.11.1：落盘改防抖。即时 saveNow() 会在点击当帧触发刷新链，打断 iOS 的原生下拉。
    var adrCdSaveTimer = null;
    function adrCdSaveSoon() {
        try {
            if (adrCdSaveTimer) clearTimeout(adrCdSaveTimer);
            adrCdSaveTimer = setTimeout(function () {
                try { saveNow(); } catch (e) {}
            }, 900);
        } catch (e2) { try { saveNow(); } catch (e3) {} }
    }

    function adrCdSetValueSafe(id, value) {
        try {
            Array.prototype.slice.call(rootDoc().querySelectorAll("#" + id)).forEach(function (el) {
                if (!el || adrCdIsBusyEl(el)) return; // 正在打字的框，谁也别碰
                el.value = value == null ? "" : value;
            });
        } catch (e) {}
    }

    function adrCdSetCheckedSafe(id, checked) {
        try {
            Array.prototype.slice.call(rootDoc().querySelectorAll("#" + id)).forEach(function (el) {
                if (!el || adrCdIsBusyEl(el)) return; // 刚点过的勾选框不回刷，否则视觉上"勾不上"
                el.checked = !!checked;
            });
        } catch (e) {}
    }

    // 选项签名：HTML 生成与后续刷新共用同一套算法。
    // v1.11.2：签名必须随 HTML 一起写进 data-optsig，否则首次刷新会重写一次 DOM，
    // 那一次重写若撞上原生下拉弹出，第一次选择就被吞掉（表现为"要点两次"）。
    function adrCdOptSig(kind, names, value) {
        return kind + "|" + (names || []).join("\u0001") + "|" + String(value || "");
    }

    // options 没变就绝不重写 DOM——这是下拉能被一次点开的前提
    function adrCdFillSelect(el, optionsHtml, value, signature) {
        try {
            if (!el) return;
            var cur = el.__adrCdOptSig;
            if (cur === undefined) {
                // 首次接触：认 HTML 里带来的签名，不做无谓重写
                cur = el.getAttribute ? el.getAttribute("data-optsig") : null;
                if (cur != null) el.__adrCdOptSig = cur;
            }
            if (cur !== signature) {
                el.innerHTML = optionsHtml;
                el.__adrCdOptSig = signature;
                try { if (el.setAttribute) el.setAttribute("data-optsig", signature); } catch (eA) {}
            }
            if (el.value !== value) el.value = value;
        } catch (e) {}
    }

    function adrCdSetTextAll(id, text, color) {
        try {
            Array.prototype.slice.call(rootDoc().querySelectorAll("#" + id)).forEach(function (el) {
                el.textContent = String(text || "");
                if (color) el.style.color = color;
            });
        } catch (e) {}
    }

    // ---- 状态行 ----

    function adrCdStatusText() {
        var st = settings();
        if (!adrDMasterEnabled()) return "总开关已关闭 · 抽卡小能手随组休息";
        if (!st.cdEnabled) return "抽卡小能手未启用";
        var state = adrCdChatState();
        var on = ADR_CD_SLOTS.filter(function (s) { return state.slotOn[s] && adrCdSlotText(state, s); })
            .map(function (s) { return ADR_CD_SLOT_LABEL[s]; });
        var libPart = on.length ? on.join("＋") : "无可用仓库";
        var mode = st.cdMode === "pick" ? "择池" : "盲抽";
        var n = adrCdN();
        var count = adrDAssistantRoundCount();
        var base = Number(state.lastDrawAt);
        var left = (Number.isFinite(base) && base >= 0) ? Math.max(0, n - (count - base)) : n;
        var head = libPart + " · " + mode + (state.paused ? " · 已暂停投卡" : " · 距下张还有 " + left + " 楼");
        var h = (state.history || []).slice(-1)[0];
        if (h) head += "\n最近一张：" + (h.pool || "?") + "｜" + String(h.card || "");
        return head;
    }

    function adrCdUpdateStatusLine() {
        try { adrCdSetTextAll("adr044-cd-status-line", adrCdStatusText()); } catch (e) {}
    }

    function adrCdToggleStatusExpand() {
        try {
            Array.prototype.slice.call(rootDoc().querySelectorAll("#adr044-cd-status-line")).forEach(function (el) {
                el.classList.toggle("adr044-cd-status-expanded");
            });
        } catch (e) {}
    }

    // ---- 面板同步 ----

    function adrCdRefreshSlotSelects() {
        try {
            var state = adrCdChatState();
            ADR_CD_SLOTS.forEach(function (slot) {
                var arr = adrCdSlotArr(state.slots[slot]);
                var html = adrCdSlotChipsHTML(slot, state);
                var sig = adrCdSlotChipsSig(slot, state);
                Array.prototype.slice.call(rootDoc().querySelectorAll("#adr044-cd-slot-" + slot)).forEach(function (el) {
                    adrCdFillSelect(el, html, "", sig);
                });
                adrCdSetCheckedSafe("adr044-cd-slot-on-" + slot, state.slotOn[slot]);
                var cnt = 0;
                var txt = adrCdSlotText(state, slot);
                if (txt) adrCdParseLibraryText(txt).forEach(function (p) { cnt += p.cards.length; });
                adrCdSetTextAll("adr044-cd-slot-count-" + slot, arr.length ? (cnt + " 张卡 · " + arr.length + " 副") : "未选");
            });
            adrCdSetValueSafe("adr044-cd-import-slot", adrCdImportSlot());
        } catch (e) {}
    }

    function adrCdRefreshEditSelect(selectedName) {
        try {
            var names = adrCdLibNames();
            if (selectedName === undefined) {
                var cur = qForm("adr044-cd-edit-select");
                selectedName = cur ? String(cur.value || "") : "";
            }
            if (!selectedName || names.indexOf(selectedName) < 0) selectedName = names[0] || "";
            var html = names.map(function (nm) {
                return '<option value="' + esc(nm) + '"' + (nm === selectedName ? " selected" : "") + '>' + esc(nm) + '</option>';
            }).join("");
            var sigEdit = adrCdOptSig("edit", names, selectedName);
            Array.prototype.slice.call(rootDoc().querySelectorAll("#adr044-cd-edit-select")).forEach(function (el) {
                if (adrCdIsBusyEl(el)) return;
                adrCdFillSelect(el, html, selectedName, sigEdit);
            });
            return selectedName;
        } catch (e) { return ""; }
    }

    // 编辑区回灌：只在换库 / 导入 / 换聊 / 首次建面板时调用，绝不挂在周期刷新上
    function adrCdLoadEditor(name) {
        try {
            var chosen = adrCdRefreshEditSelect(name);
            adrCdSetValueSafe("adr044-cd-lib-name", chosen);
            adrCdSetValueSafe("adr044-cd-lib-editor", adrCdLibraries()[chosen] || "");
        } catch (e) {}
    }

    function adrCdSyncChatControls() {
        try {
            var state = adrCdChatState();
            adrCdSetCheckedSafe("adr044-cd-paused", state.paused === true);
            adrCdRefreshSlotSelects();
            adrCdRefreshLifePanel();
            adrCdUpdateStatusLine();
        } catch (e) {}
    }

    function adrCdRefreshPanelFields() {
        try {
            var st = settings();
            adrCdSetCheckedSafe("adr044-cd-enabled", !!st.cdEnabled);
            adrCdSetValueSafe("adr044-cd-n", String(adrCdN()));
            adrCdSetTextAll("adr044-cd-n-val", String(adrCdN()));
            adrCdSetValueSafe("adr044-cd-mode", st.cdMode === "pick" ? "pick" : "blind");
            adrCdSetValueSafe("adr044-cd-depth", String(adrCdDepth()));
            adrCdSetValueSafe("adr044-cd-cooldown", String(adrCdCooldown()));
            var envPair = adrCdEnvelopePair();
            adrCdSetValueSafe("adr044-cd-envelope", envPair.active);
            adrCdSetValueSafe("adr044-cd-envelope-faded", envPair.faded);
            adrCdSetValueSafe("adr044-cd-env-name", adrCdCurrentEnvelopeName());
            adrCdSetCheckedSafe("adr044-cd-halflife", !!st.cdHalfLife);
            adrCdSetCheckedSafe("adr044-cd-autodone", !!st.cdAutoDone);
            adrCdRefreshEnvSelect(adrCdCurrentEnvelopeName());
            adrCdRefreshLifePanel();
            adrCdSetValueSafe("adr044-cd-endpoint", st.cdApiEndpoint || "");
            adrCdSetValueSafe("adr044-cd-key", st.cdApiKey || "");
            adrCdSetValueSafe("adr044-cd-model", st.cdModel || "");
            try { adrDRefreshApiProfileSelects("cd"); } catch (eP) {}
            adrCdLoadEditor(undefined);
            adrCdSyncChatControls();
        } catch (e) {}
    }

    // ---- v1.12 生命周期面板 ----

    var ADR_CD_STAGE_LABEL = { active: "必须发生", faded: "已退为背景", done: "已结案" };

    function adrCdRefreshLifePanel() {
        try {
            var state = adrCdChatState();
            var txt;
            if (!state.floatCard) {
                txt = "耳边暂无卡片。";
            } else if (state.floatStage === "done") {
                txt = "已结案（耳边已空）：" + state.floatCard;
            } else {
                var age = adrDAssistantRoundCount() - Number(state.lastDrawAt);
                if (!Number.isFinite(age) || age < 0) age = 0;
                var half = adrCdHalfLifeFloors();
                var stage = ADR_CD_STAGE_LABEL[state.floatStage] || state.floatStage;
                txt = "【" + stage + "】挂了 " + age + " 楼"
                    + (state.floatStage === "active" ? "（再过 " + Math.max(0, half - age) + " 楼转为背景）" : "")
                    + "\n" + state.floatCard;
            }
            adrCdSetTextAll("adr044-cd-life-card", txt);

            var list = (state.history || []).slice().reverse();
            var lines = list.map(function (h, i) {
                var mark = h.status === "done" ? "✓ 已兑现" : (h.status === "faded" ? "· 已退为背景" : "● 挂载中");
                return mark + "　第 " + (Number.isFinite(Number(h.floor)) ? h.floor : "?") + " 楼｜"
                    + (h.pool || "?") + "\n　　" + adrCdTruncate(String(h.card || ""), 40);
            });
            adrCdSetTextAll("adr044-cd-life-history", lines.length ? lines.join("\n") : "还没投过卡。");
        } catch (e) {}
    }

    function adrCdEnvStatus(t, c) { adrCdSetTextAll("adr044-cd-env-status", t, c || "#d6b177"); }

    function adrCdApplyEnvelopePreset(name) {
        try {
            var all = adrCdEnvelopes();
            var pair = all[name];
            if (!pair) return;
            save("cdEnvelopeCurrent", name);
            // 切预设＝以预设为准，清掉手改覆盖，避免"改过一次就永远盖住预设"
            save("cdEnvelope", "");
            save("cdEnvelopeFaded", "");
            adrCdSaveSoon();
            adrCdSetValueSafe("adr044-cd-envelope", pair.active || "");
            adrCdSetValueSafe("adr044-cd-envelope-faded", pair.faded || "");
            adrCdSetValueSafe("adr044-cd-env-name", name);
            adrCdRestoreFloat("envelope-switch");
            adrCdEnvStatus("已切换到信封「" + name + "」✓", "#8ed99d");
        } catch (e) {}
    }

    function adrCdSaveEnvelopePreset() {
        try {
            var nameEl = qForm("adr044-cd-env-name");
            var name = nameEl ? String(nameEl.value || "").trim() : "";
            if (!name) { adrCdEnvStatus("请先填写信封预设名", "#d4726a"); return; }
            var a = qForm("adr044-cd-envelope");
            var f = qForm("adr044-cd-envelope-faded");
            var all = adrCdEnvelopes();
            var existed = all[name] !== undefined;
            all[name] = {
                active: a ? String(a.value || "") : ADR_CD_DEFAULT_ENVELOPE,
                faded: f ? String(f.value || "") : ADR_CD_DEFAULT_ENVELOPE_FADED
            };
            save("cdEnvelopes", all);
            save("cdEnvelopeCurrent", name);
            save("cdEnvelope", "");
            save("cdEnvelopeFaded", "");
            saveNow();
            adrCdRefreshEnvSelect(name);
            adrCdRestoreFloat("envelope-save");
            adrCdEnvStatus("信封「" + name + "」" + (existed ? "已更新" : "已新建") + " ✓", "#8ed99d");
        } catch (e) {
            adrCdEnvStatus("保存失败：" + (e && e.message ? e.message : e), "#d4726a");
        }
    }

    function adrCdDeleteEnvelopePreset() {
        try {
            var name = adrCdCurrentEnvelopeName();
            var all = adrCdEnvelopes();
            if (Object.keys(all).length <= 1) { adrCdEnvStatus("至少留一套信封", "#d4726a"); return; }
            delete all[name];
            save("cdEnvelopes", all);
            var next = Object.keys(all)[0];
            save("cdEnvelopeCurrent", next);
            saveNow();
            adrCdRefreshEnvSelect(next);
            adrCdApplyEnvelopePreset(next);
            adrCdEnvStatus("信封「" + name + "」已删除，当前用「" + next + "」", "#d6b177");
        } catch (e) {}
    }

    function adrCdEnvSelectHTML() {
        var names = adrCdEnvelopeNames();
        var sel = adrCdCurrentEnvelopeName();
        var opts = names.map(function (nm) {
            return '<option value="' + esc(nm) + '"' + (nm === sel ? " selected" : "") + '>' + esc(nm) + '</option>';
        }).join("");
        return '<select id="adr044-cd-env-select" data-optsig="' + esc(adrCdOptSig("env", names, sel)) + '">' + opts + '</select>';
    }

    function adrCdRefreshEnvSelect(selectedName) {
        try {
            var names = adrCdEnvelopeNames();
            if (!selectedName || names.indexOf(selectedName) < 0) selectedName = adrCdCurrentEnvelopeName();
            var html = names.map(function (nm) {
                return '<option value="' + esc(nm) + '"' + (nm === selectedName ? " selected" : "") + '>' + esc(nm) + '</option>';
            }).join("");
            var sig = adrCdOptSig("env", names, selectedName);
            Array.prototype.slice.call(rootDoc().querySelectorAll("#adr044-cd-env-select")).forEach(function (el) {
                if (adrCdIsBusyEl(el)) return;
                adrCdFillSelect(el, html, selectedName, sig);
            });
        } catch (e) {}
    }

    // ---- 自检（手机上的控制台替身）----

    function adrCdSelfCheck() {
        var lines = [];
        try {
            var st = settings();
            var state = adrCdChatState();
            lines.push("总开关：" + (adrDMasterEnabled() ? "开" : "关") + "　抽卡：" + (st.cdEnabled ? "开" : "关"));
            var keyReady = false;
            try { keyReady = adrDChatKeyReady(); } catch (eK) {}
            lines.push("聊天档：" + (keyReady ? "已就绪" : "未就绪（换聊后稍等）") + "　服务器侧存档：" + (adrCdMetaRoot() ? "可用" : "不可用（仅本机备份）"));
            ADR_CD_SLOTS.forEach(function (s) {
                var name = adrCdSlotArr(state.slots[s]).join("、");
                var txt = adrCdSlotText(state, s);
                var pools = txt ? adrCdParseLibraryText(txt) : [];
                var cards = 0;
                pools.forEach(function (p) { cards += p.cards.length; });
                lines.push(ADR_CD_SLOT_FULL[s] + "：" + (state.slotOn[s] ? "启用" : "停用")
                    + "　" + (name || "（未选）") + "　" + pools.length + " 池 / " + cards + " 张");
            });
            lines.push("暂停投卡：" + (state.paused ? "是" : "否") + "（此行为回读存档所得，与勾选框一致才算写入成功）");
            var count = adrDAssistantRoundCount();
            lines.push("当前楼层：" + count + "　基准线：" + state.lastDrawAt + "　间隔 N：" + adrCdN());
            var fl = adrCdCurrentFloatLength();
            lines.push("耳机通道：" + (fl < 0 ? "读不到（旧版酒馆）" : (fl > 0 ? "已挂载 " + fl + " 字" : "空（未投卡或已暂停）")));
            lines.push("模式：" + (st.cdMode === "pick" ? "择池" : "盲抽") + "　注入深度：" + adrCdDepth() + "　冷却：" + adrCdCooldown());
            lines.push("卡的阶段：" + (state.floatCard ? (ADR_CD_STAGE_LABEL[state.floatStage] || state.floatStage) : "耳边无卡")
                + "　半衰期：" + (st.cdHalfLife ? adrCdHalfLifeFloors() + " 楼" : "关闭")
                + "　DS 兑现判定：" + (st.cdAutoDone ? "开" : "关"));
            lines.push("信封预设：" + adrCdCurrentEnvelopeName() + (String(st.cdEnvelope || "").trim() ? "（已被手改覆盖）" : ""));
            var h = (state.history || []).slice(-1)[0];
            lines.push("最近一张：" + (h ? (h.pool + "｜" + h.card + "（第 " + h.floor + " 楼 · " + h.mode + " · " + (h.status || "live") + "）") : "无"));
        } catch (e) {
            lines.push("自检出错：" + (e && e.message ? e.message : e));
        }
        adrCdSetTextAll("adr044-cd-selfcheck-out", lines.join("\n"), "#d6b177");
    }

    // ---- 按钮动作 ----

    async function adrCdPreviewDraw() {
        try {
            adrCdSetTextAll("adr044-cd-preview-out", "抽取中…", "#8ed99d");
            var r = await adrCdPerformDraw({ preview: true });
            if (r && r.ok) {
                adrCdSetTextAll("adr044-cd-preview-out", "【" + r.pool + "】" + r.card + "\n（仅预览，不入投卡史、不注入）", "#d6b177");
            } else {
                adrCdSetTextAll("adr044-cd-preview-out", "试抽失败：" + ((r && r.reason) || "未知"), "#d4726a");
            }
        } catch (e) {
            adrCdSetTextAll("adr044-cd-preview-out", "试抽失败：" + (e && e.message ? e.message : e), "#d4726a");
        }
    }

    function adrCdLibStatus(text, color) { adrCdSetTextAll("adr044-cd-lib-status", text, color || "#d6b177"); }

    function adrCdEditingName() {
        var el = qForm("adr044-cd-edit-select");
        return el ? String(el.value || "") : "";
    }

    // v1.17.2：查一副库当前挂在哪个槽（没挂返回 ""）
    function adrCdFindMountedSlot(state, name) {
        for (var i = 0; i < ADR_CD_SLOTS.length; i++) {
            if (adrCdSlotArr(state.slots[ADR_CD_SLOTS[i]]).indexOf(name) >= 0) return ADR_CD_SLOTS[i];
        }
        return "";
    }

    function adrCdSaveLibraryFromEditor() {
        try {
            var nameEl = qForm("adr044-cd-lib-name");
            var edEl = qForm("adr044-cd-lib-editor");
            var name = nameEl ? String(nameEl.value || "").trim() : "";
            if (!name) { adrCdLibStatus("请先填写卡库名", "#d4726a"); return; }
            var libs = adrCdLibraries();
            var existed = libs[name] !== undefined;
            libs[name] = edEl ? String(edEl.value || "") : "";
            save("cdLibraries", libs);

            // v1.17.2：落点对保存同样生效。用户的自然直觉就是"选好落点→保存＝挂载"，
            // 工具应该迎合直觉而不是让人背规则。已挂在某槽的库保持原位，绝不搬家。
            var state = adrCdChatState();
            var tail;
            var dest = adrCdImportSlot();
            var home = adrCdLibHome(name);
            if (dest) {
                var moved = home && home !== dest;
                adrCdSetLibHome(name, dest);
                var arrSave = adrCdSlotArr(state.slots[dest]);
                if (arrSave.indexOf(name) < 0) arrSave.push(name);
                state.slots[dest] = arrSave;
                state.slotOn[dest] = true;
                adrCdSaveChatState(state); // 归属对账会自动把旧箱里的点亮项摘下
                tail = moved
                    ? "　已从" + ADR_CD_SLOT_FULL[home] + "搬进" + ADR_CD_SLOT_FULL[dest] + "并点亮 ✓"
                    : "　已放进" + ADR_CD_SLOT_FULL[dest] + "并点亮 ✓";
            } else if (home) {
                var inUse = adrCdSlotArr(state.slots[home]).indexOf(name) >= 0;
                tail = "　（住在" + ADR_CD_SLOT_FULL[home] + "，" + (inUse ? "使用中，即改即生效" : "未点亮") + "）";
            } else {
                tail = "　（未分箱：三格里都可见，点亮或选个落点再保存即可入箱）";
            }

            saveNow();
            adrCdRefreshEditSelect(name);
            adrCdRefreshSlotSelects();
            adrCdUpdateStatusLine();
            adrCdLibStatus("卡库「" + name + "」" + (existed ? "已更新" : "已新建") + " ✓" + tail, "#8ed99d");
        } catch (e) {
            adrCdLibStatus("保存失败：" + (e && e.message ? e.message : e), "#d4726a");
        }
    }

    function adrCdRenameLibrary() {
        try {
            var oldName = adrCdEditingName();
            var nameEl = qForm("adr044-cd-lib-name");
            var newName = nameEl ? String(nameEl.value || "").trim() : "";
            if (!oldName) { adrCdLibStatus("没有可重命名的卡库", "#d4726a"); return; }
            if (!newName) { adrCdLibStatus("请先在名字框填写新名字", "#d4726a"); return; }
            if (newName === oldName) { adrCdLibStatus("名字没变", "#d6b177"); return; }
            var libs = adrCdLibraries();
            if (libs[newName] !== undefined) { adrCdLibStatus("已存在同名卡库「" + newName + "」，换个名字", "#d4726a"); return; }
            libs[newName] = libs[oldName];
            delete libs[oldName];
            save("cdLibraries", libs);
            // 三个仓库槽里引用了旧名的，跟着改名（聊天级 + 账号级默认）
            var state = adrCdChatState();
            ADR_CD_SLOTS.forEach(function (s) {
                state.slots[s] = adrCdSlotArr(state.slots[s]).map(function (nm) { return nm === oldName ? newName : nm; });
            });
            adrCdSaveChatState(state);
            var defs = adrCdSlotDefaults();
            ADR_CD_SLOTS.forEach(function (s) {
                defs[s] = adrCdSlotArr(defs[s]).map(function (nm) { return nm === oldName ? newName : nm; });
            });
            save("cdSlotDefaults", defs);
            var homeRn = adrCdLibHome(oldName);
            adrCdSetLibHome(oldName, "");
            if (homeRn) adrCdSetLibHome(newName, homeRn); // 归属随新名迁移
            saveNow();
            adrCdRefreshEditSelect(newName);
            adrCdRefreshSlotSelects();
            adrCdUpdateStatusLine();
            adrCdLibStatus("已重命名：「" + oldName + "」→「" + newName + "」✓（引用它的仓库已同步）", "#8ed99d");
        } catch (e) {
            adrCdLibStatus("重命名失败：" + (e && e.message ? e.message : e), "#d4726a");
        }
    }

    function adrCdDeleteLibrary() {
        try {
            var name = adrCdEditingName();
            if (!name) { adrCdLibStatus("没有可删除的卡库", "#d4726a"); return; }
            var libs = adrCdLibraries();
            delete libs[name];
            save("cdLibraries", libs);
            adrCdSetLibHome(name, ""); // 库没了，户口注销
            var state = adrCdChatState();
            var freed = [];
            ADR_CD_SLOTS.forEach(function (s) {
                var arrDel = adrCdSlotArr(state.slots[s]);
                if (arrDel.indexOf(name) >= 0) {
                    state.slots[s] = arrDel.filter(function (nm) { return nm !== name; });
                    freed.push(ADR_CD_SLOT_FULL[s]);
                } else {
                    state.slots[s] = arrDel;
                }
            });
            adrCdSaveChatState(state);
            saveNow();
            var rest = adrCdLibNames();
            adrCdLoadEditor(rest[0] || "");
            adrCdRefreshSlotSelects();
            adrCdUpdateStatusLine();
            var tail = freed.length ? "；已从 " + freed.join("、") + " 摘下" : "";
            adrCdLibStatus("卡库「" + name + "」已删除" + tail
                + (rest.length ? "" : "。已无任何卡库，保存一副新的即可（出厂示例会在下次读取时补回）"), "#d6b177");
        } catch (e) {
            adrCdLibStatus("删除失败：" + (e && e.message ? e.message : e), "#d4726a");
        }
    }

    function adrCdRequestDeleteLibrary(btn) {
        try {
            adrDTwoStepConfirm(
                "cd-lib-delete",
                btn || qForm("adr044-cd-lib-delete"),
                "再点一次确认删除",
                "将删除正在编辑的这副卡库（不可恢复，建议先导出）",
                function (t) { adrCdLibStatus(t, "#d6b177"); },
                function () { adrCdDeleteLibrary(); }
            );
        } catch (e) {
            try { if (rootWin().confirm("确认删除这副卡库？建议先导出。")) adrCdDeleteLibrary(); } catch (e2) {}
        }
    }

    function adrCdExportLibrary() {
        try {
            var name = adrCdEditingName();
            if (!name) { adrCdLibStatus("没有可导出的卡库", "#d4726a"); return; }
            var text = adrCdLibraries()[name] || "";
            var d = rootDoc();
            var blob = new Blob([text], { type: "text/plain;charset=utf-8" });
            var a = d.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = name + ".txt";
            (d.body || d.documentElement).appendChild(a);
            a.click();
            setTimeout(function () {
                try { URL.revokeObjectURL(a.href); } catch (e1) {}
                try { if (a.parentNode) a.parentNode.removeChild(a); } catch (e2) {}
            }, 1200);
            adrCdLibStatus("卡库「" + name + "」已导出为 .txt ✓", "#8ed99d");
        } catch (e) {
            adrCdLibStatus("导出失败：" + (e && e.message ? e.message : e), "#d4726a");
        }
    }

    function adrCdTriggerImport() {
        var f = qForm("adr044-cd-import-file");
        if (f) { try { f.value = ""; } catch (e0) {} f.click(); }
    }

    // v1.17.1：导入落点账号级持久化。iOS 跳文件 App 往返会重绘面板，
    // 裸 DOM 下拉会被复位成默认值，导入挂载步骤当场落空；改为存档为准、DOM 只是回显。
    function adrCdImportSlot() {
        var v = String(settings().cdImportSlot || "");
        return ADR_CD_SLOTS.indexOf(v) >= 0 ? v : "";
    }

    function adrCdImportSlotSelectHTML() {
        var cur = adrCdImportSlot();
        var opts = [["", "只存进卡库，不挂仓库"], ["story", "挂进专属剧情库"], ["common", "挂进通用库"], ["nsfw", "挂进 NSFW 库"]];
        return '<select id="adr044-cd-import-slot">'
            + opts.map(function (o) {
                return '<option value="' + o[0] + '"' + (o[0] === cur ? " selected" : "") + '>' + o[1] + '</option>';
            }).join("")
            + '</select>';
    }

    function adrCdHandleImportFile(fileInput) {
        try {
            var file = fileInput && fileInput.files && fileInput.files[0];
            if (!file) return;
            var reader = new FileReader();
            reader.onload = function () {
                try {
                    var text = String(reader.result || "");
                    var name = String(file.name || "导入卡库").replace(/\.(txt|md)$/i, "").trim() || "导入卡库";
                    var libs = adrCdLibraries();
                    var base = name;
                    var i = 2;
                    while (libs[name] !== undefined) { name = base + " " + i; i++; } // 不覆盖同名，另开一副
                    libs[name] = text;
                    save("cdLibraries", libs);

                    // 导入落点：读账号级存档，不读 DOM——面板重绘/双面板不同步都影响不到它
                    var slot = adrCdImportSlot();
                    var tail = "";
                    if (ADR_CD_SLOTS.indexOf(slot) >= 0) {
                        adrCdSetLibHome(name, slot);
                        var state = adrCdChatState();
                        var arrImp = adrCdSlotArr(state.slots[slot]);
                        if (arrImp.indexOf(name) < 0) arrImp.push(name);
                        state.slots[slot] = arrImp;
                        state.slotOn[slot] = true;
                        adrCdSaveChatState(state);
                        tail = "，已放进" + ADR_CD_SLOT_FULL[slot] + "并点亮";
                    }
                    saveNow();
                    adrCdLoadEditor(name);
                    adrCdRefreshSlotSelects();
                    adrCdUpdateStatusLine();
                    var pools = adrCdParseLibraryText(text);
                    var cards = 0;
                    pools.forEach(function (p) { cards += p.cards.length; });
                    adrCdLibStatus("已导入「" + name + "」：" + pools.length + " 池 / " + cards + " 张 ✓" + tail, "#8ed99d");
                } catch (eIn) {
                    adrCdLibStatus("导入失败：" + (eIn && eIn.message ? eIn.message : eIn), "#d4726a");
                }
            };
            reader.onerror = function () { adrCdLibStatus("导入失败：文件读取错误", "#d4726a"); };
            reader.readAsText(file);
        } catch (e) {}
    }

    // 暂停：写入后回读校验，结果如实告诉住户（手机上没控制台，成败必须肉眼可见）
    function adrCdSetPaused(flag, retry) {
        try {
            var want = !!flag;
            var state = adrCdChatState();
            state.paused = want;
            adrCdSaveChatState(state);
            adrCdApplyFloat(want ? "" : (state.floatText || ""));

            var back = adrCdChatState();
            if (back.paused === want) {
                adrCdSetTextAll("adr044-cd-pause-status",
                    want ? "已暂停：不再投新卡，当前卡也已从耳边取下 ✓" : "已恢复投卡 ✓", "#8ed99d");
            } else if (!retry) {
                adrCdSetTextAll("adr044-cd-pause-status", "存档尚未就绪，正在重试…", "#d6b177");
                setTimeout(function () { adrCdSetPaused(want, true); }, 1200);
            } else {
                adrCdSetTextAll("adr044-cd-pause-status", "暂停状态没能存进这个聊天，请退出聊天再进来重试", "#d4726a");
                adrCdSetCheckedSafe("adr044-cd-paused", back.paused);
            }
            adrCdUpdateStatusLine();
        } catch (e) {}
    }

    function adrCdHandleButtonId(id, btn) {
        if (id === "adr044-tab-cd") { switchTab("cd"); return true; }
        if (id === "adr044-cd-preview-draw") { adrCdPreviewDraw(); return true; }
        if (id === "adr044-cd-selfcheck") { adrCdSelfCheck(); return true; }
        if (id === "adr044-cd-close-card") { adrCdCloseCard("手动", false); return true; }
        if (id === "adr044-cd-env-save") { adrCdSaveEnvelopePreset(); return true; }
        if (id === "adr044-cd-env-delete") { adrCdDeleteEnvelopePreset(); return true; }
        if (id === "adr044-cd-status-line") { adrCdToggleStatusExpand(); return true; }
        if (id === "adr044-cd-lib-save") { adrCdSaveLibraryFromEditor(); return true; }
        if (id === "adr044-cd-lib-rename") { adrCdRenameLibrary(); return true; }
        if (id === "adr044-cd-lib-delete") { adrCdRequestDeleteLibrary(btn); return true; }
        if (id === "adr044-cd-export") { adrCdExportLibrary(); return true; }
        if (id === "adr044-cd-import") { adrCdTriggerImport(); return true; }
        if (id === "adr044-cd-load-models") { loadModels("cd"); return true; }
        if (id === "adr044-cd-test") { adrCdTestConnection(); return true; }
        if (id === "adr044-cd-save") { syncType("cd"); status("cd", "已保存当前使用的择池 API ✓", "#8ed99d"); return true; }
        return false;
    }

    // 测试连接：真发一次最小请求，成败与耗时直接写在面板上
    async function adrCdTestConnection() {
        try {
            syncType("cd");
            var st = settings();
            if (!st.cdApiEndpoint) { status("cd", "请先填写 API 地址", "#d4726a"); return; }
            var url = chatUrl(st.cdApiEndpoint);
            if (!url) { status("cd", "API 地址无效", "#d4726a"); return; }
            if (!st.cdModel) { status("cd", "请先填写或加载一个模型", "#d4726a"); return; }
            status("cd", "正在测试连接…", "#8ed99d");
            var t0 = Date.now();
            var headers = { "Content-Type": "application/json" };
            if (st.cdApiKey) headers.Authorization = "Bearer " + st.cdApiKey;
            var res = await fetch(url, {
                method: "POST",
                headers: headers,
                body: JSON.stringify({
                    model: st.cdModel,
                    messages: [{ role: "user", content: "回复两个字：在的" }],
                    max_tokens: 10,
                    stream: false
                })
            });
            var raw = await res.text();
            if (!res.ok) { status("cd", "连接失败 " + res.status + "：" + String(raw || "").slice(0, 120), "#d4726a"); return; }
            var data;
            try { data = JSON.parse(raw); } catch (eJ) { status("cd", "返回非 JSON，接口可能不兼容", "#d4726a"); return; }
            var out = "";
            try { out = parseResponse(data); } catch (eP) {}
            status("cd", "连接正常 ✓ 耗时 " + (Date.now() - t0) + "ms　模型回话：" + adrCdTruncate(out, 20), "#8ed99d");
        } catch (e) {
            status("cd", "连接失败：" + (e && e.message ? e.message : e), "#d4726a");
        }
    }

    // ---- 控件绑定（幂等）----

    var adrCdEditorDebounce = null;

    function adrCdBindControls() {
        try {
            function each(id, fn) {
                Array.prototype.slice.call(rootDoc().querySelectorAll("#" + id)).forEach(function (el) {
                    if (!el || el.__adrCdBound) return;
                    el.__adrCdBound = true;
                    fn(el);
                });
            }
            // 打字保护：聚焦即上锁，失焦 400ms 后解锁，期间任何刷新都不覆盖它
            function guard(el) {
                el.addEventListener("focus", function () { el.__adrCdTyping = true; });
                el.addEventListener("blur", function () {
                    setTimeout(function () { el.__adrCdTyping = false; }, 400);
                });
                // v1.11.2：手指按下就上锁。原生下拉是在按下那一刻弹出的，
                // 等到 change 再上锁已经晚了半拍，中间的刷新会把选择器掐掉。
                ["pointerdown", "touchstart", "mousedown"].forEach(function (evt) {
                    el.addEventListener(evt, function () { adrCdTouch(el); }, { passive: true });
                });
            }

            each("adr044-cd-enabled", function (el) {
                el.addEventListener("change", function () {
                    adrCdTouch(el);
                    save("cdEnabled", !!el.checked);
                    adrCdSaveSoon();
                    if (el.checked) adrCdRestoreFloat("toggle-cd-on");
                    else adrCdApplyFloat("");
                    adrCdUpdateStatusLine();
                });
            });

            each("adr044-cd-n", function (el) {
                el.addEventListener("input", function () {
                    save("cdN", Number(el.value) || 5);
                    adrCdSetTextAll("adr044-cd-n-val", String(adrCdN()));
                    adrCdUpdateStatusLine();
                });
                el.addEventListener("change", function () { saveNow(); });
            });

            each("adr044-cd-mode", function (el) {
                guard(el);
                el.addEventListener("change", function () {
                    adrCdTouch(el);
                    save("cdMode", el.value === "pick" ? "pick" : "blind");
                    adrCdSaveSoon();
                    adrCdUpdateStatusLine();
                });
            });

            each("adr044-cd-paused", function (el) {
                el.addEventListener("change", function () {
                    adrCdTouch(el);
                    adrCdSetPaused(!!el.checked, false);
                });
            });

            ADR_CD_SLOTS.forEach(function (slot) {
                each("adr044-cd-slot-" + slot, function (el) {
                    // v1.17.0：芯片点击委托挂容器上，innerHTML 重绘不掉监听
                    el.addEventListener("click", function (ev) {
                        var t = ev.target;
                        var chip = null;
                        while (t && t !== el) {
                            if (t.getAttribute && t.getAttribute("data-adrcd-lib") != null) { chip = t; break; }
                            t = t.parentNode;
                        }
                        if (!chip) return;
                        var nm = chip.getAttribute("data-adrcd-lib") || "";
                        if (!nm) return;
                        var state = adrCdChatState();
                        var arr = adrCdSlotArr(state.slots[slot]);
                        var idx = arr.indexOf(nm);
                        if (idx >= 0) {
                            arr.splice(idx, 1); // 熄灭＝这局不用了；归属不动，它还住这个箱
                        } else {
                            arr.push(nm);
                            if (!adrCdLibHome(nm)) adrCdSetLibHome(nm, slot); // 未分箱库点亮即认箱
                        }
                        state.slots[slot] = arr;
                        if (arr.length) state.slotOn[slot] = true;
                        adrCdSaveChatState(state);
                        var defs = adrCdSlotDefaults();
                        defs[slot] = arr.slice();
                        save("cdSlotDefaults", defs);
                        adrCdSaveSoon();
                        adrCdRefreshSlotSelects();
                        adrCdUpdateStatusLine();
                    });
                });
                each("adr044-cd-slot-on-" + slot, function (el) {
                    el.addEventListener("change", function () {
                        adrCdTouch(el);
                        var state = adrCdChatState();
                        state.slotOn[slot] = !!el.checked;
                        adrCdSaveChatState(state);
                        var defsOn = adrCdSlotOnDefaults();
                        defsOn[slot] = !!el.checked;
                        save("cdSlotOnDefaults", defsOn);
                        adrCdSaveSoon();
                        adrCdUpdateStatusLine();
                    });
                });
            });

            each("adr044-cd-depth", function (el) {
                guard(el);
                el.addEventListener("change", function () {
                    save("cdDepth", Number(el.value));
                    saveNow();
                    adrCdRestoreFloat("depth-change");
                });
            });
            each("adr044-cd-cooldown", function (el) {
                guard(el);
                el.addEventListener("change", function () { save("cdCooldown", Number(el.value)); saveNow(); });
            });
            each("adr044-cd-envelope", function (el) {
                guard(el);
                el.addEventListener("change", function () {
                    save("cdEnvelope", String(el.value || ""));
                    saveNow();
                    adrCdRestoreFloat("envelope-edit");
                    adrCdEnvStatus("已改用手写信封（切换预设可还原）", "#d6b177");
                });
            });
            each("adr044-cd-envelope-faded", function (el) {
                guard(el);
                el.addEventListener("change", function () {
                    save("cdEnvelopeFaded", String(el.value || ""));
                    saveNow();
                    adrCdRestoreFloat("envelope-faded-edit");
                });
            });
            each("adr044-cd-env-name", function (el) { guard(el); });
            each("adr044-cd-env-select", function (el) {
                guard(el);
                el.addEventListener("change", function () {
                    adrCdTouch(el);
                    adrCdApplyEnvelopePreset(String(el.value || ""));
                });
            });
            each("adr044-cd-halflife", function (el) {
                el.addEventListener("change", function () {
                    adrCdTouch(el);
                    save("cdHalfLife", !!el.checked);
                    adrCdSaveSoon();
                    adrCdRefreshLifePanel();
                });
            });
            each("adr044-cd-autodone", function (el) {
                el.addEventListener("change", function () {
                    adrCdTouch(el);
                    save("cdAutoDone", !!el.checked);
                    adrCdSaveSoon();
                });
            });
            each("adr044-cd-endpoint", function (el) {
                guard(el);
                el.addEventListener("change", function () { save("cdApiEndpoint", String(el.value || "").trim()); saveNow(); });
            });
            each("adr044-cd-key", function (el) {
                guard(el);
                el.addEventListener("change", function () { save("cdApiKey", String(el.value || "").trim()); saveNow(); });
            });
            each("adr044-cd-model", function (el) {
                guard(el);
                el.addEventListener("change", function () { save("cdModel", String(el.value || "").trim()); saveNow(); });
            });
            each("adr044-cd-model-select", function (el) {
                guard(el);
                el.addEventListener("change", function () {
                    adrCdTouch(el);
                    if (!el.value) return;
                    adrCdSetValueSafe("adr044-cd-model", el.value);
                    save("cdModel", String(el.value));
                    adrCdSaveSoon();
                });
            });

            each("adr044-api-profile-select-cd", function (el) {
                el.addEventListener("change", function () {
                    try { adrDApplyApiProfile("cd"); } catch (eAp) {}
                });
            });
            each("adr044-api-profile-name-cd", function (el) { guard(el); });

            each("adr044-cd-edit-select", function (el) {
                guard(el);
                el.addEventListener("change", function () {
                    adrCdTouch(el);
                    adrCdLoadEditor(String(el.value || ""));
                });
            });
            each("adr044-cd-lib-name", function (el) { guard(el); });
            each("adr044-cd-lib-editor", function (el) {
                guard(el);
                el.addEventListener("input", function () {
                    // 即改即生效：600ms 防抖写回正在编辑的那副库
                    if (adrCdEditorDebounce) clearTimeout(adrCdEditorDebounce);
                    adrCdEditorDebounce = setTimeout(function () {
                        try {
                            var name = adrCdEditingName();
                            if (!name) return;
                            var libs = adrCdLibraries();
                            libs[name] = String(el.value || "");
                            save("cdLibraries", libs);
                            adrCdRefreshSlotSelects();
                        } catch (eEd) {}
                    }, 600);
                });
                el.addEventListener("change", function () { saveNow(); });
            });
            each("adr044-cd-import-slot", function (el) {
                guard(el);
                el.addEventListener("change", function () {
                    adrCdTouch(el);
                    save("cdImportSlot", String(el.value || ""));
                    adrCdSaveSoon();
                });
            });
            each("adr044-cd-import-file", function (el) {
                el.addEventListener("change", function () { adrCdHandleImportFile(el); });
            });
            each("adr044-cd-status-line", function (el) {
                el.addEventListener("click", function () { adrCdToggleStatusExpand(); });
            });
        } catch (e) {
            try { console.warn("[抽卡小能手] 控件绑定失败", e); } catch (e2) {}
        }
    }

    // ---- 面板页（抽屉版 adr044 / 浮窗版 adr048 共用一套 id）----

    // v1.18.0：芯片按归属显示。住本箱的库（亮=使用中，灰=在箱未用）+ 未分箱的库（虚线，点亮即认箱）。
    // 住别人家箱子的库根本不出现——箱子的物理直觉：一件东西只在一个抽屉里。
    function adrCdSlotChipsHTML(slot, state) {
        var names = adrCdLibNames();
        var mine = adrCdSlotArr(state.slots[slot]);
        var shown = names.filter(function (nm) {
            var home = adrCdLibHome(nm);
            return !home || home === slot;
        });
        if (!shown.length) return '<div class="adr044-cd-chip-empty">这个箱子还是空的：把落点指到这里保存/导入，或点亮一副未分箱（虚线）的库</div>';
        return shown.map(function (nm) {
            var on = mine.indexOf(nm) >= 0;
            var stray = !adrCdLibHome(nm);
            return '<button type="button" class="adr044-cd-chip' + (on ? " on" : "") + (stray ? " stray" : "") + '" data-adrcd-lib="' + esc(nm) + '"' + (stray ? ' title="未分箱：点亮即认这个箱为家"' : "") + '>' + esc(nm) + '</button>';
        }).join("");
    }

    function adrCdSlotChipsSig(slot, state) {
        var homes;
        try { homes = JSON.stringify(adrCdLibHomes()); } catch (eH) { homes = ""; }
        return adrCdOptSig("chips-" + slot, adrCdLibNames(), JSON.stringify(state.slots || {}) + "|" + homes);
    }

    function adrCdSlotRowHTML(slot, checkClass) {
        var state = adrCdChatState();
        return '<div class="adr044-cd-slot-row">'
            + '<label class="' + checkClass + ' adr044-cd-slot-head">'
            + '<input type="checkbox" id="adr044-cd-slot-on-' + slot + '"' + (state.slotOn[slot] ? " checked" : "") + '> '
            + ADR_CD_SLOT_FULL[slot]
            + ' <span class="adr044-cd-slot-count" id="adr044-cd-slot-count-' + slot + '"></span></label>'
            + '<div class="adr044-cd-chiprow" id="adr044-cd-slot-' + slot + '" data-optsig="' + esc(adrCdSlotChipsSig(slot, state)) + '">' + adrCdSlotChipsHTML(slot, state) + '</div>'
            + '</div>';
    }

    function adrCdEditSelectHTML() {
        var names = adrCdLibNames();
        var sel = names[0] || "";
        var opts = names.map(function (nm) {
            return '<option value="' + esc(nm) + '"' + (nm === sel ? " selected" : "") + '>' + esc(nm) + '</option>';
        }).join("");
        return '<select id="adr044-cd-edit-select" data-optsig="' + esc(adrCdOptSig("edit", names, sel)) + '">' + opts + '</select>';
    }

    function adrCdPageInnerHTML(secOpen, secClose, checkClass, actionsClass) {
        var st = settings();
        var noteClass = checkClass === "adr048-check" ? "adr048-note" : "adr044-note";
        var mode = st.cdMode === "pick" ? "pick" : "blind";
        return secOpen("抽卡小能手")
            + '<label class="' + checkClass + '"><input type="checkbox" id="adr044-cd-enabled"' + (st.cdEnabled ? " checked" : "") + '> 启用抽卡小能手</label>'
            + '<div class="adr044-cd-status-line" id="adr044-cd-status-line" title="点一下展开／收起">状态加载中…</div>'
            + '<div class="' + actionsClass + '"><button id="adr044-cd-preview-draw" type="button">试抽一张（仅预览）</button><button id="adr044-cd-selfcheck" type="button">🔧 自检</button></div>'
            + '<div class="adr044-cd-preview-out" id="adr044-cd-preview-out"></div>'
            + '<div class="adr044-cd-preview-out" id="adr044-cd-selfcheck-out"></div>'
            + '<label>投卡间隔 N（每 N 个助手正文轮次投一张）：<b id="adr044-cd-n-val">' + esc(String(adrCdN())) + '</b> 楼</label>'
            + '<input type="range" id="adr044-cd-n" min="1" max="20" step="1" value="' + esc(String(adrCdN())) + '">'
            + '<label>抽卡模式</label>'
            + '<select id="adr044-cd-mode">'
            + opt(mode, "blind", "盲抽（零 API · 天马行空档）")
            + opt(mode, "pick", "择池（DS 只看池名点池，池内仍盲抽）")
            + '</select>'
            + '<label class="' + checkClass + '"><input type="checkbox" id="adr044-cd-paused"> 暂停投卡（只停这个聊天；关键场景不打扰）</label>'
            + '<div class="adr044-template-status" id="adr044-cd-pause-status"></div>'
            + secClose()

            + secOpen("耳边这张卡")
            + '<div class="adr044-cd-life-card" id="adr044-cd-life-card">耳边暂无卡片。</div>'
            + '<div class="' + actionsClass + '"><button id="adr044-cd-close-card" type="button">✓ 这张已兑现，撤下</button></div>'
            + '<div class="adr044-template-status" id="adr044-cd-life-status">读到卡里的事已经落地了，点一下撤下它。下一张仍按原节奏来，中间那几楼留白，让剧情喘口气。</div>'
            + '<label class="' + checkClass + '"><input type="checkbox" id="adr044-cd-halflife"' + (st.cdHalfLife ? " checked" : "") + '> 半衰期：挂过一半楼数后自动退为背景（不再逼着推进）</label>'
            + '<label class="' + checkClass + '"><input type="checkbox" id="adr044-cd-autodone"' + (st.cdAutoDone ? " checked" : "") + '> 到半衰期时问一次 DS「兑现没」，答是就自动撤下（每张多一次调用，需填写择池 API）</label>'
            + '<label>投卡史</label>'
            + '<div class="adr044-cd-life-history" id="adr044-cd-life-history">还没投过卡。</div>'
            + secClose()

            + secOpen("三个仓库")
            + '<div class="' + noteClass + '">启用哪几格，就在哪几格之间均等掷——仓库数即权重。专属库配角色卡，通用库打底，NSFW 库单独一格。点亮=这局使用（换聊天各记各的）；库住哪个箱是永久的，灰芯片=在箱未用，虚线=未分箱。</div>'
            + adrCdSlotRowHTML("story", checkClass)
            + adrCdSlotRowHTML("common", checkClass)
            + adrCdSlotRowHTML("nsfw", checkClass)
            + secClose()

            + secOpen("编辑卡库")
            + '<label>正在编辑</label>'
            + adrCdEditSelectHTML()
            + '<input type="text" id="adr044-cd-lib-name" placeholder="卡库名（保存＝新建或更新；重命名＝改当前这副）">'
            + '<div class="adr044-template-mini-actions">'
            + '<button type="button" id="adr044-cd-lib-save">保存</button>'
            + '<button type="button" id="adr044-cd-lib-rename">重命名</button>'
            + '<button type="button" id="adr044-cd-lib-delete">删除</button>'
            + '</div>'
            + '<label>保存/导入落点（新库存好后自动挂进这里）</label>'
            + adrCdImportSlotSelectHTML()
            + '<div class="adr044-template-mini-actions">'
            + '<button type="button" id="adr044-cd-import">导入 .txt/.md</button>'
            + '<button type="button" id="adr044-cd-export">导出这副</button>'
            + '</div>'
            + '<input type="file" id="adr044-cd-import-file" class="adr044-cd-import-file" accept=".txt,.md,text/plain,text/markdown">'
            + '<div class="adr044-template-status" id="adr044-cd-lib-status">## 开一门卡池，一行一张卡；// 开头是注释；即改即生效。</div>'
            + '<textarea id="adr044-cd-lib-editor" rows="12" placeholder="## 卡池名&#10;一行一张卡…"></textarea>'
            + secClose()

            + secOpen("择池 API（仅择池模式用）", true)
            + '<div class="adr044-template-compact adr044-api-profile-compact">'
            + '<select id="adr044-api-profile-select-cd">' + adrDApiProfileSelectOptions("cd", adrDSelectedApiProfileName("cd") || "") + '</select>'
            + '<input type="text" id="adr044-api-profile-name-cd" value="' + esc(adrDSelectedApiProfileName("cd") || "") + '" placeholder="预设名，如 DS">'
            + '<div class="adr044-template-mini-actions">'
            + '<button type="button" id="adr044-api-profile-save-cd">保存</button>'
            + '<button type="button" id="adr044-api-profile-delete-cd">删除</button>'
            + '</div></div>'
            + '<div class="adr044-template-status" id="adr044-api-profile-status-cd">下拉选择会立即切换；改名后保存会新增/更新预设。</div>'
            + '<label>API 地址</label><input type="text" id="adr044-cd-endpoint" value="' + esc(st.cdApiEndpoint || "") + '" placeholder="https://api.deepseek.com">'
            + '<label>API 密钥</label><input type="password" id="adr044-cd-key" value="' + esc(st.cdApiKey || "") + '" placeholder="sk-...">'
            + '<label>模型</label><input type="text" id="adr044-cd-model" value="' + esc(st.cdModel || "") + '" placeholder="可以手填，或加载模型">'
            + '<select id="adr044-cd-model-select"><option value="">加载后在此选择模型</option></select>'
            + '<div class="' + actionsClass + '"><button id="adr044-cd-load-models" type="button">加载模型</button><button id="adr044-cd-test" type="button">测试连接</button><button id="adr044-cd-save" type="button">保存当前使用</button></div>'
            + '<div class="adr044-template-status" id="adr044-cd-status">择池会用这里的 API；任何异常当场降级盲抽，不停摆。试抽恒为盲抽，不产生费用。</div>'
            + secClose()

            + secOpen("高级 · 注入与信封", true)
            + '<label>注入深度（从最新消息往回数，默认 2）</label><input type="number" id="adr044-cd-depth" min="0" max="4" value="' + esc(String(adrCdDepth())) + '">'
            + '<label>冷却区（最近 M 张不复用，默认 8）</label><input type="number" id="adr044-cd-cooldown" min="0" max="99" value="' + esc(String(adrCdCooldown())) + '">'
            + '<label>信封预设（不同模型吃不同话术）</label>'
            + adrCdEnvSelectHTML()
            + '<input type="text" id="adr044-cd-env-name" value="' + esc(adrCdCurrentEnvelopeName()) + '" placeholder="预设名">'
            + '<div class="adr044-template-mini-actions">'
            + '<button type="button" id="adr044-cd-env-save">保存</button>'
            + '<button type="button" id="adr044-cd-env-delete">删除</button>'
            + '</div>'
            + '<div class="adr044-template-status" id="adr044-cd-env-status">下拉切换立即生效；改了下面的文本再点保存，会写进当前这套预设。</div>'
            + '<label>前半程 · 必须发生（{卡面} 会被替换为抽中的卡）</label>'
            + '<textarea id="adr044-cd-envelope" rows="3">' + esc(adrCdEnvelopePair().active) + '</textarea>'
            + '<label>后半程 · 已发生的背景（过了半衰期自动换成这段）</label>'
            + '<textarea id="adr044-cd-envelope-faded" rows="3">' + esc(adrCdEnvelopePair().faded) + '</textarea>'
            + secClose()

            + secOpen("卡面家法", true)
            + '<div class="' + noteClass + '" style="white-space:pre-wrap">' + esc(ADR_CD_HELP_TEXT) + '</div>'
            + secClose();
    }

    function adrCdPageHTML() {
        var st = settings();
        function secOpen(title, closed) {
            return '<details' + (closed ? '' : ' open') + '><summary>' + title + '</summary>';
        }
        function secClose() { return '</details>'; }
        return '<div class="adr044-page" id="adr044-page-cd"' + (st.activeTab === "cd" ? '' : ' style="display:none"') + '>'
            + adrCdPageInnerHTML(secOpen, secClose, "adr044-check", "adr044-actions")
            + '</div>';
    }

    function adrCd048PageHTML() {
        var st = settings();
        function secOpen(title) {
            return '<div class="adr048-section"><div class="adr048-summary">' + title + '</div>';
        }
        function secClose() { return '</div>'; }
        return '<div class="adr048-page" id="adr048-page-cd"' + (st.activeTab === "cd" ? '' : ' style="display:none"') + '>'
            + adrCdPageInnerHTML(secOpen, secClose, "adr048-check", "adr048-actions")
            + '</div>';
    }

    // ================= 抽卡剧情小能手 模块结束 =================


    function opt(cur, val, label) {
        return '<option value="' + val + '"' + (String(cur) === String(val) ? " selected" : "") + '>' + label + '</option>';
    }

    function pageHTML(type) {
        var st = settings();
        var p = prefixOf(type);
        var title = type === "plot" ? "统筹" : "情感导演";
        var autoKey = type === "plot" ? "autoInjectPlot" : "autoInjectEmotion";

        return '<div class="adr044-page" id="adr044-page-' + type + '"' + (st.activeTab === type ? '' : ' style="display:none"') + '>'
            + '<details open><summary>' + title + '配置</summary>'
            + '<label>API 预设</label>'
            + '<div class="adr044-template-compact adr044-api-profile-compact">'
            + '<select id="adr044-api-profile-select-' + type + '">' + adrDApiProfileSelectOptions(type, adrDSelectedApiProfileName(type) || "") + '</select>'
            + '<input type="text" id="adr044-api-profile-name-' + type + '" value="' + esc(adrDSelectedApiProfileName(type) || "") + '" placeholder="预设名，如 DS / Claude">'
            + '<div class="adr044-template-mini-actions">'
            + '<button type="button" id="adr044-api-profile-save-' + type + '">保存</button>'
            + '<button type="button" id="adr044-api-profile-delete-' + type + '">删除</button>'
            + '</div>'
            + '<div class="adr044-template-status" id="adr044-api-profile-status-' + type + '">下拉选择会立即切换；改名后保存会新增/更新预设。</div>'
            + '</div>'
            + '<label>API 地址</label><input type="text" id="adr044-' + type + '-endpoint" value="' + esc(st[p + "ApiEndpoint"] || "") + '" placeholder="https://openrouter.ai/api/v1">'
            + '<label>API 密钥</label><input type="password" id="adr044-' + type + '-key" value="' + esc(st[p + "ApiKey"] || "") + '" placeholder="sk-...">'
            + '<label>模型</label><input type="text" id="adr044-' + type + '-model" value="' + esc(st[p + "Model"] || "") + '" placeholder="可以手填，或加载模型">'
            + '<select id="adr044-' + type + '-model-select"><option value="' + esc(st[p + "Model"] || "") + '">' + (st[p + "Model"] ? esc(st[p + "Model"]) + "（当前）" : "加载后选择模型") + '</option></select>'
            + '<div class="adr044-actions"><button id="adr044-' + type + '-load-models" type="button">加载模型</button><button id="adr044-' + type + '-save" type="button">保存当前使用</button></div>'
            + '<label class="adr044-check"><input type="checkbox" id="adr044-auto-inject-' + type + '"' + (st[autoKey] ? " checked" : "") + '> 生成后自动注入当前聊天</label>'
            + '<label class="adr044-check"><input type="checkbox" id="adr044-auto-trigger-' + type + '"' + (st[type === "plot" ? "autoTriggerPlot" : "autoTriggerEmotion"] ? " checked" : "") + '> ' + (type === "plot" ? "让统筹定期来看一眼大局（默认关）" : "启用情感导演自动触发") + '</label>'
            + '<label>自动触发间隔</label>'
            + '<select id="adr044-auto-trigger-range-' + type + '">'
            + opt(st[type === "plot" ? "autoTriggerPlotRange" : "autoTriggerEmotionRange"], "10", "每 10 个助手正文轮次")
            + opt(st[type === "plot" ? "autoTriggerPlotRange" : "autoTriggerEmotionRange"], "20", "每 20 个助手正文轮次")
            + opt(st[type === "plot" ? "autoTriggerPlotRange" : "autoTriggerEmotionRange"], "30", "每 30 个助手正文轮次")
            + opt(st[type === "plot" ? "autoTriggerPlotRange" : "autoTriggerEmotionRange"], "50", "每 50 个助手正文轮次")
            + opt(st[type === "plot" ? "autoTriggerPlotRange" : "autoTriggerEmotionRange"], "custom", "自定义")
            + '</select>'
            + '<input type="number" id="adr044-auto-trigger-custom-' + type + '" placeholder="自定义自动触发轮次" value="' + esc(st[type === "plot" ? "autoTriggerPlotCustomRange" : "autoTriggerEmotionCustomRange"] || "") + '" style="display:' + (String(st[type === "plot" ? "autoTriggerPlotRange" : "autoTriggerEmotionRange"]) === "custom" ? "block" : "none") + '">'
            + '<div class="adr044-auto-counter" id="adr044-auto-counter-' + type + '">计数加载中…</div>'
            + '<div class="adr044-note adr044-auto-reroll-note">ℹ️ 触发层重 roll 不会自动再触发；如需基于新回复补导演建议，点「分析」即可，想附加要求就先填补充指令。</div>'
            + '<div class="adr044-auto-calibrate-row"><button class="adr044-auto-calibrate" id="adr044-' + type + '-calibrate-auto" type="button">重新对表（从现在起重数间隔）</button></div>'
            + '</details>'

            + '<details><summary>' + title + '预设</summary>'
            + '<div class="adr044-template-compact">'
            + '<select id="adr044-template-select-' + type + '">' + adrDTemplateOptions(type) + '</select>'
            + '<input id="adr044-template-name-' + type + '" placeholder="新模板名 / 当前模板名">'
            + '<div class="adr044-template-mini-actions">'
            + '<button type="button" id="adr044-template-save-' + type + '">保存当前为模板</button>'
            + '<button type="button" id="adr044-template-delete-' + type + '">删除模板</button>'
            + '</div>'
            + '<div class="adr044-template-status" id="adr044-template-status-' + type + '"></div>'
            + '</div>'
            + '<textarea id="adr044-' + type + '-preset" rows="8">' + esc(st[p + "Preset"] || "") + '</textarea>'
            + '</details>'

            + '<details open><summary>' + title + '结果</summary>'
            + '<div id="adr044-' + type + '-status">可先试运行看看导演会读到什么，或直接点「分析」。</div>'
            + '<textarea id="adr044-' + type + '-preview" rows="8" placeholder="生成结果显示在这里">' + esc(st[p + "Preview"] || "") + '</textarea>'
            + '<label>想对导演说的话（选填）</label><input type="text" id="adr044-' + type + '-extra" placeholder="空着就是普通分析；填了导演会带着你的要求分析">'
            + '<div class="adr044-actions"><button id="adr044-' + type + '-local" type="button">试运行（不花钱）</button><button id="adr044-' + type + '-generate" type="button">分析</button></div>'
            + '<div class="adr044-actions"><button id="adr044-' + type + '-stop" type="button" disabled>打断</button><button id="adr044-' + type + '-copy" type="button">复制</button></div>'
            + '<div class="adr044-actions"><button id="adr044-' + type + '-inject" type="button">把这份稿挂上</button><button id="adr044-' + type + '-graze" type="button">放养</button></div>'
            + '</details>'
            + '</div>';
    }

    function drawerHTML() {
        var st = settings();

        return '<div id="adr044-drawer"><div class="inline-drawer">'
            + '<div class="inline-drawer-toggle inline-drawer-header"><b>🎬 Arrebol D 暗河红霞导演系统 v1.14.5</b><div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div></div>'
            + '<div class="inline-drawer-content">'
            + '<div class="adr044-box">'
            + '<div class="adr044-note">小红霞在线｜ripple & GPT & Claude</div>'
            + '<button type="button" id="adr044-master-toggle" data-master-on="' + (st.masterEnabled !== false ? '1' : '0') + '">' + adrDMasterToggleLabel() + '</button>'

            + '<details open><summary>共享设置</summary>'
            + '<label>导演回看多少楼</label><select id="adr044-range">'
            + opt(st.range, "10", "最近 10 轮")
            + opt(st.range, "20", "最近 20 轮")
            + opt(st.range, "30", "最近 30 轮")
            + opt(st.range, "50", "最近 50 轮")
            + opt(st.range, "custom", "自定义")
            + '</select>'
            + '<input type="number" id="adr044-custom" placeholder="自定义轮数" value="' + esc(st.customRange || "") + '" style="display:' + (String(st.range) === "custom" ? "block" : "none") + '">'
            + '<label>角色卡要点 / 世界书 / 当前担心</label>'
            + '<textarea id="adr044-memory" rows="5" placeholder="这里会同时发给情感导演和统筹">' + esc(st.supplementMemory || "") + '</textarea>'
            + '<label>导演稿怎么放进聊天</label><select id="adr044-inject-mode">'
            + opt(st.injectMode, "visible", "直接显示在楼里")
            + opt(st.injectMode, "folded", "隐形标记（配合美化正则）")
            + '</select>'
            + '<label class="adr044-check"><input type="checkbox" id="adr044-show-floating-window"' + (st.showFloatingWindow ? " checked" : "") + '> 显示小红霞浮窗</label>'
            + '<label class="adr044-check"><input type="checkbox" id="adr044-show-auto-trigger-popup"' + (st.showAutoTriggerPopup !== false ? " checked" : "") + '> 导演上岗前先打个招呼</label>'
            + adrxDrawerStart("shared-adv", "⚙️ 进阶开关（默认已调好，一般不用动）", false)
            + '<label>正文标签名（默认 content，多个用英文逗号分隔；正文没有标签就填 *，整层楼当正文读）</label>'
            + '<input type="text" id="adr044-content-tags" placeholder="content" value="' + esc(st.contentTagNames || "content") + '">' 
            + '<label class="adr044-check"><input type="checkbox" id="adr044-float-inject"' + (st.floatInjectEnabled !== false ? " checked" : "") + '> 贴耳模式：最新一份稿始终跟着对话走（藏楼/摘要洗不掉）</label>'
            + '<label>贴耳位置：稿子塞在倒数第几条（默认 2，不懂别动）</label><input type="number" id="adr044-float-depth" min="0" max="99" value="' + esc(st.floatDepth != null ? st.floatDepth : 2) + '">'
            + '<label class="adr044-check"><input type="checkbox" id="adr044-director-log"' + (st.directorLogEnabled !== false ? " checked" : "") + '> 跟组模式：导演记得自己说过什么，不翻烧饼</label>'
            + '<label class="adr044-check"><input type="checkbox" id="adr044-ng-detect"' + (st.ngDetectEnabled !== false ? " checked" : "") + '> NG 检测：同一楼重 roll ' + ADR_D_NG_THRESHOLD + ' 次提示请导演</label>'
            + '</details>'
            + adrxDrawerStart("shared-diag", "🔧 校对与诊断（排查问题时才用）", false)
            + '<div class="adr044-actions"><button id="adr044-probe-context" type="button" onclick="window.ADR044_probeContext&&window.ADR044_probeContext();return false;">检测上下文</button><button id="adr044-probe-content" type="button" onclick="window.ADR044_probeContent&&window.ADR044_probeContent();return false;">测试 &lt;content&gt; 提取</button></div>'
            + '<div class="adr044-actions"><button id="adr044-preview-precise" type="button">预览精准读取</button></div>'
            + '</details>'
            + '</details>'

            + '<div class="adr044-tabs">'
            + '<button id="adr044-tab-emotion" type="button" class="' + (st.activeTab === "plot" || st.activeTab === "cd" ? "" : "active") + '">情感导演</button>'
            + '<button id="adr044-tab-plot" type="button" class="' + (st.activeTab === "plot" ? "active" : "") + '">统筹</button>'
            + '<button id="adr044-tab-cd" type="button" class="' + (st.activeTab === "cd" ? "active" : "") + '">🎴 抽卡</button>'
            + '</div>'

            + pageHTML("emotion")
            + pageHTML("plot")
            + adrCdPageHTML()
            + '</div>'
            + '</div></div></div>';
    }

    function mountDrawer() {
        if (q("#adr044-drawer")) return;

        var html = drawerHTML();

        try {
            var jq = rootWin().jQuery || rootWin().$ || window.jQuery || window.$;
            if (jq) {
                var target = jq("#extensions_settings2");
                if (target && target.length) {
                    target.append(html);
                    return;
                }
            }
        } catch (e) {}

        var d = rootDoc();
        var el = d.querySelector("#extensions_settings2");
        if (el) {
            var wrap = d.createElement("div");
            wrap.innerHTML = html;
            el.appendChild(wrap.firstChild);
        }
    }

    function switchTab(type) {
        type = (type === "plot" || type === "cd") ? type : "emotion";
        save("activeTab", type);

        try {
            var d = rootDoc();

            // 抽屉与浮窗会同时存在，且内部 id 重复。
            // 所以这里必须同步所有同名节点，不能只 q("#id")。
            Array.prototype.slice.call(d.querySelectorAll("#adr044-page-emotion, #adr048-page-emotion")).forEach(function (el) {
                el.style.display = type === "emotion" ? "" : "none";
            });

            Array.prototype.slice.call(d.querySelectorAll("#adr044-page-plot, #adr048-page-plot")).forEach(function (el) {
                el.style.display = type === "plot" ? "" : "none";
            });

            Array.prototype.slice.call(d.querySelectorAll("#adr044-page-cd, #adr048-page-cd")).forEach(function (el) {
                el.style.display = type === "cd" ? "" : "none";
            });

            Array.prototype.slice.call(d.querySelectorAll("#adr044-tab-emotion")).forEach(function (el) {
                el.classList.toggle("active", type === "emotion");
            });

            Array.prototype.slice.call(d.querySelectorAll("#adr044-tab-plot")).forEach(function (el) {
                el.classList.toggle("active", type === "plot");
            });

            Array.prototype.slice.call(d.querySelectorAll("#adr044-tab-cd")).forEach(function (el) {
                el.classList.toggle("active", type === "cd");
            });

            adrDRefreshAllFieldsFromSettings();
            adrDRestorePanelRuntimeState();
        } catch (e) {
            console.warn("[Arrebol D] switchTab failed", e);
        }
    }


    function adrDSetAllById(id, value, checked) {
        try {
            var nodes = Array.prototype.slice.call(rootDoc().querySelectorAll("#" + id));
            nodes.forEach(function (el) {
                if (!el) return;
                if (el.type === "checkbox") {
                    el.checked = !!checked;
                } else {
                    el.value = value == null ? "" : value;
                }
            });
        } catch (e) {}
    }

    function adrDRefreshAllFieldsFromSettings() {
        try {
            var st = settings();

            adrDSetAllById("adr044-range", st.range || "30");
            adrDSetAllById("adr044-custom", st.customRange || "");
            adrDSetAllById("adr044-memory", st.supplementMemory || "");
            adrDSetAllById("adr044-content-tags", st.contentTagNames || "content");
            adrDSetAllById("adr044-inject-mode", st.injectMode || "visible");
            adrDSetAllById("adr044-show-floating-window", "", st.showFloatingWindow);
            adrDSetAllById("adr044-float-inject", "", st.floatInjectEnabled !== false);
            adrDSetAllById("adr044-float-depth", String(st.floatDepth != null ? st.floatDepth : 2));
            adrDSetAllById("adr044-director-log", "", st.directorLogEnabled !== false);
            adrDSetAllById("adr044-ng-detect", "", st.ngDetectEnabled !== false);
            adrDSetAllById("adr044-show-auto-trigger-popup", "", st.showAutoTriggerPopup !== false);

            ["emotion", "plot"].forEach(function (type) {
                var p = prefixOf(type);
                adrDSetAllById("adr044-" + type + "-endpoint", st[p + "ApiEndpoint"] || "");
                adrDSetAllById("adr044-" + type + "-key", st[p + "ApiKey"] || "");
                adrDSetAllById("adr044-" + type + "-model", st[p + "Model"] || "");
                adrDRefreshApiProfileSelects(type);
                adrDSetAllById("adr044-" + type + "-preset", st[p + "Preset"] || "");
                adrDSetAllById("adr044-" + type + "-preview", st[p + "Preview"] || "");
                adrDSetAllById("adr044-auto-inject-" + type, "", type === "plot" ? st.autoInjectPlot : st.autoInjectEmotion);
                adrDSetAllById("adr044-auto-trigger-" + type, "", type === "plot" ? st.autoTriggerPlot : st.autoTriggerEmotion);
                adrDSetAllById("adr044-auto-trigger-range-" + type, st[type === "plot" ? "autoTriggerPlotRange" : "autoTriggerEmotionRange"] || (type === "plot" ? "10" : "20"));
                adrDSetAllById("adr044-auto-trigger-custom-" + type, st[type === "plot" ? "autoTriggerPlotCustomRange" : "autoTriggerEmotionCustomRange"] || "");
            });
            try { adrCdRefreshPanelFields(); } catch (eCdRefresh) {}
            adrDRefreshMasterToggleUI();
            adrDUpdateAutoCounters();
        } catch (e) {
            console.warn("[Arrebol D] refresh fields failed", e);
        }
    }


    var ADR_D_TEMPLATE_KEY = "arrebol_d_prompt_templates_v1";
    var ADR_D_SELECTED_TEMPLATE_KEY = "arrebol_d_selected_prompt_templates_v1";
    var ADR_D_API_PROFILE_KEY = "arrebol_d_api_profiles_v1";
    var ADR_D_SELECTED_API_PROFILE_KEY = "arrebol_d_selected_api_profiles_v1";

    // v1.9.30：模板/API 档案四把钥匙全部迁到 extensionSettings（跟账号走）。
    // 读取优先服务器侧；首次载入自动从 localStorage 搬家存量；写入双写 localStorage 做灾备。
    function adrDLoadSelectedTemplates() {
        try {
            var st = settings();
            if (st.selectedPromptTemplates && typeof st.selectedPromptTemplates === "object") {
                return st.selectedPromptTemplates;
            }
            var migrated = {};
            try {
                var s = rootWin().localStorage.getItem(ADR_D_SELECTED_TEMPLATE_KEY) || "";
                if (s) migrated = JSON.parse(s) || {};
            } catch (e1) {}
            st.selectedPromptTemplates = migrated;
            saveNow();
            return migrated;
        } catch (e) {
            return {};
        }
    }

    function adrDSaveSelectedTemplate(type, name) {
        try {
            var obj = adrDLoadSelectedTemplates();
            obj[type] = String(name || "");
            settings().selectedPromptTemplates = obj;
            saveNow();
            try { rootWin().localStorage.setItem(ADR_D_SELECTED_TEMPLATE_KEY, JSON.stringify(obj)); } catch (eLs) {}
        } catch (e) {}
    }

    function adrDSelectedTemplateName(type) {
        try {
            var obj = adrDLoadSelectedTemplates();
            return String(obj[type] || "");
        } catch (e) {
            return "";
        }
    }


    function adrDDefaultTemplateText(type) {
        try {
            var st = settings();
            return String(type === "plot" ? (st.plotPreset || "") : (st.emotionPreset || ""));
        } catch (e) {
            return "";
        }
    }

    function adrDDefaultTemplates() {
        return {
            emotion: [
                { name: "默认情感导演", text: adrDDefaultTemplateText("emotion") || "你是 RP 情感导演。请阅读最近的聊天内容和用户补充信息，只分析情感曲线与人写正文。" }
            ],
            plot: [
                { name: "默认统筹", text: adrDDefaultTemplateText("plot") || "你是 RP 编剧顾问。请阅读角色卡、世界书、记忆与最近聊天内容，分析剧情节奏、事件张力、伏笔管理与场景调度，给出下一阶段的剧情推进方向。你不写正文，只做剧情导航。" }
            ]
        };
    }

    function adrDNormalizeTemplates(raw) {
        var def = adrDDefaultTemplates();
        var out = { emotion: [], plot: [] };

        ["emotion", "plot"].forEach(function (type) {
            var arr = raw && Array.isArray(raw[type]) ? raw[type] : [];
            arr.forEach(function (it) {
                if (!it) return;
                var name = String(it.name || "").trim();
                var text = String(it.text || "");
                if (name) out[type].push({ name: name, text: text });
            });
            if (!out[type].length) out[type] = def[type];
        });

        return out;
    }

    function adrDLoadTemplates() {
        try {
            var rw = rootWin();
            if (rw.__adrDPromptTemplatesCache) return adrDNormalizeTemplates(rw.__adrDPromptTemplatesCache);

            // 优先服务器侧存储。
            var st = settings();
            if (st.promptTemplatesStore && typeof st.promptTemplatesStore === "object") {
                rw.__adrDPromptTemplatesCache = adrDNormalizeTemplates(st.promptTemplatesStore);
                return adrDNormalizeTemplates(rw.__adrDPromptTemplatesCache);
            }

            // 服务器侧为空：从 localStorage 搬家存量（老浏览器里的模板由此救回）。
            var s = "";
            try { s = rw.localStorage.getItem(ADR_D_TEMPLATE_KEY) || ""; } catch (e1) {}

            if (!s) {
                rw.__adrDPromptTemplatesCache = adrDDefaultTemplates();
                adrDSaveTemplates(rw.__adrDPromptTemplatesCache);
                return adrDNormalizeTemplates(rw.__adrDPromptTemplatesCache);
            }

            var parsed = adrDNormalizeTemplates(JSON.parse(s));
            rw.__adrDPromptTemplatesCache = parsed;
            adrDSaveTemplates(parsed);
            return adrDNormalizeTemplates(parsed);
        } catch (e) {
            return adrDDefaultTemplates();
        }
    }

    function adrDSaveTemplates(obj) {
        try {
            var rw = rootWin();
            var normalized = adrDNormalizeTemplates(obj);
            rw.__adrDPromptTemplatesCache = normalized;
            settings().promptTemplatesStore = normalized;
            saveNow();
            try { rw.localStorage.setItem(ADR_D_TEMPLATE_KEY, JSON.stringify(normalized)); } catch (eLs) {}
            return true;
        } catch (e) {
            console.warn("[Arrebol D] save templates failed", e);
            return false;
        }
    }

    function adrDTemplateOptions(type) {
        var data = adrDLoadTemplates();
        var arr = data[type] || [];
        var selectedName = adrDSelectedTemplateName(type);
        return arr.map(function (it, idx) {
            var name = String(it.name || ("模板 " + (idx + 1)));
            var selected = selectedName && name === selectedName ? ' selected' : '';
            return '<option value="' + idx + '"' + selected + '>' + esc(name) + '</option>';
        }).join("");
    }

    function adrDRefreshTemplateSelects(type, selectedName) {
        try {
            if (!selectedName) selectedName = adrDSelectedTemplateName(type);
            var html = adrDTemplateOptions(type);
            Array.prototype.slice.call(rootDoc().querySelectorAll("#adr044-template-select-" + type)).forEach(function (sel) {
                sel.innerHTML = html;
                var matched = false;
                if (selectedName) {
                    for (var i = 0; i < sel.options.length; i++) {
                        if (sel.options[i].textContent === selectedName) {
                            sel.value = String(i);
                            matched = true;
                            break;
                        }
                    }
                }
                if (!matched) sel.value = "0";
            });
        } catch (e) {}
    }

    function adrDTemplateStatus(type, text, color) {
        try {
            Array.prototype.slice.call(rootDoc().querySelectorAll("#adr044-template-status-" + type)).forEach(function (el) {
                el.textContent = text || "";
                if (color) el.style.color = color;
            });
        } catch (e) {}
    }

    function adrDGetPresetBox(type) { return qForm("adr044-" + type + "-preset"); }
    function adrDGetTemplateSelect(type) { return qForm("adr044-template-select-" + type); }
    function adrDGetTemplateName(type) { return qForm("adr044-template-name-" + type); }

    function adrDApplyTemplate(type) {
        adrDResetConfirmAction("delete-template-" + (type === "plot" ? "plot" : "emotion"));
        var data = adrDLoadTemplates();
        var sel = adrDGetTemplateSelect(type);
        var idx = sel ? Number(sel.value) : 0;
        var item = data[type] && data[type][idx];

        if (!item) {
            adrDTemplateStatus(type, "没有找到模板", "#C98BA3");
            return;
        }

        var preset = adrDGetPresetBox(type);
        if (preset) {
            preset.value = String(item.text || "");
            try { preset.dispatchEvent(new Event("input", { bubbles: true })); } catch (e) {}
        }

        var name = adrDGetTemplateName(type);
        if (name) name.value = String(item.name || "");

        try {
            syncType(type);
            adrDSaveLocalBackup(settings());
        } catch (e2) {}

        adrDSaveSelectedTemplate(type, item.name);
        adrDTemplateStatus(type, "已切换：" + item.name, "#8ed99d");
    }

    function adrDSaveCurrentTemplate(type) {
        adrDResetConfirmAction("delete-template-" + (type === "plot" ? "plot" : "emotion"));
        var nameBox = adrDGetTemplateName(type);
        var preset = adrDGetPresetBox(type);
        var name = nameBox ? String(nameBox.value || "").trim() : "";
        var text = preset ? String(preset.value || "") : "";

        if (!name) {
            adrDTemplateStatus(type, "请先写模板名", "#C98BA3");
            return;
        }

        var data = adrDLoadTemplates();
        var arr = data[type] || [];
        var found = -1;

        arr.forEach(function (it, idx) {
            if (String(it.name || "") === name) found = idx;
        });

        if (found >= 0) arr[found] = { name: name, text: text };
        else arr.push({ name: name, text: text });

        data[type] = arr;
        adrDSaveTemplates(data);
        adrDSaveSelectedTemplate(type, name);
        adrDRefreshTemplateSelects(type, name);
        adrDTemplateStatus(type, found >= 0 ? "已更新：" + name : "已新增：" + name, "#8ed99d");
    }

    var adrDConfirmActionState = {};

    function adrDResetConfirmAction(key) {
        try {
            var item = adrDConfirmActionState[key];
            if (!item) return;
            if (item.timer) clearTimeout(item.timer);
            if (item.btn && item.originalText !== undefined) item.btn.textContent = item.originalText;
            delete adrDConfirmActionState[key];
        } catch (e) {}
    }

    function adrDTwoStepConfirm(key, btn, confirmText, hintText, hintFn, actionFn) {
        try {
            var now = Date.now();
            var old = adrDConfirmActionState[key];
            if (old && old.ready && old.until && now <= old.until) {
                adrDResetConfirmAction(key);
                try { actionFn(); } finally { adrDResetConfirmAction(key); }
                return true;
            }

            adrDResetConfirmAction(key);
            var original = btn ? String(btn.textContent || "") : "";
            var item = {
                ready: true,
                btn: btn || null,
                originalText: original,
                until: now + 4500,
                timer: null
            };
            if (btn) btn.textContent = confirmText;
            item.timer = setTimeout(function () { adrDResetConfirmAction(key); }, 4500);
            adrDConfirmActionState[key] = item;
            if (typeof hintFn === "function") hintFn(hintText);
            return false;
        } catch (e) {
            try { actionFn(); } catch (e2) {}
            return true;
        }
    }

    function adrDRequestDeleteCurrentTemplate(type, btn) {
        type = type === "plot" ? "plot" : "emotion";
        return adrDTwoStepConfirm(
            "delete-template-" + type,
            btn || qForm("adr044-template-delete-" + type),
            "确定删除？",
            "再点一次确认删除模板",
            function (msg) { adrDTemplateStatus(type, msg, "#d6a26a"); },
            function () { adrDDeleteCurrentTemplate(type); }
        );
    }

    function adrDRequestCalibrateAutoBaseline(type, btn) {
        type = type === "plot" ? "plot" : "emotion";
        return adrDTwoStepConfirm(
            "calibrate-auto-" + type,
            btn || qForm("adr044-" + type + "-calibrate-auto"),
            "确定对表？",
            "再点一次确认重新对表（从现在起重数间隔）",
            function (msg) { status(type, msg, "#d6a26a"); },
            function () { adrDCalibrateAutoBaseline(type); }
        );
    }

    function adrDDeleteCurrentTemplate(type) {
        var data = adrDLoadTemplates();
        var sel = adrDGetTemplateSelect(type);
        var idx = sel ? Number(sel.value) : -1;
        var arr = data[type] || [];

        if (!arr[idx]) {
            adrDTemplateStatus(type, "没有选中的模板", "#C98BA3");
            return;
        }

        if (arr.length <= 1) {
            adrDTemplateStatus(type, "至少保留一个模板", "#C98BA3");
            return;
        }

        var name = arr[idx].name;
        arr.splice(idx, 1);
        data[type] = arr;
        adrDSaveTemplates(data);
        adrDSaveSelectedTemplate(type, arr[0] ? arr[0].name : "");
        adrDRefreshTemplateSelects(type);
        adrDResetConfirmAction("delete-template-" + (type === "plot" ? "plot" : "emotion"));
        adrDTemplateStatus(type, "已删除：" + name, "#f0b36a");
    }

    function adrDBindCompactTemplateControls() {
        try {
            ["emotion", "plot"].forEach(function (type) {
                Array.prototype.slice.call(rootDoc().querySelectorAll("#adr044-template-select-" + type)).forEach(function (sel) {
                    if (!sel) return;
                    try {
                        var data = adrDLoadTemplates();
                        var item = data[type] && data[type][Number(sel.value)];
                        var nameInput = adrDGetTemplateName(type);
                        if (nameInput && item && !nameInput.value) nameInput.value = item.name || "";
                    } catch (e0) {}

                    if (sel.__adrDTemplateSelectBound) return;
                    sel.__adrDTemplateSelectBound = true;
                    sel.addEventListener("change", function () {
                        adrDApplyTemplate(type);
                    }, true);
                });

                Array.prototype.slice.call(rootDoc().querySelectorAll("#adr044-template-save-" + type)).forEach(function (btn) {
                    if (!btn || btn.__adrDTemplateSaveBound) return;
                    btn.__adrDTemplateSaveBound = true;
                    btn.addEventListener("touchstart", function (ev) {
                        adrDMarkButtonTouchStart(btn, ev);
                    }, { capture: true, passive: true });
                    btn.addEventListener("touchmove", function (ev) {
                        adrDMarkButtonTouchMove(btn, ev);
                    }, { capture: true, passive: true });
                    btn.addEventListener("click", function (ev) {
                        ev.preventDefault();
                        ev.stopPropagation();
                        if (adrDShouldIgnoreButtonTap(btn, ev)) return;
                        adrDSaveCurrentTemplate(type);
                    }, true);
                    btn.addEventListener("touchend", function (ev) {
                        ev.preventDefault();
                        ev.stopPropagation();
                        if (adrDShouldIgnoreButtonTap(btn, ev)) return;
                        adrDSaveCurrentTemplate(type);
                    }, true);
                });

                Array.prototype.slice.call(rootDoc().querySelectorAll("#adr044-template-delete-" + type)).forEach(function (btn) {
                    if (!btn || btn.__adrDTemplateDeleteBound) return;
                    btn.__adrDTemplateDeleteBound = true;
                    btn.addEventListener("touchstart", function (ev) {
                        adrDMarkButtonTouchStart(btn, ev);
                    }, { capture: true, passive: true });
                    btn.addEventListener("touchmove", function (ev) {
                        adrDMarkButtonTouchMove(btn, ev);
                    }, { capture: true, passive: true });
                    btn.addEventListener("click", function (ev) {
                        ev.preventDefault();
                        ev.stopPropagation();
                        if (adrDShouldIgnoreButtonTap(btn, ev)) return;
                        adrDRequestDeleteCurrentTemplate(type, btn);
                    }, true);
                    btn.addEventListener("touchend", function (ev) {
                        ev.preventDefault();
                        ev.stopPropagation();
                        if (adrDShouldIgnoreButtonTap(btn, ev)) return;
                        adrDRequestDeleteCurrentTemplate(type, btn);
                    }, true);
                });
            });
        } catch (e) {}
    }


    function adrDApiProfileType(type) {
        if (type === "cd") return "cd";
        return type === "plot" ? "plot" : "emotion";
    }

    function adrDNormalizeApiProfiles(raw) {
        var arr = Array.isArray(raw) ? raw : [];
        var out = [];
        var seen = {};

        arr.forEach(function (it) {
            if (!it) return;
            var name = String(it.name || "").trim();
            if (!name) return;
            var key = name.toLowerCase();
            var item = {
                name: name,
                endpoint: String(it.endpoint || ""),
                apiKey: String(it.apiKey || it.key || ""),
                model: String(it.model || ""),
                updatedAt: Number(it.updatedAt || 0) || Date.now()
            };
            if (seen[key] !== undefined) out[seen[key]] = item;
            else {
                seen[key] = out.length;
                out.push(item);
            }
        });

        return out;
    }

    function adrDNormalizeApiProfileStore(raw) {
        var store = { emotion: [], plot: [], cd: [] };

        // 兼容上一版共享数组：首次读取时复制到两边，随后两边各自保存、互不影响。
        if (Array.isArray(raw)) {
            var shared = adrDNormalizeApiProfiles(raw);
            store.emotion = shared.slice();
            store.plot = shared.slice();
            store.cd = shared.slice();
            return store;
        }

        if (raw && typeof raw === "object") {
            store.emotion = adrDNormalizeApiProfiles(raw.emotion || []);
            store.plot = adrDNormalizeApiProfiles(raw.plot || []);
            store.cd = adrDNormalizeApiProfiles(raw.cd || []);

            // 兼容可能存在的 shared 字段：只补空侧，不覆盖已有独立档案。
            if (Array.isArray(raw.shared)) {
                var shared2 = adrDNormalizeApiProfiles(raw.shared);
                if (!store.emotion.length) store.emotion = shared2.slice();
                if (!store.plot.length) store.plot = shared2.slice();
                if (!store.cd.length) store.cd = shared2.slice();
            }
        }

        return store;
    }

    function adrDLoadApiProfileStore() {
        try {
            var rw = rootWin();
            if (rw.__adrDApiProfilesCache) return adrDNormalizeApiProfileStore(rw.__adrDApiProfilesCache);

            // 优先服务器侧存储。
            var st = settings();
            if (st.apiProfilesStore && typeof st.apiProfilesStore === "object") {
                rw.__adrDApiProfilesCache = adrDNormalizeApiProfileStore(st.apiProfilesStore);
                return adrDNormalizeApiProfileStore(rw.__adrDApiProfilesCache);
            }

            // 服务器侧为空：从 localStorage 搬家存量。
            var s = "";
            try { s = rw.localStorage.getItem(ADR_D_API_PROFILE_KEY) || ""; } catch (e1) {}
            if (!s) {
                rw.__adrDApiProfilesCache = { emotion: [], plot: [], cd: [] };
                return { emotion: [], plot: [], cd: [] };
            }

            var parsed = adrDNormalizeApiProfileStore(JSON.parse(s));
            rw.__adrDApiProfilesCache = parsed;
            st.apiProfilesStore = parsed;
            saveNow();
            return adrDNormalizeApiProfileStore(parsed);
        } catch (e) {
            return { emotion: [], plot: [], cd: [] };
        }
    }

    function adrDLoadApiProfiles(type) {
        var t = adrDApiProfileType(type);
        var store = adrDLoadApiProfileStore();
        return adrDNormalizeApiProfiles(store[t] || []);
    }

    function adrDSaveApiProfiles(type, arr) {
        try {
            var rw = rootWin();
            var t = adrDApiProfileType(type);
            var store = adrDLoadApiProfileStore();
            store[t] = adrDNormalizeApiProfiles(arr);
            rw.__adrDApiProfilesCache = adrDNormalizeApiProfileStore(store);
            settings().apiProfilesStore = rw.__adrDApiProfilesCache;
            saveNow();
            try { rw.localStorage.setItem(ADR_D_API_PROFILE_KEY, JSON.stringify(rw.__adrDApiProfilesCache)); } catch (eLs) {}
            return true;
        } catch (e) {
            console.warn("[Arrebol D] save api profiles failed", e);
            return false;
        }
    }

    function adrDLoadSelectedApiProfiles() {
        try {
            var st = settings();
            if (st.selectedApiProfiles && typeof st.selectedApiProfiles === "object") {
                return st.selectedApiProfiles;
            }
            var migrated = {};
            try {
                var s = rootWin().localStorage.getItem(ADR_D_SELECTED_API_PROFILE_KEY) || "";
                if (s) migrated = JSON.parse(s) || {};
            } catch (e1) {}
            st.selectedApiProfiles = migrated;
            saveNow();
            return migrated;
        } catch (e) {
            return {};
        }
    }

    function adrDSaveSelectedApiProfile(type, name) {
        try {
            var obj = adrDLoadSelectedApiProfiles();
            obj[adrDApiProfileType(type)] = String(name || "");
            settings().selectedApiProfiles = obj;
            saveNow();
            try { rootWin().localStorage.setItem(ADR_D_SELECTED_API_PROFILE_KEY, JSON.stringify(obj)); } catch (eLs) {}
        } catch (e) {}
    }

    function adrDSelectedApiProfileName(type) {
        try {
            var obj = adrDLoadSelectedApiProfiles();
            return String(obj[adrDApiProfileType(type)] || "");
        } catch (e) {
            return "";
        }
    }

    function adrDApiProfileSelectOptions(type, selectedName) {
        var arr = adrDLoadApiProfiles(type);
        selectedName = String(selectedName || "");
        var html = '<option value="">选择已有预设</option>';
        html += arr.map(function (it, idx) {
            var name = String(it.name || ("API 预设 " + (idx + 1)));
            return '<option value="' + esc(name) + '"' + (name === selectedName ? " selected" : "") + '>' + esc(name) + '</option>';
        }).join("");
        return html;
    }

    function adrDRefreshApiProfileSelects(type, selectedName) {
        try {
            if (selectedName === undefined || selectedName === null) selectedName = adrDSelectedApiProfileName(type);
            selectedName = String(selectedName || "");
            var html = adrDApiProfileSelectOptions(type, selectedName);
            Array.prototype.slice.call(rootDoc().querySelectorAll("#adr044-api-profile-select-" + type)).forEach(function (sel) {
                sel.innerHTML = html;
                sel.value = selectedName;
            });
            Array.prototype.slice.call(rootDoc().querySelectorAll("#adr044-api-profile-name-" + type)).forEach(function (input) {
                input.value = selectedName;
            });
        } catch (e) {}
    }

    function adrDApiProfileStatus(type, text, color) {
        try {
            Array.prototype.slice.call(rootDoc().querySelectorAll("#adr044-api-profile-status-" + type)).forEach(function (el) {
                el.textContent = text || "";
                if (color) el.style.color = color;
            });
        } catch (e) {}
    }

    function adrDActivePageRoot(type) {
        try {
            var d = rootDoc();
            var popup = d.querySelector('#adr048-popup-panel[data-open="1"] #adr048-page-' + type);
            if (popup) return popup;
            var drawer = d.querySelector('#adr044-page-' + type);
            if (drawer) return drawer;
        } catch (e) {}
        return rootDoc();
    }

    function adrDActiveField(type, id) {
        try {
            var root = adrDActivePageRoot(type);
            var el = root && root.querySelector ? root.querySelector("#" + id) : null;
            if (el) return el;
        } catch (e) {}
        return qForm(id);
    }

    function adrDSetCurrentApiFields(type, item) {
        var p = prefixOf(type);
        item = item || {};
        adrDSetAllById("adr044-" + type + "-endpoint", item.endpoint || "");
        adrDSetAllById("adr044-" + type + "-key", item.apiKey || "");
        adrDSetAllById("adr044-" + type + "-model", item.model || "");
        save(p + "ApiEndpoint", item.endpoint || "");
        save(p + "ApiKey", item.apiKey || "");
        save(p + "Model", item.model || "");
        try {
            Array.prototype.slice.call(rootDoc().querySelectorAll("#adr044-" + type + "-model-select")).forEach(function (sel) {
                var model = String(item.model || "");
                sel.innerHTML = model ? '<option value="' + esc(model) + '">' + esc(model) + '（当前）</option>' : '<option value="">加载后选择模型</option>';
                sel.value = model;
            });
        } catch (e) {}
        saveNow();
    }

    function adrDCurrentApiFields(type) {
        type = adrDApiProfileType(type);
        var endpoint = adrDActiveField(type, "adr044-" + type + "-endpoint");
        var key = adrDActiveField(type, "adr044-" + type + "-key");
        var model = adrDActiveField(type, "adr044-" + type + "-model");
        return {
            endpoint: endpoint ? String(endpoint.value || "") : "",
            apiKey: key ? String(key.value || "") : "",
            model: model ? String(model.value || "") : ""
        };
    }

    function adrDApiProfileSelect(type) {
        var t0 = adrDApiProfileType(type);
        return adrDActiveField(t0, "adr044-api-profile-select-" + t0);
    }

    function adrDApiProfileNameInput(type) {
        var t1 = adrDApiProfileType(type);
        return adrDActiveField(t1, "adr044-api-profile-name-" + t1);
    }

    function adrDActiveApiProfileName(type) {
        type = adrDApiProfileType(type);
        var input = adrDApiProfileNameInput(type);
        return String(input ? input.value || "" : adrDSelectedApiProfileName(type) || "").trim();
    }

    function adrDSelectedApiProfileSelectName(type) {
        type = adrDApiProfileType(type);
        var sel = adrDApiProfileSelect(type);
        return String(sel ? sel.value || "" : adrDSelectedApiProfileName(type) || "").trim();
    }

    function adrDFindApiProfileIndexByName(type, name) {
        var key = String(name || "").trim().toLowerCase();
        if (!key) return -1;
        var arr = adrDLoadApiProfiles(type);
        for (var i = 0; i < arr.length; i++) {
            if (String(arr[i].name || "").trim().toLowerCase() === key) return i;
        }
        return -1;
    }

    function adrDSelectedApiProfileItem(type) {
        type = adrDApiProfileType(type);
        var name = adrDSelectedApiProfileSelectName(type) || adrDActiveApiProfileName(type) || adrDSelectedApiProfileName(type);
        var idx = adrDFindApiProfileIndexByName(type, name);
        var arr = adrDLoadApiProfiles(type);
        return idx >= 0 ? arr[idx] : null;
    }

    function adrDSaveCurrentApiProfile(type) {
        type = adrDApiProfileType(type);
        adrDResetConfirmAction("delete-api-profile-" + type);

        var fields = adrDCurrentApiFields(type);
        if (!fields.endpoint && !fields.apiKey && !fields.model) {
            adrDApiProfileStatus(type, "请先填写 API 地址、密钥或模型", "#C98BA3");
            return;
        }

        var name = adrDActiveApiProfileName(type);
        if (!name) {
            adrDApiProfileStatus(type, "请先在当前预设框里写名字，例如 DS / Claude", "#C98BA3");
            return;
        }

        var arr = adrDLoadApiProfiles(type);
        var item = {
            name: name,
            endpoint: fields.endpoint,
            apiKey: fields.apiKey,
            model: fields.model,
            updatedAt: Date.now()
        };

        var found = adrDFindApiProfileIndexByName(type, name);
        if (found >= 0) arr[found] = item;
        else arr.push(item);

        adrDSaveApiProfiles(type, arr);
        adrDSaveSelectedApiProfile(type, name);
        adrDRefreshApiProfileSelects(type, name);
        adrDSetCurrentApiFields(type, item);
        adrDApiProfileStatus(type, found >= 0 ? "已更新预设：" + name : "已新增预设：" + name, "#8ed99d");
    }

    function adrDApplyApiProfile(type) {
        type = adrDApiProfileType(type);
        adrDResetConfirmAction("delete-api-profile-" + type);

        var name = adrDSelectedApiProfileSelectName(type) || adrDActiveApiProfileName(type);
        var item = adrDSelectedApiProfileItem(type);
        if (!item) {
            adrDApiProfileStatus(type, name ? "未保存的新预设名；填好 API 后点「保存」" : "请选择已有预设，或输入新名字后保存", "#A9B2C8");
            return false;
        }

        adrDSaveSelectedApiProfile(type, item.name || "");
        adrDRefreshApiProfileSelects(type, item.name || "");
        adrDSetCurrentApiFields(type, item);
        adrDApiProfileStatus(type, "已切换：" + item.name, "#8ed99d");
        return true;
    }

    function adrDDeleteCurrentApiProfile(type) {
        type = adrDApiProfileType(type);
        var name = adrDActiveApiProfileName(type) || adrDSelectedApiProfileName(type);
        var idx = adrDFindApiProfileIndexByName(type, name);
        var arr = adrDLoadApiProfiles(type);
        var item = idx >= 0 ? arr[idx] : null;

        if (!item) {
            adrDApiProfileStatus(type, "请先输入或选择要删除的预设", "#C98BA3");
            return;
        }

        name = item.name;
        arr.splice(idx, 1);
        adrDSaveApiProfiles(type, arr);
        if (adrDSelectedApiProfileName(type) === name) adrDSaveSelectedApiProfile(type, "");
        adrDRefreshApiProfileSelects(type, "");
        adrDResetConfirmAction("delete-api-profile-" + type);
        adrDApiProfileStatus(type, "已删除：" + name, "#f0b36a");
    }

    function adrDRequestDeleteCurrentApiProfile(type, btn) {
        type = adrDApiProfileType(type);
        return adrDTwoStepConfirm(
            "delete-api-profile-" + type,
            btn || qForm("adr044-api-profile-delete-" + type),
            "确定删除？",
            "再点一次确认删除",
            function (msg) { adrDApiProfileStatus(type, msg, "#d6a26a"); },
            function () { adrDDeleteCurrentApiProfile(type); }
        );
    }

    function adrDBindApiProfileControls() {
        try {
            ["emotion", "plot"].forEach(function (type) {
                Array.prototype.slice.call(rootDoc().querySelectorAll("#adr044-api-profile-select-" + type)).forEach(function (sel) {
                    if (!sel) return;
                    if (sel.__adrDApiProfileSelectBound) return;
                    sel.__adrDApiProfileSelectBound = true;
                    sel.addEventListener("change", function () {
                        var name = String(sel.value || "").trim();
                        if (!name) {
                            adrDSaveSelectedApiProfile(type, "");
                            Array.prototype.slice.call(rootDoc().querySelectorAll("#adr044-api-profile-name-" + type)).forEach(function (input) { input.value = ""; });
                            adrDApiProfileStatus(type, "输入新名字后点「保存」即可新增预设", "#A9B2C8");
                            return;
                        }
                        adrDApplyApiProfile(type);
                    }, true);
                });

                Array.prototype.slice.call(rootDoc().querySelectorAll("#adr044-api-profile-name-" + type)).forEach(function (input) {
                    if (!input) return;
                    if (input.__adrDApiProfileNameBound) return;
                    input.__adrDApiProfileNameBound = true;
                    input.addEventListener("input", function () {
                        var name = String(input.value || "").trim();
                        adrDResetConfirmAction("delete-api-profile-" + type);
                        if (!name) {
                            adrDApiProfileStatus(type, "输入新名字后点「保存」即可新增预设", "#A9B2C8");
                        } else if (adrDFindApiProfileIndexByName(type, name) >= 0) {
                            adrDApiProfileStatus(type, "同名保存会更新该预设", "#A9B2C8");
                        } else {
                            adrDApiProfileStatus(type, "新名字保存会新增预设，不影响旧预设", "#A9B2C8");
                        }
                    }, true);
                });
            });
        } catch (e) {}
    }

    function adrDIsTouchLikeEvent(ev) {
        return !!(ev && (ev.type === "touchend" || ev.type === "pointerup"));
    }

    function adrDMarkButtonTouchStart(el, ev) {
        try {
            var p = null;
            if (ev && ev.touches && ev.touches.length) p = ev.touches[0];
            else if (ev) p = ev;
            el.__adrDTapStart = {
                x: Number(p && p.clientX) || 0,
                y: Number(p && p.clientY) || 0,
                t: Date.now(),
                moved: false
            };
        } catch (e) {}
    }

    function adrDMarkButtonTouchMove(el, ev) {
        try {
            var s = el.__adrDTapStart;
            if (!s) return;
            var p = null;
            if (ev && ev.touches && ev.touches.length) p = ev.touches[0];
            else if (ev) p = ev;
            var dx = Math.abs((Number(p && p.clientX) || 0) - s.x);
            var dy = Math.abs((Number(p && p.clientY) || 0) - s.y);
            if (dx > 12 || dy > 12) s.moved = true;
        } catch (e) {}
    }

    function adrDShouldIgnoreButtonTap(el, ev) {
        try {
            var now = Date.now();

            // 防 iOS touchend 后补发 click 造成重复触发。
            if (ev && ev.type === "click" && el.__adrDLastTouchEndAt && now - el.__adrDLastTouchEndAt < 650) {
                return true;
            }

            if (adrDIsTouchLikeEvent(ev)) {
                el.__adrDLastTouchEndAt = now;
                var s = el.__adrDTapStart;
                el.__adrDTapStart = null;
                if (s && s.moved) return true;
            }

            // 很短时间内重复点击同一按钮，视为抖动。
            if (el.__adrDLastAcceptedTapAt && now - el.__adrDLastAcceptedTapAt < 450) {
                return true;
            }

            el.__adrDLastAcceptedTapAt = now;
            return false;
        } catch (e) {
            return false;
        }
    }

    function adrDRequestManualInject(type, btn) {
        type = type === "plot" ? "plot" : "emotion";
        return adrDTwoStepConfirm(
            "manual-inject-" + type,
            btn || qForm("adr044-" + type + "-inject"),
            "确定注入？",
            "再点一次确认注入",
            function (msg) { status(type, msg, "#d6a26a"); },
            function () {
                syncType(type);
                var pv = qForm("adr044-" + type + "-preview");
                var text = pv ? pv.value : "";
                if (!text) {
                    status(type, "没有内容可注入", "#d4726a");
                    return;
                }
                var ok = injectDirector(type, text);
                status(type, ok ? "已注入当前聊天 ✓" : "注入失败", ok ? "#8ed99d" : "#d4726a");
            }
        );
    }

    function adrDRequestDirectAnalysis(type, btn) {
        type = type === "plot" ? "plot" : "emotion";
        return adrDTwoStepConfirm(
            "direct-analysis-" + type,
            btn || qForm("adr044-" + type + "-generate"),
            "确认分析？",
            "再点一次开始分析（补充指令空着就是普通分析）",
            function (msg) { status(type, msg, "#d6a26a"); },
            function () {
                syncAll();
                // v1.14.0：按钮合并。分析自动携带补充指令框内容，空=普通分析，有字=带观点分析。
                var extraEl = qForm("adr044-" + type + "-extra");
                run(type, extraEl && extraEl.value ? String(extraEl.value) : "");
            }
        );
    }

    function adrDRequestExtraAnalysis(type, btn) {
        type = type === "plot" ? "plot" : "emotion";
        return adrDTwoStepConfirm(
            "extra-analysis-" + type,
            btn || qForm("adr044-" + type + "-reroll"),
            "确认分析？",
            "再点一次开始补充指令分析",
            function (msg) { status(type, msg, "#d6a26a"); },
            function () {
                syncType(type);
                var extra = qForm("adr044-" + type + "-extra");
                run(type, extra ? extra.value : "");
            }
        );
    }

    function bindDirect() {
        try {
            try { adrCdBindControls(); } catch (eCdBind) {} // v1.10.0：抽卡控件随每次重绑一起带起（幂等）
            if (!rootWin().adrDStableAutoSaveBound) {
                rootWin().adrDStableAutoSaveBound = true;
                rootDoc().addEventListener("input", function (ev) {
                    var t = ev && ev.target;
                    if (!t || !t.id || t.id.indexOf("adr044-") !== 0) return;
                    try {
                        syncShared();
                        if (t.id.indexOf("adr044-emotion-") === 0) syncType("emotion");
                        if (t.id.indexOf("adr044-plot-") === 0) syncType("plot");
                        adrDSaveLocalBackup(settings());
                        adrDUpdateAutoCounters();
                    } catch (e) {}
                }, true);
                rootDoc().addEventListener("change", function (ev) {
                    var t = ev && ev.target;
                    if (!t || !t.id || t.id.indexOf("adr044-") !== 0) return;
                    try {
                        syncShared();
                        if (t.id.indexOf("adr044-emotion-") === 0) syncType("emotion");
                        if (t.id.indexOf("adr044-plot-") === 0) syncType("plot");
                        adrDSaveLocalBackup(settings());
                        adrDUpdateAutoCounters();
                    } catch (e) {}
                }, true);
            }
        } catch (eStableBind) {}

        var ids = {};

        ids["adr044-tab-emotion"] = function () { switchTab("emotion"); };
        ids["adr044-tab-plot"] = function () { switchTab("plot"); };
        ids["adr044-tab-cd"] = function () { switchTab("cd"); };
        ids["adr044-api-profile-save-cd"] = function () { adrDSaveCurrentApiProfile("cd"); };
        ids["adr044-api-profile-delete-cd"] = function () { adrDRequestDeleteCurrentApiProfile("cd"); };
        ids["adr044-cd-lib-rename"] = function () { adrCdRenameLibrary(); };
        ids["adr044-cd-selfcheck"] = function () { adrCdSelfCheck(); };
        ids["adr044-cd-close-card"] = function () { adrCdCloseCard("手动", false); };
        ids["adr044-cd-env-save"] = function () { adrCdSaveEnvelopePreset(); };
        ids["adr044-cd-env-delete"] = function () { adrCdDeleteEnvelopePreset(); };
        ids["adr044-cd-load-models"] = function () { loadModels("cd"); };
        ids["adr044-cd-test"] = function () { adrCdTestConnection(); };
        ids["adr044-cd-save"] = function () { syncType("cd"); status("cd", "已保存当前使用的择池 API ✓", "#8ed99d"); };
        ids["adr044-cd-preview-draw"] = function () { adrCdPreviewDraw(); };
        ids["adr044-cd-lib-save"] = function () { adrCdSaveLibraryFromEditor(); };
        ids["adr044-cd-lib-delete"] = function () { adrCdRequestDeleteLibrary(qForm("adr044-cd-lib-delete")); };
        ids["adr044-cd-export"] = function () { adrCdExportLibrary(); };
        ids["adr044-cd-import"] = function () { adrCdTriggerImport(); };
        ids["adr044-probe-context"] = function () { runContextProbe(); };
        ids["adr044-probe-content"] = function () { runContentProbe(); };
        ids["adr044-preview-precise"] = function () { runPrecisePreview(); };
        ids["adr044-master-toggle"] = function () { adrDToggleMaster(); };

        ["emotion", "plot"].forEach(function (type) {
            ids["adr044-" + type + "-local"] = function () { localTest(type); };
            ids["adr044-" + type + "-generate"] = function () { adrDRequestDirectAnalysis(type, qForm("adr044-" + type + "-generate")); };
            ids["adr044-" + type + "-reroll"] = function () { adrDRequestExtraAnalysis(type, qForm("adr044-" + type + "-reroll")); };
            ids["adr044-" + type + "-stop"] = function () { abortRun(type); };
            ids["adr044-" + type + "-copy"] = function () { copyText(type); };
            ids["adr044-" + type + "-load-models"] = function () { loadModels(type); };
            ids["adr044-" + type + "-save"] = function () {
                adrDForceSaveSettings(type);
                status(type, "当前使用已保存 ✓", "#8ed99d");
            };
            ids["adr044-api-profile-save-" + type] = function () { adrDSaveCurrentApiProfile(type); };
            ids["adr044-api-profile-delete-" + type] = function () { adrDRequestDeleteCurrentApiProfile(type); };
            ids["adr044-" + type + "-calibrate-auto"] = function () { adrDRequestCalibrateAutoBaseline(type); };
            ids["adr044-" + type + "-inject"] = function () {
                adrDRequestManualInject(type);
            };
            ids["adr044-" + type + "-graze"] = function () {
                adrDRequestGraze(type, qForm("adr044-" + type + "-graze"));
            };
        });

        Object.keys(ids).forEach(function (id) {
            var nodes = [];
            try {
                nodes = Array.prototype.slice.call(rootDoc().querySelectorAll("#" + id));
            } catch (e) {
                var one = q("#" + id);
                if (one) nodes = [one];
            }

            nodes.forEach(function (el) {
                if (!el || el.__adr044Bound) return;
                el.__adr044Bound = true;

                el.addEventListener("touchstart", function (ev) {
                    adrDMarkButtonTouchStart(el, ev);
                }, { capture: true, passive: true });

                el.addEventListener("touchmove", function (ev) {
                    adrDMarkButtonTouchMove(el, ev);
                }, { capture: true, passive: true });

                el.addEventListener("click", function (ev) {
                    try { ev.preventDefault(); ev.stopPropagation(); } catch (e) {}
                    if (adrDShouldIgnoreButtonTap(el, ev)) return;
                    adrDBlurActiveElement();
                    ids[id]();
                }, true);

                el.addEventListener("touchend", function (ev) {
                    try { ev.preventDefault(); ev.stopPropagation(); } catch (e) {}
                    if (adrDShouldIgnoreButtonTap(el, ev)) return;
                    adrDBlurActiveElement();
                    ids[id]();
                }, true);
            });
        });

        var range = qForm("adr044-range");
        if (range && !range.__adr044Bound) {
            range.__adr044Bound = true;
            range.addEventListener("change", function () {
                save("range", range.value);
                var custom = qForm("adr044-custom");
                if (custom) custom.style.display = range.value === "custom" ? "block" : "none";
                saveNow();
            });
        }

        var mode = qForm("adr044-inject-mode");
        if (mode && !mode.__adr044Bound) {
            mode.__adr044Bound = true;
            mode.addEventListener("change", function () {
                save("injectMode", mode.value || "visible");
                saveNow();
            });
        }

        var showFab = qForm("adr044-show-floating-window");
        if (showFab && !showFab.__adr044Bound) {
            showFab.__adr044Bound = true;
            showFab.addEventListener("change", function () {
                save("showFloatingWindow", !!showFab.checked);
                saveNow();
                if (showFab.checked) adr048EnsureFabLater();
                else adr048RemoveFab();
            });
        }

        var showAutoPopup = qForm("adr044-show-auto-trigger-popup");
        if (showAutoPopup && !showAutoPopup.__adr044Bound) {
            showAutoPopup.__adr044Bound = true;
            showAutoPopup.addEventListener("change", function () {
                save("showAutoTriggerPopup", !!showAutoPopup.checked);
                saveNow();
            });
        }

        ["emotion", "plot"].forEach(function (type) {
            var modelSelect = qForm("adr044-" + type + "-model-select");
            if (modelSelect && !modelSelect.__adr044Bound) {
                modelSelect.__adr044Bound = true;
                modelSelect.addEventListener("change", function () {
                    var modelInput = qForm("adr044-" + type + "-model");
                    if (modelInput) modelInput.value = modelSelect.value;
                    save(field(type, "model"), modelSelect.value || "");
                    saveNow();
                    status(type, "已选择模型：" + (modelSelect.value || "空"), "#8ed99d");
                });
            }

            var auto = qForm("adr044-auto-inject-" + type);
            if (auto && !auto.__adr044Bound) {
                auto.__adr044Bound = true;
                auto.addEventListener("change", function () {
                    save(type === "plot" ? "autoInjectPlot" : "autoInjectEmotion", !!auto.checked);
                    saveNow();
                });
            }

            var autoTrigger = qForm("adr044-auto-trigger-" + type);
            if (autoTrigger && !autoTrigger.__adr044Bound) {
                autoTrigger.__adr044Bound = true;
                autoTrigger.addEventListener("change", function () {
                    save(type === "plot" ? "autoTriggerPlot" : "autoTriggerEmotion", !!autoTrigger.checked);
                    saveNow();
                    adrDResetAutoTriggerBaseline("toggle-" + type);
                    adrDScheduleAutoTriggerCheck("toggle-" + type);
                });
            }

            var autoRange = qForm("adr044-auto-trigger-range-" + type);
            if (autoRange && !autoRange.__adr044Bound) {
                autoRange.__adr044Bound = true;
                autoRange.addEventListener("change", function () {
                    save(type === "plot" ? "autoTriggerPlotRange" : "autoTriggerEmotionRange", autoRange.value || (type === "plot" ? "10" : "20"));
                    var custom = qForm("adr044-auto-trigger-custom-" + type);
                    if (custom) custom.style.display = autoRange.value === "custom" ? "block" : "none";
                    saveNow();
                    adrDResetAutoTriggerBaseline("range-" + type);
                    adrDScheduleAutoTriggerCheck("range-" + type);
                });
            }

            var autoCustom = qForm("adr044-auto-trigger-custom-" + type);
            if (autoCustom && !autoCustom.__adr044Bound) {
                autoCustom.__adr044Bound = true;
                autoCustom.addEventListener("input", function () {
                    save(type === "plot" ? "autoTriggerPlotCustomRange" : "autoTriggerEmotionCustomRange", Number(autoCustom.value || 0));
                    saveNow();
                });
                autoCustom.addEventListener("change", function () {
                    adrDResetAutoTriggerBaseline("custom-" + type);
                    adrDScheduleAutoTriggerCheck("custom-" + type);
                });
            }
        });

        var map = {
            "adr044-custom": "customRange",
            "adr044-memory": "supplementMemory"
        };

        ["emotion", "plot"].forEach(function (type) {
            map["adr044-" + type + "-endpoint"] = field(type, "apiEndpoint");
            map["adr044-" + type + "-key"] = field(type, "apiKey");
            map["adr044-" + type + "-model"] = field(type, "model");
            map["adr044-" + type + "-preset"] = field(type, "preset");
            map["adr044-" + type + "-preview"] = field(type, "preview");
        });

        Object.keys(map).forEach(function (id) {
            var el = qForm(id);
            if (!el || el.__adr044InputBound) return;
            el.__adr044InputBound = true;
            el.addEventListener("input", function () {
                if (map[id] === "customRange") save(map[id], Number(el.value || 0));
                else save(map[id], el.value || "");
            });
            el.addEventListener("change", function () {
                if (map[id] === "customRange") save(map[id], Number(el.value || 0));
                else save(map[id], el.value || "");
                try { adrDSaveLocalBackup(settings()); } catch (eBackup) {}
                saveNow();
            });
            el.addEventListener("blur", function () {
                if (map[id] === "customRange") save(map[id], Number(el.value || 0));
                else save(map[id], el.value || "");
                try { adrDSaveLocalBackup(settings()); } catch (eBackup2) {}
                saveNow();
            }, true);
        });
    }

    async function runPrecisePreview() {
        syncAll();
        var out = "";
        out += "【红霞精准读取预览 v1.0.5.6.8.3】\n";
        out += "以下内容就是下一次发送给副 API 的主要上下文来源。\n\n";
        out += buildPreciseContext() || "（未读取到角色卡 / 世界书 / user 人设补充）";
        out += "\n\n【最近 " + activeRange() + " 轮正文｜<content>精准读取】\n";
        out += await recentContentBlocks(activeRange()) || "（未提取到正文）";
        setPreview(currentType(), out);
        status(currentType(), "精准读取预览完成 ✓", "#8ed99d");
        setButtons(currentType());
    }


    function installProbeGlobals() {
        try {
            var w = rootWin();
            w.ADR044_probeContext = function () {
                try { runContextProbe(); } catch (e) {
                    try { alert("检测上下文失败：" + (e.message || String(e))); } catch (_) {}
                }
            };
            w.ADR044_previewPrecise = function () { try { runPrecisePreview(); } catch (e) { try { alert("预览精准读取失败：" + (e.message || String(e))); } catch (_) {} } };
            w.ADR044_probeContent = function () {
                try { runContentProbe(); } catch (e) {
                    try { alert("测试 content 失败：" + (e.message || String(e))); } catch (_) {}
                }
            };
        } catch (e) {}
    }

    function installProbeDelegation() {
        try {
            var d = rootDoc();
            if (d.__adr044ProbeDelegated) return;
            d.__adr044ProbeDelegated = true;

            function handle(ev) {
                var t = ev.target;
                if (!t) return;

                var hit = null;
                try { hit = t.closest("#adr044-probe-context,#adr044-probe-content"); }
                catch (e) { hit = null; }

                if (!hit) return;

                try { ev.preventDefault(); ev.stopPropagation(); } catch (_) {}

                if (hit.id === "adr044-probe-context") runContextProbe();
                if (hit.id === "adr044-probe-content") runContentProbe();
            }

            d.addEventListener("click", handle, true);
            d.addEventListener("touchend", handle, true);
            d.addEventListener("pointerup", handle, true);
        } catch (e) {}
    }


    function adr048IsPopupOpen() {
        try {
            var p = rootDoc().querySelector("#adr048-popup-panel");
            return !!(p && p.getAttribute("data-open") === "1");
        } catch (e) { return false; }
    }

    function qForm(id) {
        try {
            if (adr048IsPopupOpen()) {
                var p = rootDoc().querySelector("#adr048-popup-panel");
                if (p) {
                    var el = p.querySelector("#" + id);
                    if (el) return el;
                }
            }
        } catch (e) {}

        try {
            var el2 = rootDoc().querySelector("#" + id);
            if (el2) return el2;
        } catch (e2) {}

        try { return document.querySelector("#" + id); } catch (e3) {}
        return null;
    }


    function adr048PageHTML(type) {
        var st = settings();
        var p = prefixOf(type);
        var title = type === "plot" ? "统筹" : "情感导演";
        var autoKey = type === "plot" ? "autoInjectPlot" : "autoInjectEmotion";

        return '<div class="adr048-page" id="adr048-page-' + type + '"' + (st.activeTab === type ? '' : ' style="display:none"') + '>'
            + '<div class="adr048-section"><div class="adr048-summary">' + title + '配置</div>'
            + '<label>API 预设</label>'
            + '<div class="adr044-template-compact adr044-api-profile-compact">'
            + '<select id="adr044-api-profile-select-' + type + '">' + adrDApiProfileSelectOptions(type, adrDSelectedApiProfileName(type) || "") + '</select>'
            + '<input type="text" id="adr044-api-profile-name-' + type + '" value="' + esc(adrDSelectedApiProfileName(type) || "") + '" placeholder="预设名，如 DS / Claude">'
            + '<div class="adr044-template-mini-actions">'
            + '<button type="button" id="adr044-api-profile-save-' + type + '">保存</button>'
            + '<button type="button" id="adr044-api-profile-delete-' + type + '">删除</button>'
            + '</div>'
            + '<div class="adr044-template-status" id="adr044-api-profile-status-' + type + '">下拉选择会立即切换；改名后保存会新增/更新预设。</div>'
            + '</div>'
            + '<label>API 地址</label><input type="text" id="adr044-' + type + '-endpoint" value="' + esc(st[p + "ApiEndpoint"] || "") + '" placeholder="https://openrouter.ai/api/v1">'
            + '<label>API 密钥</label><input type="password" id="adr044-' + type + '-key" value="' + esc(st[p + "ApiKey"] || "") + '" placeholder="sk-...">'
            + '<label>模型</label><input type="text" id="adr044-' + type + '-model" value="' + esc(st[p + "Model"] || "") + '" placeholder="可以手填，或加载模型">'
            + '<select id="adr044-' + type + '-model-select"><option value="' + esc(st[p + "Model"] || "") + '">' + (st[p + "Model"] ? esc(st[p + "Model"]) + "（当前）" : "加载后选择模型") + '</option></select>'
            + '<div class="adr048-actions"><button id="adr044-' + type + '-load-models" type="button">加载模型</button><button id="adr044-' + type + '-save" type="button">保存当前使用</button></div>'
            + '<label class="adr048-check"><input type="checkbox" id="adr044-auto-inject-' + type + '"' + (st[autoKey] ? " checked" : "") + '> 生成后自动注入当前聊天</label>'
            + '<label class="adr048-check"><input type="checkbox" id="adr044-auto-trigger-' + type + '"' + (st[type === "plot" ? "autoTriggerPlot" : "autoTriggerEmotion"] ? " checked" : "") + '> ' + (type === "plot" ? "让统筹定期来看一眼大局（默认关）" : "启用情感导演自动触发") + '</label>'
            + '<label>自动触发间隔</label>'
            + '<select id="adr044-auto-trigger-range-' + type + '">'
            + opt(st[type === "plot" ? "autoTriggerPlotRange" : "autoTriggerEmotionRange"], "10", "每 10 个助手正文轮次")
            + opt(st[type === "plot" ? "autoTriggerPlotRange" : "autoTriggerEmotionRange"], "20", "每 20 个助手正文轮次")
            + opt(st[type === "plot" ? "autoTriggerPlotRange" : "autoTriggerEmotionRange"], "30", "每 30 个助手正文轮次")
            + opt(st[type === "plot" ? "autoTriggerPlotRange" : "autoTriggerEmotionRange"], "50", "每 50 个助手正文轮次")
            + opt(st[type === "plot" ? "autoTriggerPlotRange" : "autoTriggerEmotionRange"], "custom", "自定义")
            + '</select>'
            + '<input type="number" id="adr044-auto-trigger-custom-' + type + '" placeholder="自定义自动触发轮次" value="' + esc(st[type === "plot" ? "autoTriggerPlotCustomRange" : "autoTriggerEmotionCustomRange"] || "") + '" style="display:' + (String(st[type === "plot" ? "autoTriggerPlotRange" : "autoTriggerEmotionRange"]) === "custom" ? "block" : "none") + '">'
            + '<div class="adr044-auto-counter" id="adr044-auto-counter-' + type + '">计数加载中…</div>'
            + '<div class="adr048-note adr048-auto-reroll-note">ℹ️ 触发层重 roll 不会自动再触发；如需基于新回复补导演建议，点「分析」即可，想附加要求就先填补充指令。</div>'
            + '<div class="adr044-auto-calibrate-row"><button class="adr044-auto-calibrate" id="adr044-' + type + '-calibrate-auto" type="button">重新对表（从现在起重数间隔）</button></div>'
            + '</div>'

            + '<div class="adr048-section"><div class="adr048-summary">' + title + '预设</div>'
            + '<div class="adr044-template-compact">'
            + '<select id="adr044-template-select-' + type + '">' + adrDTemplateOptions(type) + '</select>'
            + '<input id="adr044-template-name-' + type + '" placeholder="新模板名 / 当前模板名">'
            + '<div class="adr044-template-mini-actions">'
            + '<button type="button" id="adr044-template-save-' + type + '">保存当前为模板</button>'
            + '<button type="button" id="adr044-template-delete-' + type + '">删除模板</button>'
            + '</div>'
            + '<div class="adr044-template-status" id="adr044-template-status-' + type + '"></div>'
            + '</div>'
            + '<textarea id="adr044-' + type + '-preset" rows="8">' + esc(st[p + "Preset"] || "") + '</textarea>'
            + '</div>'

            + '<div class="adr048-section"><div class="adr048-summary">' + title + '结果</div>'
            + '<div id="adr044-' + type + '-status" class="adr048-status">可先试运行看看导演会读到什么，或直接点「分析」。</div>'
            + '<textarea id="adr044-' + type + '-preview" rows="8" placeholder="生成结果显示在这里">' + esc(st[p + "Preview"] || "") + '</textarea>'
            + '<label>想对导演说的话（选填）</label><input type="text" id="adr044-' + type + '-extra" placeholder="空着就是普通分析；填了导演会带着你的要求分析">'
            + '<div class="adr048-actions"><button id="adr044-' + type + '-local" type="button">试运行（不花钱）</button><button id="adr044-' + type + '-generate" type="button">分析</button></div>'
            + '<div class="adr048-actions"><button id="adr044-' + type + '-stop" type="button" disabled>打断</button><button id="adr044-' + type + '-copy" type="button">复制</button></div>'
            + '<div class="adr048-actions"><button id="adr044-' + type + '-inject" type="button">把这份稿挂上</button><button id="adr044-' + type + '-graze" type="button">放养</button></div>'
            + '</div>'
            + '</div>';
    }

    // ================= v1.14.0 改头换面第一刀：分层收纳 =================
    // 原则（ripple 拍板）：无脑层圆开关常驻，可选层方开关入抽屉，诊断层沉底；
    // 抽屉开合状态记忆，别每次打开都弹一脸。所有元素 ID 原封不动，绑定零接触。
    var ADRX_DRAWER_KEY = "arrebol_d_ui_drawer_state_v1";

    function adrxDrawerStates() {
        try { return adrDReadJsonLS(ADRX_DRAWER_KEY); } catch (e) { return {}; }
    }

    function adrxDrawerOpenAttr(id, defOpen) {
        try {
            var s = adrxDrawerStates();
            if (s && Object.prototype.hasOwnProperty.call(s, id)) return s[id] ? " open" : "";
        } catch (e) {}
        return defOpen ? " open" : "";
    }

    function adrxDrawerStart(id, label, defOpen) {
        return '<details class="adrx-drawer" data-drawer-id="' + id + '"' + adrxDrawerOpenAttr(id, defOpen) + '><summary>' + label + '</summary>';
    }

    function adrxInstallDrawerMemory() {
        try {
            var d = rootDoc();
            if (!d || d.__adrxDrawerMemoryInstalled) return;
            d.__adrxDrawerMemoryInstalled = true;
            d.addEventListener("toggle", function (ev) {
                try {
                    var t = ev.target;
                    if (!t || !t.classList || !t.classList.contains("adrx-drawer")) return;
                    var id = t.getAttribute("data-drawer-id");
                    if (!id) return;
                    var s = adrxDrawerStates();
                    s[id] = !!t.open;
                    adrDWriteJsonLS(ADRX_DRAWER_KEY, s);
                } catch (e) {}
            }, true);
        } catch (e) {}
    }

    function adr048PanelHTML() {
        var st = settings();

        return '<div id="adr048-popup-panel" data-open="0">'
            + '<div id="adr048-popup-shell">'
            + '<div id="adr048-popup-head">'
            + '<div class="adr048-head-txt"><div class="adr048-title">🎬 Arrebol <span class="adr048-title-d">D</span><span class="adr048-title-cn">暗河红霞导演系统</span></div><div id="adr048-popup-sub">小红霞在线 · ripple &amp; GPT &amp; Claude</div></div>'
            + '<button type="button" id="adr048-theme-toggle" title="开灯 / 关灯">' + (st.dawnTheme === true ? "☀️" : "🌙") + '</button>'
            + '<button type="button" id="adr048-popup-close">×</button>'
            + '</div>'
            + '<div id="adr048-popup-body">'
            + '<button type="button" id="adr044-master-toggle" data-master-on="' + (st.masterEnabled !== false ? '1' : '0') + '">' + adrDMasterToggleLabel() + '</button>'
            + '<div class="adr048-note adrx-blurb">小红霞已就绪。自动触发、手动导演、纯文本注入与本地设置保存均已启用。由 ripple & GPT & Claude 收尾维护。</div>'

            + '<div class="adr048-section"><div class="adr048-summary">共享设置</div>'
            + '<label>导演回看多少楼</label><select id="adr044-range">'
            + opt(st.range, "10", "最近 10 轮")
            + opt(st.range, "20", "最近 20 轮")
            + opt(st.range, "30", "最近 30 轮")
            + opt(st.range, "50", "最近 50 轮")
            + opt(st.range, "custom", "自定义")
            + '</select>'
            + '<input type="number" id="adr044-custom" placeholder="自定义轮数" value="' + esc(st.customRange || "") + '" style="display:' + (String(st.range) === "custom" ? "block" : "none") + '">'
            + '<label>角色卡要点 / 世界书 / 当前担心</label>'
            + '<textarea id="adr044-memory" rows="5" placeholder="这里会同时发给情感导演和统筹">' + esc(st.supplementMemory || "") + '</textarea>'
            + '<label>导演稿怎么放进聊天</label><select id="adr044-inject-mode">'
            + opt(st.injectMode, "visible", "直接显示在楼里")
            + opt(st.injectMode, "folded", "隐形标记（配合美化正则）")
            + '</select>'
            + '<label class="adr048-check"><input type="checkbox" id="adr044-show-floating-window"' + (st.showFloatingWindow ? " checked" : "") + '> 显示小红霞浮窗</label>'
            + '<label class="adr048-check"><input type="checkbox" id="adr044-show-auto-trigger-popup"' + (st.showAutoTriggerPopup !== false ? " checked" : "") + '> 导演上岗前先打个招呼</label>'

            + adrxDrawerStart("shared-adv", "⚙️ 进阶开关（默认已调好，一般不用动）", false)
            + '<label>正文标签名（默认 content，多个用英文逗号分隔；正文没有标签就填 *，整层楼当正文读）</label>'
            + '<input type="text" id="adr044-content-tags" placeholder="content" value="' + esc(st.contentTagNames || "content") + '">' 
            + '<label class="adr048-check"><input type="checkbox" id="adr044-float-inject"' + (st.floatInjectEnabled !== false ? " checked" : "") + '> 贴耳模式：最新一份稿始终跟着对话走（不占楼层）</label>'
            + '<label>贴耳位置：稿子塞在倒数第几条（默认 2，不懂别动）</label><input type="number" id="adr044-float-depth" min="0" max="99" value="' + esc(st.floatDepth != null ? st.floatDepth : 2) + '">'
            + '<label class="adr048-check"><input type="checkbox" id="adr044-director-log"' + (st.directorLogEnabled !== false ? " checked" : "") + '> 跟组模式：导演记得自己说过什么，不翻烧饼</label>'
            + '<label class="adr048-check"><input type="checkbox" id="adr044-ng-detect"' + (st.ngDetectEnabled !== false ? " checked" : "") + '> NG 检测：同一楼重 roll ' + ADR_D_NG_THRESHOLD + ' 次提示请导演</label>'
            + '</details>'

            + adrxDrawerStart("shared-diag", "🔧 校对与诊断（排查问题时才用）", false)
            + '<div class="adr048-actions"><button id="adr044-probe-context" type="button">检测上下文</button><button id="adr044-probe-content" type="button">测试 &lt;content&gt; 提取</button></div>'
            + '<div class="adr048-actions"><button id="adr044-preview-precise" type="button">预览精准读取</button></div>'
            + '</details>'
            + '</div>'

            + '<div class="adr048-tabs">'
            + '<button id="adr044-tab-emotion" type="button" class="' + (st.activeTab === "plot" || st.activeTab === "cd" ? "" : "active") + '">情感导演</button>'
            + '<button id="adr044-tab-plot" type="button" class="' + (st.activeTab === "plot" ? "active" : "") + '">统筹</button>'
            + '<button id="adr044-tab-cd" type="button" class="' + (st.activeTab === "cd" ? "active" : "") + '">🎴 抽卡</button>'
            + '</div>'

            + adr048PageHTML("emotion")
            + adr048PageHTML("plot")
            + adrCd048PageHTML()
            + '</div>'
            + '</div>'
            + '</div>';
    }


    function adr048CreatePopupPanel() {
        try {
            var d = rootDoc();
            if (!d) return;

            var old = d.querySelector("#adr048-popup-panel");
            if (old) return;

            var wrap = d.createElement("div");
            wrap.innerHTML = adr048PanelHTML();
            var panel = wrap.firstChild;

            (d.body || d.documentElement).appendChild(panel);

            adr048BindPopupPanel();
            bindDirect();
        } catch (e) {
            console.error("[ADR0483] create popup panel failed", e);
        }
    }


    function adr048OpenPopupPanel() {
        try { switchTab(settings().activeTab || "emotion"); adrDRefreshAllFieldsFromSettings(); } catch (eOpenRefresh) {}

        try {
            var d = rootDoc();

            // 每次打开浮窗前重建面板，避免抽屉/浮窗两套 DOM 不同步。
            try {
                var oldPanel = d.querySelector("#adr048-popup-panel");
                if (oldPanel && oldPanel.parentNode) oldPanel.parentNode.removeChild(oldPanel);
            } catch (e0) {}

            adr048CreatePopupPanel();
            setTimeout(adrDBindCompactTemplateControls, 120);
            setTimeout(adrDBindApiProfileControls, 120);
            adrDRefreshAllFieldsFromSettings();

            var p = d.querySelector("#adr048-popup-panel");
            var shell = d.querySelector("#adr048-popup-shell");
            var body = d.querySelector("#adr048-popup-body");

            if (!p || !shell) {
                try { alert("暗河红霞面板壳未创建成功"); } catch (_) {}
                return;
            }

            p.setAttribute("data-open", "1");

            adr048SetImportant(p, "display", "block");
            adr048SetImportant(p, "visibility", "visible");
            adr048SetImportant(p, "opacity", "1");
            adr048SetImportant(p, "pointer-events", "auto");
            adr048SetImportant(p, "position", "fixed");
            adr048SetImportant(p, "left", "0");
            adr048SetImportant(p, "right", "0");
            adr048SetImportant(p, "top", "0");
            adr048SetImportant(p, "bottom", "0");
            adr048SetImportant(p, "width", "100vw");
            adr048SetImportant(p, "height", "100vh");
            adr048SetImportant(p, "z-index", "2147483646");
            adr048SetImportant(p, "background", "rgba(0,0,0,.25)");

            adr048SetImportant(shell, "display", "flex");
            adr048SetImportant(shell, "flex-direction", "column");
            adr048SetImportant(shell, "visibility", "visible");
            adr048SetImportant(shell, "opacity", "1");
            adr048SetImportant(shell, "pointer-events", "auto");
            adr048SetImportant(shell, "position", "fixed");
            adr048SetImportant(shell, "left", "10px");
            adr048SetImportant(shell, "right", "10px");
            adr048SetImportant(shell, "top", "64px");
            adr048SetImportant(shell, "bottom", "64px");
            adr048SetImportant(shell, "width", "auto");
            adr048SetImportant(shell, "height", "auto");
            adr048SetImportant(shell, "min-height", "360px");
            adr048SetImportant(shell, "max-height", "calc(100vh - 128px)");
            adr048SetImportant(shell, "z-index", "2147483647");
            adr048SetImportant(shell, "overflow", "hidden");
            adr048SetImportant(shell, "background", "rgba(42,52,67,.98)");
            adr048SetImportant(shell, "color", "#f2f2f2");
            adr048SetImportant(shell, "border", "1px solid rgba(255,255,255,.18)");
            adr048SetImportant(shell, "border-radius", "14px");
            adr048SetImportant(shell, "box-shadow", "0 14px 42px rgba(0,0,0,.48)");

            if (body) {
                adr048SetImportant(body, "display", "block");
                adr048SetImportant(body, "visibility", "visible");
                adr048SetImportant(body, "opacity", "1");
                adr048SetImportant(body, "flex", "1 1 auto");
                adr048SetImportant(body, "overflow", "auto");
                adr048SetImportant(body, "-webkit-overflow-scrolling", "touch");
                adr048SetImportant(body, "padding", "10px 12px 16px");
                adr048SetImportant(body, "min-height", "260px");
            }

            adr048ApplyPanelTheme();
            adr048BindPopupPanel();
            bindDirect();
            adrDRestorePanelRuntimeState();

            try { if (body) body.scrollTop = 0; } catch (e1) {}
        } catch (e) {
            console.error("[ADR0483] open popup failed", e);
            try { alert("暗河红霞面板打开失败：" + (e.message || String(e))); } catch (_) {}
        }
    }

    function adr048ClosePopupPanel() {
        try {
            // 关闭浮窗前先强制同步一次表单，避免移动端输入框/长文本框的 debounced save 尚未落盘。
            try {
                syncAll();
                adrDSaveLocalBackup(settings());
                saveNow();
            } catch (eSaveBeforeClose) {}

            var p = rootDoc().querySelector("#adr048-popup-panel");
            if (!p) return;
            p.setAttribute("data-open", "0");
            adr048SetImportant(p, "display", "none");
            adr048SetImportant(p, "visibility", "hidden");
            adr048SetImportant(p, "opacity", "0");
            adr048SetImportant(p, "pointer-events", "none");
        } catch (e) {}
    }

    // v1.14.4 开灯：浮窗双主题应用器。仅换皮不动逻辑；
    // 打开浮窗与点灯时各调一次，把 open 流程里的内联 !important 深色按主题重刷，
    // 其余配色交给 style.css 的 [data-arb-theme="dawn"] 级联。
    function adr048ApplyPanelTheme() {
        try {
            var d = rootDoc();
            var p = d.querySelector("#adr048-popup-panel");
            if (!p) return;
            var dawn = settings().dawnTheme === true;
            p.setAttribute("data-arb-theme", dawn ? "dawn" : "dusk");

            if (p.getAttribute("data-open") === "1") {
                adr048SetImportant(p, "background", dawn ? "rgba(228,207,224,.40)" : "rgba(0,0,0,.25)");
            }

            var shell = d.querySelector("#adr048-popup-shell");
            if (shell) {
                adr048SetImportant(shell, "background", dawn
                    ? "linear-gradient(172deg, #FBF3F6 0%, #F2F1F7 44%, #ECF0F6 100%)"
                    : "rgba(42,52,67,.98)");
                adr048SetImportant(shell, "color", dawn ? "#404D62" : "#f2f2f2");
                adr048SetImportant(shell, "border", dawn
                    ? "1px solid rgba(116,136,162,.30)"
                    : "1px solid rgba(255,255,255,.18)");
                adr048SetImportant(shell, "box-shadow", dawn
                    ? "0 18px 48px rgba(84,100,124,.20), 0 0 0 1px rgba(255,255,255,.55)"
                    : "0 14px 42px rgba(0,0,0,.48)");
            }

            var tg = d.querySelector("#adr048-theme-toggle");
            if (tg) tg.textContent = dawn ? "☀️" : "🌙";
        } catch (e) {}
    }

    function adr048BindPopupPanel() {
        try {
            var d = rootDoc();

            var themeBtn = d.querySelector("#adr048-theme-toggle");
            if (themeBtn && !themeBtn.__adr048Bound) {
                themeBtn.__adr048Bound = true;
                var adr048FlipTheme = function (ev) {
                    try { ev.preventDefault(); ev.stopPropagation(); } catch (e) {}
                    try {
                        save("dawnTheme", settings().dawnTheme !== true);
                        saveNow();
                        adr048ApplyPanelTheme();
                    } catch (e2) {}
                };
                themeBtn.addEventListener("click", adr048FlipTheme, true);
                themeBtn.addEventListener("touchend", adr048FlipTheme, true);
            }

            var close = d.querySelector("#adr048-popup-close");
            if (close && !close.__adr048Bound) {
                close.__adr048Bound = true;
                close.addEventListener("click", function (ev) {
                    try { ev.preventDefault(); ev.stopPropagation(); } catch (e) {}
                    adr048ClosePopupPanel();
                }, true);
                close.addEventListener("touchend", function (ev) {
                    try { ev.preventDefault(); ev.stopPropagation(); } catch (e) {}
                    adr048ClosePopupPanel();
                }, true);
            }
        } catch (e) {}
    }

    function adr048RemoveOldFloatingBits(forceAll) {
        try {
            var d = rootDoc();
            var old = d.querySelectorAll("#adr048-fab");
            for (var i = 0; i < old.length; i++) {
                try {
                    if (forceAll || old[i].getAttribute("data-adr048-owned-fab") === ADR048_FAB_INSTANCE_ID) old[i].remove();
                } catch (e) {}
            }
        } catch (e2) {}
    }

    function adr048SetImportant(el, key, value) {
        try { el.style.setProperty(key, value, "important"); }
        catch(e) { try { el.style[key] = value; } catch(_) {} }
    }



    function adr048RemoveFab() {
        try {
            var d = rootDoc();
            var list = d.querySelectorAll("#adr048-fab");
            for (var i = 0; i < list.length; i++) {
                try { if (list[i].parentNode) list[i].parentNode.removeChild(list[i]); } catch (e) {}
            }
        } catch (e) {}
    }

    function adr048InstallFabOwner() {
        try {
            var w = rootWin();
            var old = w[ADR048_FAB_REGISTRY_KEY];
            if (old && old.instanceId !== ADR048_FAB_INSTANCE_ID && typeof old.stop === "function") {
                try { old.stop(); } catch (e) {}
            }
            w[ADR048_FAB_REGISTRY_KEY] = {
                instanceId: ADR048_FAB_INSTANCE_ID,
                stop: function () {
                    try {
                        if (w.__adr0481AnchorTimer) {
                            clearInterval(w.__adr0481AnchorTimer);
                            w.__adr0481AnchorTimer = null;
                        }
                        if (w.__adr048FabObserver) {
                            try { w.__adr048FabObserver.disconnect(); } catch (e0) {}
                            w.__adr048FabObserver = null;
                        }
                    } catch (e) {}
                    try { adr048RemoveFab(); } catch (e2) {}
                }
            };
        } catch (e3) {}
    }

    function adr048GetFabSavedPosition() {
        try {
            var st = settings();
            var left = Number(st.fabLeft);
            var top = Number(st.fabTop);
            if (Number.isFinite(left) && Number.isFinite(top)) return { left: left, top: top };
        } catch (e) {}
        return null;
    }

    function adr048ClampPoint(left, top, width, height) {
        try {
            var w = rootWin() || window;
            var vw = Number(w.innerWidth) || 360;
            var vh = Number(w.innerHeight) || 640;
            width = Number(width) || 78;
            height = Number(height) || 32;
            return {
                left: Math.max(4, Math.min(vw - width - 4, Number(left) || 0)),
                top: Math.max(4, Math.min(vh - height - 4, Number(top) || 0))
            };
        } catch (e) {
            return { left: Number(left) || 12, top: Number(top) || 148 };
        }
    }

    function adr048ApplyFabPosition(btn, pos, isSaved) {
        try {
            if (!btn) return;
            if (pos && Number.isFinite(Number(pos.left)) && Number.isFinite(Number(pos.top))) {
                var fixed = isSaved ? adr048ClampPoint(Number(pos.left), Number(pos.top), 78, 32) : pos;
                adr048SetImportant(btn, "left", Math.round(fixed.left) + "px");
                adr048SetImportant(btn, "top", Math.round(fixed.top) + "px");
                adr048SetImportant(btn, "right", "auto");
                adr048SetImportant(btn, "bottom", "auto");
                btn.setAttribute("data-user-moved", "1");
                return;
            }
            adr048SetImportant(btn, "left", "auto");
            adr048SetImportant(btn, "top", "auto");
            adr048SetImportant(btn, "right", "12px");
            adr048SetImportant(btn, "bottom", "148px");
        } catch (e) {}
    }

    function adr048SaveFabPosition(btn) {
        try {
            if (!btn) return;
            var r = btn.getBoundingClientRect();
            if (!r || r.width <= 0 || r.height <= 0) return;
            var pos = adr048ClampPoint(r.left, r.top, r.width, r.height);
            save("fabLeft", Math.round(pos.left));
            save("fabTop", Math.round(pos.top));
            try { adrDSaveLocalBackup(settings()); } catch (e0) {}
        } catch (e) {}
    }

    function adr048ShouldShowFab() {
        try {
            return settings().showFloatingWindow !== false;
        } catch (e) {
            return true;
        }
    }

    function adr048CreateFab() {
        try {
            var d = rootDoc();
            if (!d) return;

            if (!adr048ShouldShowFab()) {
                adr048RemoveFab();
                return;
            }

            var btn = d.querySelector("#adr048-fab");
            if (btn) return;

            btn = d.createElement("button");
            btn.id = "adr048-fab";
            btn.setAttribute("data-adr048-owned-fab", ADR048_FAB_INSTANCE_ID);
            btn.type = "button";
            /* 砚蓝入胭雾 · SVG 胶囊皮肤（按钮外壳透明，视觉全由 SVG 承担） */
            btn.innerHTML = '<svg viewBox="0 0 120 44" xmlns="http://www.w3.org/2000/svg" aria-label="ARB" style="height:100%;width:auto;display:block;pointer-events:none"><defs><linearGradient id="pkARB-bg" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#404D62"/><stop offset="55%" stop-color="#A2AFC4"/><stop offset="100%" stop-color="#E4C8D0"/></linearGradient><linearGradient id="pkARB-river" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#E4C8D0"/><stop offset="100%" stop-color="#404D62"/></linearGradient></defs><rect x="1" y="1" width="118" height="42" rx="21" fill="url(#pkARB-bg)"/><text x="60" y="22" text-anchor="middle" font-size="15.5" font-weight="700" fill="#F7ECF1" letter-spacing="3" font-family="-apple-system,sans-serif">ARB</text><path d="M12 32 C 32 26 48 37 66 30 C 84 24 98 32 108 27" fill="none" stroke="url(#pkARB-river)" stroke-width="2.4" stroke-linecap="round" opacity="0.9"/><path d="M12 32 C 32 26 48 37 66 30 C 84 24 98 32 108 27" fill="none" stroke="#FFF3F7" stroke-width="1.2" stroke-linecap="round" stroke-dasharray="5 96" opacity="0.95"><animate attributeName="stroke-dashoffset" values="101;0" dur="4.5s" repeatCount="indefinite"/></path></svg>';
            btn.title = "Arrebol D 小红霞";
            btn.setAttribute("aria-label", "Arrebol D 小红霞");

            function setImp(k, v) { adr048SetImportant(btn, k, v); }
            setImp("position", "fixed");
            setImp("z-index", "2147483647");
            setImp("display", "inline-flex");
            setImp("align-items", "center");
            setImp("justify-content", "center");
            setImp("width", "auto");
            setImp("height", "28px");
            setImp("min-width", "auto");
            setImp("min-height", "28px");
            setImp("padding", "0");
            setImp("border-radius", "999px");
            setImp("border", "none");
            setImp("background", "transparent");
            setImp("backdrop-filter", "none");
            setImp("-webkit-backdrop-filter", "none");
            setImp("color", "rgba(64, 77, 98, .88)");
            setImp("-webkit-text-fill-color", "rgba(64, 77, 98, .88)");
            setImp("font-size", "13px");
            setImp("font-weight", "800");
            setImp("line-height", "28px");
            btn.style.boxShadow = "none"; /* 不带 important：给脉冲动画让路 */
            setImp("filter", "drop-shadow(0 4px 10px rgba(64,77,98,.30))");
            setImp("cursor", "grab");
            setImp("pointer-events", "auto");
            setImp("user-select", "none");
            setImp("-webkit-user-select", "none");
            setImp("touch-action", "none");
            setImp("white-space", "nowrap");
            setImp("visibility", "visible");
            setImp("opacity", "1");
            setImp("transform", "translateZ(0)");
            btn.setAttribute("data-anchor", "own-lazy-fixed");

            (d.body || d.documentElement).appendChild(btn);
            adr048ApplyFabPosition(btn, adr048GetFabSavedPosition(), true);

            var dragging = false;
            var moved = false;
            var sx = 0, sy = 0, sl = 0, st = 0;

            function point(ev) {
                if (ev.touches && ev.touches.length) return { x: ev.touches[0].clientX, y: ev.touches[0].clientY };
                if (ev.changedTouches && ev.changedTouches.length) return { x: ev.changedTouches[0].clientX, y: ev.changedTouches[0].clientY };
                return { x: ev.clientX || 0, y: ev.clientY || 0 };
            }

            function startDrag(ev) {
                var p = point(ev);
                var r = btn.getBoundingClientRect();
                dragging = true;
                moved = false;
                sx = p.x; sy = p.y; sl = r.left; st = r.top;
                setImp("cursor", "grabbing");
                try { ev.preventDefault(); ev.stopPropagation(); } catch(e) {}
            }

            function moveDrag(ev) {
                if (!dragging) return;
                var p = point(ev);
                var dx = p.x - sx;
                var dy = p.y - sy;
                if (Math.abs(dx) + Math.abs(dy) > 10) moved = true;
                var r = btn.getBoundingClientRect();
                var pos = adr048ClampPoint(sl + dx, st + dy, r.width || 78, r.height || 32);
                setImp("left", Math.round(pos.left) + "px");
                setImp("top", Math.round(pos.top) + "px");
                setImp("right", "auto");
                setImp("bottom", "auto");
                btn.setAttribute("data-user-moved", "1");
                try { ev.preventDefault(); ev.stopPropagation(); } catch(e) {}
            }

            function endDrag(ev) {
                if (!dragging) return;
                dragging = false;
                setImp("cursor", "grab");
                if (moved) {
                    adr048SaveFabPosition(btn);
                } else {
                    setTimeout(function () {
                        try { adr048OpenPopupPanel(); } catch (e) { console.error(e); }
                    }, 30);
                }
                try { ev.preventDefault(); ev.stopPropagation(); } catch(e) {}
            }

            btn.addEventListener("mousedown", startDrag, { passive: false });
            btn.addEventListener("touchstart", startDrag, { passive: false });
            d.addEventListener("mousemove", moveDrag, { passive: false });
            d.addEventListener("mouseup", endDrag, { passive: false });
            d.addEventListener("touchmove", moveDrag, { passive: false });
            d.addEventListener("touchend", endDrag, { passive: false });
            d.addEventListener("touchcancel", endDrag, { passive: false });

            function hardOpen(ev) {
                try { ev.preventDefault(); ev.stopPropagation(); } catch(e) {}
                setTimeout(function () {
                    try { adr048OpenPopupPanel(); } catch (e2) { console.error(e2); }
                }, 20);
                return false;
            }
            btn.onclick = hardOpen;
            btn.addEventListener("click", hardOpen, true);
        } catch (e2) {
            console.error("[ADR0481] create lazy fab failed", e2);
        }
    }

    function adr048EnsureFabLater() {
        adr048InstallFabOwner();
        adr048CreatePopupPanel();
        setTimeout(adrDBindCompactTemplateControls, 120);
        setTimeout(adrDBindApiProfileControls, 120);
        if (!adr048ShouldShowFab()) {
            adr048RemoveFab();
            return;
        }
        adr048CreateFab();
        setTimeout(adr048CreateFab, 400);
        setTimeout(adr048CreateFab, 900);
        setTimeout(adr048CreateFab, 1600);
        setTimeout(adr048CreateFab, 2600);
        setTimeout(adr048CreateFab, 4200);

        try {
            var w = rootWin();
            var d = rootDoc();
            if (!w.__adr048FabObserver && typeof MutationObserver === "function" && d && d.body) {
                var pending = false;
                w.__adr048FabObserver = new MutationObserver(function () {
                    if (pending) return;
                    pending = true;
                    setTimeout(function () {
                        pending = false;
                        try {
                            if (adr048ShouldShowFab() && !d.querySelector("#adr048-fab")) adr048CreateFab();
                        } catch (e) {}
                    }, 120);
                });
                w.__adr048FabObserver.observe(d.body, { childList: true, subtree: true });
            }
        } catch (e2) {}
    }



    var adrDAutoTriggerTimer = null;
    var adrDLastChatLengthSeen = -1;
    var adrDAutoTriggerRunning = false;
    // v1.0.5.6.8.3.5：页面加载后短安全期。自动触发可以读数/对齐，但绝不生成注入，堵住 iOS 刷新抢跑竞态。
    // v1.0.5.6.8.3.6：启动安全期内彻底只读，不创建/覆盖 baseline，避免面板刷新把 1/30 写成 0/30。
    // v1.0.5.6.8.3.9：partial 小读数保护 + 自动触发吞触发修复。角色总数只应单调增加；count < base 一律视作未加载全，不允许下拉 baseline。
    var ADR_D_AUTO_STARTUP_GRACE_MS = 20000;
    var adrDAutoScriptLoadedAt = Date.now();

    function adrDInStartupAutoGrace() {
        return Date.now() - adrDAutoScriptLoadedAt < ADR_D_AUTO_STARTUP_GRACE_MS;
    }

    function adrDChatKey() {
        try {
            var c = ctx();
            if (typeof c.getCurrentChatId === "function") {
                var x = c.getCurrentChatId();
                if (x) return String(x);
            }
            if (c.chatId) return String(c.chatId);
            return String(c.characterId || "char") + "::" + String(c.name1 || "chat");
        } catch (e) {
            return "unknown-chat";
        }
    }


    function adrDIsUnstableChatKey(key) {
        var k = String(key || "");
        if (!k) return true;
        if (k === "unknown-chat") return true;
        if (k === "char::chat") return true;
        if (k.indexOf("undefined") >= 0) return true;
        if (k.indexOf("null") >= 0) return true;
        return false;
    }

    function adrDChatKeyReady() {
        try {
            var c = ctx();
            if (typeof c.getCurrentChatId === "function") {
                var x = c.getCurrentChatId();
                return !!x && !adrDIsUnstableChatKey(String(x));
            }
            if (c.chatId) return !adrDIsUnstableChatKey(String(c.chatId));
            // 旧环境没有稳定 chat-id API 时，只能使用原 fallback key，保持兼容。
            return true;
        } catch (e) {
            return false;
        }
    }

    // v1.0.5.6.8.3：自动触发计数“换眼睛”。
    // 计数公式仍然是 count - baseline；只把 count 的读取源从当前前端窗口，优先换成 TavernHelper 全量历史。
    // v1.0.5.6.8.3.1：全量计数粘滞保护。成功取得过一次全量后，瞬时失败不再回退窗口计数，避免 source 抖动清空进度。
    // v1.0.5.6.8.3.2：冷启动闸门。有 TavernHelper 全量能力时，首次全量成功前不触发、不写 baseline，避免刷新冷窗口误触发。
    // v1.0.5.6.8.3.3：首次被动判定安全网，发现脏 baseline 只对齐不注入。
    // v1.0.5.6.8.3.5：chatKey 稳定前不落盘/不触发；启动 20 秒内禁自动注入；注入落点只允许助手楼。
    var ADR_D_FULL_COUNT_MODE = "full-chat-v1";
    var ADR_D_STICKY_FULL = true;
    // v1.9.31：per-chat count isolation。缓存记住自己属于哪个 chatKey；
    // 换聊天后旧缓存一律视为"未就绪"，粘滞保护只在同一聊天内生效，
    // 杜绝"旧聊天的 count 给新聊天写 baseline"的跨聊天污染。
    var adrDFullCountCache = { count: null, source: "window", lastMessageId: -1, updatedAt: 0, loading: false, messages: [], everFull: false, chatKey: "" };

    function adrDFullCacheMatchesCurrentChat() {
        try {
            return !!adrDFullCountCache.chatKey && adrDFullCountCache.chatKey === (adrDChatKey ? adrDChatKey() : "");
        } catch (e) {
            return false;
        }
    }

    function adrDGetTavernHelper() {
        try { if (typeof TavernHelper !== "undefined" && TavernHelper) return TavernHelper; } catch (e0) {}
        try { var rw = rootWin(); if (rw && rw.TavernHelper) return rw.TavernHelper; } catch (e1) {}
        try { if (window.parent && window.parent.TavernHelper) return window.parent.TavernHelper; } catch (e2) {}
        return null;
    }

    function adrDWindowAssistantRoundCount() {
        var chat;
        try { chat = ctx().chat; } catch (e) { return 0; }
        if (!chat || !chat.length) return 0;

        var n = 0;
        for (var i = 0; i < chat.length; i++) {
            var m = chat[i];
            if (!m || m.is_system || m.is_user) continue;
            // v1.13.2：与全量口径同拍——数楼不数字，渲染文本清空不影响节奏。
            n++;
        }
        return n;
    }

    function adrDCountOneFullHistoryMessage(m) {
        if (!m) return 0;

        var role = String(m.role || "").toLowerCase();
        var isUser = m.is_user === true || role === "user";
        if (isUser) return 0;

        // 真 system 通知一般没有角色名；隐藏助手楼层可能被标记为 system，但仍带 name / message。
        // 为了让“小幽灵/隐藏楼层”也进入真实角色回复数，只有“role=system 且无 name”才跳过。
        if (role === "system" && !m.name) return 0;

        // v1.13.2：数楼不数字。楼层存在即计数，不再看当前渲染文本是否为空——
        // 预设正则/美化脚本随时可能把某些楼的展示文本清空或还原，开关一扳口径就横跳，
        // 导演会把口径跳变误当"到点"。节奏跟着楼走，不跟着渲染走。
        return 1;
    }

    async function adrDRefreshFullAssistantRoundCount(reason) {
        // v1.9.31：粘滞保护按 chatKey 收窄。只有"同一聊天内的瞬时失败"才允许沿用旧全量数；
        // 换了聊天后旧缓存一律作废，宁可短暂回退窗口计数，也不把上一个聊天的总数带过来。
        var keyNow = adrDChatKey ? adrDChatKey() : "";
        var stickyOk = ADR_D_STICKY_FULL && adrDFullCountCache.everFull &&
            Number.isFinite(Number(adrDFullCountCache.count)) &&
            adrDFullCountCache.chatKey === keyNow;

        if (adrDFullCountCache.loading) {
            if (stickyOk) return Number(adrDFullCountCache.count) || 0;
            return adrDWindowAssistantRoundCount();
        }

        var th = adrDGetTavernHelper();
        if (!th || typeof th.getChatMessages !== "function") {
            if (stickyOk) {
                try { console.warn("[Arrebol D] full history source temporarily unavailable; keep sticky full cache", reason || ""); } catch (eStickyLog0) {}
                adrDFullCountCache.updatedAt = Date.now();
                return Number(adrDFullCountCache.count) || 0;
            }
            adrDFullCountCache.count = adrDWindowAssistantRoundCount();
            adrDFullCountCache.source = "window";
            adrDFullCountCache.chatKey = keyNow;
            try { adrDFullCountCache.messages = (ctx().chat || []).slice(); } catch (eMsgs0) { adrDFullCountCache.messages = []; }
            adrDFullCountCache.updatedAt = Date.now();
            return adrDFullCountCache.count;
        }

        adrDFullCountCache.loading = true;
        try {
            var lastId;
            if (typeof th.getLastMessageId === "function") {
                lastId = Number(th.getLastMessageId());
            } else {
                try { lastId = (ctx().chat || []).length - 1; } catch (e0) { lastId = -1; }
            }

            if (!Number.isFinite(lastId) || lastId < 0) {
                adrDFullCountCache.count = 0;
                adrDFullCountCache.source = "full";
                adrDFullCountCache.lastMessageId = -1;
                adrDFullCountCache.messages = [];
                adrDFullCountCache.everFull = true;
                adrDFullCountCache.chatKey = keyNow;
                adrDFullCountCache.updatedAt = Date.now();
                return 0;
            }

            var messages = await th.getChatMessages("0-" + lastId, { include_swipes: false });
            if (!Array.isArray(messages)) messages = [];
            adrDFullCountCache.messages = messages;

            var n = 0;
            for (var i = 0; i < messages.length; i++) {
                n += adrDCountOneFullHistoryMessage(messages[i]);
            }

            adrDFullCountCache.count = n;
            adrDFullCountCache.source = "full";
            adrDFullCountCache.lastMessageId = lastId;
            adrDFullCountCache.everFull = true;
            adrDFullCountCache.chatKey = keyNow;
            adrDFullCountCache.updatedAt = Date.now();
            try { console.log("[Arrebol D] full history count", n, "lastId=", lastId, "chatKey=", keyNow, "reason=", reason || ""); } catch (eLog) {}
            return n;
        } catch (e) {
            if (stickyOk) {
                console.warn("[Arrebol D] full history count failed; keep sticky full cache", e);
                adrDFullCountCache.updatedAt = Date.now();
                return Number(adrDFullCountCache.count) || 0;
            }
            console.warn("[Arrebol D] full history count failed; fallback to window count", e);
            adrDFullCountCache.count = adrDWindowAssistantRoundCount();
            adrDFullCountCache.source = "window";
            adrDFullCountCache.chatKey = keyNow;
            try { adrDFullCountCache.messages = (ctx().chat || []).slice(); } catch (eMsgs0) { adrDFullCountCache.messages = []; }
            adrDFullCountCache.updatedAt = Date.now();
            return adrDFullCountCache.count;
        } finally {
            adrDFullCountCache.loading = false;
        }
    }

    function adrDQueueFullAssistantRoundCountRefresh(reason) {
        try {
            adrDRefreshFullAssistantRoundCount(reason || "queued").then(function () {
                try { adrDUpdateAutoCounters(); } catch (e) {}
            });
        } catch (e) {}
    }

    async function adrDGetFullChatMessagesForRead(reason) {
        var th = adrDGetTavernHelper();
        if (th && typeof th.getChatMessages === "function") {
            var lastId = -1;
            try {
                if (typeof th.getLastMessageId === "function") lastId = Number(th.getLastMessageId());
            } catch (e0) {}

            var hasFreshFullCache = adrDFullCountCache &&
                adrDFullCountCache.source === "full" &&
                adrDFullCacheMatchesCurrentChat() &&
                Array.isArray(adrDFullCountCache.messages) &&
                adrDFullCountCache.messages.length &&
                (lastId < 0 || Number(adrDFullCountCache.lastMessageId) === lastId);

            if (!hasFreshFullCache) {
                await adrDRefreshFullAssistantRoundCount(reason || "full-read");
            }

            if (adrDFullCountCache && adrDFullCountCache.source === "full" && adrDFullCacheMatchesCurrentChat() && Array.isArray(adrDFullCountCache.messages)) {
                return adrDFullCountCache.messages;
            }
        }

        // v1.9.31：粘滞兜底同样必须同 chatKey，绝不把上一个聊天的楼层喂给导演。
        if (ADR_D_STICKY_FULL && adrDFullCountCache && adrDFullCountCache.everFull && adrDFullCacheMatchesCurrentChat() && Array.isArray(adrDFullCountCache.messages)) {
            return adrDFullCountCache.messages;
        }
        try { return (ctx().chat || []).slice(); } catch (e1) { return []; }
    }

    function adrDAssistantRoundCount() {
        // 同步入口保留：UI/旧函数可继续调用。优先返回全量缓存；未就绪/换聊天后回退当前窗口并异步刷新。
        if (adrDFullCountCache && adrDFullCountCache.source === "full" && adrDFullCacheMatchesCurrentChat() && Number.isFinite(Number(adrDFullCountCache.count))) {
            return Number(adrDFullCountCache.count);
        }
        adrDQueueFullAssistantRoundCountRefresh("lazy-count");
        return adrDWindowAssistantRoundCount();
    }

    function adrDCountSourceLabel() {
        try {
            if (adrDFullCountCache.source === "full" && adrDFullCacheMatchesCurrentChat()) return "全量历史";
            return "当前窗口/等待全量";
        } catch (e) {
            return "当前窗口";
        }
    }

    function adrDCurrentCountMode() {
        return adrDFullCountCache && adrDFullCountCache.source === "full" && adrDFullCacheMatchesCurrentChat() ? ADR_D_FULL_COUNT_MODE : "window-v1";
    }

    function adrDCountReady() {
        // 没有 TavernHelper 全量能力时，window 计数就是当前环境的权威来源，保持旧行为。
        var th = adrDGetTavernHelper();
        if (!th || typeof th.getChatMessages !== "function") return true;
        // 有全量能力时，必须等"当前这个聊天"的 full 成功后，才允许触发/写 baseline。
        // v1.9.31：换聊天后旧缓存不算就绪，堵住换聊瞬间用旧 count 写新聊天 baseline 的竞态。
        return !!(adrDFullCountCache && adrDFullCountCache.source === "full" && adrDFullCacheMatchesCurrentChat());
    }

    function adrDCurrentMessageTailForPoll() {
        var th = adrDGetTavernHelper();
        try {
            if (th && typeof th.getLastMessageId === "function") return Number(th.getLastMessageId()) + 1;
        } catch (e) {}
        try { return (ctx().chat || []).length || 0; } catch (e2) { return 0; }
    }


    function adrDSetCounterText(type, info) {
        try {
            var d = rootDoc();
            var id = "adr044-auto-counter-" + type;
            var html = adrDCounterHTML(info);
            var nodes = Array.prototype.slice.call(d.querySelectorAll("#" + id));
            nodes.forEach(function (el) {
                if (el) el.innerHTML = html;
            });
        } catch (e) {}
    }


    var ADR_D_AUTO_STATE_KEY = "arrebol_d_auto_trigger_state_v1";
    var ADR_D_AUTO_LAST_KEY = "arrebol_d_auto_trigger_last_key_v1";
    // v1.9.31：base 比当前全量总数高出这么多条以上，判定为历史版本的跨聊天污染，自动贴齐重记。
    // 小幅 count < base（swipe/重roll/删几楼）仍走 no-shrink 保护，不动 base。
    var ADR_D_BASE_OVERRUN_HEAL = 20;
    // v1.13.2：一次性首检守卫（adrDFirstPassiveAutoCheckDone 等）已由常任离谱差值守卫取代，遗物清除。

    function adrDIsPassiveAutoCheck(reason) {
        var r = String(reason || "");
        // 用户主动改开关/间隔/自定义间隔时，不吞掉其有意触发；其它事件/轮询/刷新均视为被动检查。
        if (/^(toggle|range|custom)-/.test(r)) return false;
        return true;
    }

    function adrDIsDirtyBaselineGap(count, base, n) {
        // v1.0.5.6.8.3.9：first-pass / startup grace 只兜“离谱脏 baseline”，不吞正常跨阈值。
        // 正常触发通常 gap == n，或最多超出少量；若超出间隔 20 条以上，才视为旧 baseline/口径迁移污染。
        if (!Number.isFinite(Number(n)) || Number(n) <= 0) return false;
        if (!Number.isFinite(Number(count)) || !Number.isFinite(Number(base))) return false;
        var gap = Number(count) - Number(base);
        if (gap < Number(n)) return false;
        return (gap - Number(n)) >= 20;
    }

    function adrDShouldAlignDirtyBaselineOnFirstPassiveCheck(type, count, base, n, reason, inStartupGrace) {
        if (!adrDIsPassiveAutoCheck(reason)) return false;
        if (!adrDIsDirtyBaselineGap(count, base, n)) return false;

        // 启动 grace 仍然可以兜脏 baseline，但不能一刀切吞正常触发。
        if (inStartupGrace) return true;

        // v1.13.2：离谱差值守卫从"每会话一次"改为常任。
        // 活人聊天不可能在两次被动检查之间凭空多出 间隔+20 楼——每条消息都会触发检查、到点即触发，
        // 差值到不了这么大。会到这么大的只有一种情况：count 口径被外部脚本/正则/隐藏楼层扳动了。
        // 旧版一次性守卫用完后，每次口径上摆都被当成正常触发，表现为"每点一下开关导演就上岗一次"。
        // API 断线期间攒下的补拍带 pending-retry 标记，放行不吞。
        if (String(reason || "").indexOf("pending-retry") >= 0) return false;
        return true;
    }

    function adrDAutoStateKeyFor(key, type) {
        return String(key || "chat") + "::" + String(type || "emotion");
    }

    // 只读读取 auto state：不创建新 key、不迁移、不落盘。
    // 用于页面刚加载的安全期，避免 UI 计数面板为了显示而把旧进度写成 0。
    function adrDPeekAutoState(type) {
        try {
            var all = adrDAutoStateAll();
            var key = adrDAutoStateKey(type);
            var item = all[key];
            if (item && typeof item === "object" && Number.isFinite(Number(item.base))) return item;

            var last = adrDAutoLastKeys();
            var lastKey = last[type];
            var prev = lastKey ? all[lastKey] : null;
            if (prev && typeof prev === "object" && Number.isFinite(Number(prev.base))) return prev;
        } catch (e) {}
        return null;
    }

    function adrDAutoBroadKey() {
        try {
            var c = ctx();
            var cid = "";
            try { cid = c.characterId != null ? String(c.characterId) : ""; } catch (e0) {}
            var cname = "";
            try { cname = c.name2 || ""; } catch (e1) {}
            try {
                if (!cname && c.characters && c.characterId != null && c.characters[c.characterId]) {
                    cname = c.characters[c.characterId].name || "";
                }
            } catch (e2) {}
            return "char::" + (cid || cname || "unknown");
        } catch (e) {
            return "char::unknown";
        }
    }

    function adrDAutoLastKeys() {
        try {
            var s = rootWin().localStorage.getItem(ADR_D_AUTO_LAST_KEY) || "{}";
            var obj = JSON.parse(s);
            return obj && typeof obj === "object" ? obj : {};
        } catch (e) {
            return {};
        }
    }

    function adrDSaveAutoLastKey(type, key) {
        try {
            var obj = adrDAutoLastKeys();
            obj[type] = String(key || "");
            rootWin().localStorage.setItem(ADR_D_AUTO_LAST_KEY, JSON.stringify(obj));
        } catch (e) {}
    }


    function adrDAutoStateAll() {
        try {
            var s = rootWin().localStorage.getItem(ADR_D_AUTO_STATE_KEY) || "{}";
            var obj = JSON.parse(s);
            return obj && typeof obj === "object" ? obj : {};
        } catch (e) {
            return {};
        }
    }

    function adrDSaveAutoStateAll(obj) {
        try {
            rootWin().localStorage.setItem(ADR_D_AUTO_STATE_KEY, JSON.stringify(obj || {}));
        } catch (e) {}
    }

    function adrDAutoStateKey(type) {
        return adrDAutoStateKeyFor(adrDChatKey ? adrDChatKey() : "chat", type);
    }

    function adrDGetAutoState(type, count) {
        if (!adrDChatKeyReady()) {
            return { base: Number(count) || 0, updatedAt: Date.now(), broad: adrDAutoBroadKey(), mode: adrDCurrentCountMode ? adrDCurrentCountMode() : "pending-chat-key", pendingChatKey: true, temporary: true };
        }
        var all = adrDAutoStateAll();
        var key = adrDAutoStateKey(type);
        var broad = adrDAutoBroadKey();
        var item = all[key];

        if (item && typeof item === "object" && Number.isFinite(Number(item.base))) {
            if (!item.broad) item.broad = broad;
            // v1.0.5.6.8.3：从窄窗口计数迁移到全量历史计数与复盘时，只校准一次 baseline。
            // 否则旧 base 很小、全量 count 很大，会导致安装后立刻误触发。
            if (adrDCurrentCountMode && adrDCurrentCountMode() === ADR_D_FULL_COUNT_MODE && item.mode !== ADR_D_FULL_COUNT_MODE) {
                var oldBaseForMode = Number(item.base);
                var currentCountForMode = Number(count) || 0;
                // 从窗口口径迁移到全量口径时，通常要贴齐当前全量 count，避免旧小 base 误触发。
                // 但如果当前 count 反而小于旧 base，说明读到了 partial 小数；这时绝不下拉 baseline。
                var migratedBase = (Number.isFinite(oldBaseForMode) && oldBaseForMode >= 0 && oldBaseForMode > currentCountForMode)
                    ? oldBaseForMode
                    : currentCountForMode;
                item = { base: migratedBase, updatedAt: Date.now(), broad: broad, mode: ADR_D_FULL_COUNT_MODE, migratedFromMode: item.mode || "window-v1" };
                all[key] = item;
                adrDSaveAutoStateAll(all);
            }
            // v1.9.31：跨聊天污染自愈。同一聊天内全量总数只增，base 不应高出 count；
            // 历史版本可能把旧聊天的大 base 写进了这个 chatKey，导致面板永远卡 0/N。
            // 仅在计数就绪（当前聊天的全量读取已成功）且高出 ADR_D_BASE_OVERRUN_HEAL 条以上时贴齐，
            // 小幅 count < base（swipe/重roll/删几楼）保持 no-shrink 不动。
            var healCount = Number(count);
            if (adrDCountReady() && Number.isFinite(healCount) && healCount >= 0 && Number(item.base) - healCount > ADR_D_BASE_OVERRUN_HEAL) {
                var healedFrom = Number(item.base);
                item = { base: healCount, updatedAt: Date.now(), broad: broad, mode: adrDCurrentCountMode ? adrDCurrentCountMode() : "window-v1", healedFromBase: healedFrom };
                all[key] = item;
                adrDSaveAutoStateAll(all);
                try { console.warn("[Arrebol D] heal cross-chat polluted baseline", { key: key, from: healedFrom, to: healCount }); } catch (eHeal) {}
            }
            adrDSaveAutoLastKey(type, key);
            return item;
        }

        // v1.0.5.6.8.1：注入后的 reload 可能导致 chatKey 改变。
        // 如果还是同一个角色卡，就迁移上一把计数状态，不重新归零。
        var last = adrDAutoLastKeys();
        var lastKey = last[type];
        var prev = lastKey ? all[lastKey] : null;
        if (prev && typeof prev === "object" && Number.isFinite(Number(prev.base))) {
            var prevBroad = prev.broad || broad;
            var prevBase = Number(prev.base);
            var c = Number(count) || 0;
            // v1.9.31：迁移加数值闸门。同一聊天内总数只增，真正的"注入后 reload 换了 chatKey"
            // 必然满足 prevBase <= 当前全量总数；若 prevBase > count，说明是同角色开了新聊天
            // （新聊天更短），此时绝不继承旧 base，让新聊天从自己的当前总数干净起步。
            if (prevBroad === broad && prevBase >= 0 && prevBase <= c) {
                // 同聊重载：chatKey 变了但还是这把对话，继承旧 base 保住进度。
                item = { base: prevBase, updatedAt: Date.now(), broad: broad, migratedFrom: lastKey, mode: adrDCurrentCountMode ? adrDCurrentCountMode() : "window-v1" };
                all[key] = item;
                adrDSaveAutoStateAll(all);
                adrDSaveAutoLastKey(type, key);
                return item;
            }
        }

        item = { base: Number(count) || 0, updatedAt: Date.now(), broad: broad, mode: adrDCurrentCountMode ? adrDCurrentCountMode() : "window-v1" };
        all[key] = item;
        adrDSaveAutoStateAll(all);
        adrDSaveAutoLastKey(type, key);
        return item;
    }

    function adrDSetAutoBaseline(type, count) {
        if (!adrDChatKeyReady()) return false;
        var all = adrDAutoStateAll();
        var key = adrDAutoStateKey(type);
        var broad = adrDAutoBroadKey();
        all[key] = { base: Number(count) || 0, updatedAt: Date.now(), broad: broad, mode: adrDCurrentCountMode ? adrDCurrentCountMode() : "window-v1" };
        adrDSaveAutoStateAll(all);
        adrDSaveAutoLastKey(type, key);
    }

    function adrDAdvanceAutoBaseline(type, count) {
        adrDSetAutoBaseline(type, count);
    }

    async function adrDCalibrateAutoBaseline(type) {
        try {
            type = type === "plot" ? "plot" : "emotion";
            if (!adrDChatKeyReady()) {
                status(type, "聊天还在加载，稍等几秒再对表", "#d6a26a");
                adrDUpdateAutoCounters();
                return false;
            }

            var count = await adrDRefreshFullAssistantRoundCount("manual-calibrate:" + type);
            if (!adrDCountReady()) {
                status(type, "全量历史还没读完，稍等几秒再对表", "#d6a26a");
                adrDUpdateAutoCounters();
                return false;
            }

            adrDSetAutoBaseline(type, count);
            try {
                var st = settings();
                st.lastAutoTriggerChatKey = adrDChatKey();
                if (type === "plot") {
                    st.lastAutoTriggerPlotCount = count;
                    st.lastAutoTriggerPlotAt = Date.now();
                } else {
                    st.lastAutoTriggerEmotionCount = count;
                    st.lastAutoTriggerEmotionAt = Date.now();
                }
                saveNow();
                adrDPersistAutoBaselineFields(st);
            } catch (ePersist) {}

            adrDUpdateAutoCounters();
            status(type, "已校准 ✓ 基准线移至 " + count + " 楼，从零开始攒", "#9bd8a6");
            adrDToast("小红霞已校准：基准线移至当前楼层");
            return true;
        } catch (e) {
            console.error("[Arrebol D] manual auto baseline calibrate failed", e);
            try { status(type === "plot" ? "plot" : "emotion", "校准失败，请稍后再试", "#d4726a"); } catch (eStatus) {}
            return false;
        }
    }

    // v1.9.32：计数条改结构化渲染。主行说人话（已攒/还差/基准线 N 楼起），
    // 视野与口径标记降为排查小字。所有拼接内容均为内部数值与固定文案，经 esc 转义。
    function adrDCounterHTML(info) {
        if (typeof info === "string") {
            return '<div class="arb-ct"><div class="arb-ct-msg">' + esc(info) + '</div></div>';
        }
        var label = esc(info.label || "");
        var tag = info.tag ? '<span class="arb-ct-tag">' + esc(info.tag) + '</span>' : '';
        if (info.state !== "ok") {
            return '<div class="arb-ct">'
                + '<div class="arb-ct-top"><span class="arb-ct-label">' + label + tag + '</span></div>'
                + '<div class="arb-ct-msg">' + esc(info.msg || "") + '</div>'
                + (info.tech ? '<div class="arb-ct-tech">' + esc(info.tech) + '</div>' : '')
                + '</div>';
        }
        var n = Math.max(1, Number(info.n) || 1);
        var passed = Math.max(0, Number(info.passed) || 0);
        var pct = Math.max(0, Math.min(100, Math.round(passed / n * 100)));
        return '<div class="arb-ct">'
            + '<div class="arb-ct-top">'
            + '<span class="arb-ct-label">' + label + tag + '</span>'
            + '<span class="arb-ct-nums"><b>' + esc(passed) + '</b><i>/' + esc(info.n) + '</i></span>'
            + '</div>'
            + '<div class="arb-ct-bar"><i style="width:' + pct + '%"></i></div>'
            + (info.graze
                ? '<div class="arb-ct-line">放养中 · 距下次接管还有 <b>' + esc(info.left) + '</b> 楼 · 基准线 <b>' + esc(info.base) + '</b> 楼起</div>'
                : '<div class="arb-ct-line">还差 <b>' + esc(info.left) + '</b> 条触发 · 基准线 <b>' + esc(info.base) + '</b> 楼起</div>')
            + '<div class="arb-ct-tech">' + esc(info.tech || "") + '</div>'
            + '</div>';
    }

    function adrDAutoCounterText(type) {
        try {
            var st = settings();
            var enabled = type === "plot" ? !!st.autoTriggerPlot : !!st.autoTriggerEmotion;
            var label = type === "plot" ? "统筹" : "情感导演";
            var count = adrDAssistantRoundCount();
            var n = autoTriggerRange(type);

            if (!adrDMasterEnabled()) {
                return { state: "off", label: label, msg: "总开关已关闭 · 一键启动后从当前进度重新计数" };
            }

            var grazing = adrDGrazeActive(type);

            if (!enabled) {
                if (grazing) return { state: "off", label: label, tag: "放养中", msg: "自动触发未开启，无换稿点可归队；点「直接分析」或「手动注入」即归队" };
                return { state: "off", label: label, msg: "自动触发未开启" };
            }

            if (!Number.isFinite(n) || n <= 0) {
                if (grazing) return { state: "off", label: label, tag: "放养中", msg: "自动触发间隔未设置，无换稿点可归队；点「直接分析」或「手动注入」即归队" };
                return { state: "off", label: label, msg: "自动触发间隔未设置" };
            }

            if (!adrDCountReady()) {
                return { state: "wait", label: label, msg: "正在读取本聊天的全量历史，暂不累积/触发…", tech: "当前读数 " + count + " · 视野 " + adrDCountSourceLabel() };
            }

            if (!adrDChatKeyReady()) {
                return { state: "wait", label: label, msg: "等待聊天标识稳定，暂不落盘/触发…", tech: "当前读数 " + count + " · 视野 " + adrDCountSourceLabel() };
            }

            if (adrDInStartupAutoGrace && adrDInStartupAutoGrace()) {
                var peek = adrDPeekAutoState(type);
                var peekBase = peek && Number.isFinite(Number(peek.base)) ? Number(peek.base) : count;
                if (!Number.isFinite(peekBase) || peekBase < 0) peekBase = count;
                // 若 count < base，多半是页面重载/楼层未加载全的 partial 小读数；显示 0，但保留 base，不下拉。
                var peekPassed = Math.max(0, count - peekBase);
                var peekLeft = Math.max(0, n - peekPassed);
                var peekMode = peek && peek.mode ? String(peek.mode) : (adrDCurrentCountMode ? adrDCurrentCountMode() : "startup-readonly");
                return { state: "ok", label: label, tag: grazing ? "放养中 · 启动保护" : "启动保护", graze: grazing, passed: peekPassed, n: n, left: peekLeft, base: peekBase, tech: "本聊天共 " + count + " 条回复 · 视野 " + adrDCountSourceLabel() + " · " + peekMode };
            }

            var state = adrDGetAutoState(type, count);
            var base = Number(state.base);
            if (!Number.isFinite(base) || base < 0) {
                base = count;
                adrDSetAutoBaseline(type, count);
            }
            // count < base 代表当前读数不可信（聊天重载/只读到一半），只显示 0，不把 baseline 拉下来。
            var passed = Math.max(0, count - base);
            var left = Math.max(0, n - passed);
            var modeText = state && state.mode ? String(state.mode) : (adrDCurrentCountMode ? adrDCurrentCountMode() : "unknown");
            return { state: "ok", label: label, tag: grazing ? "放养中" : "", graze: grazing, passed: passed, n: n, left: left, base: base, tech: "本聊天共 " + count + " 条回复 · 视野 " + adrDCountSourceLabel() + " · " + modeText };
        } catch (e) {
            return "自动触发计数：读取失败";
        }
    }

    function adrDUpdateAutoCounters() {
        try {
            adrDSetCounterText("emotion", adrDAutoCounterText("emotion"));
            adrDSetCounterText("plot", adrDAutoCounterText("plot"));
        } catch (e) {}
        try { adrCdUpdateStatusLine(); } catch (eCd) {}
    }


    function adrDShouldSchedulePendingAutoRetry() {
        // v1.9.26：楼层尾长不变时，也要给“已到 N 但失败保拍”的待触发拍子一次退避重试机会。
        // 只读检查，不创建/下拉 baseline，不参与 dirty-gap/no-shrink 数学。
        try {
            if (!adrDMasterEnabled()) return false;
            if (adrDAutoTriggerRunning || processing) return false;
            if (!adrDCountReady() || !adrDChatKeyReady()) return false;
            if (adrDInStartupAutoGrace && adrDInStartupAutoGrace()) return false;

            var st = settings();
            var count = adrDAssistantRoundCount();
            var now = Date.now();
            var types = ["emotion", "plot"];

            for (var i = 0; i < types.length; i++) {
                var type = types[i];
                var enabled = type === "plot" ? !!st.autoTriggerPlot : !!st.autoTriggerEmotion;
                if (!enabled) continue;
                var n = autoTriggerRange(type);
                if (!Number.isFinite(n) || n <= 0) continue;
                var state = adrDPeekAutoState(type);
                if (!state || !Number.isFinite(Number(state.base))) continue;
                var base = Number(state.base);
                if (count < base) continue; // partial 小读数，绝不重试。
                if (count - base < n) continue;

                var beatKey = adrDAutoBeatKey(type, count, n);
                var retry = adrDAutoRetryByBeat[beatKey];
                if (!retry || !Number.isFinite(Number(retry.nextAt)) || now >= Number(retry.nextAt)) {
                    return true;
                }
            }
        } catch (e) {}
        return false;
    }


    function adrDPersistAutoBaselineFields(source) {
        try {
            var st = source || settings();
            var backup = {};
            try { backup = adrDLoadLocalBackup ? (adrDLoadLocalBackup() || {}) : {}; } catch (e0) { backup = {}; }

            [
                "lastAutoTriggerChatKey",
                "lastAutoTriggerEmotionCount",
                "lastAutoTriggerPlotCount",
                "lastAutoTriggerAt",
                "lastAutoTriggerEmotionAt",
                "lastAutoTriggerPlotAt"
            ].forEach(function (k) {
                if (Object.prototype.hasOwnProperty.call(st, k)) backup[k] = st[k];
            });

            adrDSaveLocalBackup(backup);
            return true;
        } catch (e) {
            try { adrDSaveLocalBackup(settings()); } catch (e2) {}
            return false;
        }
    }

    function adrDResetAutoTriggerBaseline(reason) {
        try {
            var st = settings();
            var key = adrDChatKey();
            var count = adrDAssistantRoundCount();

            st.lastAutoTriggerChatKey = key;

            if (!Number.isFinite(Number(st.lastAutoTriggerEmotionCount)) || Number(st.lastAutoTriggerEmotionCount) < 0) {
                st.lastAutoTriggerEmotionCount = count;
                adrDAdvanceAutoBaseline("emotion", count);
            }
            if (!Number.isFinite(Number(st.lastAutoTriggerPlotCount)) || Number(st.lastAutoTriggerPlotCount) < 0) {
                st.lastAutoTriggerPlotCount = count;
                adrDAdvanceAutoBaseline("plot", count);
            }

            saveNow();
            adrDPersistAutoBaselineFields(st);
            adrDUpdateAutoCounters();
            console.log("[Arrebol D] auto trigger baseline", reason, key, count);
        } catch (e) {}
    }

    /* v1.16.0 生成中的楼数得着、读不着：升旗等它写完再开工，账实相符。 */
    var adrDGenStreaming = false;
    var adrDGenStreamingSince = 0;
    function adrDMarkGenStreaming(on) {
        adrDGenStreaming = !!on;
        adrDGenStreamingSince = on ? Date.now() : 0;
    }

    function adrDScheduleAutoTriggerCheck(reason) {
        try {
            if (adrDAutoTriggerTimer) clearTimeout(adrDAutoTriggerTimer);
            adrDAutoTriggerTimer = setTimeout(function () {
                adrDCheckAutoTrigger(reason || "scheduled");
            }, 4200);
        } catch (e) {}
    }

    async function adrDCheckAutoTrigger(reason) {
        if (adrDAutoTriggerRunning || processing) return;

        if (adrDGenStreaming) {
            if (Date.now() - adrDGenStreamingSince < 180000) {
                adrDScheduleAutoTriggerCheck("wait-generation");
                return;
            }
            adrDMarkGenStreaming(false); // 保险丝：3 分钟没等到结束事件，强制降旗防死锁
        }

        try {
            var st = settings();
            if (!adrDMasterEnabled()) {
                adrDUpdateAutoCounters();
                return;
            }
            if (!st.autoTriggerEmotion && !st.autoTriggerPlot && !adrCdActive()) {
                adrDUpdateAutoCounters();
                return;
            }

            var count = await adrDRefreshFullAssistantRoundCount("auto-check:" + (reason || ""));
            if (!adrDCountReady()) {
                try { console.log("[Arrebol D] auto trigger waits for first full history count", reason || ""); } catch (eReadyLog) {}
                adrDUpdateAutoCounters();
                return;
            }

            if (!adrDChatKeyReady()) {
                try { console.log("[Arrebol D] auto trigger waits for stable chat key", reason || ""); } catch (eKeyLog) {}
                adrDUpdateAutoCounters();
                return;
            }

            var inStartupGrace = adrDInStartupAutoGrace();
            // v1.0.5.6.8.3.9：启动 grace 不再作为“总开关”吞掉自动触发。
            // 真正需要静默对齐的，只应是 gap 离谱的脏 baseline；正常 gap >= N 必须继续触发。

            // v1.10.0：先投卡后导演——统筹随后盘账能看见最新一张投卡。抽卡失败不影响导演。
            try { await adrCdAutoCheck(count, reason, inStartupGrace); } catch (eCd) { try { console.warn("[抽卡小能手] 自动检查失败", eCd); } catch (eCd2) {} }

            var nEmotion = autoTriggerRange("emotion");
            var nPlot = autoTriggerRange("plot");
            var toRun = [];

            // v1.0.5.6.8.1：自动触发判断完全改用独立 auto state。
            // 情感和剧情各有自己的 baseline，互不影响。
            if (st.autoTriggerEmotion && nEmotion > 0) {
                var emotionState = adrDGetAutoState("emotion", count);
                var emotionBase = Number(emotionState.base);
                if (!Number.isFinite(emotionBase) || emotionBase < 0) {
                    emotionBase = count;
                    adrDSetAutoBaseline("emotion", count);
                }
                // 如果 count < base，说明当前可能是 partial 小读数。保住 base，不下拉；count-base 为负，自然不会触发。

                if (adrDShouldAlignDirtyBaselineOnFirstPassiveCheck("emotion", count, emotionBase, nEmotion, reason, inStartupGrace)) {
                    // 刷新/重挂载后的首次被动检查若已越阈值，视为旧 baseline 与全量 count 不一致：只对齐，不注入。
                    adrDAdvanceAutoBaseline("emotion", count);
                    st.lastAutoTriggerEmotionCount = count;
                    st.lastAutoTriggerEmotionAt = Date.now();
                    try { console.warn("[Arrebol D] align dirty emotion baseline on first passive check", { count: count, base: emotionBase, n: nEmotion, reason: reason || "" }); } catch (eFirstEmotion) {}
                } else if (count - emotionBase >= nEmotion) {
                    // v1.9.23：不要在 run() 前推进 baseline。API/网络失败时必须保留这一拍，避免失败丢拍后再罚等 N。
                    toRun.push({ type: "emotion", n: nEmotion, count: count, beatKey: adrDAutoBeatKey("emotion", count, nEmotion) });
                }
            }

            if (st.autoTriggerPlot && nPlot > 0) {
                var plotState = adrDGetAutoState("plot", count);
                var plotBase = Number(plotState.base);
                if (!Number.isFinite(plotBase) || plotBase < 0) {
                    plotBase = count;
                    adrDSetAutoBaseline("plot", count);
                }
                // 如果 count < base，说明当前可能是 partial 小读数。保住 base，不下拉；count-base 为负，自然不会触发。

                if (adrDShouldAlignDirtyBaselineOnFirstPassiveCheck("plot", count, plotBase, nPlot, reason, inStartupGrace)) {
                    // 刷新/重挂载后的首次被动检查若已越阈值，视为旧 baseline 与全量 count 不一致：只对齐，不注入。
                    adrDAdvanceAutoBaseline("plot", count);
                    st.lastAutoTriggerPlotCount = count;
                    st.lastAutoTriggerPlotAt = Date.now();
                    try { console.warn("[Arrebol D] align dirty plot baseline on first passive check", { count: count, base: plotBase, n: nPlot, reason: reason || "" }); } catch (eFirstPlot) {}
                } else if (count - plotBase >= nPlot) {
                    // v1.9.23：不要在 run() 前推进 baseline。API/网络失败时必须保留这一拍，避免失败丢拍后再罚等 N。
                    toRun.push({ type: "plot", n: nPlot, count: count, beatKey: adrDAutoBeatKey("plot", count, nPlot) });
                }
            }

            st.lastAutoTriggerChatKey = adrDChatKey();
            saveNow();
            try { adrDPersistAutoBaselineFields(st); } catch (ePersist) {}
            adrDUpdateAutoCounters();

            if (!toRun.length) return;

            // v1.14.5 补丁B：补拍静音的判定，从"是谁叫醒的"改为"这一拍真的失败过没有"。
            // 旧逻辑把轮询捡回的首次触发也当成补拍，导致导演正常跑、正常注入，却不打招呼。
            var isSilentRetry = toRun.length > 0 && toRun.every(function (itRetry) {
                var rRetry = adrDAutoRetryByBeat[itRetry && itRetry.beatKey];
                return !!(rRetry && Number(rRetry.fails) > 0);
            });
            if (!isSilentRetry && settings().showAutoTriggerPopup !== false) adrDAutoTriggerPopup(toRun, count);
            adrDAutoTriggerRunning = true;
            for (var i = 0; i < toRun.length; i++) {
                var item = toRun[i];
                var type = item.type;
                var n = item.n;
                var triggerCount = Number(item.count);
                if (!Number.isFinite(triggerCount) || triggerCount < 0) triggerCount = count;
                var beatKey = item.beatKey || adrDAutoBeatKey(type, triggerCount, n);
                var extra = "自动触发：已新增约 " + n + " 个助手正文轮次。请基于当前精准读取上下文输出下一阶段方向。";
                console.log("[Arrebol D] auto triggering", type, "reason=", reason, "count=", triggerCount, "N=", n);
                var okRun = await run(type, extra, { autoTrigger: true, beatKey: beatKey });
                if (okRun) {
                    var stAfter = settings();
                    adrDAdvanceAutoBaseline(type, triggerCount);
                    stAfter.lastAutoTriggerChatKey = adrDChatKey();
                    if (type === "plot") {
                        stAfter.lastAutoTriggerPlotCount = triggerCount;
                        stAfter.lastAutoTriggerPlotAt = Date.now();
                    } else {
                        stAfter.lastAutoTriggerEmotionCount = triggerCount;
                        stAfter.lastAutoTriggerEmotionAt = Date.now();
                    }
                    saveNow();
                    try { adrDPersistAutoBaselineFields(stAfter); } catch (ePersistAfter) {}
                    try { adrDUpdateAutoCounters(); } catch (eCountersAfter) {}
                        adrDNoteAutoRetryResult(beatKey, true);
                } else {
                    adrDNoteAutoRetryResult(beatKey, false);
                    try { console.warn("[Arrebol D] auto trigger run failed; baseline not advanced", { type: type, count: triggerCount, n: n, reason: reason || "" }); } catch (eWarnRun) {}
                }
            }
        } catch (e) {
            console.error("[Arrebol D] auto trigger check failed", e);
        }

        adrDAutoTriggerRunning = false;
        try { adrDUpdateAutoCounters(); } catch (e2) {}
    }

    // v1.16.3：删楼不罚楼。no-shrink 铁律只该防 partial 小读数，不该罚真删除。
    // 真删楼有 MESSAGE_DELETED 事件背书（轮询缩水兜底旧酒馆）：count 掉多少，基准线跟着降多少，
    // 已积累进度原地保住；partial 场景没有删除事件、轮询也不会在同会话内看到缩水，铁律照旧生效。
    function adrCdShiftBaselineDown(delta, count) {
        try {
            var state = adrCdChatState();
            var base = Number(state.lastDrawAt);
            if (!Number.isFinite(base) || base < 0) return;
            var nb = Math.min(Math.max(0, base - delta), Number(count));
            if (nb === base) return;
            state.lastDrawAt = nb;
            adrCdSaveChatState(state);
            try { console.log("[抽卡小能手] 删楼位移基准线", { from: base, to: nb, delta: delta }); } catch (eL) {}
        } catch (e) {}
    }

    function adrDShiftBaselinesDown(delta, count, reason) {
        try {
            var all = adrDAutoStateAll();
            var changed = false;
            ["emotion", "plot"].forEach(function (type) {
                var key = adrDAutoStateKey(type);
                var item = all[key];
                if (!item || typeof item !== "object" || !Number.isFinite(Number(item.base))) return;
                var oldBase = Number(item.base);
                var newBase = Math.min(Math.max(0, oldBase - delta), Number(count));
                if (newBase === oldBase) return;
                item.base = newBase;
                item.updatedAt = Date.now();
                item.deleteShifted = { from: oldBase, delta: delta, t: Date.now() };
                all[key] = item;
                changed = true;
            });
            if (changed) {
                adrDSaveAutoStateAll(all);
                try { console.log("[Arrebol D] 删楼位移基准线，进度保住不清零", { delta: delta, count: count, reason: reason || "" }); } catch (eLog) {}
            }
        } catch (e) {}
        try { adrCdShiftBaselineDown(delta, count); } catch (eCd) {}
    }

    var adrDDeleteShiftBusy = false;
    async function adrDHandlePossibleDeletion(reason) {
        if (adrDDeleteShiftBusy) return;
        adrDDeleteShiftBusy = true;
        try {
            var keyBefore = adrDChatKey ? adrDChatKey() : "";
            var th = adrDGetTavernHelper();
            var fullCapable = !!(th && typeof th.getChatMessages === "function");
            var prevOk = adrDFullCountCache &&
                adrDFullCountCache.chatKey === keyBefore &&
                Number.isFinite(Number(adrDFullCountCache.count)) &&
                (!fullCapable || adrDFullCountCache.source === "full");
            var prev = prevOk ? Number(adrDFullCountCache.count) : NaN;

            var now = await adrDRefreshFullAssistantRoundCount("delete:" + (reason || ""));

            // 换了聊天/口径未就绪/没有可信旧读数，都不做位移，只当普通刷新。
            if (!prevOk) return;
            if ((adrDChatKey ? adrDChatKey() : "") !== keyBefore) return;
            if (fullCapable && !adrDCountReady()) return;
            if (!adrDChatKeyReady()) return;

            var delta = prev - Number(now);
            if (!Number.isFinite(delta) || delta <= 0) return;
            adrDShiftBaselinesDown(delta, Number(now), reason);
        } catch (e) {
            try { console.warn("[Arrebol D] deletion shift failed", e); } catch (e2) {}
        } finally {
            adrDDeleteShiftBusy = false;
            try { adrDUpdateAutoCounters(); } catch (eC) {}
        }
    }

    function adrDInstallAutoTriggerWatchers() {
        try {
            var c = ctx();
            var es = c.eventSource;
            var types = c.event_types || c.eventTypes || {};

            function on(name) {
                try {
                    var ev = types[name];
                    if (es && ev && typeof es.on === "function") {
                        es.on(ev, function () { adrDScheduleAutoTriggerCheck(name); });
                    }
                } catch (e) {}
            }

            ["MESSAGE_RECEIVED", "MESSAGE_SENT", "GENERATION_ENDED", "CHAT_CHANGED", "CHAT_LOADED"].forEach(on);

            // v1.16.2：生成事件升降旗。酒馆的 dryRun（只组装提示词不真生成的试跑，如算 token）
            // 也会发 GENERATION_STARTED，且永远等不到 ENDED——必须无视，否则旗子卡死、自动触发罢工。
            // MESSAGE_RECEIVED 只在楼层完整落地后发射，作第二重降旗保险。
            if (es && typeof es.on === "function") {
                if (types.GENERATION_STARTED) es.on(types.GENERATION_STARTED, function (genType, genParams, dryRun) {
                    if (dryRun) return;
                    adrDMarkGenStreaming(true);
                });
                ["GENERATION_ENDED", "GENERATION_STOPPED", "MESSAGE_RECEIVED"].forEach(function (nmGen) {
                    if (types[nmGen]) es.on(types[nmGen], function () { adrDMarkGenStreaming(false); });
                });
            }

            // v1.9.34：NG 检测走 swipe 事件（数组长度只随新生成增长，来回翻页不误计）；
            // 换聊天时恢复该聊天自己的浮动指导。
            // v1.16.3：删楼事件直连位移路径。600ms 等酒馆存盘落定再读全量。
            if (es && typeof es.on === "function" && types.MESSAGE_DELETED) {
                es.on(types.MESSAGE_DELETED, function () {
                    setTimeout(function () { adrDHandlePossibleDeletion("event-message-deleted"); }, 600);
                });
            }

            if (es && typeof es.on === "function") {
                if (types.MESSAGE_SWIPED) {
                    es.on(types.MESSAGE_SWIPED, function () { setTimeout(function () { adrDCheckNg("event"); }, 400); });
                }
                if (types.CHAT_CHANGED) {
                    es.on(types.CHAT_CHANGED, function () { setTimeout(function () { adrDRestoreFloatForCurrentChat("chat-changed"); }, 900); });
                }
            }
        } catch (e) {}

        try { setTimeout(function () { adrDRestoreFloatForCurrentChat("startup"); }, 2600); } catch (eF34s) {}

        try {
            if (!rootWin().__arrebolDAutoTriggerPoll) {
                rootWin().__arrebolDAutoTriggerPoll = setInterval(function () {
                    try {
                        // v1.9.31：轮询同时盯 chatKey。楼层数碰巧相同的两个聊天也要触发换聊刷新。
                        var keyPoll = adrDChatKey ? adrDChatKey() : "";
                        var keyChangedThisTick = rootWin().__arrebolDLastChatKeySeen !== keyPoll;
                        if (keyChangedThisTick) {
                            rootWin().__arrebolDLastChatKeySeen = keyPoll;
                            adrDQueueFullAssistantRoundCountRefresh("poll-chat-key-change");
                            adrDScheduleAutoTriggerCheck("poll-chat-key-change");
                            adrDRestoreFloatForCurrentChat("poll-chat-key-change");
                        }
                        var len = adrDCurrentMessageTailForPoll();
                        if (adrDLastChatLengthSeen >= 0 && len !== adrDLastChatLengthSeen) {
                            // v1.16.3：同聊天内活会话看到楼数缩水，只可能是真删除
                            //（partial 小读数只发生在重载后，lastSeen 会先归 -1）——走位移路径保进度。
                            if (!keyChangedThisTick && len < adrDLastChatLengthSeen) {
                                adrDHandlePossibleDeletion("poll-shrink");
                            } else {
                                adrDQueueFullAssistantRoundCountRefresh("poll-tail-change");
                            }
                            adrDScheduleAutoTriggerCheck("poll-chat-length");
                        } else if (adrDShouldSchedulePendingAutoRetry()) {
                            adrDQueueFullAssistantRoundCountRefresh("poll-pending-retry");
                            adrDScheduleAutoTriggerCheck("pending-retry");
                        }
                        adrDLastChatLengthSeen = len;
                        adrDUpdateAutoCounters();
                        adrDCheckNg("poll");
                    } catch (e) {}
                }, 9000);
            }
        } catch (e2) {}

        // v1.0.5.6.8.1：页面刷新/插件重新挂载时不主动重置自动触发基线。
        // 基线只在开关/间隔改变或真正切换聊天时重置。
        setTimeout(adrDUpdateAutoCounters, 1200);
    }


    function adrDInstallTabFallbackOnly() {
        try {
            if (rootWin().__adrDTabFallbackOnlyInstalled) return;
            rootWin().__adrDTabFallbackOnlyInstalled = true;

            function findTabTarget(ev) {
                try {
                    var t = ev.target;
                    while (t && t !== rootDoc()) {
                        if (t.id === "adr044-tab-emotion" || t.id === "adr044-tab-plot") return t;
                        t = t.parentNode;
                    }
                } catch (e) {}
                return null;
            }

            function markStart(ev) {
                var hit = findTabTarget(ev);
                if (hit) adrDMarkButtonTouchStart(hit, ev);
            }

            function markMove(ev) {
                var hit = findTabTarget(ev);
                if (hit) adrDMarkButtonTouchMove(hit, ev);
            }

            function handle(ev) {
                try {
                    var hit = findTabTarget(ev);
                    if (!hit) return;
                    if (adrDShouldIgnoreButtonTap(hit, ev)) return;
                    ev.preventDefault();
                    ev.stopPropagation();
                    switchTab(hit.id === "adr044-tab-plot" ? "plot" : "emotion");
                    return false;
                } catch (e) {}
            }

            rootDoc().addEventListener("touchstart", markStart, true);
            rootDoc().addEventListener("touchmove", markMove, true);
            rootDoc().addEventListener("click", handle, true);
            rootDoc().addEventListener("touchend", handle, true);
        } catch (e2) {
            console.warn("[Arrebol D] install tab fallback failed", e2);
        }
    }


    function adrDTypeFromButtonId(id) {
        // v1.10.0：activeTab 可能是 "cd"，导演类型分发只认 emotion/plot。
        var fallback = settings().activeTab === "plot" ? "plot" : "emotion";
        if (!id) return fallback;
        if (id.indexOf("adr044-plot-") === 0 || id.indexOf("-plot") >= 0) return "plot";
        if (id.indexOf("adr044-emotion-") === 0 || id.indexOf("-emotion") >= 0) return "emotion";
        return fallback;
    }

    function adrDHandleAnyButtonId(id, btn) {
        try {
            if (!id || id.indexOf("adr044-") !== 0) return false;

            // tab 已由 tab fallback 处理，这里也兜底一次。
            if (id === "adr044-tab-emotion") {
                switchTab("emotion");
                return true;
            }
            if (id === "adr044-tab-plot") {
                switchTab("plot");
                return true;
            }

            // v1.10.0：抽卡小能手按钮全部注册进兜底表（v1.9.27 血案判例：不注册会被 450ms 防抖吞掉）。
            if (id === "adr044-tab-cd" || id.indexOf("adr044-cd-") === 0) {
                if (adrCdHandleButtonId(id, btn)) return true;
            }
            if (id === "adr044-api-profile-save-cd") { adrDSaveCurrentApiProfile("cd"); return true; }
            if (id === "adr044-api-profile-delete-cd") { adrDRequestDeleteCurrentApiProfile("cd"); return true; }

            if (id === "adr044-probe-context") {
                runContextProbe();
                return true;
            }
            if (id === "adr044-probe-content") {
                runContentProbe();
                return true;
            }
            if (id === "adr044-preview-precise") {
                runPrecisePreview();
                return true;
            }

            // v1.9.28：总开关。必须注册在兜底表里，否则重蹈模板按钮被防抖吞掉的覆辙。
            if (id === "adr044-master-toggle") {
                adrDToggleMaster();
                return true;
            }

            var type = adrDTypeFromButtonId(id);

            if (id === "adr044-" + type + "-local") {
                localTest(type);
                return true;
            }

            if (id === "adr044-" + type + "-generate") {
                adrDRequestDirectAnalysis(type, btn);
                return true;
            }

            if (id === "adr044-" + type + "-reroll") {
                adrDRequestExtraAnalysis(type, btn);
                return true;
            }

            if (id === "adr044-" + type + "-stop") {
                abortRun(type);
                return true;
            }

            if (id === "adr044-" + type + "-copy") {
                copyText(type);
                return true;
            }

            if (id === "adr044-" + type + "-load-models") {
                syncType(type);
                loadModels(type);
                return true;
            }

            if (id === "adr044-" + type + "-save") {
                adrDForceSaveSettings(type);
                status(type, "当前使用已保存 ✓", "#8ed99d");
                return true;
            }

            if (id === "adr044-api-profile-save-" + type) {
                adrDSaveCurrentApiProfile(type);
                return true;
            }


            if (id === "adr044-api-profile-delete-" + type) {
                adrDRequestDeleteCurrentApiProfile(type);
                return true;
            }

            if (id === "adr044-" + type + "-calibrate-auto") {
                adrDRequestCalibrateAutoBaseline(type);
                return true;
            }

            if (id === "adr044-" + type + "-inject") {
                adrDRequestManualInject(type, btn);
                return true;
            }

            // v1.13.0：放养按钮同样必须进兜底表，否则被 450ms 防抖吞掉。
            if (id === "adr044-" + type + "-graze") {
                adrDRequestGraze(type, btn);
                return true;
            }

            // v1.9.27：模板按钮补进兜底表。此前兜底先盖防抖时间戳、又不认识这两个 id，
            // 元素自身监听器随后被 450ms 防抖吞掉，导致按钮永久失灵。
            if (id === "adr044-template-save-" + type) {
                adrDSaveCurrentTemplate(type);
                return true;
            }

            if (id === "adr044-template-delete-" + type) {
                adrDRequestDeleteCurrentTemplate(type, btn);
                return true;
            }
        } catch (e) {
            console.error("[Arrebol D] all-button fallback failed", e);
            try {
                var t2 = id && id.indexOf("plot") >= 0 ? "plot" : "emotion";
                status(t2, "按钮执行失败：" + (e.message || e), "#d4726a");
            } catch (e2) {}
            return true;
        }

        return false;
    }

    function adrDInstallAllButtonFallback() {
        try {
            if (rootWin().__adrDAllButtonFallbackInstalled) return;
            rootWin().__adrDAllButtonFallbackInstalled = true;

            function findButtonTarget(ev) {
                try {
                    var t = ev.target;
                    while (t && t !== rootDoc()) {
                        if (t.id && t.id.indexOf("adr044-") === 0) {
                            var tag = String(t.tagName || "").toLowerCase();
                            // 输入框/选择框不拦截，否则会影响输入。
                            if (tag === "input" || tag === "textarea" || tag === "select" || tag === "option") return null;
                            return t;
                        }
                        t = t.parentNode;
                    }
                } catch (e) {}
                return null;
            }

            function markStart(ev) {
                var hit = findButtonTarget(ev);
                if (hit) adrDMarkButtonTouchStart(hit, ev);
            }

            function markMove(ev) {
                var hit = findButtonTarget(ev);
                if (hit) adrDMarkButtonTouchMove(hit, ev);
            }

            function handle(ev) {
                try {
                    var hit = findButtonTarget(ev);
                    if (!hit) return;
                    if (adrDShouldIgnoreButtonTap(hit, ev)) return;
                    var ok = adrDHandleAnyButtonId(hit.id, hit);
                    if (ok) {
                        ev.preventDefault();
                        ev.stopPropagation();
                        return false;
                    }
                } catch (e) {
                    console.warn("[Arrebol D] all-button fallback listener failed", e);
                }
            }

            rootDoc().addEventListener("touchstart", markStart, true);
            rootDoc().addEventListener("touchmove", markMove, true);
            rootDoc().addEventListener("click", handle, true);
            rootDoc().addEventListener("touchend", handle, true);
        } catch (e2) {
            console.warn("[Arrebol D] install all-button fallback failed", e2);
        }
    }

    // v1.14.5 补丁C：抽屉与浮窗共用同一套 id，两份表单会各自漂移。
    // 作者已在 adrDRefreshAllFieldsFromSettings 里用 adrDSetAllById 一次写全部同名节点；
    // 这里只是让同一件事实时发生：谁被改了，就把同名的另一份也拨成一样。
    // 纯 UI 镜像——不读设置、不写设置、不发请求、不碰用户正在操作的那个节点。
    function adrDInstallTwinMirror() {
        try {
            var d = rootDoc();
            if (!d || d.__adrDTwinMirrorInstalled) return;
            d.__adrDTwinMirrorInstalled = true;

            d.addEventListener("change", function (evTwin) {
                try {
                    var el = evTwin && evTwin.target;
                    if (!el || !el.id || el.id.indexOf("adr044-") !== 0) return;

                    var nodes = d.querySelectorAll("#" + el.id);
                    if (!nodes || nodes.length < 2) return;

                    Array.prototype.forEach.call(nodes, function (n) {
                        if (!n || n === el) return;
                        if (n.type === "checkbox" || n.type === "radio") {
                            if (n.checked !== el.checked) n.checked = el.checked;
                            return;
                        }
                        if (typeof n.value !== "string" || n.value === el.value) return;
                        // 下拉框可能两边选项不同步：设不上就原样退回，绝不把对面清空。
                        var oldVal = n.value;
                        n.value = el.value;
                        if (n.value !== el.value) n.value = oldVal;
                    });
                } catch (eTwinInner) {}
            }, true);
        } catch (eTwin) {}
    }

    function init() {
        if (initialized) return;
        initialized = true;

        try {
            settings();
            adrDInstallTwinMirror();
            mountDrawer();
            installProbeGlobals();
            installProbeDelegation();
            bindDirect();
            adrDBindCompactTemplateControls();
            adrDBindApiProfileControls();
            adrDInstallTabFallbackOnly();
            adrDInstallAllButtonFallback();
            switchTab(settings().activeTab || "emotion");
            adr048CreatePopupPanel();
            setTimeout(adrDBindCompactTemplateControls, 120);
            setTimeout(adrDBindApiProfileControls, 120);
            adr048EnsureFabLater();
            adrxInstallDrawerMemory();
            adrDInstallAutoTriggerWatchers();
            adrDQueueFullAssistantRoundCountRefresh("init");
            adrDUpdateAutoCounters();
            setTimeout(adrDUpdateAutoCounters, 800);
            setTimeout(bindDirect, 500);
            setTimeout(adrDBindCompactTemplateControls, 650);
            setTimeout(adrDBindApiProfileControls, 650);
            setTimeout(bindDirect, 1500);
            setTimeout(bindDirect, 3000);
            console.log("[ADR044] dual drawer loaded");
        } catch (e) {
            console.error("[ADR044] init failed", e);
        }
    }

    function wait() {
        if (typeof SillyTavern === "undefined" || !SillyTavern.getContext) {
            setTimeout(wait, 300);
            return;
        }

        try {
            var c = SillyTavern.getContext();
            if (c.eventSource && c.event_types && c.event_types.APP_READY) {
                c.eventSource.on(c.event_types.APP_READY, function () {
                    setTimeout(init, 100);
                });
            }
            setTimeout(init, 1800);
        } catch (e) {
            setTimeout(init, 1200);
        }
    }

    wait();
})();
