require('dotenv').config(); // 環境変数の読み込み

const express = require('express');
const path = require('path');
const app = express();
const session = require('express-session');
const bcrypt = require('bcrypt');
// PostgreSQL用のライブラリ
const { Pool } = require('pg');
const cors = require('cors');
const helmet = require('helmet');
const router = express.Router();
const now = new Date().toISOString(); // 現在時刻をISOフォーマットで取得

// =========================
// 1. データベース初期化 (Supabase PostgreSQL)
// =========================
const pool = new Pool({
    connectionString: process.env.SUPABASE_DATABASE_URL, // Supabaseの接続文字列
});

pool.connect((err, client, release) => {
    if (err) {
        console.error('Supabase PostgreSQLへの接続に失敗しました:', err);
        process.exit(1); // データベース接続エラーでプロセスを終了
    } else {
        console.log('Supabase PostgreSQLに接続しました');
        release();
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
        const sql = 'SELECT id, username, is_Admin FROM users WHERE id = $1';
        pool.query(sql, [req.session.userId], (err, result) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Internal server error' });
            }
            const user = result.rows[0];
            if (!user) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            req.user = user; // ユーザー情報を設定
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
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        is_admin INTEGER DEFAULT 0
    )`,
    // Categories
    `CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    // Issues
    `CREATE TABLE IF NOT EXISTS issues (
        id SERIAL PRIMARY KEY,
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
        id SERIAL PRIMARY KEY,
        issue_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        stance TEXT NOT NULL,
        comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (issue_id) REFERENCES issues(id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        UNIQUE (user_id, issue_id)
    )`,
    // Favorites
    `CREATE TABLE IF NOT EXISTS favorites (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        issue_id INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, issue_id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (issue_id) REFERENCES issues(id)
    )`,
    // Comments
    `CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        issue_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        comment TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (issue_id) REFERENCES issues(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
    )`
];

tableDefinitions.forEach((sql) => {
    pool.query(sql, (err) => {
        if (err) {
            console.error('Error creating table:', err);
        }
    });
});

// =========================
// 6. 初期データ投入
// =========================
const initialCategories = [
    '政治', '社会', '経済', '外交', '国際', '税金',
    'ビジネス', '少子高齢化', '医療福祉', '教育', '環境',
    'テクノロジー', '文化', '地域'
];

initialCategories.forEach((name) => {
    const sql = `INSERT INTO categories (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`;
    pool.query(sql, [name], (err) => {
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
    const categoryId = req.query.category_id;
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
    if (categoryId) {
        sql += ' WHERE issues.category_id = $1';
        params.push(categoryId);
    }
    pool.query(sql, params, (err, result) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to fetch issues' });
        }
        res.json(result.rows);
    });
});

/**
 * キーワード検索で該当するイシューを取得
 * @param {string} q - 検索キーワード
 * @returns {Promise<Array>} - 検索結果の配列
 */
function getIssuesBySearch(q) {
    return new Promise((resolve, reject) => {
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
            WHERE issues.headline LIKE $1
               OR issues.description LIKE $2
            ORDER BY issues.id DESC
        `;
        const likeQuery = `%${q}%`;
        pool.query(sql, [likeQuery, likeQuery], (err, result) => {
            if (err) {
                return reject(err);
            }
            resolve(result.rows);
        });
    });
}

// カテゴリ一覧を取得
app.get('/api/categories', (req, res) => {
    const sql = 'SELECT id, name FROM categories';
    pool.query(sql, [], (err, result) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to fetch categories' });
        }
        res.json(result.rows);
    });
});

// コメントを取得
app.get('/api/issues/:issue_id/comments', (req, res) => {
    const issueId = req.params.issue_id;
    const sql = `
        SELECT
            stances.stance,
            stances.comment,
            stances.created_at,
            users.username
        FROM stances
        LEFT JOIN users ON stances.user_id = users.id
        WHERE stances.issue_id = $1
            AND stances.comment IS NOT NULL
            AND TRIM(stances.comment) != ''
        ORDER BY stances.created_at DESC
        LIMIT 1;
    `;
    pool.query(sql, [issueId], (err, result) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to fetch comments' });
        }
        res.json(result.rows);
    });
});

// --- 認証系エンドポイント ---
// 新規ユーザー登録
app.post('/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }
    const checkSql = 'SELECT * FROM users WHERE username = $1';
    pool.query(checkSql, [username], (err, result) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        if (result.rows.length > 0) {
            return res.status(400).json({ error: 'Username already exists' });
        }
        bcrypt.hash(password, 10, (err, hash) => {
            if (err) {
                console.error('Bcrypt error:', err);
                return res.status(500).json({ error: 'Error hashing password' });
            }
            const insertSql = 'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id';
            pool.query(insertSql, [username, hash], (err, result) => {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).json({ error: 'Database error' });
                }
                req.session.userId = result.rows[0].id;
                req.session.username = username;
                req.session.isAdmin = false;
                res.redirect('/mypage');
            });
        });
    });
});

// ログイン
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const sql = 'SELECT * FROM users WHERE username = $1';
    pool.query(sql, [username], (err, result) => {
        if (err) {
            console.error('An error occurred during login.');
            return res.status(500).json({ error: 'An internal error occurred.' });
        }
        if (result.rows.length === 0) {
            return res.status(400).json({ error: 'Invalid username or password' });
        }
        const user = result.rows[0];
        bcrypt.compare(password, user.password, (err, compareResult) => {
            if (err) {
                console.error('An error occurred during password comparison.');
                return res.status(500).json({ error: 'Authentication error' });
            }
            if (!compareResult) {
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
                if (user.is_admin === 1) {
                    return res.redirect('/admin');
                }
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
    const { headline, category_id, is_featured } = req.body;
    const placeholderDescription = 'このイシューの概要は自動生成中です';
    if (!headline || !category_id) {
        return res.status(400).json({ error: 'タイトルとカテゴリは必須です' });
    }
    const checkSql = `SELECT id FROM issues WHERE headline = $1`;
    pool.query(checkSql, [headline], (err, result) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'データベースエラー' });
        }
        if (result.rows.length > 0) {
            return res.status(400).json({ error: '同じヘッドラインのイシューが既に存在します' });
        }
        const insertSql = `
            INSERT INTO issues (headline, description, category_id, is_featured)
            VALUES ($1, $2, $3, $4)
            RETURNING id;
        `;
        pool.query(insertSql, [headline, placeholderDescription, category_id, is_featured ? 1 : 0], (err, result) => {
            if (err) {
                console.error('DB insert error:', err);
                return res.status(500).json({ error: 'イシューの作成に失敗しました。' });
            }
            res.status(201).json({ id: result.rows[0].id, message: 'イシューが正常に作成されました。' });
        });
    });
});

// イシュー更新 (管理者) - トランザクションを使用
app.put('/api/issues/:id', isAuthenticated, isAdmin, async (req, res) => {
    const { issue_id, stance, comment } = req.body;
    const user_id = req.session.userId;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const sqlStance = `
            INSERT INTO stances (issue_id, stance, comment, user_id)
            VALUES ($1, $2, $3, $4)
        `;
        await client.query(sqlStance, [issue_id, stance, comment, user_id]);
        if (comment) {
            const sqlComment = `
                INSERT INTO comments (issue_id, comment, user_id, created_at)
                VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
            `;
            await client.query(sqlComment, [issue_id, comment, user_id]);
        }
        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error in transaction:', err);
        res.status(500).json({ error: 'Failed to complete transaction' });
    } finally {
        client.release();
    }
});

// イシュー削除
app.delete('/api/issues/:id', isAuthenticated, isAdmin, (req, res) => {
    const issueId = req.params.id;
    const sql = `DELETE FROM issues WHERE id = $1`;
    pool.query(sql, [issueId], (err, result) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Issue not found' });
        }
        res.json({ message: 'Issue deleted successfully' });
    });
});

// Search
app.get('/api/issues/search', async (req, res) => {
    try {
        let q = req.query.query || '';
        q = q.trim();
        if (!q) {
            return res.status(400).json({ error: '検索クエリが空です。' });
        }
        const matchingIssues = await getIssuesBySearch(q);
        res.json(matchingIssues);
    } catch (err) {
        console.error('Search error:', err);
        res.status(500).json({ error: '検索に失敗しました' });
    }
});
  
// API: /api/issues/:issue_id
app.get('/api/issues/:issue_id', (req, res) => {
    const issueId = req.params.issue_id;
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
            (SELECT COUNT(*) FROM stances WHERE stances.issue_id = issues.id) as stance_count,
            (SELECT COUNT(*) FROM favorites WHERE favorites.issue_id = issues.id) as favorite_count,
            (SELECT COUNT(*) FROM comments WHERE comments.issue_id = issues.id) as comments_count,
            (SELECT COUNT(*) FROM stances WHERE stances.issue_id = issues.id AND stances.stance = 'YES') as yes_count,
            (SELECT COUNT(*) FROM stances WHERE stances.issue_id = issues.id AND stances.stance = 'NO') as no_count,
            (SELECT COUNT(*) FROM stances WHERE stances.issue_id = issues.id AND stances.stance = '様子見') as maybe_count
        FROM issues
        LEFT JOIN categories ON issues.category_id = categories.id
        LEFT JOIN users ON issues.created_by = users.id
        WHERE issues.id = $1
        GROUP BY issues.id, categories.name, users.username;
    `;
    const sqlComments = `
        SELECT
            stances.stance,
            stances.comment,
            stances.created_at,
            users.username
        FROM stances
        LEFT JOIN users ON stances.user_id = users.id
        WHERE stances.issue_id = $1
        ORDER BY stances.created_at DESC
        LIMIT 3;
    `;
    pool.query(sqlIssue, [issueId], (err, result) => {
        if (err) {
            console.error('Database error while fetching issue:', err);
            return res.status(500).json({ error: 'Failed to fetch issue details.' });
        }
        const issueRow = result.rows[0];
        if (!issueRow) {
            return res.status(404).json({ error: 'Issue not found.' });
        }
        pool.query(sqlComments, [issueId], (err, result2) => {
            if (err) {
                console.error('Database error while fetching comments:', err);
                return res.status(500).json({ error: 'Failed to fetch comments.' });
            }
            res.json({
                issue: issueRow,
                comments: result2.rows
            });
        });
    });
});

// YES/NO/様子見スタンス
app.post('/api/stances', isAuthenticated, (req, res) => {
    const { issue_id, stance, comment } = req.body;
    const userId = req.session.userId;
    if (!issue_id || !stance) {
        return res.status(400).json({ error: 'Issue ID and stance are required' });
    }
    const validStances = ['YES', 'NO', '様子見'];
    if (!validStances.includes(stance)) {
        return res.status(400).json({ error: 'Invalid stance' });
    }
    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized: User not logged in' });
    }
    const checkSql = `
        SELECT *
        FROM stances
        WHERE issue_id = $1 AND user_id = $2
    `;
    pool.query(checkSql, [issue_id, userId], (err, result) => {
        if (err) {
            console.error('Database error while checking stance:', err);
            return res.status(500).json({ error: 'Database error while checking stance' });
        }
        if (result.rows.length > 0) {
            const updateSql = `
                UPDATE stances
                SET stance = $1,
                    comment = $2,
                    created_at = CURRENT_TIMESTAMP
                WHERE id = $3
            `;
            pool.query(updateSql, [stance, comment || null, result.rows[0].id], (err) => {
                if (err) {
                    console.error('Database update error:', err);
                    return res.status(500).json({ error: 'Failed to update stance' });
                }
                res.status(200).json({ message: 'Stance updated successfully', updated_at: new Date().toISOString() });
            });
        } else {
            const insertSql = `
                INSERT INTO stances (issue_id, user_id, stance, comment, created_at)
                VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
                RETURNING id
            `;
            pool.query(insertSql, [issue_id, userId, stance, comment || null], (err) => {
                if (err) {
                    console.error('Database insert error:', err);
                    return res.status(500).json({ error: 'Failed to add stance' });
                }
                res.status(201).json({ message: 'Stance added successfully', created_at: new Date().toISOString() });
            });
        }
    });
});

// コメント投稿
app.post('/api/issues/:id/comment', isAuthenticated, (req, res) => {
    const issueId = req.params.id;
    const { comment } = req.body;
    const userId = req.session.userId;
    if (!comment || comment.trim() === '') {
        return res.status(400).json({ error: 'Comment is required' });
    }
    const sql = `
        INSERT INTO comments (issue_id, user_id, comment, created_at)
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
        RETURNING id
    `;
    pool.query(sql, [issueId, userId, comment.trim()], (err, result) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to add comment' });
        }
        const countSql = `
            SELECT COUNT(*) as count
            FROM comments
            WHERE issue_id = $1
        `;
        pool.query(countSql, [issueId], (err, result2) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Failed to count comments' });
            }
            res.json({ message: 'Comment added successfully', comments: result2.rows[0].count });
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
        const sql = `INSERT INTO favorites (user_id, issue_id) VALUES ($1, $2) RETURNING id`;
        pool.query(sql, [userId, issueId], (err, result) => {
            if (err) {
                // PostgreSQLのユニーク制約違反はエラーコード 23505
                if (err.code === '23505') {
                    return res.status(400).json({ error: 'Issue already favorited' });
                }
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            const countSql = `SELECT COUNT(*) as count FROM favorites WHERE issue_id = $1`;
            pool.query(countSql, [issueId], (err, result2) => {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).json({ error: 'Database error' });
                }
                res.json({ favorites: result2.rows[0].count });
            });
        });
    } else if (action === 'remove') {
        const sql = `DELETE FROM favorites WHERE user_id = $1 AND issue_id = $2`;
        pool.query(sql, [userId, issueId], (err, result) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            if (result.rowCount === 0) {
                return res.status(400).json({ error: 'Favorite not found' });
            }
            const countSql = `SELECT COUNT(*) as count FROM favorites WHERE issue_id = $1`;
            pool.query(countSql, [issueId], (err, result2) => {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).json({ error: 'Database error' });
                }
                res.json({ favorites: result2.rows[0].count });
            });
        });
    }
});

// =========================
// フィーチャー・イシュー一覧
// =========================
app.get('/api/featured_issues', (req, res) => {
    const categoryId = req.query.category_id;
    const params = [];
    let sql = `
        SELECT 
            issues.id,
            issues.headline,
            issues.description,
            issues.category_id,
            COALESCE(categories.name, '未分類') AS category_name,
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
    if (categoryId) {
        sql += ' AND issues.category_id = $1';
        params.push(categoryId);
    }
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
    pool.query(sql, params, (err, result) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to fetch featured issues.' });
        }
        const issues = result.rows;
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
        sql += ' AND issues.category_id = $1';
        params.push(categoryId);
    }
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
    pool.query(sql, params, (err, result) => {
        if (err) {
            console.error('Error fetching issues with votes:', err);
            return res.status(500).json({ error: 'Failed to fetch issues with votes' });
        }
        const rows = result.rows;
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
    pool.query(sql, [], (err, result) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        const issues = result.rows;
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

// スタンスとコメントを投稿 (トランザクション版)
router.post('/api/stances', async (req, res) => {
    const { issue_id, stance, comment } = req.body;
    const user_id = req.session.user_id;
    if (!issue_id || !stance || !user_id) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        if (comment) {
            await client.query(
                `INSERT INTO comments (issue_id, user_id, comment, created_at)
                 VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
                [issue_id, user_id, comment]
            );
        }
        if (['YES', 'NO', '様子見'].includes(stance)) {
            let updateQuery = '';
            if (stance === 'YES') {
                updateQuery = 'UPDATE issues SET yes_count = yes_count + 1 WHERE id = $1';
            } else if (stance === 'NO') {
                updateQuery = 'UPDATE issues SET no_count = no_count + 1 WHERE id = $1';
            } else if (stance === '様子見') {
                // 適切なカウント項目があれば更新
                updateQuery = 'UPDATE issues SET no_count = no_count + 1 WHERE id = $1';
            }
            if (updateQuery) {
                await client.query(updateQuery, [issue_id]);
            }
        }
        await client.query('COMMIT');
        res.json({ message: 'Stance and comment added successfully' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error posting stance:', err);
        res.status(500).json({ error: 'Failed to post stance' });
    } finally {
        client.release();
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
    const sql = `INSERT INTO categories (name) VALUES ($1) ON CONFLICT (name) DO NOTHING RETURNING id`;
    pool.query(sql, [name.trim()], (err, result) => {
        if (err) {
            console.error('Database insert error:', err);
            return res.status(500).json({ error: 'Failed to add category' });
        }
        if (result.rowCount === 0) {
            return res.status(400).json({ error: 'Category already exists' });
        }
        res.status(201).json({ id: result.rows[0].id, message: 'Category added successfully' });
    });
});

app.get('/api/categories', (req, res) => {
    const sql = `SELECT id, name FROM categories ORDER BY name ASC`;
    pool.query(sql, [], (err, result) => {
        if (err) {
            console.error('Database fetch error:', err);
            return res.status(500).json({ error: 'Failed to fetch categories' });
        }
        res.json(result.rows);
    });
});

app.put('/api/categories/:id', isAuthenticated, isAdmin, (req, res) => {
    const categoryId = req.params.id;
    const { name } = req.body;
    if (!name || name.trim() === '') {
        return res.status(400).json({ error: 'Category name is required' });
    }
    const sql = `UPDATE categories SET name = $1 WHERE id = $2`;
    pool.query(sql, [name.trim(), categoryId], (err, result) => {
        if (err) {
            console.error('Database update error:', err);
            return res.status(500).json({ error: 'Failed to update category' });
        }
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Category not found' });
        }
        res.json({ message: 'Category updated successfully' });
    });
});

app.delete('/api/categories/:id', isAuthenticated, isAdmin, (req, res) => {
    const categoryId = req.params.id;
    const sql = `DELETE FROM categories WHERE id = $1`;
    pool.query(sql, [categoryId], (err, result) => {
        if (err) {
            console.error('Database delete error:', err);
            return res.status(500).json({ error: 'Failed to delete category' });
        }
        if (result.rowCount === 0) {
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
