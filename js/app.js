/* ================================================================
   习近平新时代中国特色社会主义思想概论 — 刷题 App
   ================================================================ */

// ====== CONFIG ======
const TYPE_LABELS = {
  single: '单选题',
  multi:  '多选题',
  tf:     '判断题'
};
const TYPE_ICONS = {
  single: '①',
  multi:  '☐',
  tf:     '✓✗'
};
const WRONG_KEY = 'xsixiang_wrong';

// ====== APP STATE ======
const state = {
  mode: 'all',          // 'all' | 'single' | 'multi' | 'tf'
  selectedChapters: new Set(),
  questionCount: 20,
  filteredQuestions: [],
  quizQuestions: [],
  currentIndex: 0,
  answers: [],
  submitted: false,
  reviewMode: false,    // true when doing wrong-question review
};

// ====== DOM REFS ======
const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ====== UTILS ======
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getChapters() {
  return [...new Set(QUESTIONS.map(q => q.chapter))].sort();
}

function filterQuestions() {
  let qs = QUESTIONS;
  if (state.mode !== 'all') {
    qs = qs.filter(q => q.type === state.mode);
  }
  if (state.selectedChapters.size > 0) {
    qs = qs.filter(q => state.selectedChapters.has(q.chapter));
  }
  return qs;
}

// ====== WRONG QUESTION STORAGE ======
function getWrongStats() {
  try {
    const raw = localStorage.getItem(WRONG_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) { return {}; }
}
function saveWrongStats(stats) {
  try { localStorage.setItem(WRONG_KEY, JSON.stringify(stats)); }
  catch (e) {}
}
function recordWrong(q) {
  const stats = getWrongStats();
  const key = q.question;
  if (stats[key]) {
    stats[key].count++;
    stats[key].time = Date.now();
  } else {
    stats[key] = { count:1, time:Date.now(), q:q };
  }
  saveWrongStats(stats);
}
function getHighFreqWrong(minCount) {
  const stats = getWrongStats();
  return Object.values(stats)
    .filter(v => v.count >= minCount)
    .sort((a,b) => b.count - a.count);
}
function clearWrongStats() {
  localStorage.removeItem(WRONG_KEY);
}

// ====== SCREEN NAVIGATION ======
function showScreen(id) {
  $$('.screen').forEach(s => s.classList.remove('active'));
  const el = $('#' + id);
  if (el) el.classList.add('active');
  window.scrollTo(0, 0);
}

// ====== HOME SCREEN ======
function initHome() {
  // Type mode buttons
  $$('.type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.mode = btn.dataset.type;
      updateAvailableCount();
    });
  });

  // Chapter grid
  const grid = $('#chapter-grid');
  const chapters = getChapters();
  state.selectedChapters = new Set(chapters); // all selected by default
  grid.innerHTML = chapters.map(c =>
    `<button class="chapter-btn selected" data-chapter="${c}">${c}</button>`
  ).join('');
  updateChapterCount();

  grid.querySelectorAll('.chapter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const ch = btn.dataset.chapter;
      if (state.selectedChapters.has(ch)) {
        state.selectedChapters.delete(ch);
        btn.classList.remove('selected');
      } else {
        state.selectedChapters.add(ch);
        btn.classList.add('selected');
      }
      updateChapterCount();
      updateAvailableCount();
    });
  });

  $('#select-all-ch').addEventListener('click', () => {
    chapters.forEach(c => state.selectedChapters.add(c));
    grid.querySelectorAll('.chapter-btn').forEach(b => b.classList.add('selected'));
    updateChapterCount();
    updateAvailableCount();
  });
  $('#deselect-all-ch').addEventListener('click', () => {
    state.selectedChapters.clear();
    grid.querySelectorAll('.chapter-btn').forEach(b => b.classList.remove('selected'));
    updateChapterCount();
    updateAvailableCount();
  });

  // Count slider
  const slider = $('#question-count');
  const display = $('#count-display');
  slider.addEventListener('input', () => {
    state.questionCount = parseInt(slider.value);
    display.textContent = `${state.questionCount} 题`;
  });

  // Start
  $('#start-btn').addEventListener('click', () => {
    const filtered = filterQuestions();
    if (filtered.length === 0) {
      alert('没有符合条件的题目，请调整筛选条件！');
      return;
    }
    state.reviewMode = false;
    state.filteredQuestions = filtered;
    const count = Math.min(state.questionCount, filtered.length);
    state.quizQuestions = shuffle(filtered).slice(0, count);
    state.currentIndex = 0;
    state.answers = [];
    state.submitted = false;
    startQuiz();
  });

  // Wrong review
  $('#review-wrong-btn').addEventListener('click', startWrongReview);
  $('#clear-wrong-btn').addEventListener('click', () => {
    if (!confirm('确定要清空所有错题记录吗？')) return;
    clearWrongStats();
    updateWrongUI();
  });

  updateAvailableCount();
  updateWrongUI();
}

function updateChapterCount() {
  const total = getChapters().length;
  $('#chapter-count').textContent = `${state.selectedChapters.size}/${total}`;
}

function updateAvailableCount() {
  const filtered = filterQuestions();
  $('#total-questions').textContent = filtered.length;
  // Breakdown
  const singles = filtered.filter(q => q.type === 'single').length;
  const multis  = filtered.filter(q => q.type === 'multi').length;
  const tfs     = filtered.filter(q => q.type === 'tf').length;
  $('#type-breakdown').textContent = `单选${singles} · 多选${multis} · 判断${tfs}`;
}

// ====== QUIZ SCREEN ======
function startQuiz() {
  showScreen('quiz-screen');
  renderQuestion();
}

function renderQuestion() {
  const q = state.quizQuestions[state.currentIndex];
  const total = state.quizQuestions.length;
  const idx = state.currentIndex + 1;

  // Progress
  $('#progress-fill').style.width = `${(state.currentIndex / total) * 100}%`;
  $('#progress-text').textContent = `${idx}/${total}`;

  // Mode badge
  let badgeText;
  if (state.reviewMode) {
    badgeText = '🔄 错题复习';
  } else if (state.mode === 'all') {
    badgeText = '📋 混合模式';
  } else {
    badgeText = TYPE_ICONS[q.type] + ' ' + TYPE_LABELS[q.type];
  }
  $('#mode-badge').textContent = badgeText;

  // Type label
  $('#type-tag').textContent = TYPE_LABELS[q.type];
  const typeTag = $('#type-tag');
  typeTag.className = 'type-tag tag-' + q.type;

  // Chapter
  $('#q-chapter').textContent = q.chapter;

  // Question text
  $('#question-text').textContent = q.question;

  // Hint for multi-select
  if (q.type === 'multi') {
    $('#multi-hint').style.display = 'block';
  } else {
    $('#multi-hint').style.display = 'none';
  }

  // Options
  const optsDiv = $('#options-container');
  optsDiv.innerHTML = '';

  if (q.type === 'tf') {
    // True/False buttons
    optsDiv.innerHTML = `
      <button class="option-btn tf-btn correct-btn" data-idx="0">
        <span class="opt-icon">✅</span> 正确
      </button>
      <button class="option-btn tf-btn wrong-btn" data-idx="1">
        <span class="opt-icon">❌</span> 错误
      </button>
    `;
  } else {
    // Multiple choice options
    const labels = q.type === 'multi' ? ['A','B','C','D','E'] : ['A','B','C','D'];
    optsDiv.innerHTML = q.options.slice(0, labels.length).map((opt, i) =>
      `<button class="option-btn" data-idx="${i}">
        <span class="opt-letter">${labels[i]}</span>
        <span class="opt-text">${opt}</span>
      </button>`
    ).join('');
  }

  // Bind option clicks
  optsDiv.querySelectorAll('.option-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (state.submitted) return;
      const idx = parseInt(btn.dataset.idx);

      if (q.type === 'multi') {
        // Toggle selection for multi
        btn.classList.toggle('selected');
      } else {
        // Single selection — deselect all, select this
        optsDiv.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
      }
    });
  });

  // Reset state
  state.submitted = false;
  $('#submit-area').style.display = 'block';
  $('#feedback-area').style.display = 'none';
}

function submitAnswer() {
  if (state.submitted) return;
  const q = state.quizQuestions[state.currentIndex];
  const optsDiv = $('#options-container');

  let selectedIndices;
  if (q.type === 'multi') {
    selectedIndices = [...optsDiv.querySelectorAll('.option-btn.selected')].map(b => parseInt(b.dataset.idx));
  } else {
    const sel = optsDiv.querySelector('.option-btn.selected');
    if (!sel) {
      shakeElement($('#submit-btn'));
      return; // require selection
    }
    selectedIndices = [parseInt(sel.dataset.idx)];
  }

  // Check correctness
  const correctSet = new Set(q.answer);
  const selectedSet = new Set(selectedIndices);
  const isCorrect = setsEqual(correctSet, selectedSet);

  state.answers.push({
    question: q,
    selected: selectedIndices,
    isCorrect: isCorrect
  });

  if (!isCorrect) {
    recordWrong(q);
  }

  state.submitted = true;
  showFeedback(isCorrect, q, selectedIndices);
}

function setsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const v of a) { if (!b.has(v)) return false; }
  return true;
}

function showFeedback(isCorrect, q, selectedIndices) {
  $('#submit-area').style.display = 'none';
  const fb = $('#feedback-area');
  fb.style.display = 'block';
  fb.className = 'feedback-area ' + (isCorrect ? 'fb-correct' : 'fb-wrong');

  if (isCorrect) {
    $('#fb-icon').textContent = '🎉';
    $('#fb-title').textContent = '回答正确！';
    $('#fb-detail').textContent = '';
  } else {
    $('#fb-icon').textContent = '😞';
    $('#fb-title').textContent = '回答错误';

    // Show correct answer
    let correctStr;
    if (q.type === 'tf') {
      correctStr = q.answer[0] === 0 ? '✅ 正确' : '❌ 错误';
    } else {
      const labels = ['A','B','C','D','E'];
      correctStr = q.answer.map(i => labels[i] + '. ' + q.options[i]).join('；');
    }
    $('#fb-detail').innerHTML = '正确答案：<strong>' + correctStr + '</strong>';
    if (q.exp) {
      $('#fb-detail').innerHTML += '<div class="exp-box">💡 ' + q.exp + '</div>';
    }
  }

  // Highlight correct/wrong options
  const optsDiv = $('#options-container');
  const allBtns = optsDiv.querySelectorAll('.option-btn');
  allBtns.forEach(btn => {
    btn.disabled = true;
    const idx = parseInt(btn.dataset.idx);
    if (q.answer.includes(idx)) {
      btn.classList.add('is-correct');
    }
    if (selectedIndices.includes(idx) && !q.answer.includes(idx)) {
      btn.classList.add('is-wrong');
    }
  });
}

function skipQuestion() {
  if (state.submitted) return;
  const q = state.quizQuestions[state.currentIndex];
  state.answers.push({
    question: q,
    selected: [],
    isCorrect: false,
    skipped: true
  });

  state.submitted = true;
  $('#submit-area').style.display = 'none';
  const fb = $('#feedback-area');
  fb.style.display = 'block';
  fb.className = 'feedback-area fb-skipped';
  $('#fb-icon').textContent = '⏭️';
  $('#fb-title').textContent = '已跳过';

  let correctStr;
  if (q.type === 'tf') {
    correctStr = q.answer[0] === 0 ? '✅ 正确' : '❌ 错误';
  } else {
    const labels = ['A','B','C','D','E'];
    correctStr = q.answer.map(i => labels[i] + '. ' + q.options[i]).join('；');
  }
  $('#fb-detail').innerHTML = '正确答案：<strong>' + correctStr + '</strong>';
  if (q.exp) {
    $('#fb-detail').innerHTML += '<div class="exp-box">💡 ' + q.exp + '</div>';
  }

  // Highlight correct on buttons
  const optsDiv = $('#options-container');
  optsDiv.querySelectorAll('.option-btn').forEach(btn => {
    btn.disabled = true;
    if (q.answer.includes(parseInt(btn.dataset.idx))) {
      btn.classList.add('is-correct');
    }
  });
}

function nextQuestion() {
  if (state.currentIndex + 1 >= state.quizQuestions.length) {
    showResult();
  } else {
    state.currentIndex++;
    state.submitted = false;
    renderQuestion();
  }
}

// ====== RESULT SCREEN ======
function showResult() {
  showScreen('result-screen');

  const total = state.answers.length;
  const correct = state.answers.filter(a => a.isCorrect).length;
  const wrong = state.answers.filter(a => !a.isCorrect && !a.skipped).length;
  const skipped = state.answers.filter(a => a.skipped).length;
  const score = total > 0 ? Math.round((correct / total) * 100) : 0;

  // Score circle
  const circle = $('#score-circle');
  const scoreNum = $('#score-number');
  scoreNum.textContent = score;
  circle.className = 'score-circle';
  if (score >= 90) { circle.classList.add('great'); scoreNum.style.color = '#10b981'; }
  else if (score >= 60) { circle.classList.add('ok'); scoreNum.style.color = '#f59e0b'; }
  else { circle.classList.add('bad'); scoreNum.style.color = '#ef4444'; }

  $('#stat-correct').textContent = correct;
  $('#stat-wrong').textContent = wrong;
  $('#stat-skipped').textContent = skipped;
  const accuracy = total - skipped > 0 ? Math.round((correct / (total - skipped)) * 100) : 0;
  $('#stat-accuracy').textContent = accuracy + '%';

  // Wrong list
  const wrongAnswers = state.answers.filter(a => !a.isCorrect);
  const wrongCard = $('#wrong-list-card');
  const wrongList = $('#wrong-list');

  if (wrongAnswers.length > 0) {
    wrongCard.style.display = 'block';
    wrongList.innerHTML = wrongAnswers.map((a, i) => {
      const q = a.question;
      let correctStr;
      if (q.type === 'tf') {
        correctStr = q.answer[0] === 0 ? '✅ 正确' : '❌ 错误';
      } else {
        const labels = ['A','B','C','D','E'];
        correctStr = q.answer.map(j => labels[j] + '. ' + q.options[j]).join('；');
      }
      let yourStr;
      if (a.skipped) {
        yourStr = '<span style="color:#f59e0b">跳过</span>';
      } else if (q.type === 'tf') {
        yourStr = a.selected[0] === 0 ? '✅ 正确' : '❌ 错误';
      } else {
        const labels = ['A','B','C','D','E'];
        yourStr = a.selected.length === 0 ? '（未选）' : a.selected.map(j => labels[j] + '. ' + q.options[j]).join('；');
      }
      return `<div class="wrong-item">
        <div class="wrong-q">${i+1}. <span class="type-tag tag-${q.type}">${TYPE_LABELS[q.type]}</span> ${q.question}</div>
        <div class="wrong-a">你的答案：${yourStr}</div>
        <div class="wrong-c">正确答案：<strong>${correctStr}</strong></div>
        ${q.exp ? '<div class="wrong-exp">💡 ' + q.exp + '</div>' : ''}
      </div>`;
    }).join('');
  } else {
    wrongCard.style.display = 'none';
  }

  // Retry wrong button
  const rwBtn = $('#retry-wrong-btn');
  if (wrongAnswers.length > 0) {
    rwBtn.style.display = 'block';
    rwBtn.onclick = () => {
      state.quizQuestions = wrongAnswers.map(a => a.question);
      state.currentIndex = 0;
      state.answers = [];
      state.submitted = false;
      startQuiz();
    };
  } else {
    rwBtn.style.display = 'none';
  }

  // Retry all
  $('#retry-all-btn').onclick = () => {
    if (state.reviewMode) {
      startWrongReview();
    } else {
      const filtered = filterQuestions();
      const count = Math.min(state.questionCount, filtered.length);
      state.quizQuestions = shuffle(filtered).slice(0, count);
      state.currentIndex = 0;
      state.answers = [];
      state.submitted = false;
      startQuiz();
    }
  };

  $('#home-btn').onclick = goHome;
}

function goHome() {
  showScreen('home-screen');
  updateAvailableCount();
  updateWrongUI();
}

// ====== WRONG REVIEW UI ======
function updateWrongUI() {
  const allWrong = getHighFreqWrong(1);
  const reviewable = getHighFreqWrong(2);

  if (allWrong.length === 0) {
    $('#wrong-count').textContent = '0';
    $('#wrong-total').textContent = '完成练习后错题将出现在这里';
    $('#wrong-top').innerHTML = '<span style="color:#94a3b8;font-size:13px">💡 答错的题会自动收集，错2次以上可开启错题复习</span>';
    const rvBtn = $('#review-wrong-btn');
    rvBtn.textContent = '🔄 错题复习';
    rvBtn.style.opacity = '0.5';
    rvBtn.disabled = true;
    $('#clear-wrong-btn').style.display = 'none';
    return;
  }

  $('#clear-wrong-btn').style.display = '';
  const totalErrors = allWrong.reduce((s, w) => s + w.count, 0);
  $('#wrong-count').textContent = reviewable.length;
  $('#wrong-total').textContent = `累计出错 ${totalErrors} 次`;

  const top5 = allWrong.slice(0, 5);
  $('#wrong-top').innerHTML = top5.map(w => {
    const shortQ = w.q.question.length > 20 ? w.q.question.slice(0,18) + '…' : w.q.question;
    return `<span class="wrong-tag">${shortQ} ×${w.count}</span>`;
  }).join('');

  const rvBtn = $('#review-wrong-btn');
  if (reviewable.length === 0) {
    rvBtn.textContent = '🔄 再错一次即可开启复习（需≥2次）';
    rvBtn.style.opacity = '0.5';
    rvBtn.disabled = true;
  } else {
    rvBtn.textContent = `🔄 错题复习（${reviewable.length}题）`;
    rvBtn.style.opacity = '1';
    rvBtn.disabled = false;
  }
}

function startWrongReview() {
  const reviewable = getHighFreqWrong(2);
  if (reviewable.length === 0) return;

  state.reviewMode = true;
  const questions = reviewable.map(w => w.q);
  const count = Math.min(20, questions.length);
  state.quizQuestions = shuffle(questions).slice(0, count);
  state.currentIndex = 0;
  state.answers = [];
  state.submitted = false;
  startQuiz();
}

// ====== SHAKE ======
function shakeElement(el) {
  el.style.animation = 'none';
  el.offsetHeight;
  el.style.animation = 'shake 0.4s ease';
}

// ====== EVENT BINDINGS ======
function initQuiz() {
  $('#submit-btn').addEventListener('click', submitAnswer);
  $('#skip-btn').addEventListener('click', skipQuestion);
  $('#next-btn').addEventListener('click', nextQuestion);
  $('#quit-btn').addEventListener('click', () => {
    if (state.answers.length > 0 && !confirm('确定要退出吗？当前进度将丢失。')) return;
    goHome();
  });
}

// ====== BOOT ======
document.addEventListener('DOMContentLoaded', () => {
  try {
    // Verify questions loaded
    if (typeof QUESTIONS === 'undefined' || QUESTIONS.length === 0) {
      document.body.innerHTML = '<div style="padding:40px;text-align:center;font-family:sans-serif"><h2>题库加载失败</h2><p>请刷新页面后重试</p></div>';
      return;
    }
    initHome();
    initQuiz();
    console.log('新思想概论刷题App已就绪，题库共' + QUESTIONS.length + '题');
  } catch (e) {
    console.error('App init error:', e);
    const footer = document.querySelector('.footer-info');
    if (footer) {
      footer.innerHTML = '<p style="color:red">初始化失败，请刷新页面后重试</p>';
    }
  }
});

// ====== PWA ======
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
