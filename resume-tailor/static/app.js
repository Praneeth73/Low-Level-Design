(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const form = $("#tailor-form");
  const fileInput = $("#resume-input");
  const dropzone = $("#dropzone");
  const fileName = $("#file-name");
  const submitBtn = $("#submit-btn");
  const errorBox = $("#error");

  let resumeFile = null;
  let jdMode = "url";
  let current = null; // { resume, analysis } returned by the API

  // ---------- file input / drag & drop
  function setFile(file) {
    if (!file) return;
    resumeFile = file;
    fileName.textContent = file.name;
    fileName.hidden = false;
    dropzone.classList.add("has-file");
  }
  fileInput.addEventListener("change", () => setFile(fileInput.files[0]));
  ["dragenter", "dragover"].forEach(ev => dropzone.addEventListener(ev, e => {
    e.preventDefault(); dropzone.classList.add("drag");
  }));
  ["dragleave", "drop"].forEach(ev => dropzone.addEventListener(ev, e => {
    e.preventDefault(); dropzone.classList.remove("drag");
  }));
  dropzone.addEventListener("drop", e => setFile(e.dataTransfer.files[0]));

  // ---------- tabs
  $$(".tab[data-jd]").forEach(btn => btn.addEventListener("click", () => {
    jdMode = btn.dataset.jd;
    $$(".tab[data-jd]").forEach(b => b.classList.toggle("active", b === btn));
    $$(".jd-pane").forEach(p => (p.hidden = p.dataset.pane !== jdMode));
  }));
  $$(".tab[data-view]").forEach(btn => btn.addEventListener("click", () => {
    $$(".tab[data-view]").forEach(b => b.classList.toggle("active", b === btn));
    $$(".view").forEach(v => (v.hidden = v.dataset.viewPane !== btn.dataset.view));
    $(".edit-hint").hidden = btn.dataset.view !== "preview";
  }));

  // ---------- UI state
  function showState(state) {
    $("#empty-state").hidden = state !== "empty";
    $("#loading").hidden = state !== "loading";
    $("#result").hidden = state !== "result";
  }
  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.hidden = !msg;
  }
  function setBusy(busy) {
    submitBtn.disabled = busy;
    $(".spinner", submitBtn).hidden = !busy;
    $(".btn-label", submitBtn).textContent = busy ? "Tailoring..." : "Tailor my resume";
  }

  let progressTimer = null;
  function startProgress() {
    const items = $$(".progress li");
    let i = 0;
    const paint = () => items.forEach((li, idx) => {
      li.classList.toggle("done", idx < i);
      li.classList.toggle("active", idx === i);
    });
    paint();
    const delays = [1500, 4000, 6000];
    const tick = () => {
      if (i < items.length - 1) {
        i++; paint();
        progressTimer = setTimeout(tick, delays[i] || 0);
      }
    };
    progressTimer = setTimeout(tick, delays[0]);
  }
  function stopProgress() { clearTimeout(progressTimer); }

  // ---------- submit
  form.addEventListener("submit", async e => {
    e.preventDefault();
    showError("");
    if (!resumeFile) return showError("Please upload your resume first.");
    const jobUrl = $("#job-url").value.trim();
    const jobText = $("#job-text").value.trim();
    if (jdMode === "url" && !jobUrl) return showError("Please enter the job link (or switch to Paste text).");
    if (jdMode === "text" && !jobText) return showError("Please paste the job description.");

    const body = new FormData();
    body.append("resume", resumeFile);
    body.append("job_url", jdMode === "url" ? jobUrl : "");
    body.append("job_text", jdMode === "text" ? jobText : "");
    body.append("instructions", $("#instructions").value);

    setBusy(true);
    showState("loading");
    startProgress();
    try {
      const res = await fetch("/api/tailor", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || `Request failed (${res.status})`);
      current = data;
      renderResume(current.resume);
      renderAnalysis(current.analysis);
      showState("result");
    } catch (err) {
      showState(current ? "result" : "empty");
      showError(err.message);
    } finally {
      stopProgress();
      setBusy(false);
    }
  });

  // ---------- rendering helpers
  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") node.className = v;
      else node.setAttribute(k, v);
    }
    for (const c of children.flat()) {
      if (c == null || c === "") continue;
      node.append(c instanceof Node ? c : document.createTextNode(c));
    }
    return node;
  }

  // An editable text node bound to a path inside `current.resume`.
  // `join` marks array-of-strings fields shown as a comma list.
  function editable(tag, path, value, cls, join) {
    const text = join ? (value || []).join(", ") : (value || "");
    return el(tag, { class: cls || "", contenteditable: "true", spellcheck: "true", "data-path": path, ...(join ? { "data-join": "1" } : {}) }, text);
  }

  function setPath(obj, path, value) {
    const keys = path.split(".");
    let o = obj;
    for (let i = 0; i < keys.length - 1; i++) o = o[keys[i]];
    o[keys[keys.length - 1]] = value;
  }

  $("#resume-preview").addEventListener("input", e => {
    const node = e.target.closest("[data-path]");
    if (!node || !current) return;
    const text = node.innerText.trim();
    setPath(current.resume, node.dataset.path,
      node.dataset.join ? text.split(",").map(s => s.trim()).filter(Boolean) : text);
  });

  function dates(start, end) { return [start, end].filter(Boolean).join(" – "); }

  function renderResume(r) {
    const paper = $("#resume-preview");
    paper.replaceChildren();
    paper.append(editable("h1", "name", r.name, "r-name"));
    if (r.headline) paper.append(editable("div", "headline", r.headline, "r-headline"));

    const contact = el("div", { class: "r-contact" });
    ["email", "phone", "location", "linkedin", "github", "website"].forEach(k => {
      if (r.contact[k]) contact.append(editable("span", `contact.${k}`, r.contact[k]));
    });
    paper.append(contact);

    const bullets = (items, base) => el("ul", {}, items.map((b, i) => editable("li", `${base}.${i}`, b)));

    if (r.summary) paper.append(el("h4", {}, "Summary"), editable("p", "summary", r.summary));

    if (r.skills.length) {
      paper.append(el("h4", {}, "Skills"));
      r.skills.forEach((g, i) => paper.append(el("div", {},
        el("strong", {}, editable("span", `skills.${i}.category`, g.category), ": "),
        editable("span", `skills.${i}.skills`, g.skills, "", true))));
    }

    if (r.experience.length) {
      paper.append(el("h4", {}, "Experience"));
      r.experience.forEach((x, i) => {
        paper.append(el("div", { class: "r-row" },
          el("span", {}, editable("span", `experience.${i}.title`, x.title), " — ",
            editable("span", `experience.${i}.company`, x.company)),
          el("span", { class: "r-dates" }, dates(x.start_date, x.end_date))));
        if (x.location) paper.append(editable("div", `experience.${i}.location`, x.location, "r-sub"));
        paper.append(bullets(x.bullets, `experience.${i}.bullets`));
      });
    }

    if (r.projects.length) {
      paper.append(el("h4", {}, "Projects"));
      r.projects.forEach((p, i) => {
        paper.append(el("div", { class: "r-row" },
          el("span", {}, editable("span", `projects.${i}.name`, p.name),
            p.technologies.length ? el("span", { class: "r-sub" }, " (", editable("span", `projects.${i}.technologies`, p.technologies, "", true), ")") : null)));
        if (p.description) paper.append(editable("div", `projects.${i}.description`, p.description));
        paper.append(bullets(p.bullets, `projects.${i}.bullets`));
      });
    }

    if (r.education.length) {
      paper.append(el("h4", {}, "Education"));
      r.education.forEach((ed, i) => {
        paper.append(el("div", { class: "r-row" },
          el("span", {}, editable("span", `education.${i}.degree`, ed.degree), " — ",
            editable("span", `education.${i}.institution`, ed.institution)),
          el("span", { class: "r-dates" }, dates(ed.start_date, ed.end_date))));
        if (ed.details) paper.append(editable("div", `education.${i}.details`, ed.details, "r-sub"));
      });
    }

    if (r.certifications.length) {
      paper.append(el("h4", {}, "Certifications"), bullets(r.certifications, "certifications"));
    }
  }

  function scoreCard(label, value, cls) {
    const v = Math.max(0, Math.min(100, value | 0));
    const bar = el("div", { class: "bar" }, el("div", { style: `width:${v}%` }));
    return el("div", { class: `score-card ${cls}` },
      el("div", { class: "label" }, label), el("div", { class: "value" }, `${v}%`), bar);
  }

  function renderAnalysis(a) {
    const root = $("#analysis");
    const chips = (items, cls) => el("div", { class: "chips" },
      items.length ? items.map(k => el("span", { class: `chip ${cls}` }, k)) : el("span", { class: "hint" }, "None"));
    const list = items => el("ul", { class: "analysis-list" }, items.map(t => el("li", {}, t)));
    root.replaceChildren(
      el("h3", { class: "job-title" }, a.job_title + (a.company ? ` · ${a.company}` : "")),
      el("div", { class: "scores" },
        scoreCard("Match before", a.match_score_before, "before"),
        scoreCard("Match after tailoring", a.match_score_after, "after")),
      el("h3", {}, "Keywords matched"), chips(a.matched_keywords, "good"),
      el("h3", {}, "Gaps (not added — no evidence in your resume)"), chips(a.missing_keywords, "warn"),
      el("h3", {}, "What changed"), list(a.changes_made),
      el("h3", {}, "Suggestions"), list(a.suggestions),
    );
  }

  // ---------- downloads
  $$("[data-download]").forEach(btn => btn.addEventListener("click", async () => {
    if (!current) return;
    const fmt = btn.dataset.download;
    btn.disabled = true;
    showError("");
    try {
      const res = await fetch(`/api/export/${fmt}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(current.resume),
      });
      if (!res.ok) throw new Error(`Download failed (${res.status})`);
      const blob = await res.blob();
      const match = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") || "");
      const a = el("a", { href: URL.createObjectURL(blob), download: match ? match[1] : `resume.${fmt}` });
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch (err) {
      showError(err.message);
    } finally {
      btn.disabled = false;
    }
  }));
})();
