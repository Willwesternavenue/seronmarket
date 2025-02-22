/***********************************
 *  定数・ヘルパー関数
 ***********************************/
const API_ENDPOINTS = {
    FEATURED_ISSUES: '/api/featured_issues',
    ISSUES_WITH_VOTES: '/api/issues_with_votes',
    CATEGORIES: '/api/categories',
    SEARCH_ISSUES: '/api/issues/search',
};

/**
 * APIレスポンスを処理
 */
function handleFetchResponse(response) {
    if (!response.ok) {
        return response.json().then(err => {
            throw new Error(err.error || 'Unknown error');
        });
    }
    return response.json();
}

/**
 * エラーを表示
 */
function displayError(message, containerId = null) {
    if (containerId) {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = `<p>${sanitizeHTML(message)}</p>`;
        }
    }
    console.error(message);
}

/**
 * テキストをサニタイズ
 */
function sanitizeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}

/**
 * 数値をパーセント表記に変換
 */
function sanitizePercentage(percent) {
    const parsed = parseFloat(percent);
    if (isNaN(parsed) || parsed < 0) return '0';
    if (parsed > 100) return '100';
    return parsed.toFixed(1);
}

/**
 * テキストを指定された長さに制限
 */
function truncateText(text, maxLength) {
    if (!text || text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
}

/***********************************
 *  カード生成関数
 ***********************************/

/**
 * フィーチャーイシューカードを生成（コメント表示あり）
 */
function createFeaturedIssueCard(issue) {
    const yesPercent = sanitizePercentage(issue.yes_percent);
    const noPercent = sanitizePercentage(issue.no_percent);
    const favoritesCount = issue.favorites || 0;
    const categoryClass = issue.category_id ? `category-${issue.category_id}` : 'category-default';

    return `
        <div class="featured-issue-card ${categoryClass}">
            <span class="issue-category">${sanitizeHTML(issue.category_name || '未分類')}</span>
            <a href="/issue.html?issue_id=${issue.id}">
                <h3 class="multiline-ellipsis">${sanitizeHTML(issue.headline)}</h3>
            </a>
            <!-- コメントセクション（フィーチャーは表示）-->
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
                <button class="like-button" data-issue-id="${issue.id}" tabindex="0" aria-label="いいね ボタン">
                    <i class="fas fa-fire icon"></i> ${issue.likes || 0}
                </button>
                <button class="stance-button" data-issue-id="${issue.id}" tabindex="0" aria-label="スタンス ボタン">
                    <i class="fas fa-balance-scale icon"></i> ${issue.stance_count || 0}
                </button>
                <button class="comment-button" data-issue-id="${issue.id}" tabindex="0" aria-label="コメント ボタン">
                    <i class="fas fa-comment icon"></i> ${issue.comments_count || 0}
                </button>
                <button class="favorite-button" data-issue-id="${issue.id}" tabindex="0" aria-label="お気に入り ボタン">
                    <i class="fas fa-star icon"></i> ${favoritesCount}
                </button>
                <button class="comment-button" data-issue-id="${issue.id}" tabindex="0" aria-label="コメント ボタン">
                    <i class="fas fa-bullhorn icon"></i> ${issue.comments_count || 0}
                </button>
            </div>
        </div>
    `;
}

/**
 * その他のイシューカードを生成（コメント表示なし）
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
                <h4 class="issue-title multiline-ellipsis">${sanitizeHTML(truncateText(issue.headline, 50))}</h4>
            </a>
            <!-- コメントセクション（その他イシューでは非表示）-->
            <div class="vote-bar-container">
                <div class="vote-bar-yes" style="width: ${yesPercent}%;"></div>
                <div class="vote-bar-no" style="width: ${noPercent}%;"></div>
            </div>
            <div class="action-buttons">
                <button class="like-button" data-issue-id="${issue.id}" tabindex="0" aria-label="いいね ボタン">
                    <i class="fas fa-fire icon"></i> ${issue.likes || 0}
                </button>
                <button class="stance-button" data-issue-id="${issue.id}" tabindex="0" aria-label="スタンス ボタン">
                    <i class="fas fa-balance-scale icon"></i> ${issue.stance_count || 0}
                </button>
                <button class="comment-button" data-issue-id="${issue.id}" tabindex="0" aria-label="コメント ボタン">
                    <i class="fas fa-comment icon"></i> ${issue.comments_count || 0}
                </button>
                <button class="comment-button" data-issue-id="${issue.id}" tabindex="0" aria-label="コメント ボタン">
                    <i class="fas fa-bullhorn icon"></i> ${issue.comments_count || 0}
                </button>
            </div>
        </div>
    `;
}

/***********************************
 *  イシュー表示（コメント表示はフィーチャーのみ）
 ***********************************/

/**
 * イシューを取得 & カード表示
 * @param {string} url 
 * @param {string} containerId 
 * @param {function} cardCreator 
 * @param {boolean} withComments - フィーチャーイシューかどうか
 */
function displayIssues(url, containerId, cardCreator, withComments = false) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`コンテナ ${containerId} が見つかりませんでした。`);
        return;
    }

    fetch(url)
        .then(handleFetchResponse)
        .then(issues => {
            container.innerHTML = '';
            issues.forEach(issue => {
                const cardHTML = cardCreator(issue);
                const cardElement = document.createElement('div');
                cardElement.innerHTML = cardHTML;
                container.appendChild(cardElement);

                // フィーチャーイシューの場合のみコメントを取得
                if (withComments) {
                    fetch(`/api/issues/${issue.id}/comments`)
                        .then(handleFetchResponse)
                        .then(comments => updateCommentsSection(cardElement, comments))
                        .catch(err => {
                            console.error(`Failed to fetch comments for issue ${issue.id}:`, err);
                            updateCommentsSection(cardElement, [], true);
                        });
                }
            });
        })
        .catch(err => {
            console.error(`Error fetching issues from ${url}:`, err);
            displayError('データの取得に失敗しました。', containerId);
        });
}

/**
 * コメントセクションを更新
 */
function updateCommentsSection(cardElement, comments, isError = false) {
    const commentsSection = cardElement.querySelector('.comments-section');
    if (!commentsSection) return; // その他イシューにはコメントセクションがない
    if (isError) {
        commentsSection.innerHTML = '<p>コメントの取得に失敗しました。</p>';
        return;
    }
    if (!comments || comments.length === 0) {
        commentsSection.innerHTML = '<p>（まだコメントはありません）</p>';
    } else {
        const latestComment = comments[0];
        commentsSection.innerHTML = `
            <div class="comment">
                <p>${sanitizeHTML(latestComment.comment)}</p>
                <small>- ${sanitizeHTML(latestComment.username || '名無しさん')} - 
                       ${new Date(latestComment.created_at).toLocaleString()}</small>
            </div>
        `;
    }
}

/***********************************
 *  タブ & 検索機能
 ***********************************/

function fetchCategories() {
    fetch(API_ENDPOINTS.CATEGORIES)
        .then(handleFetchResponse)
        .then(categories => {
            const tabsContainer = document.querySelector('.tabs');
            if (!tabsContainer) return;

            tabsContainer.innerHTML = '';
            const allButton = document.createElement('button');
            allButton.className = 'tab-button active';
            allButton.dataset.category = 'all';
            allButton.textContent = '全カテゴリ';
            tabsContainer.appendChild(allButton);

            categories.forEach(cat => {
                const button = document.createElement('button');
                button.className = `tab-button category-${cat.id}`;
                button.dataset.category = cat.id;
                button.textContent = cat.name;
                tabsContainer.appendChild(button);
            });
        })
        .catch(err => console.error('Error fetching categories:', err));
}

function searchIssues(query) {
    if (!query) {
        displayIssues(API_ENDPOINTS.FEATURED_ISSUES, 'featured-issues', createFeaturedIssueCard, true);
        displayIssues(API_ENDPOINTS.ISSUES_WITH_VOTES, 'existingIssues', createOtherIssueCard, false);
        return;
    }
    fetch(`${API_ENDPOINTS.SEARCH_ISSUES}?query=${encodeURIComponent(query)}`)
        .then(handleFetchResponse)
        .then(issues => {
            const featured = issues.filter(i => i.is_featured === 1);
            const others   = issues.filter(i => i.is_featured === 0);
            renderIssues('featured-issues', featured, createFeaturedIssueCard, true);
            renderIssues('existingIssues', others, createOtherIssueCard, false);
        })
        .catch(err => console.error('Error searching issues:', err));
}

/**
 * イシュー配列を表示
 */
function renderIssues(containerId, issues, cardCreator, withComments = false) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`コンテナ ${containerId} が見つかりませんでした。`);
        return;
    }
    container.innerHTML = '';
    issues.forEach(issue => {
        const cardHTML = cardCreator(issue);
        const cardElement = document.createElement('div');
        cardElement.innerHTML = cardHTML;
        container.appendChild(cardElement);
        if (withComments) {
            fetch(`/api/issues/${issue.id}/comments`)
                .then(handleFetchResponse)
                .then(comments => updateCommentsSection(cardElement, comments))
                .catch(err => {
                    console.error(`Failed to fetch comments for issue ${issue.id}:`, err);
                    updateCommentsSection(cardElement, [], true);
                });
        }
    });
}

/***********************************
 *  アクションボタン処理
 ***********************************/

/**
 * ボタンからアクションを取得
 */
function getActionFromButton(button) {
    if (button.classList.contains('like-button')) return 'like';
    if (button.classList.contains('favorite-button')) return 'favorite';
    if (button.classList.contains('comment-button')) return 'comment';
    if (button.classList.contains('stance-button')) return 'stance';
    return null;
}

/**
 * アクションボタンクリック
 */
function handleActionButtonClickEvent(e) {
    handleActionButtonEvent(e, false);
}
function handleActionButtonKeyPress(e) {
    handleActionButtonEvent(e, true);
}
function handleActionButtonEvent(event, isKeyPress = false) {
    const button = event.target.closest('.action-buttons button');
    if (!button) return;
    if (isKeyPress && !['Enter', ' '].includes(event.key)) return;
    const action = getActionFromButton(button);
    const issueId = button.dataset.issueId;
    if (action && issueId) handleActionButtonClick(action, issueId, button);
}

/**
 * アクション処理
 */
function handleActionButtonClick(action, issueId, button) {
    let endpoint = '';
    let method = 'POST';
    let body = {};

    switch(action) {
        case 'like':
            // 修正: エンドポイントとボディを favorites エンドポイントに合わせる
            endpoint = `/api/issues/${issueId}/favorite`;
            body = { action: 'add' };
            break;
        case 'favorite':
            endpoint = `/api/issues/${issueId}/favorite`;
            body = { action: 'add' };
            break;
        case 'stance':
            const userStance = prompt('スタンスを選択 (YES, NO, 様子見):');
            if (!['YES', 'NO', '様子見'].includes(userStance)) {
                alert('有効なスタンスを選択してください。');
                return;
            }
            const stanceComment = prompt('コメントを入力 (任意):');
            endpoint = `/api/stances`;
            body = { issue_id: issueId, stance: userStance, comment: stanceComment || null };
            break;
        default:
            console.error('Unknown action:', action);
            return;
    }

    fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: Object.keys(body).length ? JSON.stringify(body) : null
    })
        .then(handleFetchResponse)
        .then(data => {
            alert(`${getActionName(action)}しました！`);
            if (action === 'like') {
                updateButtonCount(button, data.likes || 0);
            } else if (action === 'favorite') {
                updateButtonCount(button, data.favorites || 0);
            } else if (action === 'stance') {
                updateButtonCount(button, data.stance_count || 0);
            }
        })
        .catch(err => {
            console.error(`Error performing ${action} on issue ${issueId}:`, err);
            alert(`${getActionName(action)}に失敗しました: ${err.message}`);
        });
}

/**
 * アクション名
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
 */
function updateButtonCount(button, newCount) {
    // ここは、ボタン内にカウントを示す span があれば更新、
    // ない場合はボタンのテキストを直接書き換える例
    if (button.querySelector('.count')) {
        button.querySelector('.count').textContent = `(${newCount})`;
    } else {
        // アイコン部分を維持しつつテキスト更新（シンプルな例）
        button.innerHTML = button.innerHTML.replace(/\d+/, newCount);
    }
}

/***********************************
 *  メインの初期処理
 ***********************************/
document.addEventListener('DOMContentLoaded', () => {
    // 1) 初期表示：フィーチャーイシュー（withComments=true） & その他のイシュー（withComments=false）
    displayIssues(API_ENDPOINTS.FEATURED_ISSUES, 'featured-issues', createFeaturedIssueCard, true);
    displayIssues(API_ENDPOINTS.ISSUES_WITH_VOTES, 'existingIssues', createOtherIssueCard, false);

    // 2) カテゴリタブ生成＆タブ切り替え処理
    const tabsContainer = document.querySelector('.tabs');
    if (tabsContainer) {
        fetchCategories();
        tabsContainer.addEventListener('click', (e) => {
            if (!e.target.classList.contains('tab-button')) return;
            [...tabsContainer.querySelectorAll('.tab-button')].forEach(btn =>
                btn.classList.toggle('active', btn === e.target)
            );
            const categoryId = e.target.dataset.category;
            if (categoryId === 'all') {
                displayIssues(API_ENDPOINTS.FEATURED_ISSUES, 'featured-issues', createFeaturedIssueCard, true);
                displayIssues(API_ENDPOINTS.ISSUES_WITH_VOTES, 'existingIssues', createOtherIssueCard, false);
            } else {
                displayIssues(`${API_ENDPOINTS.FEATURED_ISSUES}?category_id=${categoryId}`, 'featured-issues', createFeaturedIssueCard, true);
                displayIssues(`${API_ENDPOINTS.ISSUES_WITH_VOTES}?category_id=${categoryId}`, 'existingIssues', createOtherIssueCard, false);
            }
        });
    }

    // 3) 検索機能
    const searchForm = document.getElementById('searchForm');
    const searchInput = document.getElementById('searchInput');
    if (searchForm && searchInput) {
        searchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const query = searchInput.value.trim();
            if (!query) {
                displayIssues(API_ENDPOINTS.FEATURED_ISSUES, 'featured-issues', createFeaturedIssueCard, true);
                displayIssues(API_ENDPOINTS.ISSUES_WITH_VOTES, 'existingIssues', createOtherIssueCard, false);
            } else {
                fetch(`${API_ENDPOINTS.SEARCH_ISSUES}?query=${encodeURIComponent(query)}`)
                    .then(handleFetchResponse)
                    .then(issues => {
                        const featured = issues.filter(i => i.is_featured === 1);
                        const others   = issues.filter(i => i.is_featured === 0);
                        renderIssues('featured-issues', featured, createFeaturedIssueCard, true);
                        renderIssues('existingIssues', others, createOtherIssueCard, false);
                    })
                    .catch(err => console.error('Error searching issues:', err));
            }
        });
    }

    // 4) アクションボタンのクリック & キーボード操作
    document.addEventListener('click', handleActionButtonClickEvent);
    document.addEventListener('keypress', handleActionButtonKeyPress);
});
