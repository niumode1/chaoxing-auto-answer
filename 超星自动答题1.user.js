// ==UserScript==
// @name         超星学习通 AI 自动答题6.17
// @namespace    https://github.com/auto-answer
// @version      1.3.0
// @description  在作业页面右侧出现AI答题面板，一键自动读题→AI分析→填入答案。支持单选、多选、填空和判断。
// @author       Auto Answer Tool
// @match        https://mooc1-api.chaoxing.com/mooc-ans/mooc2/work/dowork*
// @match        https://*.chaoxing.com/mooc-ans/*
// @match        https://mooc1-api.chaoxing.com/exam-ans/mooc2/exam/preview*
// @match        https://*.chaoxing.com/exam-ans/*
// @match        file:///*作业作答*.html
// @match        file:///*整卷预览*.html
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function () {
  'use strict';

  // ==================== 配置 ====================
  const API_URL = 'https://api.deepseek.com/chat/completions';
  const MODEL = 'deepseek-v4-pro'; // deepseek-v4-flash 或 deepseek-v4-pro
  const LS_KEY = 'cx_auto_answer_apikey';

  // ==================== 注入样式 ====================
  const style = document.createElement('style');
  style.textContent = `
    #aa-panel {
      position: fixed; top: 70px; right: 16px; z-index: 2147483647;
      width: 310px; background: #fff; border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.2);
      font: 13px/1.5 -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;
    }
    #aa-panel .aa-hd {
      background: linear-gradient(135deg,#4f46e5,#7c3aed); color:#fff;
      padding:12px 14px; border-radius:12px 12px 0 0; display:flex;
      align-items:center; justify-content:space-between; cursor:move; user-select:none;
    }
    #aa-panel .aa-hd h3 { margin:0; font-size:14px; }
    #aa-panel .aa-hd button { background:none;border:none;color:#fff;font-size:18px;cursor:pointer;padding:0 4px; }
    #aa-panel .aa-bd { padding:12px 14px; }
    #aa-panel .aa-bd label { display:block; font-size:11px; color:#64748b; margin-bottom:2px; font-weight:600; }
    #aa-panel .aa-bd input, #aa-panel .aa-bd select {
      width:100%; padding:7px 10px; border:2px solid #e2e8f0; border-radius:6px;
      font-size:13px; box-sizing:border-box; margin-bottom:8px;
    }
    #aa-panel .aa-bd input:focus, #aa-panel .aa-bd select:focus { outline:none; border-color:#818cf8; }
    #aa-panel .aa-stats { display:flex; gap:6px; margin-bottom:8px; }
    #aa-panel .aa-stats > div {
      flex:1; background:#f8fafc; border-radius:8px; padding:8px 4px; text-align:center;
    }
    #aa-panel .aa-stats .aa-num { font-size:20px; font-weight:700; color:#4f46e5; }
    #aa-panel .aa-stats .aa-lbl { font-size:10px; color:#94a3b8; }
    #aa-panel .aa-btn {
      display:block; width:100%; padding:10px; border:none; border-radius:8px;
      font-size:13px; font-weight:600; cursor:pointer; text-align:center; margin-bottom:6px; transition:all .15s;
    }
    #aa-panel .aa-btn:disabled { opacity:0.45; cursor:not-allowed; }
    #aa-panel .aa-btn-scan { background:#f0fdf4; color:#16a34a; border:2px solid #bbf7d0; }
    #aa-panel .aa-btn-scan:hover:not(:disabled) { background:#dcfce7; }
    #aa-panel .aa-btn-ai { background:#4f46e5; color:#fff; }
    #aa-panel .aa-btn-ai:hover:not(:disabled) { background:#4338ca; }
    #aa-panel .aa-btn-fill { background:#fef3c7; color:#92400e; border:2px solid #fde68a; }
    #aa-panel .aa-btn-fill:hover:not(:disabled) { background:#fef9c3; }
    #aa-panel .aa-btn-all { background:linear-gradient(135deg,#4f46e5,#7c3aed); color:#fff; font-size:14px; }
    #aa-panel .aa-btn-all:hover:not(:disabled) { opacity:0.9; transform:translateY(-1px); }
    #aa-panel .aa-msg {
      margin-top:8px; padding:8px 10px; border-radius:6px; font-size:12px; display:none;
    }
    #aa-panel .aa-msg.show { display:block; }
    #aa-panel .aa-msg.info { background:#dbeafe; color:#1e40af; }
    #aa-panel .aa-msg.ok { background:#dcfce7; color:#166534; }
    #aa-panel .aa-msg.err { background:#fee2e2; color:#991b1b; }
    #aa-panel .aa-progress {
      height:4px; background:#e2e8f0; border-radius:2px; margin:8px 0; overflow:hidden; display:none;
    }
    #aa-panel .aa-progress.on { display:block; }
    #aa-panel .aa-progress div { height:100%; background:#4f46e5; width:0%; transition:width .3s; }
    #aa-panel.aa-folded .aa-bd { display:none; }
    #aa-panel.aa-folded { width:auto; }
    #aa-float {
      position:fixed; top:70px; right:16px; z-index:2147483646;
      width:42px; height:42px; border-radius:50%;
      background:linear-gradient(135deg,#4f46e5,#7c3aed); color:#fff;
      border:none; cursor:pointer; font-size:20px;
      box-shadow:0 4px 12px rgba(79,70,229,0.4); display:none;
      align-items:center; justify-content:center;
    }
    #aa-float:hover { transform:scale(1.1); }
  `;
  document.head.appendChild(style);

  // ==================== 全局状态 ====================
  let questions = [];
  let answers = {};
  let busy = false;

  // ==================== 构建UI ====================
  const panel = document.createElement('div');
  panel.id = 'aa-panel';
  panel.innerHTML = `
    <div class="aa-hd" id="aa-hd">
      <h3>🤖 AI 自动答题</h3>
      <button id="aa-fold" title="折叠/展开">−</button>
    </div>
    <div class="aa-bd">
      <label>🔑 DeepSeek API Key</label>
      <input type="password" id="aa-apikey" placeholder="sk-...（获取: platform.deepseek.com/api_keys）">
      <label>🧠 模型</label>
      <select id="aa-model">
        <option value="deepseek-v4-flash">DeepSeek-V4-Flash（快速）</option>
        <option value="deepseek-v4-pro">DeepSeek-V4-Pro（更强）</option>
      </select>
      <div class="aa-stats">
        <div><div class="aa-num" id="aa-total">0</div><div class="aa-lbl">总题</div></div>
        <div><div class="aa-num" id="aa-ans">0</div><div class="aa-lbl">已答</div></div>
        <div><div class="aa-num" id="aa-single">0</div><div class="aa-lbl">选择/判断</div></div>
        <div><div class="aa-num" id="aa-multi">0</div><div class="aa-lbl">多选/填空</div></div>
      </div>
      <div class="aa-progress" id="aa-prog"><div></div></div>
      <button class="aa-btn aa-btn-all" id="aa-btn-all">⚡ 一键全自动（扫描→AI→填答）</button>
      <button class="aa-btn aa-btn-scan" id="aa-btn-scan">📖 步骤1: 扫描题目</button>
      <button class="aa-btn aa-btn-ai" id="aa-btn-ai" disabled>🤖 步骤2: AI 分析答题</button>
      <button class="aa-btn aa-btn-fill" id="aa-btn-fill" disabled>🖱️ 步骤3: 自动填入答案</button>
      <div class="aa-msg" id="aa-msg"></div>
    </div>
  `;
  document.body.appendChild(panel);

  // 折叠后的浮动按钮
  const floatBtn = document.createElement('button');
  floatBtn.id = 'aa-float';
  floatBtn.innerHTML = '🤖';
  floatBtn.title = '展开AI答题面板';
  document.body.appendChild(floatBtn);

  // ==================== 事件绑定 ====================
  // 恢复 API Key
  const savedKey = localStorage.getItem(LS_KEY);
  if (savedKey) document.getElementById('aa-apikey').value = savedKey;

  // 保存 API Key
  document.getElementById('aa-apikey').addEventListener('change', function () {
    localStorage.setItem(LS_KEY, this.value.trim());
  });

  // 折叠
  document.getElementById('aa-fold').addEventListener('click', function () {
    const p = document.getElementById('aa-panel');
    const f = document.getElementById('aa-float');
    p.classList.toggle('aa-folded');
    if (p.classList.contains('aa-folded')) {
      f.style.display = 'flex';
      this.textContent = '+';
    } else {
      f.style.display = 'none';
      this.textContent = '−';
    }
  });
  floatBtn.addEventListener('click', function () {
    document.getElementById('aa-panel').classList.remove('aa-folded');
    this.style.display = 'none';
    document.getElementById('aa-fold').textContent = '−';
  });

  // 扫描
  document.getElementById('aa-btn-scan').addEventListener('click', scanQuestions);

  // AI
  document.getElementById('aa-btn-ai').addEventListener('click', aiAnswer);

  // 填答
  document.getElementById('aa-btn-fill').addEventListener('click', fillAnswers);

  // 一键全自动
  document.getElementById('aa-btn-all').addEventListener('click', async function () {
    if (busy) return;
    busy = true;
    disableAll(true);
    try {
      msg('info', '🚀 全自动进行中...');
      await scanQuestions();
      if (!questions.length) throw new Error('未找到题目');
      await aiAnswer();
      if (!Object.keys(answers).length) throw new Error('未获取到AI答案');
      await fillAnswers();
      msg('ok', '🎉 全部完成！请人工核对后提交。');
    } catch (e) {
      msg('err', '❌ ' + e.message);
    } finally {
      busy = false;
      disableAll(false);
      updateBtns();
    }
  });

  // 拖拽
  makeDraggable();

  // ==================== 辅助函数 ====================
  function msg(type, text) {
    const el = document.getElementById('aa-msg');
    el.className = 'aa-msg ' + type + ' show';
    el.textContent = text;
  }

  function disableAll(v) {
    document.querySelectorAll('#aa-panel .aa-btn').forEach(b => { b.disabled = v; });
  }

  function updateBtns() {
    document.getElementById('aa-btn-scan').disabled = busy;
    document.getElementById('aa-btn-ai').disabled = busy || !questions.length;
    document.getElementById('aa-btn-fill').disabled = busy || !Object.keys(answers).length;
    document.getElementById('aa-btn-all').disabled = busy;
  }

  function updateStats() {
    document.getElementById('aa-total').textContent = questions.length;
    document.getElementById('aa-ans').textContent = Object.keys(answers).length;
    document.getElementById('aa-single').textContent = questions.filter(q => q.answertype === 0 || q.answertype === 3).length;
    document.getElementById('aa-multi').textContent = questions.filter(q => q.answertype === 1).length + questions.filter(q => q.answertype === 2).length + questions.filter(q => q.answertype >= 4).length;
  }

  function setProgress(pct) {
    const wrap = document.getElementById('aa-prog');
    const bar = wrap.querySelector('div');
    if (pct < 0) { wrap.classList.remove('on'); return; }
    wrap.classList.add('on');
    bar.style.width = Math.min(100, pct) + '%';
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  function waitFor(selector, ms = 8000) {
    return new Promise(resolve => {
      if (document.querySelector(selector)) return resolve();
      const ob = new MutationObserver(() => {
        if (document.querySelector(selector)) { ob.disconnect(); resolve(); }
      });
      ob.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => { ob.disconnect(); resolve(); }, ms);
    });
  }

  function makeDraggable() {
    const hd = document.getElementById('aa-hd');
    let ox, oy, down = false;
    hd.addEventListener('mousedown', e => {
      if (e.target.tagName === 'BUTTON') return;
      down = true;
      const r = panel.getBoundingClientRect();
      ox = e.clientX - r.left;
      oy = e.clientY - r.top;
      panel.style.transition = 'none';
      panel.style.right = 'auto';
    });
    document.addEventListener('mousemove', e => {
      if (!down) return;
      panel.style.left = (e.clientX - ox) + 'px';
      panel.style.top = (e.clientY - oy) + 'px';
    });
    document.addEventListener('mouseup', () => {
      down = false;
      panel.style.transition = '';
    });
  }

  // ==================== 步骤1: 扫描题目 ====================
  async function scanQuestions() {
    msg('info', '📖 正在扫描页面题目...');
    setProgress(10);
    questions = [];

    await waitFor('.questionLi', 5000);

    const qEls = document.querySelectorAll('.questionLi');
    if (!qEls.length) {
      msg('err', '❌ 未找到题目，请确认在作业答题页面');
      setProgress(-1);
      return;
    }

    qEls.forEach(el => {
      const qId = el.id || '';
      const dataId = el.getAttribute('data') || '';
      // 模式A: 答题页面 .questionLi 有 typename 属性
      // 模式B: 整卷预览页面 typeName 在 hidden input 中
      let typeName = el.getAttribute('typename') || '';
      if (!typeName) {
        const tnInp = el.querySelector('input[name="typeName' + dataId + '"]');
        typeName = tnInp ? (tnInp.value || '') : '';
      }

      const h3 = el.querySelector('h3.mark_name');
      let text = '';
      const images = [];  // 题目中的图片URL（供AI视觉识别）
      if (h3) {
        // 提取所有 p 标签文本（多段题干 / 嵌套 span 也能正确处理）
        const pTexts = [];
        h3.querySelectorAll('p').forEach(p => {
          const pt = (p.textContent || '').trim();
          if (pt && pt.length > 2) pTexts.push(pt);
        });
        if (pTexts.length) {
          text = pTexts.join(' ');
        } else {
          const clone = h3.cloneNode(true);
          clone.querySelectorAll('span').forEach(s => s.remove());
          text = (clone.textContent || '').replace(/^\d+\.\s*/, '').trim();
        }
        if (!text || text.length < 3) {
          text = (h3.textContent || '').replace(/^\d+\.\s*/, '').trim();
        }
        // 提取图片URL（优先 data-original，其次 src）
        h3.querySelectorAll('img').forEach(img => {
          const src = img.getAttribute('data-original') || img.src || '';
          if (src && !src.startsWith('data:') && !src.includes('saved_resource')) {
            images.push(src);
          }
        });
      }

      let answertype;
      // 模式A: 答题页面 input[id^="answertype"]
      const atInp = el.querySelector('input[id^="answertype"]');
      if (atInp) {
        answertype = parseInt(atInp.value) || 0;
      } else {
        // 模式B: 整卷预览页面 input[name="typeXXXXX"]
        const typeInp = el.querySelector('input[name="type' + dataId + '"]');
        if (typeInp) {
          answertype = parseInt(typeInp.value) || 0;
        } else {
          // 查看详情页面：从 span 文本判断题型
          const h3Span = el.querySelector('h3.mark_name span');
          const spanText = (h3Span && h3Span.textContent) || '';
          if (/多选/.test(spanText)) answertype = 1;
          else if (/填空/.test(spanText)) answertype = 2;
          else if (/判断/.test(spanText)) answertype = 3;
          else if (/计算|简答|论述/.test(spanText)) answertype = 4;
          else answertype = 0;
        }
      }

      const options = [];
      const blanks = [];  // 填空题的空白框信息

      // 模式1: 答题页面 .answerBg + aria-label
      el.querySelectorAll('.answerBg').forEach(opt => {
        const al = opt.getAttribute('aria-label') || '';
        const m = al.match(/^([A-D])\s*(.*?)选择$/);
        if (m) options.push({ letter: m[1], text: m[2].trim() });
      });
      // 模式1.5: 整卷预览页面 .answerBg 无 aria-label（letter 在子 span[data] 或 textContent）
      if (!options.length) {
        el.querySelectorAll('.answerBg').forEach(opt => {
          const span = opt.querySelector('span[data], span.saveSingleSelect');
          if (span) {
            const rawData = span.getAttribute('data') || '';
            // 判断题: data="true"→A, data="false"→B；选择题: data 就是字母
            let letter;
            if (rawData === 'true') letter = 'A';
            else if (rawData === 'false') letter = 'B';
            else letter = rawData;
            if (!letter || !/^[A-D]$/.test(letter)) {
              letter = (span.textContent || '').trim().charAt(0);
            }
            const opText = (opt.querySelector('.answer_p') || opt.querySelector('p') || opt).textContent.trim();
            if (letter && /^[A-D]$/.test(letter)) {
              options.push({ letter: letter, text: opText });
            }
          }
        });
      }
      // 模式2: 查看详情页面 ul.mark_letter > li
      if (!options.length) {
        el.querySelectorAll('.mark_letter li').forEach(opt => {
          const raw = (opt.textContent || '').trim();
          const m = raw.match(/^([A-D])[.、)\s]+(.+)/);
          if (m) options.push({ letter: m[1], text: m[2].trim() });
        });
      }
      // 模式3: 填空题 — 扫描 hidden answerEditor textarea
      // 模式4: 计算题/简答题 — answer{dataId} textarea (单个编辑器)
      if (!options.length) {
        if (answertype === 2) {
          // 模式A: 答题页面有 tiankongsize
          const tiankongSize = el.querySelector('input[name^="tiankongsize"]');
          let blankCount = tiankongSize ? parseInt(tiankongSize.value) || 1 : 0;
          // 模式B: 整卷预览页面有 blankNum（值为逗号分隔列表如 "1," 或 "1,2,"）
          if (!blankCount) {
            const blankNumInp = el.querySelector('input[name^="blankNum"]');
            if (blankNumInp) {
              const parts = (blankNumInp.value || '').split(',').filter(Boolean);
              blankCount = parts.length || 1;
              for (let i = 0; i < parts.length; i++) {
                const blankIdx = parts[i];
                const editorId = 'answerEditor' + dataId + blankIdx;
                blanks.push({ index: parseInt(blankIdx), editorId: editorId, label: '第' + blankIdx + '空' });
              }
            } else {
              blankCount = 1;
            }
          }
          // tiankongsize 模式下的循环
          if (tiankongSize || !blanks.length) {
            for (let i = 1; i <= blankCount; i++) {
              const editorId = 'answerEditor' + dataId + i;
              blanks.push({ index: i, editorId: editorId, label: '第' + i + '空' });
            }
          }
        } else if (answertype >= 4) {
          // 计算题、简答题、论述题等 — 单个编辑器
          // 模式A: 答题页面 id=answer{dataId}
          let editorId = 'answer' + dataId;
          if (document.getElementById(editorId)) {
            blanks.push({ index: 1, editorId: editorId, label: '作答区' });
          }
          // 模式B: 整卷预览 — 也可能用 answerEditor{dataId}0 等格式
          if (!blanks.length) {
            editorId = 'answerEditor' + dataId;
            if (document.getElementById(editorId)) {
              blanks.push({ index: 1, editorId: editorId, label: '作答区' });
            }
          }
        }
      }

      if (text && (options.length || (answertype >= 2 && blanks.length))) {
        questions.push({
          number: questions.length + 1,
          id: qId,
          data_id: dataId,
          type: typeName,
          answertype: answertype,
          text: text,
          options: options,
          blanks: blanks,
          images: images,
        });
      }
    });

    setProgress(-1);
    updateStats();
    updateBtns();

    if (questions.length) {
      msg('ok', `✅ 扫描完成！共 ${questions.length} 题（单选${questions.filter(q=>q.answertype===0).length} + 多选${questions.filter(q=>q.answertype===1).length} + 填空${questions.filter(q=>q.answertype===2).length} + 判断${questions.filter(q=>q.answertype===3).length} + 简答${questions.filter(q=>q.answertype>=4).length}）`);
      console.log('[自动答题] 题目:', questions.map(q => ({ n:q.number, t:q.type, text:q.text.slice(0,30), opts:q.options.map(o=>o.letter) })));
    }
  }

  // ==================== 步骤2: AI答题 ====================
  async function aiAnswer() {
    if (!questions.length) { msg('err', '❌ 请先扫描题目'); return; }

    const apiKey = document.getElementById('aa-apikey').value.trim();
    if (!apiKey || !apiKey.startsWith('sk-')) {
      msg('err', '❌ 请输入有效的 API Key（以 sk- 开头）');
      return;
    }
    localStorage.setItem(LS_KEY, apiKey);

    msg('info', '🤖 正在调用 DeepSeek API...');
    setProgress(20);
    answers = {};

    const model = document.getElementById('aa-model').value;
    const BATCH_SIZE = 20; // 每批最多20题，避免响应被截断
    const batches = [];
    for (let i = 0; i < questions.length; i += BATCH_SIZE) {
      batches.push(questions.slice(i, i + BATCH_SIZE));
    }
    if (batches.length > 1) {
      msg('info', `📦 共${questions.length}题，分${batches.length}批调用AI...`);
    }

    for (let bi = 0; bi < batches.length; bi++) {
      const batch = batches[bi];
      let prompt = '请回答以下题目。\n';
      prompt += '必须严格输出JSON数组：[{"question_id":"题目id","answer":"答案"}]\n';
      prompt += '规则：\n';
      prompt += '  - 单选题：answer填答案字母（如：A）\n';
      prompt += '  - 多选题：answer填所有正确字母（如：ABC）\n';
      prompt += '  - 判断题：answer填A(对)或B(错)\n';
      prompt += '  - 填空题：answer填文本答案，多空用 ||| 分隔（如：职能型|||矩阵型|||项目型）\n';
      prompt += '  - 计算题/简答题：answer填完整解答文本（写出过程或答案）\n\n';
      prompt += '题目列表：\n' + '─'.repeat(40) + '\n';

      // 收集本批所有图片URL
      const batchImages = [];
      batch.forEach(q => {
        const typeLabel = q.answertype === 1 ? '【多选】' : q.answertype === 2 ? '【填空】' : q.answertype === 3 ? '【判断】' : q.answertype >= 4 ? '【计算/简答】' : '【单选】';
        prompt += `\n第${q.number}题${typeLabel} ID:${q.id}\n${q.text}\n`;
        if (q.options.length) {
          q.options.forEach(o => { prompt += `  ${o.letter}. ${o.text}\n`; });
        } else if (q.answertype === 2 && q.blanks && q.blanks.length) {
          prompt += `  （共${q.blanks.length}空，答案用|||分隔）\n`;
        }
        // 标记图片
        (q.images || []).forEach(imgUrl => {
          prompt += `  [图片: ${imgUrl}]\n`;
          batchImages.push(imgUrl);
        });
      });
      prompt += '\n' + '─'.repeat(40) + '\n请输出JSON：';

      const pct = 35 + Math.round((bi / batches.length) * 45);
      setProgress(pct);

      try {
        // 纯文本模式 — 图片URL已在题干中标记，避免 vision 格式 400 错误
        const resp = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
          body: JSON.stringify({
            model: model,
            messages: [
              { role: 'system', content: '你是一个专业答题助手。必须严格按JSON数组格式输出答案。如果题目包含图片URL请尝试访问获取数据，无法获取则如实说明。输出尽量简洁，不要reasoning字段。' },
              { role: 'user', content: prompt },
            ],
            temperature: 0.1,
            max_tokens: 16384,
          }),
        });

        if (!resp.ok) {
          let errText = '';
          try { errText = await resp.text(); } catch(e) {}
          // HTTP 400 时打印请求详情方便排查
          if (resp.status === 400) {
            console.warn('[自动答题] 400 请求体:', JSON.stringify({ model: model, promptLen: prompt.length, hasImages: batchImages.length }));
          }
          throw new Error('HTTP ' + resp.status + (errText.length < 200 ? ': ' + errText : ''));
        }

        const data = await resp.json();
        const content = data.choices[0].message.content;

        // 解析JSON — 贪婪匹配整个数组
        const jm = content.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (jm) {
          try {
            JSON.parse(jm[0]).forEach(item => {
              if (item.question_id && item.answer) {
                const q = questions.find(qq => qq.id === item.question_id);
                if (q && q.answertype >= 2) {
                  answers[item.question_id] = item.answer;
                } else {
                  answers[item.question_id] = item.answer.toUpperCase().replace(/[^A-D]/g, '');
                }
              }
            });
          } catch (e) {
            console.warn('[自动答题] 第' + (bi+1) + '批JSON解析失败:', e.message);
          }
        }

        // 备用解析
        if (!jm) {
          content.split('\n').forEach(line => {
            const m = line.match(/(\d+)[\.、)\s]+([A-Da-d,，\s]+)/);
            if (m) {
              const q = questions.find(q => q.number === parseInt(m[1]));
              if (q) answers[q.id] = m[2].toUpperCase().replace(/[^A-D]/g, '');
            }
          });
        }
      } catch (e) {
        console.warn('[自动答题] 第' + (bi+1) + '批请求失败:', e.message);
      }
    }

    setProgress(-1);
    updateStats();
    updateBtns();

    if (Object.keys(answers).length) {
      msg('ok', `✅ 获得 ${Object.keys(answers).length} 道题答案`);
      console.log('[自动答题] AI答案:\n' + questions.map(q => `  ${q.number}. → ${answers[q.id]||'?'}  ${q.text.slice(0,30)}`).join('\n'));
    } else {
      msg('err', '❌ 无法解析AI返回，查看控制台');
    }
  }

  // ==================== 步骤3: 自动填答 ====================
  async function fillAnswers() {
    if (!Object.keys(answers).length) { msg('err', '❌ 没有答案可填'); return; }

    msg('info', '🖱️ 正在填入答案...');
    setProgress(10);

    let done = 0;
    const total = questions.filter(q => answers[q.id]).length;

    for (const q of questions) {
      const ans = answers[q.id];
      if (!ans) continue;

      const qEl = document.getElementById(q.id);
      if (!qEl) continue;

      // ===== 填空题 / 计算题 / 简答题填答 =====
      if (q.answertype >= 2 && q.blanks && q.blanks.length) {
        const blankAnswers = q.answertype >= 4 ? [ans] : ans.split(/\|\|\||\n/);
        for (let i = 0; i < q.blanks.length; i++) {
          const aText = (blankAnswers[i] || '').trim();
          if (!aText) continue;
          const editorId = q.blanks[i].editorId;
          let contentSet = false;
          try {
            // 方式1: 通过 UEditor API setContent
            if (typeof UE !== 'undefined' && UE.getEditor) {
              const ueditor = UE.getEditor(editorId);
              if (ueditor) {
                if (typeof ueditor.setContent === 'function') {
                  ueditor.setContent(aText);
                  contentSet = true;
                }
                // 方式1b: 直接写入编辑器 body（iframe 内的 document.body）
                if (!contentSet && ueditor.body) {
                  ueditor.body.innerHTML = aText;
                  contentSet = true;
                }
                // 触发内容变更事件
                if (contentSet) {
                  try { ueditor.fireEvent('contentChange'); } catch(e) {}
                }
              }
            }
            // 方式2: 同时设置隐藏 textarea 的值
            const ta = document.getElementById(editorId);
            if (ta) {
              ta.value = aText;
              ta.dispatchEvent(new Event('input', { bubbles: true }));
              ta.dispatchEvent(new Event('change', { bubbles: true }));
            }
          } catch (e) {
            // 纯 textarea 兜底
            try {
              const ta = document.getElementById(editorId);
              if (ta) {
                ta.value = aText;
                ta.dispatchEvent(new Event('input', { bubbles: true }));
                ta.dispatchEvent(new Event('change', { bubbles: true }));
              }
            } catch (e2) {
              console.warn('[自动答题] 填空题填入失败:', q.number, editorId, e2);
            }
          }

          // 尝试触发保存（整卷预览页面需要点击保存按钮）
          const saveSubId = editorId.replace('answerEditor', '').replace('answer', '');
          // 多模式匹配保存按钮：save_数据ID空序号 / save_数据ID / questionLi内任意save按钮
          let saveBtn = document.getElementById('save_' + saveSubId)
                     || document.getElementById('save_' + q.data_id + i)
                     || document.getElementById('save_' + q.data_id + (i + 1))
                     || document.getElementById('save_' + q.data_id);
          // 最后兜底：在题目元素内搜索id以save_开头的按钮
          if (!saveBtn) {
            const allSaves = qEl.querySelectorAll('[id^="save_"]');
            if (allSaves.length > i) saveBtn = allSaves[i];
          }
          if (saveBtn) {
            saveBtn.style.display = '';
            if (saveBtn.onclick) {
              try { saveBtn.onclick.call(saveBtn, { currentTarget: saveBtn, target: saveBtn }); } catch(e) {}
            }
            // 调用全局 saveQuestion
            if (typeof saveQuestion === 'function') {
              try { saveQuestion(q.data_id, saveSubId); } catch(e) {}
              if (saveSubId !== q.data_id) {
                try { saveQuestion(q.data_id, String(i + 1)); } catch(e) {}
              }
            }
            try { saveBtn.click(); } catch(e) {}
          } else if (typeof saveQuestion === 'function') {
            try { saveQuestion(q.data_id, saveSubId); } catch(e) {}
            try { saveQuestion(q.data_id, String(i + 1)); } catch(e) {}
          }
        }
        // 最终兜底：填完所有空后，触发题目级保存
        const finalSave = document.getElementById('save_' + q.data_id);
        if (finalSave) {
          finalSave.style.display = '';
          try { finalSave.click(); } catch(e) {}
        }
        if (typeof saveQuestion === 'function') {
          try { saveQuestion(q.data_id, q.data_id); } catch(e) {}
        }
        done++;
      } else {
        // ===== 选择题/判断题填答 =====
        const dataId = qEl.getAttribute('data') || q.data_id;
        const isMulti = q.answertype === 1;
        const letters = ans.split('').filter(l => 'ABCD'.includes(l));

        // 对于单选题，只取第一个字母（防止AI返回多个）
        const finalLetters = isMulti ? letters : letters.slice(0, 1);

        for (const letter of finalLetters) {
          // 先尝试答题页面模式: .answerBg[aria-label][qid]
          let optEl = document.querySelector(
            '.answerBg[aria-label^="' + letter + ' "][qid="' + dataId + '"]'
          );
          // 判断 aria-label 无空格格式（如"A对选择"）
          if (!optEl) {
            optEl = document.querySelector(
              '.answerBg[aria-label^="' + letter + '"][qid="' + dataId + '"]'
            );
          }

          // 找不到则尝试查看详情页面模式: questionLi 内 ul.mark_letter > li
          if (!optEl) {
            const lis = qEl.querySelectorAll('.mark_letter li');
            for (const li of lis) {
              const liText = (li.textContent || '').trim();
              const liM = liText.match(/^([A-D])[.、)\s]+/);
              if (liM && liM[1] === letter) { optEl = li; break; }
            }
          }

          // 整卷预览页面: .answerBg 无 aria-label/qid，letter 在子 span[data] 或 textContent
          if (!optEl) {
            const answerBgs = qEl.querySelectorAll('.answerBg');
            for (const bg of answerBgs) {
              const span = bg.querySelector('span[data], span.saveSingleSelect');
              if (!span) continue;
              const rawData = span.getAttribute('data') || '';
              const spanLetter = (span.textContent || '').trim().charAt(0);
              // 匹配: data 属性等于 letter, 或 textContent 首字符等于 letter
              // 判断题特殊处理: data="true"→A, data="false"→B
              if (rawData === letter ||
                  spanLetter === letter ||
                  (letter === 'A' && rawData === 'true') ||
                  (letter === 'B' && rawData === 'false')) {
                optEl = bg;
                break;
              }
            }
          }

          if (!optEl) {
            console.warn('[自动答题] 未找到选项元素:', q.number, letter, dataId);
            continue;
          }

          // ===== 关键：根据页面类型选择正确的点击方式 =====
          // 整卷预览页面：onclick 中包含 saveSingleSelect
          if (!isMulti && optEl.onclick && optEl.onclick.toString().includes('saveSingleSelect')) {
            const match = optEl.onclick.toString().match(/saveSingleSelect\(this,\s*'(\d+)'\)/);
            const qDataId = match ? match[1] : dataId;
            saveSingleSelect(optEl, qDataId);
          } else if (isMulti && typeof addMultipleChoice === 'function') {
            addMultipleChoice(optEl);
          } else if (!isMulti && typeof addChoice === 'function') {
            addChoice(optEl);
          } else if (!isMulti && typeof saveSingleSelect === 'function') {
            saveSingleSelect(optEl, dataId);
          } else {
            // 兜底：触发真实 click（调用 onclick 属性处理器）
            if (optEl.click) {
              optEl.click();
            } else {
              optEl.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
              optEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
              optEl.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
            }
            if (optEl.onclick) optEl.onclick.call(optEl, { currentTarget: optEl, target: optEl });
          }
        }

        done++;
      }
      setProgress(10 + (done / total) * 90);
      await sleep(100);
    }

    setProgress(-1);
    updateStats();
    updateBtns();
    msg('ok', `✅ 填答完成！共 ${done} 题。请人工核对后提交。`);

    // 滚动到顶部让用户看到结果
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  console.log('[自动答题] ✅ 油猴脚本已加载！页面右侧出现AI答题面板。');
})();
