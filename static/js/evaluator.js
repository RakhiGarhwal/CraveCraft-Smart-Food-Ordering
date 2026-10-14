/**
 * CraveCraft — AI Response Quality Evaluator & Benchmark Viewer
 * Fulfills Requirements 9 & 10:
 * Assesses chatbot responses for Relevance, Factual Consistency with the Menu, and Clarity.
 * Displays scores from 1 to 5 with actionable feedback and verified catalog items.
 */

const CraveEvaluator = {
  init() {
    this.bindEvents();
    this.loadSampleReport();
  },

  bindEvents() {
    // Live playground form on homepage
    const form = document.getElementById('liveEvalForm');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const prompt = document.getElementById('evalPromptInput')?.value.trim();
        const answer = document.getElementById('evalAnswerInput')?.value.trim();
        if (prompt && answer) {
          this.runAuditInPlayground(prompt, answer);
        }
      });
    }

    // Close evaluation modal
    const btnClose = document.getElementById('btnCloseEvalModal');
    const overlay = document.getElementById('evalModalOverlay');
    if (btnClose) {
      btnClose.addEventListener('click', () => this.closeEvaluationModal());
    }
    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) this.closeEvaluationModal();
      });
    }
  },

  async loadSampleReport() {
    try {
      const res = await fetch('/api/sample-evaluation');
      const data = await res.json();
      if (data.success && data.report) {
        this.renderSampleReport(data.report);
      }
    } catch (err) {
      console.warn('Could not fetch sample report dynamically:', err);
    }
  },

  renderSampleReport(report) {
    const qEl = document.getElementById('sampleQuestionText');
    const aEl = document.getElementById('sampleAnswerText');
    const badge = document.getElementById('reportModeBadge');

    if (qEl) qEl.textContent = `"${report.test_question}"`;
    if (aEl) aEl.textContent = `"${report.chatbot_answer}"`;
    if (badge) badge.textContent = report.evaluator_mode;

    // Scores
    const sRel = document.getElementById('scoreRelevance');
    const bRel = document.getElementById('barRelevance');
    const fRel = document.getElementById('feedbackRelevance');

    const sCon = document.getElementById('scoreConsistency');
    const bCon = document.getElementById('barConsistency');
    const fCon = document.getElementById('feedbackConsistency');

    const sCla = document.getElementById('scoreClarity');
    const bCla = document.getElementById('barClarity');
    const fCla = document.getElementById('feedbackClarity');

    const overallScore = document.getElementById('overallScoreVal');
    const overallVerdict = document.getElementById('overallVerdictText');

    if (sRel && report.scores.relevance) {
      sRel.textContent = `${report.scores.relevance.score.toFixed(1)} / 5.0`;
      if (bRel) bRel.style.width = `${(report.scores.relevance.score / 5) * 100}%`;
      if (fRel) fRel.textContent = report.scores.relevance.feedback;
    }

    if (sCon && report.scores.consistency) {
      sCon.textContent = `${report.scores.consistency.score.toFixed(1)} / 5.0`;
      if (bCon) bCon.style.width = `${(report.scores.consistency.score / 5) * 100}%`;
      if (fCon) fCon.textContent = report.scores.consistency.feedback;
    }

    if (sCla && report.scores.clarity) {
      sCla.textContent = `${report.scores.clarity.score.toFixed(1)} / 5.0`;
      if (bCla) bCla.style.width = `${(report.scores.clarity.score / 5) * 100}%`;
      if (fCla) fCla.textContent = report.scores.clarity.feedback;
    }

    if (overallScore) overallScore.textContent = `${report.overall_score.toFixed(1)} / 5.0`;
    if (overallVerdict) overallVerdict.textContent = `• ${report.verdict}`;

    // Strengths list
    const strengthsList = document.getElementById('evalStrengthsList');
    if (strengthsList && report.strengths) {
      strengthsList.innerHTML = report.strengths.map(s => `
        <li class="eval-bullet-item"><span class="bullet-icon-check">✓</span> ${s}</li>
      `).join('');
    }
  },

  // Open the dedicated evaluation modal when clicking "Evaluate Response" on any chat bubble
  async openLiveEvaluationModal(question, answer) {
    const overlay = document.getElementById('evalModalOverlay');
    const body = document.getElementById('evalModalBody');
    if (!overlay || !body) return;

    overlay.classList.add('open');
    body.innerHTML = `
      <div style="text-align: center; padding: 40px 20px;">
        <div style="font-size: 2.4rem; animation: float-slow 1s infinite;">⚡</div>
        <h4 style="margin: 12px 0 4px; font-size: 1.15rem;">Auditing CraveBot Response...</h4>
        <p style="color: var(--text-muted); font-size: 0.85rem;">Checking factual consistency with menu items, prices, and dietary compliance.</p>
      </div>
    `;

    try {
      const res = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, answer })
      });
      const data = await res.json();

      if (data.success && data.evaluation) {
        this.renderModalEvaluationDetails(question, answer, data.evaluation);
      } else {
        body.innerHTML = `
          <div style="text-align:center;padding:30px;color:#ef4444;">
            <p>Evaluation service encountered an error.</p>
          </div>
        `;
      }
    } catch (e) {
      body.innerHTML = `
        <div style="text-align:center;padding:30px;color:#ef4444;">
          <p>Failed to connect to evaluation engine.</p>
        </div>
      `;
    }
  },

  closeEvaluationModal() {
    const overlay = document.getElementById('evalModalOverlay');
    if (overlay) overlay.classList.remove('open');
  },

  renderModalEvaluationDetails(question, answer, evalData) {
    const body = document.getElementById('evalModalBody');
    if (!body) return;

    const relPct = (evalData.relevance_score / 5) * 100;
    const conPct = (evalData.consistency_score / 5) * 100;
    const claPct = (evalData.clarity_score / 5) * 100;

    const isDemo = evalData.evaluator_mode.toLowerCase().includes('demo') || evalData.evaluator_mode.toLowerCase().includes('rule-based');

    body.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;background:rgba(255,255,255,0.03);padding:10px 14px;border-radius:var(--radius-md);border:1px solid var(--border-subtle);">
        <span style="font-size:0.8rem;color:var(--text-muted);font-weight:600;">EVALUATOR ENGINE</span>
        <span class="pill" style="background:${isDemo ? 'rgba(245,158,11,0.2)' : 'rgba(16,185,129,0.2)'};color:${isDemo ? '#fcd34d' : 'var(--veg-color)'};border:1px solid ${isDemo ? 'rgba(245,158,11,0.4)' : 'rgba(16,185,129,0.4)'}">
          ${evalData.evaluator_mode}
        </span>
      </div>

      <div style="background:var(--bg-secondary);border-radius:var(--radius-md);padding:12px;margin-bottom:12px;font-size:0.85rem;">
        <span style="color:var(--text-muted);text-transform:uppercase;font-size:0.72rem;font-weight:700;">Customer Query:</span>
        <div style="font-weight:600;color:#fff;margin-top:2px;">"${question}"</div>
      </div>

      <!-- Overall Score Gauge -->
      <div style="background:linear-gradient(135deg,rgba(255,107,53,0.1) 0%,rgba(247,147,30,0.05) 100%);border:1px solid var(--border-accent);border-radius:var(--radius-md);padding:14px;margin-bottom:20px;display:flex;align-items:center;justify-content:space-between;">
        <div>
          <div style="font-size:0.75rem;text-transform:uppercase;color:var(--text-muted);font-weight:700;">Composite Quality Score</div>
          <div style="font-size:1.8rem;font-weight:800;font-family:var(--font-heading);color:var(--accent-primary);">
            ${evalData.overall_score.toFixed(1)} <span style="font-size:1.1rem;color:var(--text-muted);">/ 5.0</span>
          </div>
        </div>
        <div style="text-align:right;">
          <span style="background:rgba(16,185,129,0.15);color:var(--veg-color);padding:4px 10px;border-radius:var(--radius-full);font-size:0.8rem;font-weight:700;text-transform:uppercase;">
            ${evalData.verdict}
          </span>
        </div>
      </div>

      <!-- 3 Metrics Breakdown -->
      <div style="display:flex;flex-direction:column;gap:14px;margin-bottom:20px;">
        <!-- Relevance -->
        <div class="score-row">
          <div class="score-label-row">
            <span>1. Prompt Relevance & Dietary Alignment</span>
            <span class="score-val-badge">${evalData.relevance_score.toFixed(1)} / 5.0</span>
          </div>
          <div class="score-progress-track">
            <div class="score-progress-bar" style="width:${relPct}%;"></div>
          </div>
          <div class="score-feedback-text">${evalData.relevance_feedback}</div>
        </div>

        <!-- Consistency -->
        <div class="score-row">
          <div class="score-label-row">
            <span>2. Factual Consistency With Menu (Zero Hallucination)</span>
            <span class="score-val-badge">${evalData.consistency_score.toFixed(1)} / 5.0</span>
          </div>
          <div class="score-progress-track">
            <div class="score-progress-bar" style="width:${conPct}%;"></div>
          </div>
          <div class="score-feedback-text">${evalData.consistency_feedback}</div>
        </div>

        <!-- Clarity -->
        <div class="score-row">
          <div class="score-label-row">
            <span>3. Clarity, Tone & Formatting</span>
            <span class="score-val-badge">${evalData.clarity_score.toFixed(1)} / 5.0</span>
          </div>
          <div class="score-progress-track">
            <div class="score-progress-bar" style="width:${claPct}%;"></div>
          </div>
          <div class="score-feedback-text">${evalData.clarity_feedback}</div>
        </div>
      </div>

      <!-- Verified Dishes Table -->
      ${evalData.verified_dishes && evalData.verified_dishes.length > 0 ? `
        <div style="margin-bottom:16px;">
          <div style="font-size:0.78rem;font-weight:700;color:var(--text-secondary);text-transform:uppercase;margin-bottom:6px;">
            Verified Menu Items Detected (${evalData.verified_dishes.length}):
          </div>
          <div style="background:var(--bg-secondary);border-radius:var(--radius-md);overflow:hidden;border:1px solid var(--border-subtle);font-size:0.8rem;">
            ${evalData.verified_dishes.map(d => `
              <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-bottom:1px solid rgba(255,255,255,0.04);">
                <div style="display:flex;align-items:center;gap:6px;">
                  <span>${d.is_veg ? '🟢' : '🔴'}</span>
                  <span style="font-weight:600;color:#fff;">${d.dish}</span>
                </div>
                <div style="display:flex;align-items:center;gap:10px;">
                  <span style="color:var(--accent-primary);font-weight:700;">₹${d.price_inr}</span>
                  <span style="color:var(--veg-color);font-size:0.75rem;">${d.price_accuracy || 'Verified'}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Strengths & Suggestions -->
      ${evalData.strengths && evalData.strengths.length > 0 ? `
        <div style="margin-bottom:14px;">
          <div style="font-size:0.78rem;font-weight:700;color:var(--text-secondary);text-transform:uppercase;margin-bottom:6px;">
            Audit Highlights:
          </div>
          <ul class="eval-bullet-list">
            ${evalData.strengths.map(s => `
              <li class="eval-bullet-item"><span class="bullet-icon-check">✓</span> ${s}</li>
            `).join('')}
          </ul>
        </div>
      ` : ''}

      <button type="button" class="btn-secondary" style="width:100%;margin-top:10px;" onclick="CraveEvaluator.closeEvaluationModal()">
        <span>Done Inspecting</span>
      </button>
    `;
  },

  // Run audit in the homepage playground
  async runAuditInPlayground(prompt, answer) {
    const btn = document.getElementById('btnRunAudit');
    const resultBox = document.getElementById('liveAuditResult');
    if (!resultBox) return;

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>Auditing Response... ⚡</span>';
    }

    resultBox.style.display = 'block';
    resultBox.innerHTML = `
      <div style="text-align:center;padding:20px;color:var(--text-muted);">
        <span>Evaluating against CraveCraft menu ground-truth...</span>
      </div>
    `;

    try {
      const res = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: prompt, answer: answer })
      });
      const data = await res.json();

      if (data.success && data.evaluation) {
        const ev = data.evaluation;
        const isDemo = ev.evaluator_mode.toLowerCase().includes('demo') || ev.evaluator_mode.toLowerCase().includes('rule-based');

        resultBox.innerHTML = `
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
            <div style="font-size:1.1rem;font-weight:700;">Audit Results:</div>
            <span class="pill" style="background:${isDemo ? 'rgba(245,158,11,0.2)' : 'rgba(16,185,129,0.2)'};color:${isDemo ? '#fcd34d' : 'var(--veg-color)'};border:1px solid ${isDemo ? 'rgba(245,158,11,0.4)' : 'rgba(16,185,129,0.4)'}">
              ${ev.evaluator_mode}
            </span>
          </div>

          <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:10px;margin-bottom:16px;">
            <div style="background:var(--bg-secondary);padding:10px;border-radius:var(--radius-md);text-align:center;border:1px solid var(--border-subtle);">
              <div style="font-size:0.75rem;color:var(--text-muted);">RELEVANCE</div>
              <div style="font-size:1.3rem;font-weight:800;color:var(--accent-primary);">${ev.relevance_score.toFixed(1)}/5</div>
            </div>
            <div style="background:var(--bg-secondary);padding:10px;border-radius:var(--radius-md);text-align:center;border:1px solid var(--border-subtle);">
              <div style="font-size:0.75rem;color:var(--text-muted);">CONSISTENCY</div>
              <div style="font-size:1.3rem;font-weight:800;color:var(--veg-color);">${ev.consistency_score.toFixed(1)}/5</div>
            </div>
            <div style="background:var(--bg-secondary);padding:10px;border-radius:var(--radius-md);text-align:center;border:1px solid var(--border-subtle);">
              <div style="font-size:0.75rem;color:var(--text-muted);">CLARITY</div>
              <div style="font-size:1.3rem;font-weight:800;color:#38bdf8;">${ev.clarity_score.toFixed(1)}/5</div>
            </div>
          </div>

          <div style="background:rgba(255,255,255,0.03);padding:12px;border-radius:var(--radius-md);font-size:0.84rem;margin-bottom:12px;">
            <strong>Consistency Feedback:</strong> ${ev.consistency_feedback}
          </div>

          <div style="background:rgba(255,255,255,0.03);padding:12px;border-radius:var(--radius-md);font-size:0.84rem;">
            <strong>Relevance Feedback:</strong> ${ev.relevance_feedback}
          </div>
        `;
        if (window.CraveApp) {
          window.CraveApp.showToast(`Audit Completed: ${ev.overall_score.toFixed(1)} / 5.0 (${ev.verdict})`, 'success');
        }
      }
    } catch (e) {
      resultBox.innerHTML = `<div style="color:#ef4444;font-size:0.85rem;">Evaluation failed: ${e.message}</div>`;
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span>Evaluate Response Now ⚡</span>';
      }
    }
  }
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  CraveEvaluator.init();
});

window.CraveEvaluator = CraveEvaluator;
