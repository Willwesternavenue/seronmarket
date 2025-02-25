/**
 * 共通のログアウト関数
 */
function logout() {
    fetch('/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
    })
        .then(response => {
            if (response.redirected) {
                window.location.href = response.url;
            } else {
                window.location.href = '/login';
            }
        })
        .catch(err => {
            console.error('Logout error:', err);
            alert('ログアウトに失敗しました。');
        });
}

/**
 * ユーザー情報を取得して表示
 * 管理者ページのため、管理者チェックボックスを自動でチェック
 */
function fetchUserInfo() {
    fetch('/api/user')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(user => {
            setElementText('username', user.username || '不明');
            const adminCheckbox = document.getElementById('is-admin-checkbox');
            if (adminCheckbox) {
                adminCheckbox.checked = true; // 管理者ページのため、常にチェック
            }
        })
        .catch(err => {
            console.error('Error fetching user info:', err);
            alert('ユーザー情報の取得に失敗しました。');
        });
}

/**
 * サニタイズ関数
 */
function sanitizeHTML(str) {
    const tempDiv = document.createElement('div');
    tempDiv.textContent = str || '';
    return tempDiv.innerHTML;
}

function sanitizePercentage(percent) {
    const parsedPercent = parseFloat(percent);
    return isNaN(parsedPercent) || parsedPercent < 0 ? '0' : parsedPercent.toFixed(1);
}

/**
 * 要素のテキストを設定する関数
 * @param {string} elementId - 対象要素のID
 * @param {string} text - 設定するテキスト
 */
function setElementText(elementId, text) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = text;
    } else {
        console.warn(`要素が見つかりませんでした: ${elementId}`);
    }
}

/**
 * フォームの初期化とイベントリスナーの登録
 */
function initializeForms() {
    // スタンス投稿フォームの送信イベントを登録
    const stanceForm = document.getElementById('post-stance-form');
    if (stanceForm) {
        stanceForm.addEventListener('submit', (e) => {
            e.preventDefault();
            submitStance();
        });
    }

    // イシュー作成フォームの送信イベントを登録
    const issueForm = document.getElementById('create-issue-form');
    if (issueForm) {
        issueForm.addEventListener('submit', (e) => {
            e.preventDefault();
            createIssue();
        });
    }

    // 「いいね」ボタンのクリックイベントを登録（動的に追加されるボタンも対象）
    document.addEventListener('click', (event) => {
        if (event.target.classList.contains('like-button')) {
            const issueId = event.target.dataset.issueId; // ボタンのデータ属性からIDを取得
            likeIssue(issueId);
        }
    });
}

/**
 * スタンス投稿の処理
 */
function submitStance() {
    const issueId = document.getElementById('issue').value;
    const stance = document.getElementById('stance').value;
    const comment = document.getElementById('comment').value.trim();
    const errorDiv = document.getElementById('stance-error');
    const successDiv = document.getElementById('stance-success');

    // メッセージをクリア
    errorDiv.textContent = '';
    successDiv.textContent = '';

    if (!issueId || !stance) {
        errorDiv.textContent = 'イシューとスタンスを選択してください。';
        return;
    }

    fetch('/api/stances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issue_id: issueId, stance, comment })
    })
        .then(handleFetchResponse)
        .then(data => {
            successDiv.textContent = 'スタンスが投稿されました！';
            document.getElementById('post-stance-form').reset();
            // 必要に応じてスタンス一覧を再取得・更新
            refreshIssues();
        })
        .catch(err => {
            console.error('Error posting stance:', err);
            errorDiv.textContent = `スタンスの投稿に失敗しました: ${err.message}`;
        });
}

/**
 * イシュー作成の処理
 */
function createIssue() {
    const headline = document.getElementById('headline').value.trim();
    const description = document.getElementById('description').value.trim();
    // 修正: タグではなくカテゴリIDとして取得
    const categoryId = document.getElementById('tag').value;
    const isFeaturedCheckbox = document.getElementById('isFeatured');
    const isFeatured = isFeaturedCheckbox ? isFeaturedCheckbox.checked : false;
    const errorDiv = document.getElementById('issue-error');
    const successDiv = document.getElementById('issue-success');

    // メッセージをクリア
    errorDiv.textContent = '';
    successDiv.textContent = '';

    if (!headline || !description || !categoryId) {
        errorDiv.textContent = 'すべてのフィールドを入力してください。';
        return;
    }

    fetch('/api/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // 修正: tag -> category_id
        body: JSON.stringify({ headline, description, category_id: categoryId, is_featured: isFeatured })
    })
        .then(handleFetchResponse)
        .then(data => {
            successDiv.textContent = 'イシューが作成されました！';
            document.getElementById('create-issue-form').reset();
            // 必要に応じてイシュー一覧を再取得・更新
            refreshIssues();
        })
        .catch(err => {
            console.error('Error creating issue:', err);
            errorDiv.textContent = `イシューの作成に失敗しました: ${err.message}`;
        });
}

/**
 * 「いいね」ボタンの処理
 * @param {number} issueId - イシューのID
 */
function likeIssue(issueId) {
    // 修正: エンドポイントを /api/issues/{id}/favorite に変更し、アクションを指定
    fetch(`/api/issues/${issueId}/favorite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add' })
    })
        .then(handleFetchResponse)
        .then(data => {
            alert('いいねしました！');
            updateLikeCount(issueId, data.favorites);
        })
        .catch(err => {
            console.error('Error liking issue:', err);
            alert(`いいねに失敗しました: ${err.message}`);
        });
}

/**
 * いいねのカウントを更新
 * @param {number} issueId - イシューのID
 * @param {number} newCount - 新しいいいね数
 */
function updateLikeCount(issueId, newCount) {
    const button = document.querySelector(`.like-button[data-issue-id="${issueId}"]`);
    if (button) {
        button.textContent = `関心あり (${newCount})`;
    }
}

/**
 * APIレスポンスを処理
 * @param {Response} response - Fetch APIレスポンス
 * @returns {Promise<Object>}
 */
function handleFetchResponse(response) {
    if (!response.ok) {
        return response.json().then(err => {
            throw new Error(err.error || '不明なエラーが発生しました。');
        });
    }
    return response.json();
}

/**
 * イシューカードを生成
 * @param {Object} issue - イシュー情報
 * @returns {string} - HTML文字列
 */
function createIssueCard(issue) {
    const cardClass = issue.is_featured ? 'featured-issue-card' : 'other-issue-card';
    return `
        <div class="${cardClass}">
            <h4>${sanitizeHTML(issue.headline)}</h4>
            <p>${sanitizeHTML(issue.description)}</p>
            <p>カテゴリ: ${sanitizeHTML(issue.category_name)}</p>
            <div class="vote-bar-container">
                <div class="vote-bar vote-bar-yes" style="width: ${sanitizePercentage(issue.yes_percent)}%;"></div>
                <div class="vote-bar vote-bar-no" style="width: ${sanitizePercentage(issue.no_percent)}%;"></div>
            </div>
            <div class="vote-counts">
                <span>YES: ${sanitizePercentage(issue.yes_percent)}%</span>
                <span>NO: ${sanitizePercentage(issue.no_percent)}%</span>
            </div>
            <button class="like-button" data-issue-id="${issue.id}">
                関心あり (${issue.likes || 0})
            </button>
        </div>
    `;
}

/**
 * APIからイシューを取得して表示
 * @param {string} url - APIのURL
 * @param {string} containerId - 表示先のコンテナID
 * @param {function} cardCreator - カードを作成する関数
 */
function displayIssues(url, containerId, cardCreator) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`コンテナ ${containerId} が見つかりませんでした。`);
        return;
    }

    fetch(url)
        .then(handleFetchResponse)
        .then(data => {
            if (!Array.isArray(data)) {
                console.error(`APIから予期しないデータ形式が返されました: ${data}`);
                container.innerHTML = '<p>データの取得に失敗しました。</p>';
                return;
            }

            container.innerHTML = data.length
                ? data.map(cardCreator).join('')
                : '<p>現在データはありません。</p>';
        })
        .catch(err => {
            console.error(`Error fetching issues from ${url}:`, err);
            container.innerHTML = '<p>データの取得に失敗しました。</p>';
        });
}

/**
 * イシュー一覧を再取得・更新する関数
 */
function refreshIssues() {
    // フィーチャーイシューとその他のイシューをそれぞれ再取得
    displayIssues('/api/featured_issues', 'featured-issues', createIssueCard);
    displayIssues('/api/issues_with_votes', 'existingIssues', createIssueCard);
}

/**
 * カテゴリドロップダウンを初期化（バックエンドから取得）
 */
function initializeTagDropdown() {
    const tagDropdown = document.getElementById('tag');
    if (!tagDropdown) {
        console.error("タグドロップダウンが見つかりませんでした。");
        return;
    }

    // 既存のオプションをクリア
    tagDropdown.innerHTML = '<option value="">選択してください</option>';

    fetch('/api/categories')
        .then(handleFetchResponse)
        .then(categories => {
            if (!Array.isArray(categories) || categories.length === 0) {
                console.warn('利用可能なカテゴリがありません。');
                tagDropdown.innerHTML = '<option disabled>利用可能なカテゴリがありません</option>';
                return;
            }

            categories.forEach(category => {
                const option = document.createElement('option');
                // 修正: option.value をカテゴリID に変更
                option.value = category.id;
                option.textContent = category.name;
                tagDropdown.appendChild(option);
            });
        })
        .catch(err => {
            console.error('Error fetching categories:', err);
            tagDropdown.innerHTML = '<option disabled>カテゴリの取得に失敗しました</option>';
        });
}

/**
 * イシュー選択ドロップダウンを初期化
 */
function initializeIssueDropdown() {
    const issueDropdown = document.getElementById('issue');
    if (!issueDropdown) {
        console.error("イシュードロップダウンが見つかりませんでした。");
        return;
    }

    // 既存のオプションをクリア
    issueDropdown.innerHTML = '<option value="">選択してください</option>';

    fetch('/api/admin/issues')
        .then(handleFetchResponse)
        .then(issues => {
            if (!Array.isArray(issues) || issues.length === 0) {
                console.warn('利用可能なイシューがありません。');
                issueDropdown.innerHTML = '<option disabled>利用可能なイシューがありません</option>';
                return;
            }

            issues.forEach(issue => {
                const option = document.createElement('option');
                option.value = issue.id;
                option.textContent = issue.headline;
                issueDropdown.appendChild(option);
            });
        })
        .catch(err => {
            console.error('Error fetching issues for dropdown:', err);
            issueDropdown.innerHTML = '<option disabled>イシューの取得に失敗しました</option>';
        });
}

/**
 * DOMが読み込まれた後の処理
 */
document.addEventListener('DOMContentLoaded', () => {
    fetchUserInfo(); // ユーザー情報を取得して表示
    initializeTagDropdown(); // カテゴリドロップダウンを初期化
    initializeIssueDropdown(); // イシュードロップダウンを初期化
    initializeForms(); // フォームのイベントリスナーを登録

    // フィーチャーイシューとその他のイシューを表示
    displayIssues('/api/featured_issues', 'featured-issues', createIssueCard); // フィーチャーイシュー
    displayIssues('/api/issues_with_votes', 'existingIssues', createIssueCard); // その他のイシュー
});
