// scripts-top.js

document.addEventListener('DOMContentLoaded', () => {
    // フィーチャーイシューとその他のイシューをそれぞれ表示
    displayIssues('/api/featured_issues', 'featured-issues', createFeaturedIssueCard);
    displayIssues('/api/issues', 'existingIssues', createOtherIssueCard);

    // 「いいね」ボタンのクリックイベントを登録
    document.addEventListener('click', (event) => {
        if (event.target.classList.contains('like-button')) {
            const issueId = event.target.dataset.issueId; // ボタンのデータ属性からIDを取得
            likeIssue(issueId);
        }
    });
});

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
 * 「いいね」ボタンの処理
 * @param {number} issueId - イシューのID
 */
function likeIssue(issueId) {
    fetch(`/api/issues/${issueId}/like`, {
        method: 'POST',
    })
    .then(handleFetchResponse)
    .then(data => {
        alert('いいねしました！');
        updateLikeCount(issueId, data.likes);
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
        button.textContent = `関心あり ${newCount}`;
    }
}

/**
 * フィーチャーイシューカードを生成
 * @param {Object} issue - イシュー情報
 * @returns {string} - HTML文字列
 */
function createFeaturedIssueCard(issue) {
    const yesPercent = sanitizePercentage(issue.yes_percent);
    const noPercent = sanitizePercentage(issue.no_percent);

    return `
        <div class="featured-issue-card">
            <h4>${sanitizeHTML(truncateText(issue.headline, 20))}</h4>
            <p>${sanitizeHTML(truncateText(issue.description, 20))}</p>
            <p>カテゴリ: ${sanitizeHTML(issue.tag)}</p>
            <div class="vote-bar-container">
                <div class="vote-bar vote-bar-yes" style="width: ${yesPercent}%;"></div>
                <div class="vote-bar vote-bar-no" style="width: ${noPercent}%;"></div>
            </div>
            <div class="vote-counts">
                <span>YES ${yesPercent}%</span>
                <span>NO ${noPercent}%</span>
            </div>
            <button class="like-button" data-issue-id="${issue.id}">
                関心あり ${issue.likes || 0}
            </button>
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

    return `
        <div class="other-issue-card">
            <h4>${sanitizeHTML(truncateText(issue.headline, 20))}</h4>
            <p>${sanitizeHTML(truncateText(issue.description, 20))}</p>
            <p>カテゴリ: ${sanitizeHTML(issue.tag)}</p>
            <div class="vote-bar-container">
                <div class="vote-bar vote-bar-yes" style="width: ${yesPercent}%;"></div>
                <div class="vote-bar vote-bar-no" style="width: ${noPercent}%;"></div>
            </div>
            <div class="vote-counts">
                <span>YES ${yesPercent}%</span>
                <span>NO ${noPercent}%</span>
            </div>
            <button class="like-button" data-issue-id="${issue.id}">
                関心あり ${issue.likes || 0}
            </button>
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
 * 要素にテキストを設定
 * @param {string} elementId - 要素ID
 * @param {string} text - 設定するテキスト
 */
function setElementText(elementId, text) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = text;
    }
}
