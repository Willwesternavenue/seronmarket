// public/js/scripts-mypage.js

// ブラウザ用のカテゴリ初期化関数をインポート
import { initializeCategoryDropdown } from './category.js';

/**
 * 共通のログアウト関数
 */
function logout() {
  fetch('/logout', { method: 'GET', credentials: 'same-origin' })
    .then(response => {
      window.location.href = '/login';
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
  fetch('/api/user', { credentials: 'same-origin' })
    .then(response => {
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
      return response.json();
    })
    .then(user => {
      document.getElementById('username').textContent = user.username || 'Unknown';
      const adminCheckbox = document.getElementById('is-admin-checkbox');
      if (adminCheckbox) adminCheckbox.checked = user.isAdmin || false;
    })
    .catch(err => {
      console.error('Error fetching user info:', err);
      alert('ユーザー情報の取得に失敗しました。');
    });
}

/** サニタイズ関数 */
function sanitizeHTML(str) {
  const tempDiv = document.createElement('div');
  tempDiv.textContent = str || '';
  return tempDiv.innerHTML;
}
function sanitizePercentage(percent) {
  const parsed = parseFloat(percent);
  return isNaN(parsed) || parsed < 0 ? '0' : parsed.toFixed(1);
}

/** 要素のテキストを設定 */
function setElementText(elementId, text) {
  const el = document.getElementById(elementId);
  if (el) el.textContent = text;
}

/** フォーム等のイベントを一括初期化 */
function initializeForms() {
  // スタンス投稿フォーム
  const stanceForm = document.getElementById('post-stance-form');
  if (stanceForm) {
    stanceForm.addEventListener('submit', e => {
      e.preventDefault();
      submitStance();
    });
  }

  // イシュー作成フォーム
  const issueForm = document.getElementById('create-issue-form');
  if (issueForm) {
    issueForm.addEventListener('submit', e => {
      e.preventDefault();
      createIssue();
    });
  }

  // 「いいね」ボタンのクリック（動的に追加される要素でも動くよう、documentに設定）
  document.addEventListener('click', event => {
    if (event.target.classList.contains('like-button')) {
      const issueId = event.target.dataset.issueId;
      likeIssue(issueId);
    }
  });

  // ログアウトボタン
  const logoutButtons = document.querySelectorAll('.btn-logout');
  logoutButtons.forEach(btn => {
    btn.addEventListener('click', logout);
  });
}

/** スタンス投稿処理 */
function submitStance() {
  const issueId = document.getElementById('issue').value;
  const stance = document.getElementById('stance').value;
  const comment = document.getElementById('comment').value.trim();

  const errorDiv = document.getElementById('stance-error');
  const successDiv = document.getElementById('stance-success');
  errorDiv.textContent = '';
  successDiv.textContent = '';

  if (!issueId || !stance) {
    errorDiv.textContent = 'イシューとスタンスを選択してください。';
    return;
  }

  fetch('/api/stances', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ issue_id: issueId, stance, comment }),
    credentials: 'include'
  })
    .then(res => res.json())
    .then(data => {
      if (data.error) {
        errorDiv.textContent = `スタンスの投稿に失敗しました: ${data.error}`;
        return;
      }
      successDiv.textContent = 'スタンスが投稿されました！';
      document.getElementById('post-stance-form').reset();
      refreshIssues(); // 再取得
    })
    .catch(err => {
      console.error('Error posting stance:', err);
      errorDiv.textContent = `スタンスの投稿に失敗しました: ${err.message}`;
    });
}

/** イシュー作成処理 */
function createIssue() {
  const headlineInput = document.getElementById('headline');
  // 1) 「カテゴリ選択」用の <select id="tag"> を取得
  const tagSelect = document.getElementById('tag'); 
  const isFeaturedCheckbox = document.getElementById('isFeatured');

  // 2) headlineInput と tagSelect の両方があるかチェック
  if (!headlineInput || !tagSelect) {
    console.error('Required input fields are missing');
    alert('必須の入力フィールドが見つかりませんでした。');
    return;
  }

  // 3) 値の取得
  const headline = headlineInput.value.trim();
  const categoryValue = tagSelect.value.trim();
  if (!categoryValue) {
    alert('カテゴリを選択してください。');
    return;
  }

  // 4) categoryValueを整数に変換
  const categoryId = parseInt(categoryValue, 10);
  const isFeatured = isFeaturedCheckbox ? isFeaturedCheckbox.checked : false;
  const description = 'このイシューは自動生成された概要を持ちます。';

  // 5) バリデーション
  const errorDiv = document.getElementById('issue-error');
  const successDiv = document.getElementById('issue-success');
  if (errorDiv) errorDiv.textContent = '';
  if (successDiv) successDiv.textContent = '';

  if (!headline || !categoryId) {
    if (errorDiv) {
      errorDiv.textContent = 'タイトルとカテゴリは必須です。';
    }
    return;
  }

  // 6) APIにリクエスト
  fetch('/api/issues', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      headline,
      category_id: categoryId,
      is_featured: isFeatured,
      description
    }),
    credentials: 'same-origin'
  })
    .then(handleFetchResponse)
    .then(data => {
      if (successDiv) successDiv.textContent = 'イシューが作成されました！';
      const form = document.getElementById('create-issue-form');
      if (form) form.reset();
      refreshIssues();
    })
    .catch(err => {
      console.error('Error creating issue:', err);
      if (errorDiv) {
        errorDiv.textContent = `イシューの作成に失敗しました: ${err.message}`;
      }
    });
}

/** 「いいね」ボタンクリック */
function likeIssue(issueId) {
  fetch(`/api/issues/${issueId}/like`, { method: 'POST', credentials: 'same-origin' })
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

/** いいね数をボタンに反映 */
function updateLikeCount(issueId, newCount) {
  const button = document.querySelector(`.like-button[data-issue-id="${issueId}"]`);
  if (button) {
    button.textContent = `関心あり (${newCount})`;
  }
}

/** APIレスポンスを処理 */
function handleFetchResponse(response) {
  if (!response.ok) {
    return response.json().then(err => {
      throw new Error(err.error || '不明なエラー');
    });
  }
  return response.json();
}

/** イシューカード生成 */
function createIssueCard(issue) {
  const cardClass = issue.is_featured ? 'featured-issue-card' : 'other-issue-card';
  return `
    <div class="${cardClass}">
      <h4>${sanitizeHTML(issue.headline)}</h4>
      <p>${sanitizeHTML(issue.description)}</p>
      <!-- サーバーが "category_name" を返すなら、以下を修正して表示 -->
      <!-- <p>カテゴリ: ${sanitizeHTML(issue.category_name)}</p> -->
      <p>カテゴリID: ${issue.category_id || '(不明)'}</p>
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

/** イシューを取得＆表示 */
function displayIssues(url, containerId, cardCreator) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`コンテナ ${containerId} が見つかりません`);
    return;
  }

  fetch(url, { credentials: 'same-origin' })
    .then(handleFetchResponse)
    .then(data => {
      if (!Array.isArray(data)) {
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

/** イシュー一覧を再取得 */
function refreshIssues() {
  displayIssues('/api/featured_issues', 'featured-issues', createIssueCard);
  displayIssues('/api/issues_with_votes', 'existingIssues', createIssueCard);
}

/** イシュー選択用ドロップダウン(スタンス投稿) */
function initializeIssueDropdown() {
  const issueDropdown = document.getElementById('issue');
  if (!issueDropdown) return;
  issueDropdown.innerHTML = '<option value="">選択してください</option>';

  fetch('/api/issues', { credentials: 'same-origin' })
    .then(handleFetchResponse)
    .then(issues => {
      if (!Array.isArray(issues) || !issues.length) {
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
      issueDropdown.innerHTML = '<option disabled>イシューの取得に失敗</option>';
    });
}

/** DOMContentLoaded 後にまとめて実行 */
document.addEventListener('DOMContentLoaded', () => {
  // カテゴリドロップダウンを初期化
  initializeCategoryDropdown();
  // ユーザー情報・フォームなどの初期化
  fetchUserInfo();
  initializeIssueDropdown();
  initializeForms();
  // イシュー表示
  displayIssues('/api/featured_issues', 'featured-issues', createIssueCard);
  displayIssues('/api/issues_with_votes', 'existingIssues', createIssueCard);
});
