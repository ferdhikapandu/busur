CREATE DATABASE IF NOT EXISTS busur_panahan
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE busur_panahan;

CREATE TABLE IF NOT EXISTS app_settings (
    id TINYINT UNSIGNED NOT NULL DEFAULT 1,
    default_set_count TINYINT UNSIGNED NOT NULL DEFAULT 3,
    default_arrows_per_set TINYINT UNSIGNED NOT NULL DEFAULT 3,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT chk_settings_set_count CHECK (default_set_count BETWEEN 1 AND 12),
    CONSTRAINT chk_settings_arrows CHECK (default_arrows_per_set BETWEEN 1 AND 12)
) ENGINE=InnoDB;

INSERT IGNORE INTO app_settings (id, default_set_count, default_arrows_per_set)
VALUES (1, 3, 3);

CREATE TABLE IF NOT EXISTS matches (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    event_name VARCHAR(100) NOT NULL,
    set_count TINYINT UNSIGNED NOT NULL,
    arrows_per_set TINYINT UNSIGNED NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_matches_created_at (created_at),
    CONSTRAINT chk_matches_set_count CHECK (set_count BETWEEN 1 AND 12),
    CONSTRAINT chk_matches_arrows CHECK (arrows_per_set BETWEEN 1 AND 12)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS archers (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    match_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(80) NOT NULL,
    PRIMARY KEY (id),
    KEY idx_archers_match_id (match_id),
    CONSTRAINT fk_archers_match
        FOREIGN KEY (match_id) REFERENCES matches (id)
        ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS arrow_scores (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    archer_id BIGINT UNSIGNED NOT NULL,
    set_number TINYINT UNSIGNED NOT NULL,
    arrow_number TINYINT UNSIGNED NOT NULL,
    score_value TINYINT UNSIGNED NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_arrow_scores_position (archer_id, set_number, arrow_number),
    CONSTRAINT fk_arrow_scores_archer
        FOREIGN KEY (archer_id) REFERENCES archers (id)
        ON DELETE CASCADE,
    CONSTRAINT chk_arrow_scores_value CHECK (score_value IS NULL OR score_value <= 10)
) ENGINE=InnoDB;
