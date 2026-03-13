-- ============================================================
-- KC Catalogue — Schema MySQL (Final avec Bannière)
-- ============================================================
-- CREATE DATABASE IF NOT EXISTS kc_catalogue CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- USE kc_catalogue;
-- 1. Nettoyage
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS follows;
DROP TABLE IF EXISTS admin_actions;
DROP TABLE IF EXISTS reports;
DROP TABLE IF EXISTS friends;
DROP TABLE IF EXISTS reviews;
DROP TABLE IF EXISTS collections;
DROP TABLE IF EXISTS wishlists;
DROP TABLE IF EXISTS game_media;
DROP TABLE IF EXISTS games;
DROP TABLE IF EXISTS users;
SET FOREIGN_KEY_CHECKS = 1;
-- 2. Table Utilisateurs (Ajout de banner_url)
CREATE TABLE users (
    id INT NOT NULL AUTO_INCREMENT,
    email VARCHAR(255) NULL UNIQUE,
    password VARCHAR(255) NULL,
    username VARCHAR(100) NOT NULL UNIQUE,
    google_id VARCHAR(255) NULL,
    discord_id VARCHAR(255) NULL,
    steam_id VARCHAR(255) NULL,
    avatar_url VARCHAR(500) NULL,
    banner_url VARCHAR(500) NULL,
    -- <--- NOUVEAU CHAMP (Remplace banner_image_url)
    bio TEXT NULL,
    location VARCHAR(255) NULL,
    -- Keep social fields
    birthday DATE NULL,
    -- Keep social fields
    gender ENUM('male', 'female', 'other', 'prefer_not_to_say') NULL,
    -- Keep social fields
    role ENUM('user', 'admin') NOT NULL DEFAULT 'user',
    is_banned BOOLEAN NOT NULL DEFAULT FALSE,
    wishlist_public BOOLEAN NOT NULL DEFAULT FALSE,
    follows_public BOOLEAN NOT NULL DEFAULT FALSE,
    info_public BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
-- 3. Table Jeux
CREATE TABLE games (
    id INT NOT NULL AUTO_INCREMENT,
    igdb_id INT NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    summary TEXT NULL,
    first_release_date DATE NULL,
    developer VARCHAR(255) NULL,
    publisher VARCHAR(255) NULL,
    genres VARCHAR(500) NULL,
    platforms VARCHAR(500) NULL,
    cover_url VARCHAR(500) NULL,
    igdb_rating DECIMAL(5, 2) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
-- 4. Table Médias
CREATE TABLE game_media (
    id INT NOT NULL AUTO_INCREMENT,
    game_id INT NOT NULL,
    media_type ENUM('screenshot', 'video') NOT NULL,
    url VARCHAR(500) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
-- 5. Table Wishlists
CREATE TABLE wishlists (
    id INT NOT NULL AUTO_INCREMENT,
    user_id INT NOT NULL,
    game_id INT NOT NULL,
    added_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_wishlist (user_id, game_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
-- 6. Table Collections
CREATE TABLE collections (
    id INT NOT NULL AUTO_INCREMENT,
    user_id INT NOT NULL,
    game_id INT NOT NULL,
    status ENUM(
        'playing',
        'completed',
        'plan_to_play',
        'dropped',
        'on_hold'
    ) NOT NULL DEFAULT 'plan_to_play',
    added_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_collection (user_id, game_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
-- 7. Table Reviews
CREATE TABLE reviews (
    id INT NOT NULL AUTO_INCREMENT,
    user_id INT NOT NULL,
    game_id INT NOT NULL,
    rating TINYINT NOT NULL CHECK (
        rating BETWEEN 0 AND 10
    ),
    content TEXT NULL,
    is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_review (user_id, game_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
-- 8. Table Signalements
CREATE TABLE reports (
    id INT NOT NULL AUTO_INCREMENT,
    reporter_id INT NOT NULL,
    review_id INT NOT NULL,
    reason TEXT NOT NULL,
    status ENUM('pending', 'resolved', 'rejected') NOT NULL DEFAULT 'pending',
    resolved_by INT NULL,
    resolved_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE,
    FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE
    SET NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
-- 9. Table Logs Admin
CREATE TABLE admin_actions (
    id INT NOT NULL AUTO_INCREMENT,
    admin_id INT NOT NULL,
    action_type ENUM(
        'ban_user',
        'unban_user',
        'promote_admin',
        'demote_admin',
        'delete_user',
        'hide_review',
        'delete_review',
        'resolve_report',
        'delete_game',
        'refresh_game'
    ) NOT NULL,
    target_user_id INT NULL,
    target_review_id INT NULL,
    target_game_id INT NULL,
    details TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE
    SET NULL,
        FOREIGN KEY (target_review_id) REFERENCES reviews(id) ON DELETE
    SET NULL,
        FOREIGN KEY (target_game_id) REFERENCES games(id) ON DELETE
    SET NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
-- 11. Table Follows (Unidirectional)
CREATE TABLE follows (
    id INT NOT NULL AUTO_INCREMENT,
    follower_id INT NOT NULL,
    following_id INT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_follow (follower_id, following_id),
    FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
-- 12. Table Higher Lower Scores
CREATE TABLE higher_lower_scores (
    id INT NOT NULL AUTO_INCREMENT,
    user_id INT NOT NULL,
    score INT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_higher_lower_score (score DESC),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- 11. Initial Data
INSERT INTO users (username, email, password, role)
VALUES (
        'Admin',
        'admin@kccatalogue.com',
        '$2b$10$MqEtm2Si7bXTVBKJqHsVh.6oOzvXVUcdG5D290kB812vI5SiAdEja',
        'admin'
    ),
    (
        'Dylan',
        'user@kccatalogue.com',
        '$2b$10$ZpSp8meaF91tuiAW/GBFqOWnMdC5Idy3bAvfKwZViho9oQqRkP.I2',
        'user'
    );