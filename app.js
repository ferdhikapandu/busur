(() => {
    'use strict';

    const form = document.getElementById('score-form');
    document.querySelectorAll('.delete-match-form').forEach((deleteForm) => {
        const deleteButton = deleteForm.querySelector('.delete-match-button');
        const confirmation = deleteForm.querySelector('.delete-confirmation');
        const cancelButton = deleteForm.querySelector('.cancel-delete-button');
        const confirmedField = deleteForm.querySelector('[name="delete_confirmed"]');

        deleteButton.addEventListener('click', () => {
            deleteButton.hidden = true;
            confirmation.hidden = false;
            cancelButton.focus();
        });
        cancelButton.addEventListener('click', () => {
            confirmation.hidden = true;
            deleteButton.hidden = false;
            confirmedField.value = '0';
            deleteButton.focus();
        });
        deleteForm.addEventListener('submit', () => {
            confirmedField.value = '1';
        });
    });

    if (!form) return;

    const list = document.getElementById('archer-list');
    const setCount = document.getElementById('set-count');
    const arrowsPerSet = document.getElementById('arrows-per-set');
    const scoreSummary = document.getElementById('score-summary');
    const scoresJson = document.getElementById('archers-json');
    const addArcherButton = document.getElementById('add-archer');
    const scoreOptions = ['M', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
    let nextArcherId = 0;

    function updateSummary() {
        const selects = [...list.querySelectorAll('.arrow-select')];
        const completed = selects.filter((select) => select.value !== '').length;
        const archerCount = list.querySelectorAll('.archer-card').length;
        scoreSummary.textContent = `${archerCount} pemanah · ${completed}/${selects.length} nilai terisi`;
    }

    function renderScores(card, archerIndex) {
        const container = card.querySelector('.score-sets');
        const nameInput = card.querySelector('.archer-name');
        const previousScores = new Map(
            [...container.querySelectorAll('.arrow-select')].map((select) => [select.dataset.position, select.value])
        );
        container.replaceChildren();

        for (let setIndex = 0; setIndex < Number(setCount.value); setIndex++) {
            const setBox = document.createElement('div');
            setBox.className = 'set-box';

            const heading = document.createElement('div');
            heading.className = 'set-head';
            const setLabel = document.createElement('span');
            setLabel.textContent = `SET ${setIndex + 1}`;
            const setTotalLabel = document.createElement('span');
            setTotalLabel.className = 'set-total';
            setTotalLabel.textContent = '0 poin';
            heading.append(setLabel, setTotalLabel);

            const arrowGrid = document.createElement('div');
            arrowGrid.className = 'arrow-grid';
            for (let arrowIndex = 0; arrowIndex < Number(arrowsPerSet.value); arrowIndex++) {
                const select = document.createElement('select');
                select.className = 'arrow-select';
                select.dataset.position = `${setIndex}:${arrowIndex}`;
                select.setAttribute('aria-label', `Pemanah ${archerIndex + 1}, set ${setIndex + 1}, panah ${arrowIndex + 1}`);
                select.required = true;

                const placeholder = document.createElement('option');
                placeholder.value = '';
                placeholder.textContent = `P${arrowIndex + 1}`;
                select.append(placeholder);
                for (const score of scoreOptions) {
                    const option = document.createElement('option');
                    option.value = score;
                    option.textContent = score;
                    select.append(option);
                }

                const position = select.dataset.position;
                if (previousScores.has(position)) select.value = previousScores.get(position);
                select.addEventListener('change', () => {
                    const total = [...arrowGrid.querySelectorAll('.arrow-select')].reduce(
                        (sum, item) => sum + (item.value === 'M' || item.value === '' ? 0 : Number(item.value)),
                        0
                    );
                    setTotalLabel.textContent = `${total} poin`;
                    updateSummary();
                });
                arrowGrid.append(select);
            }

            const total = [...arrowGrid.querySelectorAll('.arrow-select')].reduce(
                (sum, select) => sum + (select.value === 'M' || select.value === '' ? 0 : Number(select.value)),
                0
            );
            setTotalLabel.textContent = `${total} poin`;
            setBox.append(heading, arrowGrid);
            container.append(setBox);
        }
        nameInput.setAttribute('aria-label', `Nama pemanah ${archerIndex + 1}`);
        nameInput.placeholder = `Nama pemanah ${archerIndex + 1}`;
        updateSummary();
    }

    function renumberArchers() {
        [...list.querySelectorAll('.archer-card')].forEach((card, index) => {
            card.dataset.archerIndex = String(index);
            card.querySelector('.archer-index').textContent = String(index + 1).padStart(2, '0');
            card.querySelectorAll('.arrow-select').forEach((select) => {
                const [setIndex, arrowIndex] = select.dataset.position.split(':').map(Number);
                select.setAttribute('aria-label', `Pemanah ${index + 1}, set ${setIndex + 1}, panah ${arrowIndex + 1}`);
            });
            card.querySelector('.archer-name').setAttribute('aria-label', `Nama pemanah ${index + 1}`);
        });
    }

    function addArcher() {
        if (list.querySelectorAll('.archer-card').length >= 50) {
            window.alert('Maksimal 50 pemanah untuk satu pertandingan.');
            return;
        }

        const index = nextArcherId++;
        const card = document.createElement('section');
        card.className = 'archer-card';
        card.dataset.archerIndex = String(index);

        const head = document.createElement('div');
        head.className = 'archer-head';
        const badge = document.createElement('span');
        badge.className = 'archer-index';
        badge.textContent = String(index + 1).padStart(2, '0');

        const name = document.createElement('input');
        name.className = 'archer-name';
        name.maxLength = 80;
        name.placeholder = `Nama pemanah ${index + 1}`;
        name.setAttribute('aria-label', `Nama pemanah ${index + 1}`);
        name.required = true;

        const remove = document.createElement('button');
        remove.className = 'remove-archer';
        remove.type = 'button';
        remove.textContent = 'Hapus';
        remove.addEventListener('click', () => {
            card.remove();
            renumberArchers();
            updateSummary();
        });

        head.append(badge, name, remove);
        const scoresWrap = document.createElement('div');
        scoresWrap.className = 'scores-wrap';
        const scoreSets = document.createElement('div');
        scoreSets.className = 'score-sets';
        scoresWrap.append(scoreSets);
        card.append(head, scoresWrap);
        list.append(card);
        renderScores(card, index);
    }

    function updateAllScores() {
        [...list.querySelectorAll('.archer-card')].forEach((card, index) => renderScores(card, index));
    }

    form.addEventListener('submit', () => {
        const archers = [...list.querySelectorAll('.archer-card')].map((card) => ({
            name: card.querySelector('.archer-name').value.trim(),
            sets: [...card.querySelectorAll('.set-box')].map((setBox) =>
                [...setBox.querySelectorAll('.arrow-select')].map((select) => select.value)
            )
        }));
        scoresJson.value = JSON.stringify(archers);
    });

    addArcherButton.addEventListener('click', addArcher);
    setCount.addEventListener('change', updateAllScores);
    arrowsPerSet.addEventListener('change', updateAllScores);
    addArcher();
})();
