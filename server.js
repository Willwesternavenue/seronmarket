// server.js

require('dotenv').config(); // 環境変数の読み込み

const express = require('express');
const path = require('path');
const app = express();
const session = require('express-session');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const helmet = require('helmet');
const router = express.Router();

// =========================
// 1. データベース初期化
// =========================
const dbPath = path.join(__dirname, 'db', 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Could not connect to database', err);
        process.exit(1); // データベース接続エラーでプロセスを終了
    } else {
        console.log('Connected to SQLite database');
    }
});

// =========================
// 2. ポート設定
// =========================
const PORT = process.env.PORT || 3000;
const HOST = '127.0.0.1'; // ホストを127.0.0.1に設定

// =========================
// 3. ミドルウェア設定
// =========================
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(session({
    secret: process.env.SESSION_SECRET || 'your_secure_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production', // 本番環境ではtrue (HTTPS必須)
        httpOnly: true,
        maxAge: 1000 * 60 * 60 // 1時間
    }
}));

// HelmetとCSPの統合設定
if (process.env.NODE_ENV === 'production') {
    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'"],
                styleSrc: ["'self'", 'https://cdn.jsdelivr.net'], // jsDelivr等
                imgSrc: ["'self'", 'data:', 'https://cdn.jsdelivr.net'],
                connectSrc: ["'self'"],
                fontSrc: ["'self'", 'https://cdn.jsdelivr.net'],
                objectSrc: ["'none'"],
                baseUri: ["'self'"],
                formAction: ["'self'"],
                frameAncestors: ["'self'"],
                scriptSrcAttr: ["'none'"],
                upgradeInsecureRequests: true
            }
        },
        hsts: {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true
        }
    }));
} else {
    // 開発環境ではCSP/HSTSを緩和
    app.use(helmet({
        contentSecurityPolicy: false,
        hsts: false
    }));
}

// 静的ファイルの提供
app.use(express.static(path.join(__dirname, 'public')));

// CSPヘッダーをログに出力するミドルウェア (開発デバッグ用)
if (process.env.NODE_ENV !== 'production') {
    app.use((req, res, next) => {
        res.on('finish', () => {
            const csp = res.getHeader('Content-Security-Policy');
            if (csp) {
                console.log('CSP Header:', csp);
            }
        });
        next();
    });
}

// =========================
// 4. 認証ミドルウェア
// =========================
function isAuthenticated(req, res, next) {
    if (req.session && req.session.userId) {
        // データベースからユーザー情報を取得して req.user に設定
        const sql = 'SELECT id, username, is_Admin FROM users WHERE id = ?';
        db.get(sql, [req.session.userId], (err, user) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Internal server error' });
            }
            if (!user) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            req.user = user; // `req.user` にユーザー情報を設定
            next();
        });
    } else {
        return res.status(401).json({ error: 'Unauthorized' });
    }
}

function isAdmin(req, res, next) {
    if (req.session && req.session.isAdmin) {
        return next();
    }
    return res.status(403).json({ error: 'Forbidden: Admins only' });
}
// =========================
// 5. テーブル作成
// =========================
const tableDefinitions = [
    // Users
    `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        is_admin INTEGER DEFAULT 0
    )`,
    // Categories
    `CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    // Issues
    `CREATE TABLE IF NOT EXISTS issues (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        headline TEXT NOT NULL,
        description TEXT NOT NULL,
        tag TEXT,
        created_by INTEGER,
        likes INTEGER DEFAULT 0,
        is_featured INTEGER DEFAULT 0,
        yes_count INTEGER DEFAULT 0,
        no_count INTEGER DEFAULT 0,
        category_id INTEGER REFERENCES categories(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
    )`,
    // Stances
    `CREATE TABLE IF NOT EXISTS stances (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        issue_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        stance TEXT NOT NULL,
        comment TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (issue_id) REFERENCES issues(id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        UNIQUE (user_id, issue_id)
    )`,
    // Favorites
    `CREATE TABLE IF NOT EXISTS favorites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        issue_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, issue_id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (issue_id) REFERENCES issues(id)
    )`,
    // Comments
    `CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        issue_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        comment TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (issue_id) REFERENCES issues(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
    )`
];

for (const sql of tableDefinitions) {
    db.run(sql, (err) => {
        if (err) {
            console.error('Error creating table:', err);
        }
    });
}

// =========================
// 6. 初期データ投入
// =========================
const initialCategories = [
    '政治', '社会', '経済', '外交', '国際', '税金',
    'ビジネス', '少子高齢化', '医療福祉', '教育', '環境',
    'テクノロジー', '文化', '地理'
];

initialCategories.forEach((name) => {
    db.run(`INSERT OR IGNORE INTO categories (name) VALUES (?)`, [name], (err) => {
        if (err) {
            console.error('Error inserting initial categories:', err);
        }
    });
});

// =========================
// 7. ルート & エンドポイント
// =========================

// --- 静的ページ ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});
app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'register.html'));
});
app.get('/mypage', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'mypage.html'));
});
app.get('/admin', isAuthenticated, isAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});
// ログインユーザー情報取得
app.get('/api/user', isAuthenticated, (req, res) => {
    if (!req.user) {
        return res.status(404).json({ error: 'User not found' });
    }
    res.json({
        id: req.user.id,
        username: req.user.username,
        isAdmin: req.user.isAdmin,
    });
});

// セッション内容のデバッグ
app.get('/debug-session', (req, res) => {
    res.json(req.session);
});


// --- APIエンドポイント ---
// カテゴリ別のイシューを取得
app.get('/api/issues', (req, res) => {
    const categoryId = req.query.category_id; // クエリパラメータからカテゴリIDを取得

    let sql = `
        SELECT 
            issues.id, 
            issues.headline, 
            issues.description, 
            issues.likes, 
            issues.is_featured,
            categories.name AS category_name,
            users.username AS created_by
        FROM issues
        LEFT JOIN categories ON issues.category_id = categories.id
        LEFT JOIN users ON issues.created_by = users.id
    `;
    const params = [];

    // カテゴリIDが指定されている場合にフィルタリング
    if (categoryId) {
        sql += ' WHERE issues.category_id = ?';
        params.push(categoryId);
    }

    db.all(sql, params, (err, rows) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to fetch issues' });
        }
        res.json(rows);
    });
});

/**
 * キーワード検索で該当するイシューを取得
 * @param {string} q - 検索キーワード
 * @returns {Promise<Array>} - 検索結果の配列
 */
function getIssuesBySearch(q) {
    return new Promise((resolve, reject) => {
        // 例: headline や description から部分一致検索する
        const sql = `
            SELECT 
                issues.id,
                issues.headline,
                issues.description,
                issues.category_id,
                categories.name AS category_name,
                users.username AS created_by,
                issues.likes,
                issues.is_featured
            FROM issues
            LEFT JOIN categories ON issues.category_id = categories.id
            LEFT JOIN users ON issues.created_by = users.id
            WHERE issues.headline LIKE ?
               OR issues.description LIKE ?
            ORDER BY issues.id DESC
        `;
        const likeQuery = `%${q}%`;

        db.all(sql, [likeQuery, likeQuery], (err, rows) => {
            if (err) {
                return reject(err);
            }
            resolve(rows);
        });
    });
}


// カテゴリ一覧を取得
app.get('/api/categories', (req, res) => {
    const sql = 'SELECT id, name FROM categories';

    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to fetch categories' });
        }
        res.json(rows);
    });
});
// コメントを取得
app.get('/api/issues/:issue_id/comments', (req, res) => {
    const issueId = req.params.issue_id;

    const sql = `
        SELECT COALESCE(stances.comment, '') AS comment
        FROM stances
        WHERE stances.issue_id = ?
        AND stances.comment IS NOT NULL AND stances.comment != ''
        ORDER BY stances.created_at DESC
    `;

    db.all(sql, [issueId], (err, rows) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to fetch comments' });
        }
        res.json(rows);
    });
});


// --- 認証系エンドポイント ---

// 新規ユーザー登録
app.post('/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        if (user) {
            return res.status(400).json({ error: 'Username already exists' });
        }
        bcrypt.hash(password, 10, (err, hash) => {
            if (err) {
                console.error('Bcrypt error:', err);
                return res.status(500).json({ error: 'Error hashing password' });
            }
            db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hash], function (err) {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).json({ error: 'Database error' });
                }
                // 新規ユーザー登録後、セッションを開始
                req.session.userId = this.lastID;
                req.session.username = username;
                req.session.isAdmin = false; // 初期値は非管理者
                res.redirect('/mypage');
            });
        });
    });
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;

    db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
        if (err) {
            console.error('An error occurred during login.');
            return res.status(500).json({ error: 'An internal error occurred.' });
        }

        if (!user) {
            return res.status(400).json({ error: 'Invalid username or password' });
        }

        bcrypt.compare(password, user.password, (err, result) => {
            if (err) {
                console.error('An error occurred during password comparison.');
                return res.status(500).json({ error: 'Authentication error' });
            }

            if (!result) {
                return res.status(400).json({ error: 'Invalid username or password' });
            }

            req.session.regenerate((err) => {
                if (err) {
                    console.error('Session regeneration error:', err);
                    return res.status(500).json({ error: 'Session error' });
                }

                req.session.userId = user.id;
                req.session.username = user.username;
                req.session.isAdmin = user.is_admin === 1;

                // 管理者リダイレクト
                if (user.is_admin === 1) {
                    return res.redirect('/admin');
                }

                // 通常ユーザーリダイレクト
                return res.redirect('/mypage');
            });
        });
    });
});


// ログアウト
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Session destroy error:', err);
            return res.status(500).json({ error: 'Logout failed' });
        }
        res.redirect('/login');
    });
});


// イシュー作成
app.post('/api/issues', (req, res) => {
    const { headline, description, tag, is_featured } = req.body;

    if (!headline || !description || !tag) {
        return res.status(400).json({ error: 'すべてのフィールドが必要です。' });
    }

    const checkSql = `SELECT id FROM issues WHERE headline = ?`;
    db.get(checkSql, [headline], (err, row) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'データベースエラー' });
        }

        if (row) {
            return res.status(400).json({ error: '同じヘッドラインのイシューが既に存在します。' });
        }

        const insertSql = `INSERT INTO issues (headline, description, tag, is_featured) VALUES (?, ?, ?, ?)`;
        db.run(insertSql, [headline, description, tag, is_featured ? 1 : 0], function (err) {
            if (err) {
                console.error('Database insert error:', err);
                return res.status(500).json({ error: 'イシューの作成に失敗しました。' });
            }
            res.status(201).json({ id: this.lastID, message: 'イシューが正常に作成されました。' });
        });
    });
});

// イシュー更新 (管理者)
app.put('/api/issues/:id', isAuthenticated, isAdmin, (req, res) => {
    const { issue_id, stance, comment } = req.body;
    const user_id = req.session.user_id;

    // トランザクションで複数の操作を実行
    db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        // 1. スタンスを stances テーブルに追加
        const sqlStance = `
            INSERT INTO stances (issue_id, stance, comment, user_id)
            VALUES (?, ?, ?, ?);
        `;
        db.run(sqlStance, [issue_id, stance, comment, user_id], function (err) {
            if (err) {
                console.error('Error inserting stance:', err);
                db.run('ROLLBACK');
                return res.status(500).json({ error: 'Failed to submit stance' });
            }
        });

        // 2. コメントを comments テーブルに追加（空コメントの場合はスキップ）
        if (comment) {
            const sqlComment = `
                INSERT INTO comments (issue_id, comment, user_id, created_at)
                VALUES (?, ?, ?, datetime('now'));
            `;
            db.run(sqlComment, [issue_id, comment, user_id], function (err) {
                if (err) {
                    console.error('Error inserting comment:', err);
                    db.run('ROLLBACK');
                    return res.status(500).json({ error: 'Failed to submit comment' });
                }
            });
        }

        // トランザクションをコミット
        db.run('COMMIT', (err) => {
            if (err) {
                console.error('Error committing transaction:', err);
                db.run('ROLLBACK');
                return res.status(500).json({ error: 'Failed to complete transaction' });
            }
            res.json({ success: true });
        });
    });
});

// イシュー削除 (必要なら)
app.delete('/api/issues/:id', isAuthenticated, isAdmin, (req, res) => {
    const issueId = req.params.id;
    db.run(`DELETE FROM issues WHERE id = ?`, [issueId], function (err) {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Issue not found' });
        }
        res.json({ message: 'Issue deleted successfully' });
    });
});

// Search
app.get('/api/issues/search', async (req, res) => {
    try {
      const q = req.query.q || '';
      // ここでDBなどからタイトルや本文などが q に部分一致するイシューを取得
      // 例: SELECT * FROM issues WHERE headline LIKE '%q%'
      const matchingIssues = await getIssuesBySearch(q);
      res.json(matchingIssues);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '検索に失敗しました' });
    }
  });
  
// --- イシュー関連エンドポイント ---

// API: /api/issues/:issue_id
app.get('/api/issues/:issue_id', (req, res) => {
    const issueId = req.params.issue_id;

    // イシュー情報を取得するクエリ
    const sqlIssue = `
        SELECT
            issues.id,
            issues.headline,
            issues.description,
            issues.category_id,
            issues.likes,
            issues.is_featured,
            categories.name AS category_name,
            users.username AS author_name,

            -- スタンス数をカウント
            (
                SELECT COUNT(*)
                FROM stances
                WHERE stances.issue_id = issues.id
            ) as stance_count,

            -- お気に入り数をカウント
            (
                SELECT COUNT(*)
                FROM favorites
                WHERE favorites.issue_id = issues.id
            ) as favorite_count,

            -- コメント数をカウント
            (
                SELECT COUNT(*)
                FROM comments
                WHERE comments.issue_id = issues.id
            ) as comments_count
        FROM issues
        LEFT JOIN categories ON issues.category_id = categories.id
        LEFT JOIN users ON issues.created_by = users.id
        WHERE issues.id = ?
        GROUP BY issues.id, categories.name, users.username;
    `;

    // コメント情報を取得するクエリ
    const sqlComments = `
        SELECT
            comments.comment,
            users.username,
            comments.created_at,
            stances.stance
        FROM comments
        LEFT JOIN users ON comments.user_id = users.id
        LEFT JOIN stances ON stances.issue_id = comments.issue_id AND comments.user_id = stances.user_id
        WHERE comments.issue_id = ?
        ORDER BY comments.created_at DESC
        LIMIT 3;
    `;

    // 1. イシュー情報を取得
    db.get(sqlIssue, [issueId], (err, issueRow) => {
        if (err) {
            console.error('Database error while fetching issue:', err);
            return res.status(500).json({ error: 'Failed to fetch issue details.' });
        }

        if (!issueRow) {
            return res.status(404).json({ error: 'Issue not found.' });
        }

        // 2. コメント情報を取得
        db.all(sqlComments, [issueId], (err, commentRows) => {
            if (err) {
                console.error('Database error while fetching comments:', err);
                return res.status(500).json({ error: 'Failed to fetch comments.' });
            }

            // 3. 結果をクライアントに送信
            res.json({
                issue: issueRow,       // イシュー詳細情報
                comments: commentRows  // 最新3件のコメント
            });
        });
    });
});





// YES/NO/様子見スタンス
// YES/NO/様子見スタンス
app.post('/api/stances', isAuthenticated, (req, res) => {
    const { issue_id, stance, comment } = req.body;

    // バリデーション
    if (!issue_id || !stance) {
        return res.status(400).json({ error: 'Issue ID and stance are required' });
    }
    const validStances = ['YES', 'NO', '様子見'];
    if (!validStances.includes(stance)) {
        return res.status(400).json({ error: 'Invalid stance' });
    }
    const userId = req.session?.userId;
    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized: User not logged in' });
    }

    // すでに同じ (issue_id, user_id) があるかチェック
    const checkSql = `
        SELECT *
        FROM stances
        WHERE issue_id = $issueId
          AND user_id = $userId
    `;
    db.get(checkSql, { $issueId: issue_id, $userId: userId }, (err, existingStance) => {
        if (err) {
            console.error('Database error while checking stance:', err);
            return res.status(500).json({ error: 'Database error while checking stance' });
        }

        console.log('Existing stance:', existingStance);

        if (existingStance) {
            // 既存のスタンスを更新
            const updateSql = `
                UPDATE stances
                SET stance = $stance,
                    comment = $comment
                WHERE id = $id
            `;
            db.run(
                updateSql,
                {
                    $stance: stance,
                    $comment: comment || null,
                    $id: existingStance.id
                },
                function (err) {
                    if (err) {
                        console.error('Database update error:', err);
                        return res.status(500).json({ error: 'Database update error' });
                    }
                    console.log('Stance updated successfully');
                    res.status(200).json({ message: 'Stance updated successfully' });
                }
            );
        } else {
            // 新規スタンスを挿入
            const insertSql = `
                INSERT INTO stances (issue_id, user_id, stance, comment, created_at)
                VALUES ($issueId, $userId, $stance, $comment, datetime('now'))
            `;
            db.run(
                insertSql,
                {
                    $issueId: issue_id,
                    $userId: userId,
                    $stance: stance,
                    $comment: comment || null
                },
                function (err) {
                    if (err) {
                        console.error('Database insert error:', err);
                        return res.status(500).json({ error: 'Database insert error' });
                    }
                    console.log('Stance added successfully');
                    res.status(201).json({ message: 'Stance added successfully' });
                }
            );
        }
    });
});


// いいね
app.post('/api/issues/:id/like', (req, res) => {
    const issueId = req.params.id;
    db.run(`UPDATE issues SET likes = likes + 1 WHERE id = ?`, [issueId], function (err) {
        if (err) {
            console.error('Database update error:', err);
            return res.status(500).json({ error: 'Database update error' });
        }
        db.get(`SELECT likes FROM issues WHERE id = ?`, [issueId], (err, row) => {
            if (err) {
                console.error('Database fetch error:', err);
                return res.status(500).json({ error: 'Database fetch error' });
            }
            res.json({ likes: row.likes });
        });
    });
});

// お気に入り
app.post('/api/issues/:id/favorite', isAuthenticated, (req, res) => {
    const issueId = req.params.id;
    const { action } = req.body;
    const userId = req.session.userId;

    if (!['add', 'remove'].includes(action)) {
        return res.status(400).json({ error: 'Invalid action' });
    }

    if (action === 'add') {
        const sql = `INSERT INTO favorites (user_id, issue_id) VALUES (?, ?)`;
        db.run(sql, [userId, issueId], function (err) {
            if (err) {
                if (err.code === 'SQLITE_CONSTRAINT') {
                    return res.status(400).json({ error: 'Issue already favorited' });
                }
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            const countSql = `SELECT COUNT(*) as count FROM favorites WHERE issue_id = ?`;
            db.get(countSql, [issueId], (err, row) => {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).json({ error: 'Database error' });
                }
                res.json({ favorites: row.count });
            });
        });
    } else if (action === 'remove') {
        const sql = `DELETE FROM favorites WHERE user_id = ? AND issue_id = ?`;
        db.run(sql, [userId, issueId], function (err) {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            if (this.changes === 0) {
                return res.status(400).json({ error: 'Favorite not found' });
            }
            const countSql = `SELECT COUNT(*) as count FROM favorites WHERE issue_id = ?`;
            db.get(countSql, [issueId], (err, row) => {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).json({ error: 'Database error' });
                }
                res.json({ favorites: row.count });
            });
        });
    }
});

// コメント投稿
app.post('/api/issues/:id/comment', isAuthenticated, (req, res) => {
    const issueId = req.params.id;
    const { comment } = req.body;
    const userId = req.session.userId;

    if (!comment || comment.trim() === '') {
        return res.status(400).json({ error: 'Comment is required' });
    }

    const sql = `INSERT INTO comments (issue_id, user_id, comment) VALUES (?, ?, ?)`;
    db.run(sql, [issueId, userId, comment.trim()], function (err) {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        const countSql = `SELECT COUNT(*) as count FROM comments WHERE issue_id = ?`;
        db.get(countSql, [issueId], (err, row) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            res.json({ comments: row.count });
        });
    });
});

// =========================
// フィーチャー・イシュー一覧
// =========================
app.get('/api/featured_issues', (req, res) => {
    const categoryId = req.query.category_id; // 例: /api/featured_issues?category_id=2
    const params = [];

    let sql = `
        SELECT 
            issues.id,
            issues.headline,
            issues.description,
            issues.category_id,
            categories.name AS category_name,
            users.username AS author_name,
            issues.likes,
            COUNT(CASE WHEN stances.stance = 'YES' THEN 1 END) as yes_count,
            COUNT(CASE WHEN stances.stance = 'NO' THEN 1 END) as no_count,
            COUNT(CASE WHEN stances.stance = '様子見' THEN 1 END) as maybe_count,
            (
                (SELECT COUNT(*) FROM comments WHERE comments.issue_id = issues.id)
                + (SELECT COUNT(*) FROM stances WHERE stances.issue_id = issues.id AND stances.comment IS NOT NULL AND stances.comment != '')
            ) as comments_count,
            COUNT(stances.id) as stance_count
        FROM 
            issues
        LEFT JOIN stances ON issues.id = stances.issue_id
        LEFT JOIN categories ON issues.category_id = categories.id
        LEFT JOIN users ON issues.created_by = users.id
        WHERE issues.is_featured = 1
    `;

    // カテゴリ指定があれば追加
    if (categoryId) {
        sql += ' AND issues.category_id = ?';
        params.push(categoryId);
    }

    // GROUP BY (集計)
    sql += `
        GROUP BY 
            issues.id, 
            issues.headline, 
            issues.description, 
            issues.category_id, 
            categories.name, 
            users.username, 
            issues.likes
    `;

    db.all(sql, params, (err, issues) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to fetch featured issues.' });
        }

        const mapped = issues.map(issue => {
            const yesCount = issue.yes_count || 0;
            const noCount = issue.no_count || 0;
            const maybeCount = issue.maybe_count || 0;
            const totalVotes = yesCount + noCount + maybeCount;

            let yesPercent = 0, noPercent = 0, maybePercent = 0;
            if (totalVotes > 0) {
                yesPercent = (yesCount / totalVotes) * 100;
                noPercent = (noCount / totalVotes) * 100;
                maybePercent = (maybeCount / totalVotes) * 100;
            }

            return {
                ...issue,
                yes_percent: yesPercent.toFixed(1),
                no_percent: noPercent.toFixed(1),
                maybe_percent: maybePercent.toFixed(1),
                stance_count: issue.stance_count || 0,
                comments_count: issue.comments_count || 0
            };
        });

        res.json(mapped);
    });
});

// =========================
// イシュー一覧 (スタンス含む, votes)
// =========================
app.get('/api/issues_with_votes', (req, res) => {
    const categoryId = req.query.category_id;
    const params = [];

    let sql = `
        SELECT
            issues.id,
            issues.headline,
            issues.description,
            issues.category_id,
            categories.name AS category_name,
            users.username AS author_name,
            issues.likes,
            COUNT(CASE WHEN stances.stance = 'YES' THEN 1 END) as yes_count,
            COUNT(CASE WHEN stances.stance = 'NO' THEN 1 END) as no_count,
            COUNT(CASE WHEN stances.stance = '様子見' THEN 1 END) as maybe_count,
            (
                (SELECT COUNT(*) FROM comments WHERE comments.issue_id = issues.id)
                + (SELECT COUNT(*) FROM stances WHERE stances.issue_id = issues.id AND stances.comment IS NOT NULL AND stances.comment != '')
            ) as comments_count,
            COUNT(stances.id) as stance_count
        FROM
            issues
        LEFT JOIN stances ON issues.id = stances.issue_id
        LEFT JOIN categories ON issues.category_id = categories.id
        LEFT JOIN users ON issues.created_by = users.id
        WHERE issues.is_featured = 0
    `;

    if (categoryId) {
        sql += ' AND issues.category_id = ?';
        params.push(categoryId);
    }

    sql += `
        GROUP BY 
            issues.id, users.username
    `;

    db.all(sql, params, (err, rows) => {
        if (err) {
            console.error('Error fetching issues with votes:', err);
            return res.status(500).json({ error: 'Failed to fetch issues with votes' });
        }
        const mapped = rows.map(issue => {
            const totalVotes = (issue.yes_count || 0) + (issue.no_count || 0) + (issue.maybe_count || 0);
            let yesPercent = 0, noPercent = 0;
            if (totalVotes > 0) {
                yesPercent = (issue.yes_count / totalVotes) * 100;
                noPercent = (issue.no_count / totalVotes) * 100;
            }
            return {
                ...issue,
                yes_percent: yesPercent.toFixed(1),
                no_percent: noPercent.toFixed(1),
                stance_count: issue.stance_count || 0,
                comments_count: issue.comments_count || 0
            };
        });
        res.json(mapped);
    });
});


// =========================
// 管理者用イシュー一覧
// =========================
app.get('/api/admin/issues', isAuthenticated, isAdmin, (req, res) => {
    const sql = `
        SELECT
            issues.*,
            users.username,
            COUNT(CASE WHEN stances.stance = 'YES' THEN 1 END) as yes_count,
            COUNT(CASE WHEN stances.stance = 'NO' THEN 1 END) as no_count,
            (SELECT COUNT(*) FROM comments WHERE comments.issue_id = issues.id) as comments,
            COUNT(stances.id) as stance_count
        FROM
            issues
        LEFT JOIN stances ON issues.id = stances.issue_id
        LEFT JOIN users ON issues.created_by = users.id
        GROUP BY
            issues.id, users.username;
    `;
    db.all(sql, [], (err, issues) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        const mapped = issues.map(issue => {
            const totalVotes = (issue.yes_count || 0) + (issue.no_count || 0);
            let yes_percent = 0, no_percent = 0;
            if (totalVotes > 0) {
                yes_percent = (issue.yes_count / totalVotes) * 100;
                no_percent = (issue.no_count / totalVotes) * 100;
            }
            return {
                ...issue,
                yes_percent: yes_percent.toFixed(1),
                no_percent: no_percent.toFixed(1)
            };
        });
        res.json(mapped);
    });
});

// スタンスとコメントを投稿
router.post('/api/stances', async (req, res) => {
    const { issue_id, stance, comment } = req.body;
    const user_id = req.session.user_id; // ログインユーザーのID

    if (!issue_id || !stance || !user_id) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        // トランザクションの開始
        const dbTransaction = await db.transaction();

        // コメントが提供された場合、commentsテーブルに挿入
        if (comment) {
            await dbTransaction('comments').insert({
                issue_id,
                user_id,
                comment,
                created_at: new Date()
            });
        }

        // スタンスカウントを更新 (YES, NO, 様子見)
        if (['YES', 'NO', '様子見'].includes(stance)) {
            const column = stance.toLowerCase() + '_count';
            await dbTransaction('issues')
                .increment(column, 1)
                .where({ id: issue_id });
        }

        // コミット
        await dbTransaction.commit();

        res.json({ message: 'Stance and comment added successfully' });
    } catch (err) {
        console.error('Error posting stance:', err);
        res.status(500).json({ error: 'Failed to post stance' });
    }
});

module.exports = router;


// =========================
// カテゴリ管理 (管理者向け)
// =========================
app.post('/api/categories', isAuthenticated, isAdmin, (req, res) => {
    const { name } = req.body;
    if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Category name is required' });
    }
    const sql = `INSERT INTO categories (name) VALUES (?)`;
    db.run(sql, [name.trim()], function (err) {
        if (err) {
            if (err.code === 'SQLITE_CONSTRAINT') {
                return res.status(400).json({ error: 'Category already exists' });
            }
            console.error('Database insert error:', err);
            return res.status(500).json({ error: 'Failed to add category' });
        }
        res.status(201).json({ id: this.lastID, message: 'Category added successfully' });
    });
});

app.get('/api/categories', (req, res) => {
    const sql = `SELECT id, name FROM categories ORDER BY name ASC`;
    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error('Database fetch error:', err);
            return res.status(500).json({ error: 'Failed to fetch categories' });
        }
        res.json(rows);
    });
});

app.put('/api/categories/:id', isAuthenticated, isAdmin, (req, res) => {
    const categoryId = req.params.id;
    const { name } = req.body;
    if (!name || name.trim() === '') {
        return res.status(400).json({ error: 'Category name is required' });
    }
    const sql = `UPDATE categories SET name = ? WHERE id = ?`;
    db.run(sql, [name.trim(), categoryId], function (err) {
        if (err) {
            console.error('Database update error:', err);
            return res.status(500).json({ error: 'Failed to update category' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Category not found' });
        }
        res.json({ message: 'Category updated successfully' });
    });
});

app.delete('/api/categories/:id', isAuthenticated, isAdmin, (req, res) => {
    const categoryId = req.params.id;
    const sql = `DELETE FROM categories WHERE id = ?`;
    db.run(sql, [categoryId], function (err) {
        if (err) {
            console.error('Database delete error:', err);
            return res.status(500).json({ error: 'Failed to delete category' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Category not found' });
        }
        res.json({ message: 'Category deleted successfully' });
    });
});

// =========================
// エラーハンドリング (全体)
// =========================
app.use((err, req, res, next) => {
    console.error('Internal Server Error:', err);
    res.status(500).json({ error: 'An unexpected error occurred. Please try again later.' });
});

// =========================
// サーバー起動
// =========================
app.listen(PORT, HOST, () => {
    console.log(`Server is running on http://${HOST}:${PORT}`);
});
