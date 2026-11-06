<?php
declare(strict_types=1);

date_default_timezone_set('Asia/Jakarta');
$isHttps = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== '' && $_SERVER['HTTPS'] !== 'off';
ini_set('session.use_strict_mode', '1');
ini_set('session.use_only_cookies', '1');
session_set_cookie_params([
    'httponly' => true,
    'secure' => $isHttps,
    'samesite' => 'Lax',
]);
session_start();
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: strict-origin-when-cross-origin');

function e(string|int|null $value): string
{
    return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function csrfToken(): string
{
    if (!isset($_SESSION['csrf_token']) || !is_string($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }

    return $_SESSION['csrf_token'];
}

function verifyCsrf(): void
{
    $submitted = $_POST['csrf_token'] ?? '';
    if (!is_string($submitted) || !hash_equals(csrfToken(), $submitted)) {
        throw new InvalidArgumentException('Sesi formulir kedaluwarsa. Muat ulang halaman, lalu coba lagi.');
    }
}

function postRawText(string $key): string
{
    $value = $_POST[$key] ?? '';
    if (!is_string($value)) {
        throw new InvalidArgumentException('Data formulir tidak valid.');
    }

    return $value;
}

function postText(string $key): string
{
    return trim(postRawText($key));
}

function textLength(string $value): int
{
    $length = preg_match_all('/./us', $value);
    if ($length === false) {
        throw new InvalidArgumentException('Teks berisi karakter yang tidak valid.');
    }

    return $length;
}

function boundedInteger(mixed $value, int $minimum, int $maximum, string $label): int
{
    $parsed = filter_var($value, FILTER_VALIDATE_INT);
    if ($parsed === false || $parsed < $minimum || $parsed > $maximum) {
        throw new InvalidArgumentException($label . ' harus antara ' . $minimum . ' sampai ' . $maximum . '.');
    }

    return $parsed;
}

function redirectTo(string $url): never
{
    header('Location: ' . $url, true, 303);
    exit;
}

function orderedArchers(array $archers): array
{
    usort($archers, static function (array $first, array $second): int {
        $scoreOrder = $second['total'] <=> $first['total'];
        return $scoreOrder !== 0 ? $scoreOrder : strcasecmp($first['name'], $second['name']);
    });

    return $archers;
}

function rankingPosition(array $archers, int $index): int
{
    return $index > 0 && $archers[$index]['total'] === $archers[$index - 1]['total']
        ? rankingPosition($archers, $index - 1)
        : $index + 1;
}

function dateLabel(string $date): string
{
    try {
        return (new DateTimeImmutable($date))->format('d M Y · H:i');
    } catch (Exception) {
        return 'Tanggal tidak tersedia';
    }
}

function renderScoreRows(array $archers, int $setCount): string
{
    $ranked = orderedArchers($archers);
    $html = '';
    foreach ($ranked as $index => $archer) {
        $rank = rankingPosition($ranked, $index);
        $rankLabel = $rank === 1 ? '🏆' : '#' . $rank;
        $html .= '<tr><td class="rank-cell' . ($rank === 1 ? ' rank-first' : '') . '">' . $rankLabel . '</td>';
        $html .= '<td><strong>' . e($archer['name']) . '</strong></td>';
        for ($setNumber = 0; $setNumber < $setCount; $setNumber++) {
            $set = $archer['sets'][$setNumber];
            $scores = array_map(static fn (?int $score): string => $score === null ? 'M' : (string) $score, $set['scores']);
            $html .= '<td>' . $set['total'] . '<span class="arrow-detail">' . e(implode(' · ', $scores)) . '</span></td>';
        }
        $html .= '<td class="total-cell">' . $archer['total'] . ' poin</td></tr>';
    }

    return $html;
}

function renderTableHead(int $setCount): string
{
    $html = '<tr><th>Peringkat</th><th>Nama pemanah</th>';
    for ($setNumber = 1; $setNumber <= $setCount; $setNumber++) {
        $html .= '<th>Set ' . $setNumber . '</th>';
    }
    return $html . '<th>Total</th></tr>';
}

$page = isset($_GET['page']) && is_string($_GET['page']) ? $_GET['page'] : 'scores';
$allowedPages = ['scores', 'history', 'ranking', 'entry'];
if (!in_array($page, $allowedPages, true)) {
    $page = 'scores';
}

$error = '';
$notice = '';
$settings = ['default_set_count' => 3, 'default_arrows_per_set' => 3];
$matches = [];
$databaseError = '';
$config = require __DIR__ . DIRECTORY_SEPARATOR . 'config.php';
$dsn = sprintf(
    'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
    $config['host'],
    $config['port'],
    $config['database']
);

try {
    $pdo = new PDO($dsn, $config['username'], $config['password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    $settingsRow = $pdo->query('SELECT default_set_count, default_arrows_per_set FROM app_settings WHERE id = 1')->fetch();
    if ($settingsRow !== false) {
        $settings = $settingsRow;
    }
} catch (PDOException $exception) {
    error_log('Busur database connection error: ' . $exception->getMessage());
    $databaseError = 'Database belum siap. Pastikan MySQL aktif, impor database.sql lewat phpMyAdmin, lalu periksa config.php.';
}

if ($databaseError === '' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        $action = postText('action');
        verifyCsrf();

        if ($action === 'save_match') {
            $eventName = postText('event_name');
            if ($eventName === '' || textLength($eventName) > 100) {
                throw new InvalidArgumentException('Nama pertandingan wajib diisi dan maksimal 100 karakter.');
            }
            $setCount = boundedInteger($_POST['set_count'] ?? null, 1, 12, 'Jumlah set');
            $arrowsPerSet = boundedInteger($_POST['arrows_per_set'] ?? null, 1, 12, 'Jumlah panah per set');
            $submittedJson = postText('archers_json');
            try {
                $submittedArchers = json_decode($submittedJson, true, 512, JSON_THROW_ON_ERROR);
            } catch (JsonException $exception) {
                throw new InvalidArgumentException('Data skor pemanah tidak valid. Periksa kembali skor sebelum menyimpan.', 0, $exception);
            }
            if (!is_array($submittedArchers) || count($submittedArchers) < 1 || count($submittedArchers) > 50) {
                throw new InvalidArgumentException('Tambahkan minimal satu dan maksimal 50 pemanah.');
            }

            $validatedArchers = [];
            foreach ($submittedArchers as $submittedArcher) {
                if (!is_array($submittedArcher) || !isset($submittedArcher['name'], $submittedArcher['sets']) || !is_string($submittedArcher['name']) || !is_array($submittedArcher['sets'])) {
                    throw new InvalidArgumentException('Data pemanah tidak valid.');
                }
                $name = trim($submittedArcher['name']);
                if ($name === '' || textLength($name) > 80) {
                    throw new InvalidArgumentException('Nama setiap pemanah wajib diisi dan maksimal 80 karakter.');
                }
                if (count($submittedArcher['sets']) !== $setCount) {
                    throw new InvalidArgumentException('Jumlah set pada skor tidak sesuai.');
                }
                $validatedSets = [];
                for ($setIndex = 0; $setIndex < $setCount; $setIndex++) {
                    $setScores = $submittedArcher['sets'][$setIndex] ?? null;
                    if (!is_array($setScores) || count($setScores) !== $arrowsPerSet) {
                        throw new InvalidArgumentException('Jumlah panah pada set tidak sesuai.');
                    }
                    $validatedScores = [];
                    for ($arrowIndex = 0; $arrowIndex < $arrowsPerSet; $arrowIndex++) {
                        $score = $setScores[$arrowIndex] ?? null;
                        if ($score !== 'M' && (!is_string($score) || !preg_match('/^(?:0|[1-9]|10)$/', $score))) {
                            throw new InvalidArgumentException('Setiap panah harus memiliki nilai M atau 0 sampai 10.');
                        }
                        $validatedScores[] = $score === 'M' ? null : (int) $score;
                    }
                    $validatedSets[] = $validatedScores;
                }
                $validatedArchers[] = ['name' => $name, 'sets' => $validatedSets];
            }

            $pdo->beginTransaction();
            try {
                $insertMatch = $pdo->prepare(
                    'INSERT INTO matches (event_name, set_count, arrows_per_set) VALUES (:event_name, :set_count, :arrows_per_set)'
                );
                $insertMatch->execute([
                    'event_name' => $eventName,
                    'set_count' => $setCount,
                    'arrows_per_set' => $arrowsPerSet,
                ]);
                $matchId = (int) $pdo->lastInsertId();
                $insertArcher = $pdo->prepare('INSERT INTO archers (match_id, name) VALUES (:match_id, :name)');
                $insertScore = $pdo->prepare(
                    'INSERT INTO arrow_scores (archer_id, set_number, arrow_number, score_value) VALUES (:archer_id, :set_number, :arrow_number, :score_value)'
                );
                foreach ($validatedArchers as $archer) {
                    $insertArcher->execute(['match_id' => $matchId, 'name' => $archer['name']]);
                    $archerId = (int) $pdo->lastInsertId();
                    foreach ($archer['sets'] as $setIndex => $scores) {
                        foreach ($scores as $arrowIndex => $score) {
                            $insertScore->execute([
                                'archer_id' => $archerId,
                                'set_number' => $setIndex + 1,
                                'arrow_number' => $arrowIndex + 1,
                                'score_value' => $score,
                            ]);
                        }
                    }
                }
                $pdo->commit();
            } catch (Throwable $exception) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                throw $exception;
            }
            redirectTo('?page=ranking&match=' . $matchId . '&saved=1');
        }

        if ($action === 'delete_match') {
            if (postText('delete_confirmed') !== '1') {
                throw new InvalidArgumentException('Konfirmasi penghapusan terlebih dahulu dengan menekan tombol Hapus dua kali.');
            }
            $matchId = boundedInteger($_POST['match_id'] ?? null, 1, PHP_INT_MAX, 'ID pertandingan');
            $deleteMatch = $pdo->prepare('DELETE FROM matches WHERE id = :id');
            $deleteMatch->execute(['id' => $matchId]);
            if ($deleteMatch->rowCount() === 0) {
                throw new InvalidArgumentException('Pertandingan tidak ditemukan atau sudah dihapus.');
            }

            redirectTo('?page=history&deleted=1');
        }

        throw new InvalidArgumentException('Aksi tidak dikenal. Muat ulang halaman dan coba lagi.');
    } catch (InvalidArgumentException $exception) {
        $error = $exception->getMessage();
    } catch (PDOException $exception) {
        error_log('Busur database operation error: ' . $exception->getMessage());
        $error = 'Perubahan gagal diproses di database. Periksa konfigurasi dan struktur database.';
    } catch (Throwable $exception) {
        error_log('Busur application error: ' . $exception->getMessage());
        $error = 'Terjadi kesalahan saat memproses perubahan. Silakan coba kembali.';
    }
}

if ($databaseError === '') {
    try {
        $matchRows = $pdo->query(
            'SELECT id, event_name, set_count, arrows_per_set, created_at FROM matches ORDER BY created_at DESC, id DESC'
        )->fetchAll();
        $matchesById = [];
        foreach ($matchRows as $row) {
            $row['id'] = (int) $row['id'];
            $row['set_count'] = (int) $row['set_count'];
            $row['arrows_per_set'] = (int) $row['arrows_per_set'];
            $row['archers'] = [];
            $matchesById[$row['id']] = $row;
        }

        if ($matchesById !== []) {
            $archerRows = $pdo->query('SELECT id, match_id, name FROM archers ORDER BY id')->fetchAll();
            $archerIndex = [];
            foreach ($archerRows as $archerRow) {
                $matchId = (int) $archerRow['match_id'];
                $archerId = (int) $archerRow['id'];
                if (!isset($matchesById[$matchId])) {
                    continue;
                }
                $sets = [];
                for ($setIndex = 0; $setIndex < $matchesById[$matchId]['set_count']; $setIndex++) {
                    $sets[] = [
                        'scores' => array_fill(0, $matchesById[$matchId]['arrows_per_set'], null),
                        'total' => 0,
                    ];
                }
                $matchesById[$matchId]['archers'][] = [
                    'id' => $archerId,
                    'name' => $archerRow['name'],
                    'sets' => $sets,
                    'total' => 0,
                ];
                $archerIndex[$archerId] = [$matchId, count($matchesById[$matchId]['archers']) - 1];
            }

            $scoreRows = $pdo->query(
                'SELECT archer_id, set_number, arrow_number, score_value FROM arrow_scores ORDER BY archer_id, set_number, arrow_number'
            )->fetchAll();
            foreach ($scoreRows as $scoreRow) {
                $archerId = (int) $scoreRow['archer_id'];
                if (!isset($archerIndex[$archerId])) {
                    continue;
                }
                [$matchId, $archerOffset] = $archerIndex[$archerId];
                $setIndex = (int) $scoreRow['set_number'] - 1;
                $arrowIndex = (int) $scoreRow['arrow_number'] - 1;
                $score = $scoreRow['score_value'] === null ? null : (int) $scoreRow['score_value'];
                $matchesById[$matchId]['archers'][$archerOffset]['sets'][$setIndex]['scores'][$arrowIndex] = $score;
                $matchesById[$matchId]['archers'][$archerOffset]['sets'][$setIndex]['total'] += $score ?? 0;
                $matchesById[$matchId]['archers'][$archerOffset]['total'] += $score ?? 0;
            }
        }
        $matches = array_values($matchesById);
    } catch (PDOException $exception) {
        error_log('Busur database read error: ' . $exception->getMessage());
        $databaseError = 'Data database tidak dapat dibaca. Periksa apakah database.sql sudah diimpor dengan benar.';
    }
}

$selectedMatchId = isset($_GET['match']) && is_string($_GET['match']) && ctype_digit($_GET['match'])
    ? (int) $_GET['match']
    : 0;
$selectedMatch = null;
foreach ($matches as $match) {
    if ($match['id'] === $selectedMatchId) {
        $selectedMatch = $match;
        break;
    }
}
if ($selectedMatch === null && $matches !== []) {
    $selectedMatch = $matches[0];
}

if (isset($_GET['deleted']) && $_GET['deleted'] === '1') {
    $notice = 'Pertandingan dan seluruh skornya berhasil dihapus.';
} elseif (isset($_GET['saved'])) {
    $notice = 'Skor pertandingan berhasil disimpan.';
}

$titleByPage = [
    'scores' => 'Skor pertandingan',
    'history' => 'Riwayat pertandingan',
    'ranking' => 'Peringkat pemanah',
    'entry' => 'Input skor pertandingan',
];
$title = $titleByPage[$page] ?? 'Skor pertandingan';
?>
<!doctype html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#e7efe6">
    <title><?= e($title) ?> · Busur</title>
    <link rel="stylesheet" href="styles.css?v=<?= (int) filemtime(__DIR__ . DIRECTORY_SEPARATOR . 'styles.css') ?>">
</head>
<body>
<header>
    <div class="shell topbar">
        <a class="brand" href="?page=scores">
            <span class="brand-mark" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none"><path d="M5 3c8 4 8 14 0 18M5 12h13m0 0-4-4m4 4-4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </span>
            <span><span class="brand-name">busur<span class="brand-period">.</span></span><br><span class="brand-note">ARCHERY SCOREKEEPER</span></span>
        </a>
        <?php if ($databaseError === ''): ?>
            <nav class="nav" aria-label="Navigasi utama">
                <a href="?page=scores" class="<?= $page === 'scores' ? 'active' : '' ?>">Skor</a>
                <a href="?page=history" class="<?= $page === 'history' ? 'active' : '' ?>">Riwayat</a>
                <a href="?page=ranking" class="<?= $page === 'ranking' ? 'active' : '' ?>">Peringkat</a>
                <a href="?page=entry" class="<?= $page === 'entry' ? 'active' : '' ?>">Input skor</a>
            </nav>
        <?php endif; ?>
    </div>
</header>
<main class="shell">
    <?php if ($databaseError !== ''): ?>
        <section class="auth-shell">
            <div class="card auth-card">
                <div class="eyebrow">Koneksi diperlukan</div>
                <h1>Siapkan database Busur.</h1>
                <p><?= e($databaseError) ?></p>
                <ol class="setup-steps">
                    <li>Jalankan Apache dan MySQL di XAMPP.</li>
                    <li>Impor <code>database.sql</code> lewat phpMyAdmin.</li>
                    <li>Pastikan host dan kredensial database di <code>config.php</code> sesuai.</li>
                </ol>
            </div>
        </section>
    <?php else: ?>
        <?php if ($error !== ''): ?><div class="alert" role="alert"><?= e($error) ?></div><?php endif; ?>
        <?php if ($notice !== ''): ?><div class="alert success" role="status"><?= e($notice) ?></div><?php endif; ?>

        <?php if ($page === 'entry'): ?>
            <div class="intro">
                <div><div class="eyebrow">Input peserta</div><h1>Catat skor pertandingan.</h1><p>Isi hasil pertandingan dan bagikan peringkatnya kepada semua peserta.</p></div>
            </div>
            <form method="post" id="score-form">
                <input type="hidden" name="csrf_token" value="<?= e(csrfToken()) ?>">
                <input type="hidden" name="action" value="save_match">
                <input type="hidden" name="archers_json" id="archers-json">
                <div class="layout">
                    <section class="card form-card">
                        <h2 class="section-title"><span class="step">01</span> Detail pertandingan</h2>
                        <div class="field-grid">
                            <div class="field full"><label for="event-name">Nama pertandingan</label><input id="event-name" name="event_name" maxlength="100" placeholder="Contoh: Latihan Minggu Pagi" required></div>
                            <div class="field"><label for="set-count">Jumlah set</label><select id="set-count" name="set_count" data-selected="<?= (int) $settings['default_set_count'] ?>"><?php for ($count = 1; $count <= 12; $count++): ?><option value="<?= $count ?>" <?= $count === (int) $settings['default_set_count'] ? 'selected' : '' ?>><?= $count ?> set</option><?php endfor; ?></select></div>
                            <div class="field"><label for="arrows-per-set">Anak panah per set</label><select id="arrows-per-set" name="arrows_per_set" data-selected="<?= (int) $settings['default_arrows_per_set'] ?>"><?php for ($count = 1; $count <= 12; $count++): ?><option value="<?= $count ?>" <?= $count === (int) $settings['default_arrows_per_set'] ? 'selected' : '' ?>><?= $count ?> panah</option><?php endfor; ?></select></div>
                        </div>
                        <div class="divider"></div>
                        <h2 class="section-title"><span class="step">02</span> Pemanah &amp; nilai</h2>
                        <div class="archer-list" id="archer-list"></div>
                        <div class="button-row">
                            <button class="button button-secondary" type="button" id="add-archer">＋ Tambah pemanah</button>
                            <span class="subtext" id="score-summary">Pilih nilai untuk setiap anak panah.</span>
                        </div>
                        <div class="divider"></div>
                        <div class="button-row">
                            <span class="subtext">Nilai maksimal tiap panah adalah 10.</span>
                            <button class="button button-primary" type="submit">Simpan &amp; lihat peringkat <span aria-hidden="true">→</span></button>
                        </div>
                    </section>
                    <aside class="card side-card">
                        <h2>Informasi</h2>
                        <ul class="guide-list">
                            <li><span class="guide-icon">01</span><span>Siapa saja dapat mencatat pertandingan dan skornya.</span></li>
                            <li><span class="guide-icon">02</span><span>Hasil yang disimpan akan terlihat oleh semua pengunjung.</span></li>
                            <li><span class="guide-icon">03</span><span>Nilai M dihitung nol. Total set dan peringkat otomatis.</span></li>
                        </ul>
                        <div class="hint">Pastikan nama pertandingan dan skor sudah benar sebelum disimpan.</div>
                    </aside>
                </div>
            </form>
        <?php elseif ($page === 'scores' || $page === 'ranking'): ?>
            <div class="intro">
                <div><div class="eyebrow"><?= $page === 'scores' ? 'Papan skor publik' : 'Hasil pertandingan' ?></div><h1><?= $page === 'scores' ? 'Skor & peringkat.' : 'Peringkat pemanah.' ?></h1><p>Skor pertandingan bisa dilihat semua peserta tanpa perlu login.</p></div>
                <?php if ($page === 'scores'): ?><span class="count-pill"><?= count($matches) ?> pertandingan</span><?php endif; ?>
            </div>
            <?php if ($matches === []): ?>
                <section class="card empty"><div class="empty-icon">⌁</div><h2>Skor belum tersedia</h2><p>Belum ada pertandingan yang dicatat. Tambahkan pertandingan untuk mulai mengisi skor.</p><a class="button button-primary" href="?page=entry">＋ Catat pertandingan</a></section>
            <?php else: ?>
                <div class="toolbar"><h2>Pilih pertandingan</h2><select class="rank-select" aria-label="Pilih pertandingan" onchange="if(this.value) location.href='?page=ranking&amp;match='+encodeURIComponent(this.value)"><?php foreach ($matches as $match): ?><option value="<?= $match['id'] ?>" <?= $selectedMatch !== null && $selectedMatch['id'] === $match['id'] ? 'selected' : '' ?>><?= e($match['event_name']) ?> — <?= e(dateLabel($match['created_at'])) ?></option><?php endforeach; ?></select></div>
                <?php if ($selectedMatch !== null && $selectedMatch['archers'] !== []): ?>
                    <?php $rankedArchers = orderedArchers($selectedMatch['archers']); $winningScore = $rankedArchers[0]['total']; $winners = array_values(array_filter($rankedArchers, static fn (array $archer): bool => $archer['total'] === $winningScore)); ?>
                    <div class="ranking-banner"><span class="trophy" aria-hidden="true">🏆</span><div><strong><?= e(implode(' & ', array_column($winners, 'name'))) ?></strong><span>Nilai tertinggi · <?= e($selectedMatch['event_name']) ?></span></div><span class="winner-score"><?= $winningScore ?> <small>pts</small></span></div>
                    <section class="card rank-table-card"><div class="match-top"><div><h2><?= e($selectedMatch['event_name']) ?></h2><div class="match-meta"><?= e(dateLabel($selectedMatch['created_at'])) ?> · <?= $selectedMatch['set_count'] ?> set · <?= $selectedMatch['arrows_per_set'] ?> panah per set</div></div></div><div class="match-body"><table><thead><?= renderTableHead($selectedMatch['set_count']) ?></thead><tbody><?= renderScoreRows($selectedMatch['archers'], $selectedMatch['set_count']) ?></tbody></table></div></section>
                <?php endif; ?>
            <?php endif; ?>
        <?php elseif ($page === 'history'): ?>
            <div class="intro"><div><div class="eyebrow">Arsip skor</div><h1>Riwayat pertandingan.</h1><p>Semua sesi beserta total skor setiap set.</p></div><a class="button button-primary" href="?page=entry">＋ Catat pertandingan</a></div>
            <?php if ($matches === []): ?>
                <section class="card empty"><div class="empty-icon">⌂</div><h2>Belum ada riwayat</h2><p>Riwayat pertandingan akan muncul di sini setelah ada pertandingan yang dicatat.</p></section>
            <?php else: ?>
                <div class="match-list"><?php foreach ($matches as $match): ?><section class="card match-card"><div class="match-top"><div><h2><?= e($match['event_name']) ?></h2><div class="match-meta"><?= e(dateLabel($match['created_at'])) ?> · <?= count($match['archers']) ?> pemanah · <?= $match['set_count'] ?> set</div></div><div class="match-actions"><a class="button button-light" href="?page=ranking&amp;match=<?= $match['id'] ?>">Lihat peringkat</a><form class="delete-match-form" method="post"><input type="hidden" name="csrf_token" value="<?= e(csrfToken()) ?>"><input type="hidden" name="action" value="delete_match"><input type="hidden" name="match_id" value="<?= $match['id'] ?>"><input type="hidden" name="delete_confirmed" value="0"><button class="button button-light delete-match-button" type="button">Hapus</button><div class="delete-confirmation" hidden><span>Yakin ingin menghapus riwayat ini?</span><button class="button button-light confirm-delete-button" type="submit">Hapus</button><button class="button button-light cancel-delete-button" type="button">Batal</button></div></form></div></div><div class="match-body"><table><thead><?= renderTableHead($match['set_count']) ?></thead><tbody><?= renderScoreRows($match['archers'], $match['set_count']) ?></tbody></table></div></section><?php endforeach; ?></div>
            <?php endif; ?>
        <?php endif; ?>
    <?php endif; ?>
</main>
<footer class="shell">Busur · Catatan skor panahan untuk semua peserta</footer>
<script src="app.js?v=<?= (int) filemtime(__DIR__ . DIRECTORY_SEPARATOR . 'app.js') ?>" defer></script>
</body>
</html>
