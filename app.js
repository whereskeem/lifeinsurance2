const LS_KEY = "fl215_flashcards_v2";

const els = {
  categorySelect: document.getElementById("categorySelect"),
  modeSelect: document.getElementById("modeSelect"),
  shuffleToggle: document.getElementById("shuffleToggle"),
  autoAdvanceToggle: document.getElementById("autoAdvanceToggle"),
  resetBtn: document.getElementById("resetBtn"),

  progressPill: document.getElementById("progressPill"),
  correctCount: document.getElementById("correctCount"),
  incorrectCount: document.getElementById("incorrectCount"),
  accuracyPct: document.getElementById("accuracyPct"),
  missedCount: document.getElementById("missedCount"),
  flaggedCount: document.getElementById("flaggedCount"),

  categoryTag: document.getElementById("categoryTag"),
  difficultyTag: document.getElementById("difficultyTag"),
  flagBtn: document.getElementById("flagBtn"),

  questionText: document.getElementById("questionText"),
  choicesWrap: document.getElementById("choicesWrap"),

  revealWrap: document.getElementById("revealWrap"),
  answerText: document.getElementById("answerText"),
  explainText: document.getElementById("explainText"),
  refText: document.getElementById("refText"),

  backBtn: document.getElementById("backBtn"),
  nextBtn: document.getElementById("nextBtn"),
};

const ALL = window.QUESTION_BANK ?? [];

function uniq(arr){ return Array.from(new Set(arr)); }

function loadState(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(!raw) return null;
    return JSON.parse(raw);
  }catch{ return null; }
}

function saveState(state){
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

function freshState(){
  return {
    correct: 0,
    incorrect: 0,
    missedIds: [],
    flaggedIds: [],
    category: "All",
    mode: "all",
    shuffle: false,
    autoAdvance: false,
    deckOrder: [],
    idx: 0,
    history: []
  };
}

let state = loadState() ?? freshState();

function buildCategoryOptions(){
  const categories = ["All", ...uniq(ALL.map(q => q.category)).sort()];
  els.categorySelect.innerHTML = categories.map(c => `<option value="${c}">${c}</option>`).join("");
  if(!categories.includes(state.category)) state.category = "All";
  els.categorySelect.value = state.category;
}

function shuffle(arr){
  const a = arr.slice();
  for(let i=a.length-1; i>0; i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getFilteredDeck(){
  let deck = ALL.slice();

  if(state.category !== "All"){
    deck = deck.filter(q => q.category === state.category);
  }

  if(state.mode === "missed"){
    const missed = new Set(state.missedIds);
    deck = deck.filter(q => missed.has(q.id));
  }

  if(state.mode === "flagged"){
    const flagged = new Set(state.flaggedIds);
    deck = deck.filter(q => flagged.has(q.id));
  }

  if(state.shuffle){
    deck = shuffle(deck);
  }

  return deck;
}

function rebuildDeck(keepCurrentId=true){
  const currentId = keepCurrentId ? state.deckOrder[state.idx] : null;
  const deck = getFilteredDeck();
  state.deckOrder = deck.map(q => q.id);

  if(state.deckOrder.length === 0){
    state.idx = 0;
    state.history = [];
    saveState(state);
    renderEmptyDeck();
    return;
  }

  if(currentId && state.deckOrder.includes(currentId)){
    state.idx = state.deckOrder.indexOf(currentId);
  }else{
    state.idx = Math.min(state.idx, state.deckOrder.length - 1);
  }

  state.history = [];
  saveState(state);
  render();
}

function currentQuestion(){
  if(state.deckOrder.length === 0) return null;
  const id = state.deckOrder[state.idx];
  return ALL.find(q => q.id === id) ?? null;
}

function renderStats(){
  els.correctCount.textContent = state.correct;
  els.incorrectCount.textContent = state.incorrect;
  const total = state.correct + state.incorrect;
  const pct = total ? Math.round((state.correct/total)*100) : 0;
  els.accuracyPct.textContent = `${pct}%`;
  els.missedCount.textContent = state.missedIds.length;
  els.flaggedCount.textContent = state.flaggedIds.length;
}

function renderProgress(){
  const total = state.deckOrder.length;
  const n = total ? (state.idx + 1) : 0;
  els.progressPill.textContent = `${n} / ${total}`;
}

function clearReveal(){
  els.revealWrap.hidden = true;
  els.answerText.textContent = "";
  els.explainText.textContent = "";
  els.refText.textContent = "";
}

function renderEmptyDeck(){
  renderStats();
  renderProgress();
  els.categoryTag.textContent = state.category;
  els.difficultyTag.textContent = state.mode === "missed" ? "Missed Only" : (state.mode === "flagged" ? "Flagged Only" : "—");
  els.flagBtn.textContent = "☆ Flag";
  els.questionText.textContent = "No questions in this deck. Try changing Category/Mode, or answer more questions to build Missed/Flagged decks.";
  els.choicesWrap.innerHTML = "";
  clearReveal();
}

function updateFlagButton(q){
  const isFlagged = state.flaggedIds.includes(q.id);
  els.flagBtn.textContent = isFlagged ? "★ Flagged" : "☆ Flag";
}

function render(){
  const q = currentQuestion();
  renderStats();
  renderProgress();

  if(!q){
    renderEmptyDeck();
    return;
  }

  els.categoryTag.textContent = q.category;
  els.difficultyTag.textContent = q.difficulty ?? "—";
  els.questionText.textContent = q.prompt;

  updateFlagButton(q);
  clearReveal();

  els.choicesWrap.innerHTML = q.choices.map((c, i) => {
    const letter = String.fromCharCode(65 + i);
    return `<button class="choice" data-index="${i}"><strong>${letter}.</strong> ${c}</button>`;
  }).join("");

  els.choicesWrap.querySelectorAll(".choice").forEach(btn => {
    btn.addEventListener("click", () => onPickAnswer(q, Number(btn.dataset.index), btn));
  });

  els.backBtn.disabled = state.history.length === 0;
}

function onPickAnswer(q, pickedIndex, pickedBtn){
  const buttons = [...els.choicesWrap.querySelectorAll(".choice")];
  buttons.forEach(b => b.disabled = true);

  const correct = pickedIndex === q.answerIndex;

  buttons.forEach(b => {
    const idx = Number(b.dataset.index);
    if(idx === q.answerIndex) b.classList.add("correct");
  });
  if(!correct){
    pickedBtn.classList.add("wrong");
  }

  els.revealWrap.hidden = false;
  els.answerText.textContent = q.choices[q.answerIndex];
  els.explainText.textContent = q.explanation ?? "";
  els.refText.textContent = q.reference ? `Focus: ${q.reference}` : "";

  if(correct){
    state.correct += 1;
  }else{
    state.incorrect += 1;
    if(!state.missedIds.includes(q.id)) state.missedIds.push(q.id);
  }

  saveState(state);
  renderStats();

  if(state.autoAdvance){
    setTimeout(() => goNext(), 550);
  }
}

function goNext(){
  if(state.deckOrder.length === 0) return;
  state.history.push(state.idx);
  state.idx = (state.idx + 1) % state.deckOrder.length;
  saveState(state);
  render();
}

function goBack(){
  if(state.history.length === 0) return;
  state.idx = state.history.pop();
  saveState(state);
  render();
}

function toggleFlag(){
  const q = currentQuestion();
  if(!q) return;
  const i = state.flaggedIds.indexOf(q.id);
  if(i >= 0){
    state.flaggedIds.splice(i, 1);
  }else{
    state.flaggedIds.push(q.id);
  }
  saveState(state);
  renderStats();
  updateFlagButton(q);
}

function wireUI(){
  els.categorySelect.addEventListener("change", () => {
    state.category = els.categorySelect.value;
    saveState(state);
    rebuildDeck(false);
  });

  els.modeSelect.addEventListener("change", () => {
    state.mode = els.modeSelect.value;
    saveState(state);
    rebuildDeck(false);
  });

  els.shuffleToggle.addEventListener("change", () => {
    state.shuffle = els.shuffleToggle.checked;
    saveState(state);
    rebuildDeck(false);
  });

  els.autoAdvanceToggle.addEventListener("change", () => {
    state.autoAdvance = els.autoAdvanceToggle.checked;
    saveState(state);
  });

  els.resetBtn.addEventListener("click", () => {
    state.correct = 0;
    state.incorrect = 0;
    state.missedIds = [];
    state.flaggedIds = [];
    state.history = [];
    saveState(state);
    rebuildDeck(false);
  });

  els.nextBtn.addEventListener("click", goNext);
  els.backBtn.addEventListener("click", goBack);
  els.flagBtn.addEventListener("click", toggleFlag);

  els.modeSelect.value = state.mode ?? "all";
  els.shuffleToggle.checked = Boolean(state.shuffle);
  els.autoAdvanceToggle.checked = Boolean(state.autoAdvance);
}

function init(){
  buildCategoryOptions();
  wireUI();
  rebuildDeck(true);

  // If first run (no deckOrder yet)
  if(!state.deckOrder || state.deckOrder.length === 0){
    rebuildDeck(false);
  }else{
    render();
  }
}

init();
