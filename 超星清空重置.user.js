// ==UserScript==
// @name         超星答题 清空重置
// @namespace    https://github.com/auto-answer
// @version      1.1
// @description  快速逐个清空所有已选选项和已填答案
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

  const btn = document.createElement('button');
  btn.textContent = '🔄';
  btn.title = '逐个清空所有答案';
  btn.style.cssText = `
    position: fixed; bottom: 20px; right: 20px; z-index: 2147483647;
    width: 44px; height: 44px; border-radius: 50%;
    background: #ef4444; color: #fff; border: none;
    font-size: 22px; cursor: pointer;
    box-shadow: 0 4px 16px rgba(239,68,68,0.5);
    transition: transform .15s;
  `;
  btn.addEventListener('mouseenter', () => { btn.style.transform = 'scale(1.15)'; });
  btn.addEventListener('mouseleave', () => { btn.style.transform = 'scale(1)'; });

  async function clearAll() {
    const qEls = document.querySelectorAll('.questionLi');
    if (!qEls.length) {
      alert('未找到题目');
      return;
    }

    btn.textContent = '⏳';
    btn.disabled = true;
    let cleared = 0;

    for (const el of qEls) {
      const dataId = el.getAttribute('data') || '';

      // 1. 清除选择题/判断题 — 点击已选中的选项来取消
      el.querySelectorAll('.answerBg').forEach(opt => {
        // 尝试各种可能的"已选中"标记
        const isChecked = opt.classList.contains('checked') ||
                          opt.classList.contains('active') ||
                          opt.classList.contains('selected') ||
                          opt.getAttribute('aria-checked') === 'true' ||
                          opt.querySelector('span.checked, span.active');
        if (isChecked) {
          // 点击取消（部分页面支持toggle）
          if (opt.onclick) {
            try { opt.onclick.call(opt, { currentTarget: opt, target: opt }); } catch(e) {}
          }
          opt.click();
          opt.classList.remove('checked', 'active', 'selected');
          cleared++;
        }
      });

      // 2. 清除 ul.mark_letter li 选中
      el.querySelectorAll('.mark_letter li').forEach(li => {
        ['checked', 'active', 'selected'].forEach(cls => {
          if (li.classList.contains(cls)) {
            li.classList.remove(cls);
            cleared++;
          }
        });
      });

      // 3. 清除单选/复选 input
      el.querySelectorAll('input[type="radio"], input[type="checkbox"]').forEach(inp => {
        if (inp.checked) {
          inp.checked = false;
          inp.dispatchEvent(new Event('change', { bubbles: true }));
          cleared++;
        }
      });

      // 4. 清除UEditor富文本编辑器内容
      el.querySelectorAll('textarea[id^="answer"]').forEach(ta => {
        if (ta.value) {
          ta.value = '';
          ta.dispatchEvent(new Event('input', { bubbles: true }));
          cleared++;
        }
        // 同时通过UEditor API清空
        const editorId = ta.id || ta.name;
        if (editorId && typeof UE !== 'undefined' && UE.getEditor) {
          try {
            const ue = UE.getEditor(editorId);
            if (ue && ue.setContent) {
              ue.setContent('');
            }
          } catch(e) {}
        }
      });

      // 5. 清除隐藏的 answerEditor textarea
      el.querySelectorAll('textarea[id^="answerEditor"]').forEach(ta => {
        if (ta.value) {
          ta.value = '';
          ta.dispatchEvent(new Event('input', { bubbles: true }));
          cleared++;
        }
      });

      await new Promise(r => setTimeout(r, 30)); // 快速逐个，避免页面卡死
    }

    btn.textContent = '🔄';
    btn.disabled = false;
    console.log('[清空重置] ✅ 已清空 ' + cleared + ' 项');
  }

  btn.addEventListener('click', clearAll);
  document.body.appendChild(btn);
})();
