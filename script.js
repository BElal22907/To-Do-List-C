'use strict';
/* ---------- Helpers ---------- */
const $ = s => document.querySelector(s);
const KEY = 'daily-planner-v1';
const CATS = { university: ['جامعة', 'fa-graduation-cap'], study: ['مذاكرة', 'fa-book-open'], personal: ['شخصي', 'fa-user'], sports: ['رياضة', 'fa-dumbbell'] };
const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const REP = { none: '', daily: 'يوميًا', weekly: 'أسبوعيًا' };
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseD = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parseD(s); d.setDate(d.getDate() + n); return iso(d); };
const esc = s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const todayISO = () => iso(new Date());

/* ---------- State & storage ---------- */
const S = { tasks: [], sel: todayISO(), filter: 'all', q: '', sound: true, speak: true, month: todayISO().slice(0, 7) };
try { Object.assign(S, JSON.parse(localStorage.getItem(KEY) || '{}'), { sel: todayISO(), filter: 'all', q: '', month: todayISO().slice(0, 7) }); } catch { }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify({ tasks: S.tasks, sound: S.sound, speak: S.speak })); } catch { } };

const tasksFor = date => S.tasks.filter(t =>
  t.date === date ||
  (t.repeat === 'daily' && date >= t.date) ||
  (t.repeat === 'weekly' && date >= t.date && parseD(date).getDay() === parseD(t.date).getDay())
).sort((a, b) => (a.start || '99').localeCompare(b.start || '99'));
const isDone = (t, date) => t.doneOn.includes(date);

/* ---------- Audio (Web Audio API, no files) ---------- */
let ac;
function tone(freqs, dur = .1, type = 'sine', vol = .08) {
  if (!S.sound) return;
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    const t0 = ac.currentTime;
    freqs.forEach((f, i) => {
      const o = ac.createOscillator(), g = ac.createGain(), t = t0 + i * dur;
      o.type = type; o.frequency.value = f;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .01);
      g.gain.exponentialRampToValueAtTime(.0001, t + dur * 2.6);
      o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur * 2.7);
    });
  } catch { }
}
const sClick = () => tone([620], .05, 'triangle', .05);
const sChime = () => tone([523, 659, 784, 1047], .09);
document.addEventListener('click', e => { if (e.target.closest('button,.day,.cell')) sClick(); });

/* ---------- UI helpers ---------- */
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2200); }

/* ---------- Rendering ---------- */
function renderWeek() {
  const d = parseD(S.sel);
  const start = addDays(S.sel, -((d.getDay() + 1) % 7)); // week starts Saturday
  $('#week').innerHTML = Array.from({ length: 7 }, (_, i) => {
    const s = addDays(start, i), dd = parseD(s);
    return `<button class="day ${s === S.sel ? 'sel' : ''} ${s === todayISO() ? 'today' : ''}" data-d="${s}"><span>${DAYS[dd.getDay()]}</span><b>${dd.getDate()}</b></button>`;
  }).join('');
}

function render() {
  const d = parseD(S.sel), all = tasksFor(S.sel);
  $('#hTitle').textContent = S.sel === todayISO() ? 'جدول اليوم' : DAYS[d.getDay()];
  $('#hSub').textContent = `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  const done = all.filter(t => isDone(t, S.sel)).length, pct = all.length ? Math.round(done / all.length * 100) : 0;
  $('#pText').textContent = all.length ? `أنجزت ${done} من ${all.length} مهام` : 'لا توجد مهام في هذا اليوم';
  $('#pPct').textContent = pct + '%'; $('#pBar').style.width = pct + '%';
  renderWeek();
  const q = S.q.trim().toLowerCase();
  const list = all.filter(t => {
    const dn = isDone(t, S.sel);
    return (S.filter === 'all' || (S.filter === 'done' ? dn : !dn)) &&
      (!q || (t.title + ' ' + t.loc + ' ' + CATS[t.cat][0]).toLowerCase().includes(q));
  });
  $('#list').innerHTML = list.length ? list.map(t => {
    const dn = isDone(t, S.sel);
    return `<article class="task ${t.pri} ${dn ? 'done' : ''}">
      <button class="chk" data-t="${t.id}" aria-label="تبديل الإنجاز"><i class="fa-solid fa-check"></i></button>
      <div class="body"><div class="tt">${esc(t.title)}</div><div class="meta">
        ${t.start ? `<span><i class="fa-regular fa-clock"></i>${t.start}${t.end ? ' - ' + t.end : ''}</span>` : ''}
        ${t.loc ? `<span><i class="fa-solid fa-location-dot"></i>${esc(t.loc)}</span>` : ''}
        <span><i class="fa-solid ${CATS[t.cat][1]}"></i>${CATS[t.cat][0]}</span>
        ${t.repeat !== 'none' ? `<span><i class="fa-solid fa-repeat"></i>${REP[t.repeat]}</span>` : ''}
      </div></div>
      <button class="del" data-x="${t.id}" aria-label="حذف"><i class="fa-regular fa-trash-can"></i></button></article>`;
  }).join('') : `<div class="empty"><i class="fa-regular fa-calendar-check"></i>${all.length ? 'لا نتائج مطابقة' : 'يومك فارغ. اضغط + أو اطلب من المساعد إضافة مهمة.'}</div>`;
  $('#btnSound').classList.toggle('off', !S.sound);
  $('#btnSound').firstElementChild.className = 'fa-solid ' + (S.sound ? 'fa-volume-high' : 'fa-volume-xmark');
  $('#btnSpeak').classList.toggle('off', !S.speak);
}

/* ---------- Task actions ---------- */
function addTask(o) {
  const t = { id: Date.now() + Math.floor(Math.random() * 999), title: o.title, cat: o.cat || 'personal', pri: o.pri || 'medium', date: o.date || S.sel, start: o.start || '', end: o.end || '', loc: o.loc || '', repeat: o.repeat || 'none', doneOn: [] };
  S.tasks.push(t); S.sel = t.date; save(); render(); return t;
}
function toggle(id) {
  const t = S.tasks.find(x => x.id === id); if (!t) return;
  const i = t.doneOn.indexOf(S.sel);
  if (i < 0) { t.doneOn.push(S.sel); sChime(); } else t.doneOn.splice(i, 1);
  save(); render();
}
function remove(id) { S.tasks = S.tasks.filter(t => t.id !== id); save(); render(); toast('تم حذف المهمة'); }

/* ---------- Month calendar ---------- */
function renderMonth() {
  const [y, m] = S.month.split('-').map(Number), first = new Date(y, m - 1, 1);
  $('#mTitle').textContent = `${MONTHS[m - 1]} ${y}`;
  $('#mHeads').innerHTML = [6, 0, 1, 2, 3, 4, 5].map(i => `<span>${DAYS[i].slice(0, 3)}</span>`).join('');
  const start = addDays(iso(first), -((first.getDay() + 1) % 7));
  $('#mGrid').innerHTML = Array.from({ length: 42 }, (_, i) => {
    const s = addDays(start, i), dd = parseD(s);
    return `<button class="cell ${dd.getMonth() !== m - 1 ? 'out' : ''} ${s === todayISO() ? 'today' : ''} ${s === S.sel ? 'sel' : ''} ${tasksFor(s).length ? 'has' : ''}" data-d="${s}">${dd.getDate()}</button>`;
  }).join('');
}
const shiftMonth = n => { const [y, m] = S.month.split('-').map(Number), d = new Date(y, m - 1 + n, 1); S.month = iso(d).slice(0, 7); renderMonth(); };

/* ---------- Backup ---------- */
function exportJSON() {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify({ tasks: S.tasks }, null, 2)], { type: 'application/json' }));
  a.download = `planner-backup-${todayISO()}.json`; a.click(); URL.revokeObjectURL(a.href); toast('تم تصدير النسخة الاحتياطية');
}
function importJSON(file) {
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result);
      if (!Array.isArray(d.tasks)) throw 0;
      S.tasks = d.tasks.filter(t => t && t.title && t.date).map(t => ({ id: t.id || Date.now() + Math.random(), title: String(t.title), cat: CATS[t.cat] ? t.cat : 'personal', pri: ['high', 'medium', 'low'].includes(t.pri) ? t.pri : 'medium', date: t.date, start: t.start || '', end: t.end || '', loc: t.loc || '', repeat: REP[t.repeat] !== undefined ? t.repeat : 'none', doneOn: Array.isArray(t.doneOn) ? t.doneOn : [] }));
      save(); render(); toast('تم استيراد المهام');
    } catch { toast('ملف غير صالح'); }
  };
  r.readAsText(file);
}

/* ---------- Arabic NLP parser ---------- */
const WD = { الاحد: 0, الاثنين: 1, الثلاثاء: 2, الاربعاء: 3, الخميس: 4, الجمعه: 5, السبت: 6 };
const norm = s => s.replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');

function parseDate(cut) {
  if (cut(/بعد\s*(?:بكر[هة]|غد)/)) return addDays(todayISO(), 2);
  if (cut(/بكره|غدا|غد(?=\s|$)/)) return addDays(todayISO(), 1);
  if (cut(/اليوم/)) return todayISO();
  const w = cut(/(?:يوم\s*)?(الاحد|الاثنين|الثلاثاء|الاربعاء|الخميس|الجمعه|السبت)/);
  if (w) { const diff = (WD[w[1]] - new Date().getDay() + 7) % 7; return addDays(todayISO(), diff || 7); }
  return null;
}
function parseTime(cut) {
  const m = cut(/(?:الساعه|ساعه)\s*(\d{1,2})(?::(\d{2}))?/); if (!m) return null;
  let h = +m[1]; const mi = m[2] || '00';
  const am = cut(/صباحا|صباح|الصبح/), pm = cut(/مساء|عصرا|العصر|ليلا|بالليل|الليل|المغرب/), noon = cut(/ظهرا|الظهر/);
  if ((pm || noon) && h < 12) h += (noon && h >= 7) ? 0 : 12;
  else if (!am && !pm && !noon && h < 7) h += 12;
  return `${pad(h % 24)}:${mi}`;
}

function runCommand(raw) {
  let o = raw.replace(/[\u064B-\u0652\u0640]/g, '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).trim();
  let n = norm(o);
  const cut = re => {
    const m = n.match(re); if (!m) return null;
    const blank = ' '.repeat(m[0].length);
    n = n.slice(0, m.index) + blank + n.slice(m.index + m[0].length);
    o = o.slice(0, m.index) + blank + o.slice(m.index + m[0].length);
    return m;
  };
  const clean = () => o.replace(/\s+/g, ' ').trim().replace(/^(في|ل|ب|لي)\s+|\s+(في|على|عند|ل)$/g, '').trim();
  const fmt = d => `${DAYS[parseD(d).getDay()]} ${parseD(d).getDate()} ${MONTHS[parseD(d).getMonth()]}`;
  const list = d => { const l = tasksFor(d); return l.length ? `مهام ${fmt(d)}:\n` + l.map(t => `• ${t.start ? t.start + ' ' : ''}${t.title}${isDone(t, d) ? ' ✓' : ''}`).join('\n') : `لا توجد مهام يوم ${fmt(d)}.`; };
  const find = (q, d) => { const k = norm(q); return k ? tasksFor(d).find(t => norm(t.title).includes(k)) : null; };

  // Delete
  if (/^\s*(احذف|امسح|شيل|ازل|الغ)/.test(n)) {
    cut(/^\s*(احذف|امسح|شيل|ازل|الغ\S*)/);
    if (/المكتمل|المنجز|المنتهي|المنتهيه|الخالص/.test(n)) {
      const c = S.tasks.filter(t => t.doneOn.length).length;
      S.tasks = S.tasks.filter(t => !t.doneOn.length); save(); render();
      return c ? `تم حذف ${c} من المهام المكتملة.` : 'لا توجد مهام مكتملة لحذفها.';
    }
    const d = parseDate(cut) || S.sel;
    if (/\b(كل|جميع)|^\s*(كل|جميع)/.test(n) || /(كل|جميع)\s/.test(n)) {
      const ids = tasksFor(d).map(t => t.id); S.tasks = S.tasks.filter(t => !ids.includes(t.id)); save(); render();
      return `تم حذف ${ids.length} مهام من ${fmt(d)}.`;
    }
    const t = find(clean().replace(/^(مهمه|محاضره)\s+/, '') || clean(), d) || find(clean(), d);
    if (!t) return 'لم أجد المهمة المطلوبة. جرّب ذكر جزء من عنوانها.';
    remove(t.id); return `تم حذف "${t.title}".`;
  }
  // Complete
  if (/^\s*(انجز|اكملت|خلصت|كملت|تم|علم)/.test(n)) {
    cut(/^\s*(انجزت|انجز|اكملت|كملت|خلصت|تم|علم)\S*/);
    const d = parseDate(cut) || S.sel, t = find(clean(), d);
    if (!t) return 'لم أجد المهمة. ما اسمها؟';
    S.sel = d; if (!isDone(t, d)) toggle(t.id); return `أحسنت! تم إنجاز "${t.title}".`;
  }
  // Add
  const hasVerb = cut(/^\s*(اضف|اضيف|اضافه|سجل|ضيف|ذكرني|انشئ)\s*(?:لي|ب)?\s*/);
  const tmpDate = parseDate(cut), time = parseTime(cut);
  if (hasVerb || time) {
    const title = clean().replace(/^(مهمه|موعد)\s+/, '');
    if (!title) return 'ما عنوان المهمة؟';
    const hi = /مهم|ضروري|عاجل/.test(n);
    const cat = /محاضر|جامع|كلي|دكتور/.test(n) ? 'university' : /ذاكر|مذاكر|ادرس|دراس|امتحان|واجب|مراجع/.test(n) ? 'study' : /رياض|تمرين|جيم|جري|مشي|سباح|كره/.test(n) ? 'sports' : 'personal';
    const start = time || '', end = time ? `${pad((+time.slice(0, 2) + 1) % 24)}:${time.slice(3)}` : '';
    const t = addTask({ title, cat, pri: hi ? 'high' : 'medium', date: tmpDate || S.sel, start, end });
    sChime();
    return `تمت إضافة "${t.title}" يوم ${fmt(t.date)}${start ? ' الساعة ' + start : ''}.`;
  }
  // Show
  const d = tmpDate || parseDate(() => null) || S.sel;
  if (/ماذا|شو|ايش|اعرض|عرض|جدول|مهام|عندي|لدي/.test(n)) { S.sel = d; render(); return list(d); }
  return 'يمكنني:\n• إضافة: "أضف محاضرة داتا ستراكشر بكره الساعة 10 صباحاً"\n• حذف: "احذف المهام المكتملة"\n• إنجاز: "أنجزت المذاكرة"\n• عرض: "ماذا لدي اليوم؟"';
}

/* ---------- Chat, voice in, voice out ---------- */
function say(text) {
  if (!S.speak || !('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/[•✓\n]/g, ' ')); u.lang = 'ar-SA'; speechSynthesis.speak(u);
}
function msg(text, who) {
  const m = document.createElement('div'); m.className = 'm ' + who; m.textContent = text;
  $('#msgs').append(m); $('#msgs').scrollTop = 1e6;
}
function handleInput(text) {
  text = text.trim(); if (!text) return;
  msg(text, 'me');
  let r; try { r = runCommand(text); } catch (e) { console.error(e); r = 'حدث خطأ، حاول مرة أخرى.'; }
  msg(r, 'bot'); say(r);
}
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec, recording = false;
function toggleMic() {
  if (!SR) { toast('المتصفح لا يدعم التعرف على الصوت. جرّب Chrome أو Safari.'); return; }
  if (recording) { rec.stop(); return; }
  rec = new SR(); rec.lang = 'ar-SA'; rec.interimResults = false; rec.maxAlternatives = 1;
  rec.onstart = () => { recording = true; $('#mic').classList.add('rec'); $('#chatIn').placeholder = 'أستمع إليك...'; };
  rec.onend = () => { recording = false; $('#mic').classList.remove('rec'); $('#chatIn').placeholder = 'اكتب أو تحدث بالعربية'; };
  rec.onerror = e => toast(e.error === 'not-allowed' ? 'اسمح للمتصفح باستخدام الميكروفون' : 'تعذّر التقاط الصوت');
  rec.onresult = e => handleInput(e.results[0][0].transcript);
  speechSynthesis.cancel(); rec.start();
}

/* ---------- Events ---------- */
$('#week').onclick = e => { const b = e.target.closest('[data-d]'); if (b) { S.sel = b.dataset.d; render(); } };
$('#list').onclick = e => {
  const c = e.target.closest('[data-t]'), x = e.target.closest('[data-x]');
  if (c) toggle(+c.dataset.t); else if (x) remove(+x.dataset.x);
};
$('#search').oninput = e => { S.q = e.target.value; render(); };
$('#filters').onclick = e => {
  const b = e.target.closest('[data-f]'); if (!b) return;
  S.filter = b.dataset.f; document.querySelectorAll('#filters button').forEach(x => x.classList.toggle('on', x === b)); render();
};
$('#btnSound').onclick = () => { S.sound = !S.sound; save(); render(); };
$('#btnSpeak').onclick = () => { S.speak = !S.speak; if (!S.speak) speechSynthesis.cancel(); save(); render(); };
$('#btnExport').onclick = exportJSON;
$('#btnImport').onclick = () => $('#fileIn').click();
$('#fileIn').onchange = e => { if (e.target.files[0]) importJSON(e.target.files[0]); e.target.value = ''; };

document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => b.closest('dialog').close());
document.querySelectorAll('dialog').forEach(d => d.addEventListener('click', e => { if (e.target === d) d.close(); }));
$('#fCat').innerHTML = Object.entries(CATS).map(([k, v]) => `<option value="${k}">${v[0]}</option>`).join('');
$('#fabAdd').onclick = () => { $('#form').reset(); $('#fDate').value = S.sel; $('#dlgTask').showModal(); };
$('#form').onsubmit = () => {
  const start = $('#fStart').value, end = $('#fEnd').value;
  addTask({ title: $('#fTitle').value.trim(), cat: $('#fCat').value, pri: $('#fPri').value, date: $('#fDate').value, start, end, loc: $('#fLoc').value.trim(), repeat: $('#fRep').value });
  sChime(); toast('تمت إضافة المهمة');
};
$('#btnMonth').onclick = () => { S.month = S.sel.slice(0, 7); renderMonth(); $('#dlgMonth').showModal(); };
$('#mPrev').onclick = () => shiftMonth(-1); $('#mNext').onclick = () => shiftMonth(1);
$('#mToday').onclick = () => { S.sel = todayISO(); render(); $('#dlgMonth').close(); };
$('#mGrid').onclick = e => { const b = e.target.closest('[data-d]'); if (b) { S.sel = b.dataset.d; render(); $('#dlgMonth').close(); } };

const chat = $('#chat');
$('#fabAi').onclick = () => {
  const open = chat.classList.toggle('open'); chat.setAttribute('aria-hidden', !open);
  if (open && !$('#msgs').children.length) msg('مرحبًا! اضغط على الميكروفون وقل مثلًا:\n"أضف محاضرة داتا ستراكشر بكره الساعة 10 صباحاً"', 'bot');
};
$('#chatX').onclick = () => { chat.classList.remove('open'); speechSynthesis.cancel(); };
$('#mic').onclick = toggleMic;
$('#chatForm').onsubmit = e => { e.preventDefault(); handleInput($('#chatIn').value); $('#chatIn').value = ''; };

render();
