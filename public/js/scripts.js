// public/js/scripts.js
document.addEventListener('DOMContentLoaded', () => {
    // ユーザー情報を取得
    fetch('/api/user')
        .then(handleFetchResponse)
        .then(data => {
            const usernameElement = document.getElementById('username');
            const isAdminCheckbox = document.getElementById('is-admin-checkbox');
        
            if (usernameElement) usernameElement.textContent = data.username;
            if (isAdminCheckbox) isAdminCheckbox.checked = data.isAdmin;
        })
        .catch(err => {
            console.error('Error fetching user data:', err);
            alert('ユーザーデータの取得に失敗しました。');
        });

    // イシュー作成フォームの送信を処理
    // イシュー作成フォームの送信を処理
    const createIssueForm = document.getElementById('create-issue-form');
    if (createIssueForm) {
        createIssueForm.addEventListener('submit', (event) => {
            event.preventDefault();
            
            const headline = document.getElementById('headline').value.trim();
            const description = document.getElementById('description').value.trim();
            // 修正: "tag" -> "category_id"
            const categoryId = document.getElementById('tag').value;
            const isFeatured = document.getElementById('isFeatured').checked;
            
            if (!headline || !description || !categoryId) {
                alert('すべてのフィールドを入力してください。');
                return;
            }
            
            // 修正: フィールド名を category_id と is_featured に変更
            const issueData = { 
                headline, 
                description, 
                category_id: categoryId, 
                is_featured: isFeatured 
            };
            
            fetch('/api/issues', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(issueData)
            })
            .then(handleFetchResponse)
            .then(data => {
                alert('イシューが正常に作成されました。');
                createIssueForm.reset();
                refreshIssues();
            })
            .catch(err => {
                console.error('Error creating issue:', err);
                alert(`イシューの作成に失敗しました: ${err.message}`);
            });
        });
    }

    // スタンス投稿フォームの送信を処理
    const postStanceForm = document.getElementById('post-stance-form');
    if (postStanceForm) {
        postStanceForm.addEventListener('submit', (event) => {
            event.preventDefault();

            const issueId = document.getElementById('issue').value;
            const stance = document.getElementById('stance').value;
            const comment = document.getElementById('comment').value.trim();

            if (!issueId || !stance) {
                alert('イシューとスタンスを選択してください。');
                return;
            }

            const stanceData = { issue_id: issueId, stance, comment: comment || null };

            fetch('/api/stances', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(stanceData)
            })
            .then(handleFetchResponse)
            .then(data => {
                alert('スタンスが正常に投稿されました。');
                postStanceForm.reset();
                refreshIssues();
            })
            .catch(err => {
                console.error('Error posting stance:', err);
                alert(`スタンスの投稿に失敗しました: ${err.message}`);
            });
        });
    }

    // 初期ロード時にイシューを取得
    refreshIssues();
});

// イシュー一覧を再取得・更新する関数
async function refreshIssues() {
    try {
        const [featuredIssues, otherIssues] = await Promise.all([
            fetch('/api/featured_issues').then(handleFetchResponse),
            fetch('/api/issues_with_votes').then(handleFetchResponse),
        ]);

        // フィーチャーイシューを表示
        const featuredContainer = document.getElementById('featured-issues');
        featuredContainer.innerHTML = featuredIssues.length
            ? featuredIssues.map(createFeaturedIssueCard).join('')
            : '<p>現在データはありません。</p>';

        // その他のイシューを表示
        const otherContainer = document.getElementById('existingIssues');
        otherContainer.innerHTML = otherIssues.length
            ? otherIssues.map(createOtherIssueCard).join('')
            : '<p>現在データはありません。</p>';

    } catch (err) {
        console.error('Error refreshing issues:', err);
        alert('イシューリストの更新に失敗しました。');
    }
}

/**
 * APIレスポンスを処理
 * @param {Response} response - Fetch APIレスポンス
 * @returns {Promise<Object>}
 */
function handleFetchResponse(response) {
    if (!response.ok) {
        return response.json().catch(() => ({ error: '不明なエラー' })).then(err => {
            throw new Error(err.error || '不明なエラー');
        });
    }
    return response.json();
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
            // 修正: 'like' も favorites エンドポイントを使用し、常に "add" を送信
            endpoint = `/api/issues/${issueId}/favorite`;
            body = { action: 'add' };
            break;
        case 'favorite':
            // トグル機能の場合： 現在の数を確認して add/remove を決定
            const currentFavorites = parseInt(button.textContent.match(/\((\d+)\)/)[1], 10);
            const actionType = currentFavorites > 0 ? 'remove' : 'add';
            endpoint = `/api/issues/${issueId}/favorite`;
            body = { action: actionType };
            break;
        case 'comment':
            const userComment = prompt('コメントを入力してください:');
            if (!userComment || userComment.trim() === '') {
                alert('コメントは空にできません。');
                return;
            }
            endpoint = `/api/issues/${issueId}/comment`;
            body = { comment: userComment.trim() };
            break;
        case 'stance':
            const userStance = prompt('スタンスを選択してください (YES, NO, 様子見):');
            if (!['YES', 'NO', '様子見'].includes(userStance)) {
                alert('有効なスタンスを選択してください。');
                return;
            }
            const stanceComment = prompt('スタンスに関するコメントを入力してください (任意):');
            endpoint = `/api/stances`;
            body = { issue_id: issueId, stance: userStance, comment: stanceComment ? stanceComment.trim() : null };
            break;
        default:
            console.error('Unknown action:', action);
            return;
    }

    fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: Object.keys(body).length > 0 ? JSON.stringify(body) : null
    })
    .then(handleFetchResponse)
    .then(data => {
        alert(`${getActionName(action)}しました！`);
        // 修正: for both 'like' and 'favorite', use data.favorites
        if (action === 'like' || action === 'favorite') {
            updateButtonCount(button, data.favorites || 0);
        } else {
            updateButtonCount(button, data[`${action}s`] || 0);
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
    const actionText = button.textContent.split('(')[0].trim();
    button.innerHTML = `${button.querySelector('.icon').outerHTML}${actionText} (${newCount})`;
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

            // イシューを表示（安全な方法でHTMLを生成）
            container.innerHTML = '';
            if (data.length > 0) {
                data.forEach(issue => {
                    const sanitizedHTML = sanitizeHTML(cardCreator(issue)); // サニタイズを追加
                    const issueElement = document.createElement('div');
                    issueElement.innerHTML = sanitizedHTML;
                    container.appendChild(issueElement);
                });
            } else {
                container.innerHTML = '<p>現在データはありません。</p>';
            }
        })
        .catch(err => {
            console.error(`Error fetching issues from ${url}:`, err);
            container.innerHTML = '<p>データの取得に失敗しました。</p>';
        });
}

/**
 * HTML文字列をサニタイズして安全なHTMLとして返す
 * @param {string} html - サニタイズするHTML文字列
 * @returns {string} - サニタイズ済みHTML
 */
function sanitizeHTML(html) {
    const tempDiv = document.createElement('div');
    tempDiv.textContent = html; // テキストとしてエスケープ
    return tempDiv.innerHTML;
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

    return `
        <div class="featured-issue-card">
            <span class="issue-category">${sanitizeHTML(issue.tag)}</span>
            <span class="trending-icon"><i class="fas fa-fire"></i></span>
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
                    <i class="fas fa-arrow-up icon"></i> (${issue.stances || 0})
                </button>
                <button class="like-button" data-issue-id="${issue.id}" tabindex="0" aria-label="いいね ボタン">
                    <i class="fas fa-heart icon"></i> (${issue.likes || 0})
                </button>
                <button class="favorite-button" data-issue-id="${issue.id}" tabindex="0" aria-label="お気に入り ボタン">
                    <i class="fas fa-star icon"></i> (${favoritesCount})
                </button>
                <button class="comment-button" data-issue-id="${issue.id}" tabindex="0" aria-label="コメント ボタン">
                    <i class="fas fa-comment icon"></i> (${issue.comments || 0})
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

    return `
        <div class="other-issue-card">
            <span class="issue-category">${sanitizeHTML(issue.tag)}</span>
            <span class="trending-icon"><i class="fas fa-fire"></i></span>
            <h4 class="issue-title">${sanitizeHTML(truncateText(issue.headline, 30))}</h4>
            
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
                    <i class="fas fa-arrow-up icon"></i> (${issue.stances || 0})
                </button>    
                <button class="like-button" data-issue-id="${issue.id}" tabindex="0" aria-label="いいね ボタン">
                    <i class="fas fa-heart icon"></i> (${issue.likes || 0})
                </button>
                <button class="favorite-button" data-issue-id="${issue.id}" tabindex="0" aria-label="お気に入り ボタン">
                    <i class="fas fa-star icon"></i> (${favoritesCount})
                </button>
                <button class="comment-button" data-issue-id="${issue.id}" tabindex="0" aria-label="コメント ボタン">
                    <i class="fas fa-comment icon"></i> (${issue.comments || 0})
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
