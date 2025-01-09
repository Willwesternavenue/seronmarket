// public/js/scripts-top.js

const PORT = 3000;

document.addEventListener('DOMContentLoaded', () => {
    // 1) 初期表示：フィーチャーイシュー & その他のイシューを表示
    displayIssues('/api/featured_issues', 'featured-issues', createFeaturedIssueCard);
    displayIssues('/api/issues_with_votes', 'existingIssues', createOtherIssueCard);
    // 2) アクションボタンのクリック & キーボード操作に対応
    document.addEventListener('click', handleActionButtonClickEvent);
    document.addEventListener('keypress', handleActionButtonKeyPress);
    // 3) カテゴリタブ生成＆タブ切り替え処理
    const tabsContainer = document.querySelector('.tabs');
    if (tabsContainer) {
        fetchCategories(); // カテゴリタブの生成
        tabsContainer.addEventListener('click', (e) => {
            if (!e.target.classList.contains('tab-button')) return;
            
            // アクティブ状態の切り替え
            const activeTab = tabsContainer.querySelector('.tab-button.active');
            if (activeTab) {
                activeTab.classList.remove('active');
            }
            e.target.classList.add('active');

            const categoryId = e.target.dataset.category;

            // "all" 選択なら全件表示、それ以外はカテゴリフィルタ
            if (categoryId === 'all') {
                displayIssues('/api/featured_issues', 'featured-issues', createFeaturedIssueCard);
                displayIssues('/api/issues_with_votes', 'existingIssues', createOtherIssueCard);
            } else {
                displayIssues(`/api/featured_issues?category_id=${categoryId}`, 'featured-issues', createFeaturedIssueCard);
                displayIssues(`/api/issues_with_votes?category_id=${categoryId}`, 'existingIssues', createOtherIssueCard);
            }
        });
    }
    const searchForm = document.getElementById('searchForm');
    const searchInput = document.getElementById('searchInput');
    if (searchForm && searchInput) {
        searchForm.addEventListener('submit', (e) => {
            e.preventDefault(); // ページリロードを防ぐ
            const query = searchInput.value.trim();
            searchIssues(query);
        });
    }
});
    
/**
 * アクションボタンのクリック処理
 */
function handleActionButtonClickEvent(event) {
    const button = event.target.closest('.action-buttons button');
    if (!button) return;

    const action = getActionFromButton(button);
    const issueId = button.dataset.issueId;
    if (action && issueId) {
        handleActionButtonClick(action, issueId, button);
    }
}

/**
 * アクションボタンのキーボード操作
 */
function handleActionButtonKeyPress(event) {
    const button = event.target.closest('.action-buttons button');
    if (!button) return;

    // Enter または Space のときアクション実行
    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        const action = getActionFromButton(button);
        const issueId = button.dataset.issueId;
        if (action && issueId) {
            handleActionButtonClick(action, issueId, button);
        }
    }
}

/**
 * カテゴリ一覧を取得してタブを生成
 */
function fetchCategories() {
    fetch('/api/categories')
        .then(handleFetchResponse)
        .then(categories => {
            const tabsContainer = document.querySelector('.tabs');
            if (!tabsContainer) return;

            // 初期状態（全て）ボタンをクリアして再生成
            tabsContainer.innerHTML = '';
            const allButton = document.createElement('button');
            allButton.className = 'tab-button active';
            allButton.dataset.category = 'all';
            allButton.textContent = '全カテゴリ';
            tabsContainer.appendChild(allButton);

            // APIで取得したカテゴリをタブに追加
            categories.forEach(category => {
                const button = document.createElement('button');
                button.className = `tab-button category-${category.id}`;
                button.dataset.category = category.id;
                button.textContent = category.name;
                tabsContainer.appendChild(button);
            });
        })
        .catch(err => console.error('Error fetching categories:', err));
}

/**
 * イシューを取得して「issues-container」に表示
 * @param {number|null} categoryId - フィルタしたいカテゴリID (null の場合は全て)
 */
function fetchIssues(categoryId = null) {
    const endpoint = categoryId 
        ? `/api/issues?category_id=${categoryId}` 
        : '/api/issues';

    fetch(endpoint)
        .then(handleFetchResponse)
        .then(issues => {
            const issuesContainer = document.getElementById('issues-container');
            if (!issuesContainer) return;

            if (!Array.isArray(issues)) {
                issuesContainer.innerHTML = '<p>イシューの取得に失敗しました。</p>';
                return;
            }

            // 表示用HTML
            issuesContainer.innerHTML = issues.map(issue => `
                <div class="issue-card">
                    <h3>${sanitizeHTML(issue.headline)}</h3>
                    <p>カテゴリ: ${sanitizeHTML(issue.category_name) || '未分類'}</p>
                    <p>作成者: ${sanitizeHTML(issue.created_by) || '不明'}</p>
                    <p>いいね: ${sanitizeHTML(issue.likes)}</p>
                </div>
            `).join('');
        })
        .catch(err => {
            console.error('Error fetching issues:', err);
            const issuesContainer = document.getElementById('issues-container');
            if (issuesContainer) {
                issuesContainer.innerHTML = '<p>イシューの取得に失敗しました。</p>';
            }
        });
}

function rotateComments(comments, containerSelector) {
    const container = document.querySelector(containerSelector);
    if (!container) {
        console.error(`コメントのコンテナが見つかりません: ${containerSelector}`);
        return;
    }

    const latestComments = comments.slice(0, 3);
    let currentIndex = 0;

    function displayComments(comments) {
        const container = document.getElementById('comments-container');
        if (!container) {
            console.error('コメント表示用のコンテナが見つかりません。');
            return;
        }
    
        container.innerHTML = comments.map(c => `
            <div class="comment">
                <p>${sanitizeHTML(c.comment)}</p>
            </div>
        `).join('');
    }
    

    if (latestComments.length > 0) {
        displayComment(currentIndex);
        setInterval(() => {
            currentIndex = (currentIndex + 1) % latestComments.length;
            displayComment(currentIndex);
        }, 3000);
    } else {
        container.innerHTML = '<p>表示するコメントがありません。</p>';
    }
}

function searchIssues(query) {
    if (!query) {
        // すべて再取得
        displayIssues('/api/featured_issues', 'featured-issues', createFeaturedIssueCard);
        displayIssues('/api/issues_with_votes', 'existingIssues', createOtherIssueCard);
        return;
    }
    fetch(`/api/issues/search?q=${encodeURIComponent(query)}`)
        .then(handleFetchResponse)
        .then(issues => {
            // 取得したissuesを "フィーチャー" と "その他" に振り分け
            const featuredIssues = issues.filter(i => i.is_featured === 1);
            const otherIssues = issues.filter(i => i.is_featured === 0);

            // フィーチャー表示先
            const featuredContainer = document.getElementById('featured-issues');
            if (!featuredContainer) return;

            // その他イシュー表示先
            const existingContainer = document.getElementById('existingIssues');
            if (!existingContainer) return;

            // いったんクリア
            featuredContainer.innerHTML = '';
            existingContainer.innerHTML = '';

            // フィーチャー表示
            if (featuredIssues.length === 0) {
                featuredContainer.innerHTML = `<p>「${query}」に一致するフィーチャーイシューはありません。</p>`;
            } else {
                featuredIssues.forEach(issue => {
                    const cardHTML = createFeaturedIssueCard(issue);
                    const cardElement = document.createElement('div');
                    cardElement.innerHTML = cardHTML;
                    featuredContainer.appendChild(cardElement);

                    // コメント取得
                    fetchAndDisplayComments(issue.id, cardElement);
                });
            }

            // その他イシュー表示
            if (otherIssues.length === 0) {
                existingContainer.innerHTML = `<p>「${query}」に一致するイシューはありません。</p>`;
            } else {
                otherIssues.forEach(issue => {
                    const cardHTML = createOtherIssueCard(issue);
                    const cardElement = document.createElement('div');
                    cardElement.innerHTML = cardHTML;
                    existingContainer.appendChild(cardElement);

                    // コメント取得
                    fetchAndDisplayComments(issue.id, cardElement);
                });
            }
        })
        .catch(err => {
            console.error('Error searching issues:', err);
        });
}

/**
 * ボタンからアクションを取得
 * @param {HTMLElement} button - クリックされたボタン
 * @returns {string|null} - アクション名（like, favorite, comment, stance）またはnull
 */
function getActionFromButton(button) {
    if (button.classList.contains('like-button')) return 'like';
    if (button.classList.contains('favorite-button')) return 'favorite';
    if (button.classList.contains('comment-button')) return 'comment';
    if (button.classList.contains('stance-button')) return 'stance';
    return null;
}

/**
 * アクションボタンのクリックを処理
 * @param {string} action - アクションの種類（like, favorite, comment, stance）
 * @param {number} issueId - イシューのID
 * @param {HTMLElement} button - クリックされたボタン
 */
function handleActionButtonClick(action, issueId, button) {
    let endpoint = '';
    let method = 'POST';
    let body = {};

    switch(action) {
        case 'like':
            endpoint = `/api/issues/${issueId}/like`;
            break;
        case 'stance':
            const userStance = prompt('スタンスを選択してください (YES, NO, 様子見):');
            if (!['YES', 'NO', '様子見'].includes(userStance)) {
                alert('有効なスタンスを選択してください。');
                return;
            }
            const stanceComment = prompt('スタンスに関するコメントを入力してください (任意):');
            endpoint = `/api/stances`;
            body = { issue_id: issueId, stance: userStance, comment: stanceComment || null };
            break;
        default:
            console.error('Unknown action:', action);
            return;
    }

    fetch(endpoint, {
        method: method,
        headers: {
            'Content-Type': 'application/json'
        },
        body: Object.keys(body).length > 0 ? JSON.stringify(body) : null
    })
    .then(handleFetchResponse)
    .then(data => {
        alert(`${getActionName(action)}しました！`);
        if (action === 'like') {
            updateButtonCount(button, data.likes || 0); // "いいね" の場合
        } else if (action === 'stance') {
            updateButtonCount(button, data.stance_count || 0); // スタンスの場合
        }
    })
    .catch(err => {
        console.error(`Error performing ${action} on issue ${issueId}:`, err);
        alert(`${getActionName(action)}に失敗しました: ${err.message}`);
    });
}

/**
 * アクション名を取得
 * @param {string} action - アクションの種類
 * @returns {string} - 表示用のアクション名
 */
function getActionName(action) {
    switch(action) {
        case 'stance': return 'スタンス';
        case 'like': return 'いいね';
        case 'favorite': return 'お気に入り';
        case 'comment': return 'コメント';
        default: return 'アクション';
    }
}

/**
 * ボタンのカウントを更新
 * @param {HTMLElement} button - 更新するボタン
 * @param {number} newCount - 新しいカウント値
 */
function updateButtonCount(button, newCount) {
    const countSpan = button.querySelector('.count');
    if (countSpan) {
        countSpan.textContent = `(${newCount})`;
    }
}
function fetchAndDisplayComments(issueId, cardElement) {
    fetch(`/api/issues/${issueId}/comments`)
        .then(handleFetchResponse)
        .then(comments => {
            const commentsSection = cardElement.querySelector('.comments-section');
            if (!commentsSection) return;

            if (comments.length > 0) {
                const latestComment = comments[0]; // 最新のコメント1件を取得
                const singleCommentHTML = `
                    <div class="comment">
                        <p>${sanitizeHTML(latestComment.comment)}</p>
                        <small>- ${sanitizeHTML(latestComment.username || '名無しさん')}, ${new Date(latestComment.created_at).toLocaleString()}</small>
                    </div>
                `;
                commentsSection.innerHTML = singleCommentHTML;
            } else {
                commentsSection.innerHTML = '<p>（まだコメントがありません）</p>';
            }
        })
        .catch(err => {
            console.error(`Error fetching comments for issue ${issueId}:`, err);
            const commentsSection = cardElement.querySelector('.comments-section');
            if (commentsSection) {
                commentsSection.innerHTML = '<p>コメントの取得に失敗しました。</p>';
            }
        });
}

/**
 * APIからデータを取得して表示
 * @param {string} url - APIエンドポイントのURL
 * @param {string} containerId - 表示先のコンテナID
 * @param {function} cardCreator - カードを生成する関数
 */
function displayIssues(url, containerId, cardCreator) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`コンテナ ${containerId} が見つかりませんでした。`);
        return;
    }

    fetch(url)
        .then(handleFetchResponse)
        .then(issues => {
            container.innerHTML = ''; // 初期化
            issues.forEach(issue => {
                const cardHTML = cardCreator(issue);
                const cardElement = document.createElement('div');
                cardElement.innerHTML = cardHTML;
                container.appendChild(cardElement);

                // コメントを非同期で取得して表示
                fetchAndDisplayComments(issue.id, cardElement);
            });
        })
        .catch(err => {
            console.error(`Error fetching issues from ${url}:`, err);
            container.innerHTML = '<p>データの取得に失敗しました。</p>';
        });
}


/**
 * フィーチャーイシューカードを生成
 * @param {Object} issue - イシュー情報
 * @returns {string} - HTML文字列
 */
function createFeaturedIssueCard(issue) {
    const yesPercent = sanitizePercentage(issue.yes_percent);
    const noPercent = sanitizePercentage(issue.no_percent);
    const favoritesCount = issue.favorites || 0;
    const categoryClass = issue.category_id ? `category-${issue.category_id}` : 'category-default';

    // コメントセクションのプレースホルダーを追加
    return `
        <div class="featured-issue-card ${categoryClass}">
            <span class="issue-category">${sanitizeHTML(issue.category_name)}</span>
            <a href="/issue.html?issue_id=${issue.id}">
                <h3 class="multiline-ellipsis">${sanitizeHTML(issue.headline)}</h3>
            </a>
            <div class="comments-section">
                <p>コメントを取得中...</p>
            </div>
            <div class="vote-bar-container">
                <div class="vote-bar-yes" style="width: ${yesPercent}%;"></div>
                <div class="vote-bar-no" style="width: ${noPercent}%;"></div>
            </div>
            <div class="vote-counts">
                <span>YES ${yesPercent}%</span>
                <span>NO ${noPercent}%</span>
            </div>
            <div class="action-buttons">
                <button class="stance-button" data-issue-id="${issue.id}" tabindex="0" aria-label="スタンス ボタン">
                    <i class="fas fa-hand-paper icon"></i> ${issue.stance_count || 0}
                </button>
                <button class="like-button" data-issue-id="${issue.id}" tabindex="0" aria-label="いいね ボタン">
                    <i class="fas fa-heart icon"></i> ${issue.likes || 0}
                </button>
                <button class="favorite-button" data-issue-id="${issue.id}" tabindex="0" aria-label="お気に入り ボタン">
                    <i class="fas fa-star icon"></i> ${favoritesCount}
                </button>
                <button class="comment-button" data-issue-id="${issue.id}" tabindex="0" aria-label="コメント ボタン">
                    <i class="fas fa-comment icon"></i> ${issue.comments_count || 0}
                </button>
            </div>
        </div>
    `;
}
/**
 * その他のイシューカードを生成// Expressの例:
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

 * @param {Object} issue - イシュー情報
 * @returns {string} - HTML文字列
 */
function createOtherIssueCard(issue) {
    const yesPercent = sanitizePercentage(issue.yes_percent);
    const noPercent = sanitizePercentage(issue.no_percent);
    const favoritesCount = issue.favorites || 0;
    const categoryClass = issue.category_id ? `category-${issue.category_id}` : 'category-default';

    return `
        <div class="other-issue-card ${categoryClass}">
            <span class="issue-category">${sanitizeHTML(issue.category_name)}</span>
            <a href="/issue.html?issue_id=${issue.id}">
                <h4 class="issue-title multiline-ellipsis">
                ${sanitizeHTML(truncateText(issue.headline, 50))}</h4>
            </a>
                <div class="vote-bar-container">
                <div class="vote-bar-yes" style="width: ${yesPercent}%;"></div>
                <div class="vote-bar-no" style="width: ${noPercent}%;"></div>
            </div>
            <div class="vote-counts">
                <span>YES ${yesPercent}%</span>
                <span>NO ${noPercent}%</span>
            </div>

            <div class="action-buttons">
                <button class="stance-button" data-issue-id="${issue.id}" tabindex="0" aria-label="スタンス ボタン">
                    <i class="fas fa-hand-paper icon"></i> ${issue.stance_count || 0}
                </button>
                <button class="like-button" data-issue-id="${issue.id}" tabindex="0" aria-label="いいね ボタン">
                    <i class="fas fa-heart icon"></i> ${issue.likes || 0}
                </button>
                <button class="favorite-button" data-issue-id="${issue.id}" tabindex="0" aria-label="お気に入り ボタン">
                    <i class="fas fa-star icon"></i> ${favoritesCount}
                </button>
                <button class="comment-button" data-issue-id="${issue.id}" tabindex="0" aria-label="コメント ボタン">
                    <i class="fas fa-comment icon"></i> ${issue.comments_count || 0}
                </button>
            </div>
        </div>
    `;
}

/**
 * サニタイズ関数
 * @param {string} str - サニタイズする文字列
 * @returns {string}
 */
function sanitizeHTML(str) {
    const tempDiv = document.createElement('div');
    tempDiv.textContent = str || '';
    return tempDiv.innerHTML;
}

/**
 * パーセンテージをサニタイズ
 * @param {number|string} percent - サニタイズするパーセンテージ
 * @returns {string}
 */
function sanitizePercentage(percent) {
    const parsedPercent = parseFloat(percent);
    return isNaN(parsedPercent) || parsedPercent < 0
        ? '0'
        : parsedPercent.toFixed(1);
}

/**
 * テキストを指定された長さに制限
 * @param {string} text - 元のテキスト
 * @param {number} maxLength - 最大文字数
 * @returns {string} - 制限後のテキスト
 */
function truncateText(text, maxLength) {
    if (!text || text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
}

/**
 * APIレスポンスを処理
 * @param {Response} response - Fetch APIレスポンス
 * @returns {Promise<Object>}
 */
function handleFetchResponse(response) {
    if (!response.ok) {
        return response.json().then(err => {
            throw new Error(err.error || 'Unknown error');
        });
    }
    return response.json();
}

function displayError(message) {
    const errorContainer = document.getElementById('error-message');
    if (errorContainer) {
        errorContainer.textContent = message;
        errorContainer.style.display = 'block';
    }
}

function createActionButton(className, label, iconClass, count) {
    return `
        <button class="${className}" tabindex="0" aria-label="${label}">
            <i class="${iconClass} icon"></i>
            <span class="count">(${count || 0})</span>
        </button>
    `;
}
