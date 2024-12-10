// server.js

require('dotenv').config(); // 環境変数の読み込み

const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');

const app = express();
const dbPath = path.join(__dirname, 'db', 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Could not connect to database', err);
        process.exit(1); // データベース接続エラーでプロセスを終了
    } else {
        console.log('Connected to SQLite database');
    }
});

// ミドルウェア設定
app.use(cors()); // 必要に応じてCORSを有効化
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
    secret: process.env.SESSION_SECRET || 'your_secure_secret_key', // 環境変数を使用
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production', // 本番環境ではtrue
        httpOnly: true,
        maxAge: 1000 * 60 * 60 // 1時間
    }
}));

// HelmetとCSPの統合設定
if (process.env.NODE_ENV === 'production') {
    app.use(
        helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: ["'self'"],
                    styleSrc: ["'self'", 'https://cdn.jsdelivr.net'], // jsDelivrのベースURLを許可
                    imgSrc: ["'self'", 'data:', 'https://cdn.jsdelivr.net'],
                    connectSrc: ["'self'"],
                    fontSrc: ["'self'", 'https://cdn.jsdelivr.net'],
                    objectSrc: ["'none'"],
                    baseUri: ["'self'"],
                    formAction: ["'self'"],
                    frameAncestors: ["'self'"],
                    scriptSrcAttr: ["'none'"],
                    upgradeInsecureRequests: true // 本番環境のみ有効化
                },
            },
            // HSTSを本番環境のみ有効化
            hsts: {
                maxAge: 31536000, // 1年
                includeSubDomains: true,
                preload: true
            }
        })
    );
} else {
    app.use(
        helmet({
            contentSecurityPolicy: false, // CSPを無効化
            hsts: false // HSTSを無効化
        })
    );
}
// CSPヘッダーをログに出力するミドルウェア
app.use((req, res, next) => {
    res.on('finish', () => {
        const csp = res.getHeader('Content-Security-Policy');
        if (csp) {
            console.log('CSP Header:', csp);
        } else {
            console.log('CSP Header is not set.');
        }
    });
    next();
});

// 認証ミドルウェア
function isAuthenticated(req, res, next) {
    if (req.session && req.session.userId) {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized' });
    }
}

function isAdmin(req, res, next) {
    if (req.session && req.session.isAdmin) {
        next();
    } else {
        res.status(403).json({ error: 'Forbidden: Admins only' });
    }
}

// 静的ファイルの提供
app.use(express.static(path.join(__dirname, 'public')));

// ルート設定
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

// ログイン処理
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        if (!user) return res.status(400).json({ error: 'User not found' });

        bcrypt.compare(password, user.password, (err, result) => {
            if (err) {
                console.error('Bcrypt error:', err);
                return res.status(500).json({ error: 'Authentication error' });
            }
            if (result) {
                req.session.userId = user.id;
                req.session.username = user.username;
                req.session.isAdmin = user.is_admin === 1;
                if (req.session.isAdmin) {
                    res.redirect('/admin');
                } else {
                    res.redirect('/mypage');
                }
            } else {
                res.status(400).json({ error: 'Incorrect password' });
            }
        });
    });
});

// 登録処理
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
            db.run('INSERT INTO users (username, password, is_admin) VALUES (?, ?, ?)', [username, hash, 0], function(err) {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).json({ error: 'Error creating user' });
                }
                req.session.userId = this.lastID;
                req.session.username = username;
                req.session.isAdmin = false;
                res.redirect('/mypage');
            });
        });
    });
});

// ログアウト処理
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Session destroy error:', err);
            return res.status(500).json({ error: 'Logout failed' });
        }
        res.redirect('/login'); // 相対パスを使用
        console.log('Current NODE_ENV:', process.env.NODE_ENV);

    });
});

// サーバー起動
const PORT = process.env.PORT || 3000;
const HOST = '127.0.0.1'; // ホストを127.0.0.1に設定

app.listen(PORT, () => {
    console.log(`Server is running on http://${HOST}:${PORT}`);
});


// 正しい /api/issues_with_votes エンドポイントの定義
app.get('/api/issues_with_votes', (req, res) => {
    const sql = `
        SELECT 
            issues.id,
            issues.headline,
            issues.description,
            issues.tag,
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
        LEFT JOIN 
            stances ON issues.id = stances.issue_id
        WHERE 
            issues.is_featured = 0
        GROUP BY 
            issues.id;
    `;

    db.all(sql, [], (err, issues) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        const issuesWithVotes = issues.map(issue => {
            const totalVotes = (issue.yes_count || 0) + (issue.no_count || 0) + (issue.maybe_count || 0);
            let yes_percent = 0, no_percent = 0;
            if (totalVotes > 0) {
                yes_percent = (issue.yes_count / totalVotes) * 100;
                no_percent = (issue.no_count / totalVotes) * 100;
            }
            return {
                ...issue,
                yes_percent: yes_percent.toFixed(1),
                no_percent: no_percent.toFixed(1),
                // stance_count によりトータルのスタンス数が取得可能
                stance_count: issue.stance_count || 0,
                comments: issue.comments || 0  // commentsカラムを返していることを確認
            };
        });
        res.json(issuesWithVotes);
    });
});

app.get('/api/featured_issues', (req, res) => {
    const sql = `
    SELECT 
        issues.id,
        issues.headline,
        issues.description,
        issues.tag,
        issues.likes,
        COUNT(CASE WHEN stances.stance = 'YES' THEN 1 END) as yes_count,
        COUNT(CASE WHEN stances.stance = 'NO' THEN 1 END) as no_count,
        (
            (SELECT COUNT(*) FROM comments WHERE comments.issue_id = issues.id)
            + (SELECT COUNT(*) FROM stances WHERE stances.issue_id = issues.id AND stances.comment IS NOT NULL AND stances.comment != '')
        ) as comments_count,
        COUNT(stances.id) as stance_count
    FROM 
        issues
    LEFT JOIN 
        stances ON issues.id = stances.issue_id
    WHERE 
        issues.is_featured = 1
    GROUP BY 
        issues.id;

    `;

    db.all(sql, [], (err, issues) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        const issuesWithVotes = issues.map(issue => {
            const totalVotes = (issue.yes_count || 0) + (issue.no_count || 0);
            let yes_percent = 0, no_percent = 0;
            if (totalVotes > 0) {
                yes_percent = (issue.yes_count / totalVotes) * 100;
                no_percent = (issue.no_count / totalVotes) * 100;
            }
            return {
                ...issue,
                yes_percent: yes_percent.toFixed(1),
                no_percent: no_percent.toFixed(1),
                stance_count: issue.stance_count || 0,  // ここで取得したstance_countを反映
                comments: issue.comments || 0  // commentsカラムを返していることを確認
            };
        });
        res.json(issuesWithVotes);
    });
});




// 全てのイシューの取得（管理者用）
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
        LEFT JOIN 
            stances ON issues.id = stances.issue_id
        LEFT JOIN 
            users ON issues.created_by = users.id
        GROUP BY 
            issues.id
    `;

    db.all(sql, [], (err, issues) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        const issuesWithVotes = issues.map(issue => {
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
        res.json(issuesWithVotes);
    });
});


// フィーチャーイシューの更新
app.put('/api/issues/:id', isAuthenticated, isAdmin, (req, res) => {
    const issueId = req.params.id;
    const { is_featured, headline, description, tag } = req.body;

    // Build dynamic SQL based on provided fields
    let fields = [];
    let values = [];

    if (typeof is_featured !== 'undefined') {
        fields.push('is_featured = ?');
        values.push(is_featured ? 1 : 0);
    }
    if (headline) {
        fields.push('headline = ?');
        values.push(headline);
    }
    if (description) {
        fields.push('description = ?');
        values.push(description);
    }
    if (tag) {
        fields.push('tag = ?');
        values.push(tag);
    }

    if (fields.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(issueId);

    const sql = `UPDATE issues SET ${fields.join(', ')} WHERE id = ?`;
    db.run(sql, values, function(err) {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Issue not found' });
        }
        res.sendStatus(200);
    });
});

// イシューの取得
app.get('/api/issues', (req, res) => {
    const sql = `SELECT id, headline, description, tag FROM issues LIMIT 100`; // 必要フィールドだけ取得
    db.all(sql, [], (err, issues) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to fetch issues' }); // 安全なエラー内容
        }
        res.json(issues);
    });
});

// イシューの作成
app.post('/api/issues', (req, res) => {
    const { headline, description, tag, is_featured } = req.body;

    if (!headline || !description || !tag) {
        return res.status(400).json({ error: 'すべてのフィールドが必要です。' });
    }

    const checkDuplicateSql = `SELECT id FROM issues WHERE headline = ?`;
    db.get(checkDuplicateSql, [headline], (err, row) => {
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
// スタンスの投稿
app.post('/api/stances', isAuthenticated, (req, res) => {
    const { issue_id, stance, comment } = req.body;

    // 必要なパラメータが存在するか確認
    if (!issue_id || !stance) {
        return res.status(400).json({ error: 'Issue ID and stance are required' });
    }

    const validStances = ['YES', 'NO', '様子見'];
    if (!validStances.includes(stance)) {
        return res.status(400).json({ error: 'Invalid stance' });
    }

    // セッションユーザーIDの確認
    const userId = req.session?.userId;
    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized: User not logged in' });
    }

    // スタンスがすでに存在するか確認
    const checkSql = `SELECT * FROM stances WHERE issue_id = ? AND user_id = ?`;
    db.get(checkSql, [issue_id, userId], (err, existingStance) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        if (existingStance) {
            // 既存のスタンスを更新
            const updateSql = `UPDATE stances SET stance = ?, comment = ? WHERE id = ?`;
            db.run(updateSql, [stance, comment || null, existingStance.id], function (err) {
                if (err) {
                    console.error('Database update error:', err);
                    return res.status(500).json({ error: 'Database update error' });
                }
                res.status(200).json({ message: 'Stance updated successfully' });
            });
        } else {
            // 新しいスタンスを挿入
            const insertSql = `INSERT INTO stances (issue_id, user_id, stance, comment) VALUES (?, ?, ?, ?)`;
            db.run(insertSql, [issue_id, userId, stance, comment || null], function (err) {
                if (err) {
                    console.error('Database insert error:', err);
                    return res.status(500).json({ error: 'Database insert error' });
                }
                res.status(201).json({ message: 'Stance added successfully' });
            });
        }
    });
});


// テーブルの作成（Favorites）
db.run(`
    CREATE TABLE IF NOT EXISTS favorites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        issue_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, issue_id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (issue_id) REFERENCES issues(id)
    )
`, (err) => {
    if (err) {
        console.error('Error creating favorites table:', err);
    } else {
        console.log('Favorites table ensured');
    }
});
// お気に入りを追加または削除するエンドポイント
app.post('/api/issues/:id/favorite', isAuthenticated, (req, res) => {
    const issueId = req.params.id;
    const { action } = req.body;
    const userId = req.session.userId;

    if (!['add', 'remove'].includes(action)) {
        return res.status(400).json({ error: 'Invalid action' });
    }

    if (action === 'add') {
        const sql = `INSERT INTO favorites (user_id, issue_id) VALUES (?, ?)`;
        db.run(sql, [userId, issueId], function(err) {
            if (err) {
                if (err.code === 'SQLITE_CONSTRAINT') {
                    // 既にお気に入りに追加されている
                    return res.status(400).json({ error: 'Issue already favorited' });
                }
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            // お気に入り数をカウント
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
        db.run(sql, [userId, issueId], function(err) {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            if (this.changes === 0) {
                return res.status(400).json({ error: 'Favorite not found' });
            }
            // お気に入り数をカウント
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
// コメントを追加するエンドポイント
app.post('/api/issues/:id/comment', isAuthenticated, (req, res) => {
    const issueId = req.params.id;
    const { comment } = req.body;
    const userId = req.session.userId;

    if (!comment || comment.trim() === '') {
        return res.status(400).json({ error: 'Comment is required' });
    }

    const sql = `INSERT INTO comments (issue_id, user_id, comment) VALUES (?, ?, ?)`;
    db.run(sql, [issueId, userId, comment.trim()], function(err) {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        // コメント数をカウント
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

// テーブルの作成（Comments）
db.run(`
    CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        issue_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        comment TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (issue_id) REFERENCES issues(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
    )
`, (err) => {
    if (err) {
        console.error('Error creating comments table:', err);
    } else {
        console.log('Comments table ensured');
    }
});

// "いいね" を追加するエンドポイント
app.post('/api/issues/:id/like', (req, res) => {
    const issueId = req.params.id;

    db.run(`UPDATE issues SET likes = likes + 1 WHERE id = ?`, [issueId], function (err) {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Database update error' });
        }
        db.get(`SELECT likes FROM issues WHERE id = ?`, [issueId], (err, row) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: 'Database fetch error' });
            }
            res.json({ likes: row.likes });
        });
    });
});

app.get('/api/user', isAuthenticated, (req, res) => {
    const sql = 'SELECT id, username, is_admin FROM users WHERE id = ?';
    db.get(sql, [req.session.userId], (err, user) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({
            userId: user.id,
            username: user.username,
            isAdmin: user.is_admin === 1
        });
    });
});

function isAdmin(req, res, next) {
    if (req.session && req.session.isAdmin) {
        next();
    } else {
        res.status(403).json({ error: 'Forbidden: Admins only' });
    }
}
// server.js

app.get('/api/admin/users', isAuthenticated, isAdmin, (req, res) => {
    const sql = 'SELECT id, username, is_admin FROM users';
    db.all(sql, [], (err, users) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(users);
    });
});
// 既存のコードに続けて以下を追加

// お気に入りを追加または削除するエンドポイント
app.post('/api/issues/:id/favorite', isAuthenticated, (req, res) => {
    // 上記のコードをここに追加
});

// コメントを追加するエンドポイント
app.post('/api/issues/:id/comment', isAuthenticated, (req, res) => {
    // 上記のコードをここに追加
});
// server.js

// カテゴリを取得するエンドポイント（静的リスト）
app.get('/api/categories', (req, res) => {
    const categories = [
        { id: 1, name: '政治' },
        { id: 2, name: '社会' },
        { id: 3, name: '経済' },
        { id: 4, name: '外交' },
        { id: 5, name: '国際' },
        { id: 6, name: '税金' },
        { id: 7, name: 'ビジネス' },
        { id: 8, name: '少子高齢化' },
        { id: 9, name: '医療福祉' },
        // 必要に応じて追加
    ];
    res.json(categories);
});
