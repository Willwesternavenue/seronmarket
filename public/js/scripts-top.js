// public/js/scripts-top.js

document.addEventListener('DOMContentLoaded', () => {
    // フィーチャーイシューとその他のイシューをそれぞれ表示
    displayIssues('/api/featured_issues', 'featured-issues', createFeaturedIssueCard);
    displayIssues('/api/issues_with_votes', 'existingIssues', createOtherIssueCard); // 正しいエンドポイントに変更

    // アクションボタンのクリックイベントを登録
    document.addEventListener('click', (event) => {
        const button = event.target.closest('.action-buttons button');
        if (button) {
            const action = getActionFromButton(button);
            const issueId = button.dataset.issueId;

            if (action && issueId) {
                handleActionButtonClick(action, issueId, button);
            }
        }
    });

    // キーボード操作の対応
    document.addEventListener('keypress', (event) => {
        const button = event.target.closest('.action-buttons button');
        if (button && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            const action = getActionFromButton(button);
            const issueId = button.dataset.issueId;

            if (action && issueId) {
                handleActionButtonClick(action, issueId, button);
            }
        }
    });
});

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
            endpoint = `/api/issues/${issueId}/like`; // サーバー側エンドポイント
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
        .then(data => {
            if (!Array.isArray(data)) {
                console.error(`APIから予期しないデータ形式が返されました: ${data}`);
                container.innerHTML = '<p>データの取得に失敗しました。</p>';
                return;
            }

            // イシューを表示
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
 * フィーチャーイシューカードを生成
 * @param {Object} issue - イシュー情報
 * @returns {string} - HTML文字列
 */
function createFeaturedIssueCard(issue) {
    const yesPercent = sanitizePercentage(issue.yes_percent);
    const noPercent = sanitizePercentage(issue.no_percent);
    const favoritesCount = issue.favorites || 0;
    const categoryClass = issue.category_id ? `category-${issue.category_id}` : 'category-default';
 
    return `
        <div class="featured-issue-card ${categoryClass}">
            <span class="issue-category">${sanitizeHTML(issue.tag)}</span>
            <span class="trending-icon"><i class="fas fa-fire"></i></span>
            <h4 class="issue-title">${sanitizeHTML(truncateText(issue.headline, 50))}</h4>
            <div class="vote-bar-container">
                <div class="vote-bar-yes" style="width: ${sanitizePercentage(issue.yes_percent)}%;"></div>
                <div class="vote-bar-no" style="width: ${sanitizePercentage(issue.no_percent)}%;"></div>            </div>
            <div class="vote-counts">
                <span>YES ${sanitizePercentage(issue.yes_percent)}%</span>
                <span>NO ${sanitizePercentage(issue.no_percent)}%</span>
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
 * その他のイシューカードを生成
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
            <span class="issue-category">${sanitizeHTML(issue.tag)}</span>
            <h4 class="issue-title">${sanitizeHTML(truncateText(issue.headline, 50))}</h4>
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
    return isNaN(parsedPercent) || parsedPercent < 0 ? '0' : parsedPercent.toFixed(1);
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
