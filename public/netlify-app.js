(() => {
    "use strict";

    const apiUrl = "/.netlify/functions/api";
    const app = document.getElementById("app");
    const query = new URLSearchParams(window.location.search);
    const page = ["scores", "history", "ranking", "entry"].includes(query.get("page"))
        ? query.get("page")
        : "scores";
    const selectedMatchId = query.get("match") || "";
    const titleByPage = {
        scores: "Skor pertandingan",
        history: "Riwayat pertandingan",
        ranking: "Peringkat pemanah",
        entry: "Input skor pertandingan",
    };
    const scoreOptions = ["M", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
    let matches = [];
    let settings = { default_set_count: 3, default_arrows_per_set: 3 };

    function escapeHtml(value) {
        return String(value).replace(/[&<>"']/g, (character) => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
        })[character]);
    }

    async function request(url, options = {}) {
        const result = await fetch(url, {
            cache: "no-store",
            ...options,
            headers: { "Content-Type": "application/json", ...options.headers },
        });
        const data = await result.json();
        if (!result.ok) throw new Error(data.error || `Permintaan gagal (${result.status}).`);
        return data;
    }

    function dateLabel(date) {
        const parsed = new Date(date);
        if (Number.isNaN(parsed.getTime())) return "Tanggal tidak tersedia";
        return new Intl.DateTimeFormat("id-ID", {
            timeZone: "Asia/Jakarta",
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        }).format(parsed);
    }

    function orderedArchers(archers) {
        return [...archers].sort((first, second) =>
            second.total - first.total || first.name.localeCompare(second.name, "id")
        );
    }

    function rankAt(archers, index) {
        return index > 0 && archers[index].total === archers[index - 1].total
            ? rankAt(archers, index - 1)
            : index + 1;
    }

    function tableHead(setCount) {
        return `<tr><th>Peringkat</th><th>Nama pemanah</th>${Array.from(
            { length: setCount },
            (_, index) => `<th>Set ${index + 1}</th>`
        ).join("")}<th>Total</th></tr>`;
    }

    function scoreRows(archers, setCount) {
        const ranked = orderedArchers(archers);
        return ranked.map((archer, index) => {
            const rank = rankAt(ranked, index);
            const rankLabel = rank === 1 ? "🏆" : `#${rank}`;
            const setCells = Array.from({ length: setCount }, (_, setIndex) => {
                const set = archer.sets[setIndex];
                const scores = set.scores.map((score) => score === null ? "M" : score).join(" · ");
                return `<td>${set.total}<span class="arrow-detail">${escapeHtml(scores)}</span></td>`;
            }).join("");
            return `<tr><td class="rank-cell${rank === 1 ? " rank-first" : ""}">${rankLabel}</td><td><strong>${escapeHtml(archer.name)}</strong></td>${setCells}<td class="total-cell">${archer.total} poin</td></tr>`;
        }).join("");
    }

    function matchOptions(selectedId) {
        return matches.map((match) =>
            `<option value="${escapeHtml(match.id)}"${match.id === selectedId ? " selected" : ""}>${escapeHtml(match.event_name)} — ${escapeHtml(dateLabel(match.created_at))}</option>`
        ).join("");
    }

    function selectedMatch() {
        return matches.find((match) => match.id === selectedMatchId) || matches[0] || null;
    }

    function rankingContent(match) {
        if (!match || match.archers.length === 0) {
            return `<section class="card empty"><div class="empty-icon">⌁</div><h2>Skor belum tersedia</h2><p>Belum ada pemanah yang tercatat untuk pertandingan ini.</p></section>`;
        }
        const ranked = orderedArchers(match.archers);
        const winners = ranked.filter((archer) => archer.total === ranked[0].total);
        return `<div class="ranking-banner"><span class="trophy" aria-hidden="true">🏆</span><div><strong>${escapeHtml(winners.map((archer) => archer.name).join(" & "))}</strong><span>Nilai tertinggi · ${escapeHtml(match.event_name)}</span></div><span class="winner-score">${ranked[0].total} <small>pts</small></span></div>
            <section class="card rank-table-card"><div class="match-top"><div><h2>${escapeHtml(match.event_name)}</h2><div class="match-meta">${escapeHtml(dateLabel(match.created_at))} · ${match.set_count} set · ${match.arrows_per_set} panah per set</div></div></div><div class="match-body"><table><thead>${tableHead(match.set_count)}</thead><tbody>${scoreRows(match.archers, match.set_count)}</tbody></table></div></section>`;
    }

    function renderScores() {
        const match = selectedMatch();
        return `<div class="intro"><div><div class="eyebrow">Papan skor publik</div><h1>Skor &amp; peringkat.</h1><p>Skor pertandingan bisa dilihat semua peserta tanpa perlu login.</p></div><span class="count-pill">${matches.length} pertandingan</span></div>
            ${matches.length === 0
                ? `<section class="card empty"><div class="empty-icon">⌁</div><h2>Skor belum tersedia</h2><p>Belum ada pertandingan yang dicatat. Tambahkan pertandingan untuk mulai mengisi skor.</p><a class="button button-primary" href="?page=entry">＋ Catat pertandingan</a></section>`
                : `<div class="toolbar"><h2>Pilih pertandingan</h2><select class="rank-select" id="match-select" aria-label="Pilih pertandingan">${matchOptions(match.id)}</select></div>${rankingContent(match)}`}`;
    }

    function renderRanking() {
        const match = selectedMatch();
        return `<div class="intro"><div><div class="eyebrow">Hasil pertandingan</div><h1>Peringkat pemanah.</h1><p>Skor pertandingan bisa dilihat semua peserta tanpa perlu login.</p></div></div>
            ${matches.length === 0
                ? `<section class="card empty"><div class="empty-icon">⌁</div><h2>Skor belum tersedia</h2><p>Belum ada pertandingan yang dicatat. Tambahkan pertandingan untuk mulai mengisi skor.</p><a class="button button-primary" href="?page=entry">＋ Catat pertandingan</a></section>`
                : `<div class="toolbar"><h2>Pilih pertandingan</h2><select class="rank-select" id="match-select" aria-label="Pilih pertandingan">${matchOptions(match.id)}</select></div>${rankingContent(match)}`}`;
    }

    function renderHistory() {
        const rows = matches.map((match) =>
            `<section class="card match-card"><div class="match-top"><div><h2>${escapeHtml(match.event_name)}</h2><div class="match-meta">${escapeHtml(dateLabel(match.created_at))} · ${match.archers.length} pemanah · ${match.set_count} set</div></div><div class="match-actions"><a class="button button-light" href="?page=ranking&amp;match=${encodeURIComponent(match.id)}">Lihat peringkat</a><form class="delete-match-form"><input type="hidden" name="match_id" value="${escapeHtml(match.id)}"><button class="button button-light delete-match-button" type="button">Hapus</button><div class="delete-confirmation" hidden><span>Yakin ingin menghapus riwayat ini?</span><button class="button button-light confirm-delete-button" type="submit">Hapus</button><button class="button button-secondary cancel-delete-button" type="button">Batal</button></div></form></div></section>`
        ).join("");
        return `<div class="intro"><div><div class="eyebrow">Arsip skor</div><h1>Riwayat pertandingan.</h1><p>Semua sesi beserta total skor setiap set.</p></div><a class="button button-primary" href="?page=entry">＋ Catat pertandingan</a></div>
            ${matches.length === 0
                ? `<section class="card empty"><div class="empty-icon">⌂</div><h2>Belum ada riwayat</h2><p>Riwayat pertandingan akan muncul di sini setelah ada pertandingan yang dicatat.</p></section>`
                : `<div class="match-list">${rows}</div>`}`;
    }

    function renderEntry() {
        return `<div class="intro"><div><div class="eyebrow">Input peserta</div><h1>Catat skor pertandingan.</h1><p>Isi hasil pertandingan dan bagikan peringkatnya kepada semua peserta.</p></div></div>
            <form id="score-form">
                <div class="layout">
                    <section class="card form-card">
                        <h2 class="section-title"><span class="step">01</span> Detail pertandingan</h2>
                        <div class="field-grid">
                            <div class="field full"><label for="event-name">Nama pertandingan</label><input id="event-name" maxlength="100" placeholder="Contoh: Latihan Minggu Pagi" required></div>
                            <div class="field"><label for="set-count">Jumlah set</label><select id="set-count">${Array.from({ length: 12 }, (_, index) => `<option value="${index + 1}"${index + 1 === settings.default_set_count ? " selected" : ""}>${index + 1} set</option>`).join("")}</select></div>
                            <div class="field"><label for="arrows-per-set">Anak panah per set</label><select id="arrows-per-set">${Array.from({ length: 12 }, (_, index) => `<option value="${index + 1}"${index + 1 === settings.default_arrows_per_set ? " selected" : ""}>${index + 1} panah</option>`).join("")}</select></div>
                        </div>
                        <div class="divider"></div>
                        <h2 class="section-title"><span class="step">02</span> Pemanah &amp; nilai</h2>
                        <div class="archer-list" id="archer-list"></div>
                        <div class="button-row"><button class="button button-secondary" type="button" id="add-archer">＋ Tambah pemanah</button><span class="subtext" id="score-summary">Pilih nilai untuk setiap anak panah.</span></div>
                        <div class="divider"></div>
                        <div class="button-row"><span class="subtext">Nilai maksimal tiap panah adalah 10.</span><button class="button button-primary" type="submit">Simpan &amp; lihat peringkat <span aria-hidden="true">→</span></button></div>
                    </section>
                    <aside class="card side-card"><h2>Informasi</h2><ul class="guide-list"><li><span class="guide-icon">01</span><span>Siapa saja dapat mencatat pertandingan dan skornya.</span></li><li><span class="guide-icon">02</span><span>Hasil yang disimpan akan terlihat oleh semua pengunjung.</span></li><li><span class="guide-icon">03</span><span>Nilai M dihitung nol. Total set dan peringkat otomatis.</span></li></ul><div class="hint">Pastikan nama pertandingan dan skor sudah benar sebelum disimpan.</div></aside>
                </div>
            </form>`;
    }

    function showAlert(message, success = false) {
        const previous = app.querySelector("[role='alert'], [role='status']");
        if (previous) previous.remove();
        const alert = document.createElement("div");
        alert.className = `alert${success ? " success" : ""}`;
        alert.setAttribute("role", success ? "status" : "alert");
        alert.textContent = message;
        app.prepend(alert);
    }

    function updateSummary() {
        const list = document.getElementById("archer-list");
        if (!list) return;
        const selects = [...list.querySelectorAll(".arrow-select")];
        const completed = selects.filter((select) => select.value !== "").length;
        const count = list.querySelectorAll(".archer-card").length;
        document.getElementById("score-summary").textContent =
            `${count} pemanah · ${completed}/${selects.length} nilai terisi`;
    }

    function updateSetTotal(arrowGrid, label) {
        const total = [...arrowGrid.querySelectorAll(".arrow-select")].reduce(
            (sum, select) => sum + (select.value === "M" || select.value === "" ? 0 : Number(select.value)),
            0
        );
        label.textContent = `${total} poin`;
    }

    function renderArcherScores(card, archerIndex) {
        const container = card.querySelector(".score-sets");
        const previousScores = new Map(
            [...container.querySelectorAll(".arrow-select")].map((select) => [select.dataset.position, select.value])
        );
        container.replaceChildren();
        const setCount = Number(document.getElementById("set-count").value);
        const arrowsPerSet = Number(document.getElementById("arrows-per-set").value);

        for (let setIndex = 0; setIndex < setCount; setIndex++) {
            const setBox = document.createElement("div");
            setBox.className = "set-box";
            const heading = document.createElement("div");
            heading.className = "set-head";
            const setLabel = document.createElement("span");
            setLabel.textContent = `SET ${setIndex + 1}`;
            const totalLabel = document.createElement("span");
            totalLabel.className = "set-total";
            heading.append(setLabel, totalLabel);

            const arrowGrid = document.createElement("div");
            arrowGrid.className = "arrow-grid";
            for (let arrowIndex = 0; arrowIndex < arrowsPerSet; arrowIndex++) {
                const select = document.createElement("select");
                select.className = "arrow-select";
                select.dataset.position = `${setIndex}:${arrowIndex}`;
                select.setAttribute("aria-label", `Pemanah ${archerIndex + 1}, set ${setIndex + 1}, panah ${arrowIndex + 1}`);
                select.required = true;
                const placeholder = document.createElement("option");
                placeholder.value = "";
                placeholder.textContent = `P${arrowIndex + 1}`;
                select.append(placeholder);
                for (const score of scoreOptions) {
                    const option = document.createElement("option");
                    option.value = score;
                    option.textContent = score;
                    select.append(option);
                }
                const position = select.dataset.position;
                if (previousScores.has(position)) select.value = previousScores.get(position);
                select.addEventListener("change", () => {
                    updateSetTotal(arrowGrid, totalLabel);
                    updateSummary();
                });
                arrowGrid.append(select);
            }
            updateSetTotal(arrowGrid, totalLabel);
            setBox.append(heading, arrowGrid);
            container.append(setBox);
        }
        const nameInput = card.querySelector(".archer-name");
        nameInput.setAttribute("aria-label", `Nama pemanah ${archerIndex + 1}`);
        nameInput.placeholder = `Nama pemanah ${archerIndex + 1}`;
    }

    function addArcher() {
        const list = document.getElementById("archer-list");
        const count = list.querySelectorAll(".archer-card").length;
        if (count >= 50) {
            window.alert("Maksimal 50 pemanah untuk satu pertandingan.");
            return;
        }
        const card = document.createElement("section");
        card.className = "archer-card";
        card.innerHTML = `<div class="archer-head"><span class="archer-index">${String(count + 1).padStart(2, "0")}</span><input class="archer-name" maxlength="80" required><button class="remove-archer" type="button">Hapus</button></div><div class="scores-wrap"><div class="score-sets"></div></div>`;
        card.querySelector(".remove-archer").addEventListener("click", () => {
            card.remove();
            [...list.querySelectorAll(".archer-card")].forEach((archerCard, index) => {
                archerCard.querySelector(".archer-index").textContent = String(index + 1).padStart(2, "0");
                archerCard.querySelectorAll(".arrow-select").forEach((select) => {
                    const [setIndex, arrowIndex] = select.dataset.position.split(":").map(Number);
                    select.setAttribute("aria-label", `Pemanah ${index + 1}, set ${setIndex + 1}, panah ${arrowIndex + 1}`);
                });
                archerCard.querySelector(".archer-name").setAttribute("aria-label", `Nama pemanah ${index + 1}`);
            });
            updateSummary();
        });
        list.append(card);
        renderArcherScores(card, count);
        updateSummary();
    }

    function bindEntryForm() {
        const form = document.getElementById("score-form");
        const list = document.getElementById("archer-list");
        document.getElementById("add-archer").addEventListener("click", addArcher);
        for (const id of ["set-count", "arrows-per-set"]) {
            document.getElementById(id).addEventListener("change", () => {
                [...list.querySelectorAll(".archer-card")].forEach((card, index) => renderArcherScores(card, index));
                updateSummary();
            });
        }
        addArcher();
        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            const button = form.querySelector('[type="submit"]');
            button.disabled = true;
            try {
                const archers = [...list.querySelectorAll(".archer-card")].map((card) => ({
                    name: card.querySelector(".archer-name").value.trim(),
                    sets: [...card.querySelectorAll(".set-box")].map((setBox) =>
                        [...setBox.querySelectorAll(".arrow-select")].map((select) => select.value)
                    ),
                }));
                const { match } = await request(apiUrl, {
                    method: "POST",
                    body: JSON.stringify({
                        event_name: document.getElementById("event-name").value,
                        set_count: Number(document.getElementById("set-count").value),
                        arrows_per_set: Number(document.getElementById("arrows-per-set").value),
                        archers,
                    }),
                });
                window.location.href = `?page=ranking&match=${encodeURIComponent(match.id)}&saved=1`;
            } catch (error) {
                showAlert(error.message);
                button.disabled = false;
            }
        });
    }

    function bindHistoryActions() {
        document.querySelectorAll(".delete-match-form").forEach((form) => {
            const deleteButton = form.querySelector(".delete-match-button");
            const confirmation = form.querySelector(".delete-confirmation");
            const cancelButton = form.querySelector(".cancel-delete-button");
            deleteButton.addEventListener("click", () => {
                deleteButton.hidden = true;
                confirmation.hidden = false;
                cancelButton.focus();
            });
            cancelButton.addEventListener("click", () => {
                confirmation.hidden = true;
                deleteButton.hidden = false;
                deleteButton.focus();
            });
            form.addEventListener("submit", async (event) => {
                event.preventDefault();
                const button = form.querySelector(".confirm-delete-button");
                button.disabled = true;
                try {
                    await request(apiUrl, {
                        method: "DELETE",
                        body: JSON.stringify({ id: form.querySelector('[name="match_id"]').value }),
                    });
                    window.location.href = "?page=history&deleted=1";
                } catch (error) {
                    showAlert(error.message);
                    button.disabled = false;
                }
            });
        });
    }

    async function init() {
        document.title = `${titleByPage[page]} · Busur`;
        document.querySelectorAll("[data-page-link]").forEach((link) => {
            if (link.dataset.pageLink === page) link.classList.add("active");
        });
        try {
            const data = await request(apiUrl);
            matches = data.matches;
            settings = data.settings;
            if (page === "entry") app.innerHTML = renderEntry();
            else if (page === "history") app.innerHTML = renderHistory();
            else if (page === "ranking") app.innerHTML = renderRanking();
            else app.innerHTML = renderScores();

            if (query.has("saved")) showAlert("Skor pertandingan berhasil disimpan.", true);
            else if (query.has("deleted")) showAlert("Pertandingan dan seluruh skornya berhasil dihapus.", true);
            if (page === "entry") bindEntryForm();
            if (page === "history") bindHistoryActions();
            const matchSelect = document.getElementById("match-select");
            if (matchSelect) {
                matchSelect.addEventListener("change", () => {
                    window.location.href = `?page=${encodeURIComponent(page)}&match=${encodeURIComponent(matchSelect.value)}`;
                });
            }
        } catch (error) {
            app.innerHTML = `<section class="card auth-card"><div class="eyebrow">Koneksi diperlukan</div><h1>Data Busur belum dapat dimuat.</h1><p>${escapeHtml(error.message)}</p><p>Pastikan Netlify Functions dan Netlify Blobs sudah aktif di situs ini.</p></section>`;
        }
    }

    init();
})();
