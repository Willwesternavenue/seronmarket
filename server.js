// server.js

require('dotenv').config(); // 環境変数の読み込み（必要に応じて）

const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');


const helmet = require('helmet'); // セキュリティ強化用（オプション）

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
app.use(cors()); // CORSの許可（オプション）
app.use(helmet()); // セキュリティヘッダーの設定（オプション）
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

// ルート
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// カスタムルートの追加
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

// ログイン
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

// 登録
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

// APIエンドポイント
app.get('/api/issues_with_votes', (req, res) => {
    const sql = `
        SELECT 
            issues.*, 
            COUNT(CASE WHEN stances.stance = 'YES' THEN 1 END) as yes_count,
            COUNT(CASE WHEN stances.stance = 'NO' THEN 1 END) as no_count
        FROM 
            issues
        LEFT JOIN 
            stances ON issues.id = stances.issue_id
        WHERE 
            issues.is_featured = 0 -- フィーチャーイシューを除外
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
                no_percent: no_percent.toFixed(1),
            };
        });
        res.json(issuesWithVotes);
    });
});





// ユーザー情報の取得
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

// フィーチャーイシューの取得
app.get('/api/issues_with_votes', (req, res) => {
    const sql = `
        SELECT 
            issues.id,
            issues.headline,
            issues.description,
            issues.tag,
            COUNT(CASE WHEN stances.stance = 'YES' THEN 1 END) as yes_count,
            COUNT(CASE WHEN stances.stance = 'NO' THEN 1 END) as no_count
        FROM 
            issues
        LEFT JOIN 
            stances ON issues.id = stances.issue_id
        GROUP BY 
            issues.id
    `;

    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error('Database error:', err);
            res.status(500).json({ error: 'Database error' });
        } else {
            const issues = rows.map(row => {
                const totalVotes = (row.yes_count || 0) + (row.no_count || 0);
                return {
                    ...row,
                    yes_percent: totalVotes > 0 ? ((row.yes_count / totalVotes) * 100).toFixed(1) : 0,
                    no_percent: totalVotes > 0 ? ((row.no_count / totalVotes) * 100).toFixed(1) : 0,
                };
            });
            res.json(issues);
        }
    });
});
app.get('/api/featured_issues', (req, res) => {
    const sql = `
        SELECT 
            issues.*, 
            COUNT(CASE WHEN stances.stance = 'YES' THEN 1 END) as yes_count,
            COUNT(CASE WHEN stances.stance = 'NO' THEN 1 END) as no_count
        FROM 
            issues
        LEFT JOIN 
            stances ON issues.id = stances.issue_id
        WHERE 
            issues.is_featured = 1 -- フィーチャーイシューのみを取得
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
                no_percent: no_percent.toFixed(1),
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
            COUNT(CASE WHEN stances.stance = 'NO' THEN 1 END) as no_count
        FROM 
            issues
        LEFT JOIN 
            stances ON issues.id = stances.issue_id
        LEFT JOIN 
            users ON issues.created_by = users.id
        WHERE
        issues.is_featured = 0 -- フィーチャーイシューを除外
        GROUP BY 
            issues.id
    `;
    db.all(sql, [], (err, issues) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' }); // JSON形式でエラーを返す
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
    const { headline, description, tag } = req.body;

    if (!headline || !description || !tag) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    const checkDuplicateSql = `SELECT id FROM issues WHERE headline = ?`;
    db.get(checkDuplicateSql, [headline], (err, row) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        if (row) {
            return res.status(400).json({ error: 'Issue with the same headline already exists' });
        }

        const insertSql = `INSERT INTO issues (headline, description, tag) VALUES (?, ?, ?)`;
        db.run(insertSql, [headline, description, tag], function (err) {
            if (err) {
                console.error('Database insert error:', err);
                return res.status(500).json({ error: 'Database insert error' });
            }

            res.status(201).json({ id: this.lastID, message: 'Issue created successfully' });
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




// サーバー起動
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
