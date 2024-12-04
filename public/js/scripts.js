// 共通のログアウト関数
function logout() {
    fetch('/logout')
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
                adminCheckbox.checked = user.isAdmin || false;
            }
        })
        .catch(err => {
            console.error('Error fetching user info:', err);
            alert('ユーザー情報の取得に失敗しました。');
        });
}

/**
 * イシュー作成フォームの初期化
 */
let isCreateIssueFormInitialized = false; // 初期化済みフラグ

function initializeCreateIssueForm() {
    if (isCreateIssueFormInitialized) {
        console.warn("イシュー作成フォームは既に初期化されています。");
        return;
    }

    const createIssueForm = document.getElementById('create-issue-form');
    if (!createIssueForm) {
        console.error("イシュー作成フォームが見つかりませんでした。");
        return;
    }

    const submitButton = createIssueForm.querySelector('button[type="submit"]');

    createIssueForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        
        const headline = document.getElementById('headline')?.value.trim();
        const description = document.getElementById('description')?.value.trim();
        const tag = document.getElementById('tag')?.value.trim();

        if (!headline || !description || !tag) {
            alert('すべてのフィールドを入力してください。');
            return;
        }

        // ボタンを無効化して多重送信を防止
        submitButton.disabled = true;

        try {
            const response = await fetch('/api/issues', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ headline, description, tag })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'イシュー作成に失敗しました');
            }

            const data = await response.json();
            alert('イシューが作成されました！');
            createIssueForm.reset();
            console.log(data); // デバッグ用
        } catch (err) {
            console.error('Error creating issue:', err);
            alert(`イシューの作成に失敗しました: ${err.message}`);
        } finally {
            // ボタンを再び有効化
            submitButton.disabled = false;
        }
    });

    isCreateIssueFormInitialized = true; // 初期化済みフラグを設定
}


// DOMが読み込まれた後の処理
document.addEventListener('DOMContentLoaded', () => {
    if (document.body.classList.contains('top-page')) {
        displayIssues('/api/featured_issues', 'featured-issues', createIssueCard); // フィーチャーイシュー
        displayIssues('/api/issues_with_votes', 'existingIssues', createIssueCard); // その他のイシュー
    }
    fetchUserInfo(); // ユーザー情報を取得して表示
    displayIssues('/api/featured_issues', 'featured-issues', createIssueCard); // フィーチャーイシュー
    displayIssues('/api/issues_with_votes', 'existingIssues', createIssueCard); // その他のイシュー
    initializeStanceForm(); // スタンス投稿フォームの初期化
});
    // プリセットタグのリスト
    const presetTags = [
        '政治', '社会', '経済', '外交', '税金', '少子高齢化', '医療福祉', 'ビジネス'
    ];

    // タグドロップダウンを初期化
    const tagDropdown = document.getElementById('tag');
    presetTags.forEach(tag => {
        const option = document.createElement('option');
        option.value = tag;
        option.textContent = tag;
        tagDropdown.appendChild(option);
    });


/**
 * プリセットタグのリストを初期化
 */
function initializeTagDropdown() {
    const presetTags = [
        '政治', '社会', '経済', '外交', '税金', '少子高齢化', '医療福祉', 'ビジネス'
    ];

    const tagDropdown = document.getElementById('tag');
    if (!tagDropdown) {
        console.error("タグドロップダウンが見つかりませんでした。");
        return;
    }

    presetTags.forEach(tag => {
        const option = document.createElement('option');
        option.value = tag;
        option.textContent = tag;
        tagDropdown.appendChild(option);
    });
}
/**
 * APIからデータを取得して表示
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
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
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
            <p>カテゴリ: ${sanitizeHTML(issue.tag)}</p>
            <div class="vote-bar-container">
                <div class="vote-bar vote-bar-yes" style="width: ${sanitizePercentage(issue.yes_percent)}%;"></div>
                <div class="vote-bar vote-bar-no" style="width: ${sanitizePercentage(issue.no_percent)}%;"></div>
            </div>
            <div class="vote-counts">
                <span>YES: ${sanitizePercentage(issue.yes_percent)}%</span>
                <span>NO: ${sanitizePercentage(issue.no_percent)}%</span>
            </div>
            <button class="like-button" data-issue-id="${issue.id}" onclick="likeIssue(${issue.id})">
                関心あり (${issue.likes || 0})
            </button>
        </div>
    `;
}

// フィーチャーイシューの表示
function displayFeaturedIssues() {
    const container = document.getElementById('featured-issues');
    if (!container) {
        console.error('フィーチャーイシューのコンテナが見つかりませんでした。');
        return;
    }

    fetch('/api/featured_issues')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (!data.length) {
                container.innerHTML = '<p>現在フィーチャーイシューはありません。</p>';
                return;
            }
            container.innerHTML = data.map(createFeaturedIssueCard).join('');
        })
        .catch(err => {
            console.error('フィーチャーイシューの取得中にエラーが発生しました:', err);
            container.innerHTML = '<p>フィーチャーイシューの取得に失敗しました。</p>';
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
 * APIからイシューを取得して表示
 */

const issueForm = document.getElementById('create-issue-form');
if (issueForm) {
    issueForm.addEventListener('submit', (event) => {
        event.preventDefault(); // デフォルトの送信を防止

        const headline = document.getElementById('headline').value;
        const description = document.getElementById('description').value;
        const tag = document.getElementById('tag').value;
        const isFeatured = document.getElementById('isFeatured').checked ? 1 : 0;

        // サーバーにリクエストを送信
        fetch('/api/issues', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ headline, description, tag, is_featured: isFeatured }),
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => {
                    throw new Error(err.error || 'Unknown error');
                });
            }
            return response.json();
        })
        .then(data => {
            alert('イシューが作成されました！');
            console.log(data);
            issueForm.reset(); // フォームをリセット
        })
        .catch(err => {
            console.error('Error creating issue:', err);
            alert(`イシューの作成に失敗しました: ${err.message}`);
        });
    });
}

/**
 * スタンス投稿フォームを初期化
 */
function initializeStanceForm() {
    const stanceForm = document.getElementById('post-stance-form');
    const issueDropdown = document.getElementById('issue');

    if (!stanceForm || !issueDropdown) {
        console.error('Stance form or issue dropdown not found.');
        return;
    }

    // イシューの選択肢を取得して追加
    fetch('/api/issues')
        .then(handleFetchResponse)
        .then(issues => {
            if (!issues.length) {
                console.warn('No issues found.');
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
            console.error('Error fetching issues:', err);
            alert('イシューの取得に失敗しました。');
        });

    // スタンス投稿フォームの送信処理
    stanceForm.addEventListener('submit', (event) => {
        event.preventDefault();
    
        const issueId = document.getElementById('issue').value;
        const stance = document.getElementById('stance').value;
        const comment = document.getElementById('comment').value;
    
        if (!issueId || !stance) {
            alert('イシューとスタンスを選択してください。');
            return;
        }
    
        fetch('/api/stances', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ issue_id: issueId, stance, comment })
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => {
                    throw new Error(err.error || 'An unknown error occurred');
                });
            }
            return response.json();
        })
        .then(data => {
            alert('スタンスが投稿されました！');
            stanceForm.reset();
        })
        .catch(err => {
            console.error('Error posting stance:', err);
            alert(`スタンスの投稿に失敗しました: ${err.message}`);
        });
    });
    
}

function handleFetchResponse(response) {
    if (!response.ok) {
        return response.json().then(err => {
            throw new Error(err.error || '不明なエラーが発生しました。');
        });
    }
    return response.json();
}
function likeIssue(issueId) {
    fetch(`/api/issues/${issueId}/like`, {
        method: 'POST',
    })
    .then(response => {
        if (!response.ok) {
            return response.text().then(text => {
                throw new Error(`HTTP Error: ${response.status}. Response: ${text}`);
            });
        }
        return response.json();
    })
    .then(data => {
        alert('いいねしました！');
        updateLikeCount(issueId, data.likes);
    })
    .catch(err => {
        console.error('Error liking issue:', err);
        alert(`いいねに失敗しました: ${err.message}`);
    });
}


function updateLikeCount(issueId, newCount) {
    const button = document.querySelector(`.like-button[data-issue-id="${issueId}"]`);
    if (button) {
        button.textContent = `いいね (${newCount})`;
    }
}

function setElementText(elementId, text) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = text;
    }
}
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === "asyncTask") {
            performAsyncTask().then((result) => {
                sendResponse({ success: true, data: result });
            }).catch((error) => {
                sendResponse({ success: false, error: error.message });
            });
            return true; // 非同期応答を期待していることを示す
        }
    });
} else {
    console.warn("chrome.runtime.onMessage is not supported in this environment.");
}
