// /public/js/issue-detail.js
import { createDonutChart } from './chart.js';
import { renderCommentsByStance } from './commentRenderer.js';

(function() {
    const urlParams = new URLSearchParams(window.location.search);
    const issueId = urlParams.get('issue_id');
    if (!issueId) {
        alert("イシューIDが見つかりませんでした。");
        throw new Error("Missing issue_id in URL");
    }

    fetch(`/api/issues/${issueId}`)
        .then(response => {
            if (!response.ok) throw new Error("Failed to fetch issue details");
            return response.json();
        })
        .then(data => {
            const { issue, comments } = data;
            displayIssueInfo(issue);
            renderCommentsByStance(comments, 'yes-comments', 'no-comments');
            createUserChart(issue);
            createAIChart();
        })
        .catch(err => {
            console.error('Error:', err);
            document.body.innerHTML = '<p>データの取得に失敗しました。</p>';
        });

    /**
     * イシューの基本情報＋スタッツをまとめてDOM操作
     */
    function displayIssueInfo(issue) {
        // カテゴリCSS
        const catParent = document.querySelector('.category-featured');
        if (catParent) {
            for (let i = 1; i <= 13; i++) {
                catParent.classList.remove(`category-${i}`);
            }
            if (issue.category_id) {
                catParent.classList.add(`category-${issue.category_id}`);
            }
        }

        // カテゴリ名 / フィーチャー
        const categorySpan = document.querySelector('.category');
        if (categorySpan) categorySpan.textContent = issue.category_name || '未分類';

        const featuredSpan = document.querySelector('.featured');
        if (featuredSpan) {
            featuredSpan.style.display = (issue.is_featured === 1) ? 'inline-block' : 'none';
        }

        // タイトル / 作成者
        const issueTitle = document.querySelector('.issue-title');
        if (issueTitle) issueTitle.textContent = issue.headline;

        const authorName = document.querySelector('.author-name');
        if (authorName) authorName.textContent = issue.author_name || '不明な作成者';

         // 概要
        const issueSummary = document.querySelector('.issue-summary h4');
        if (issueSummary) {
            issueSummary.textContent = issue.description || '（概要は現在自動生成中です）';
        }
        // トップページリンク
        const topLinkContainer = document.querySelector('.top-link');
        if (topLinkContainer) {
            topLinkContainer.innerHTML = `<a href="/" class="btn-top-link">SERON - TOP</a>`;
        }

        // スタッツ
        const likeSpan    = document.querySelector('.like-stat span');
        const stanceSpan  = document.querySelector('.stance-stat span');
        const favSpan     = document.querySelector('.favorite-stat span');
        const commentSpan = document.querySelector('.comment-stat span');

        if (likeSpan)    likeSpan.textContent    = `ホット: ${issue.likes ?? 0}`;
        if (stanceSpan)  stanceSpan.textContent  = `スタンス: ${issue.stance_count ?? 0}`;
        if (favSpan)     favSpan.textContent     = `フォロー: ${issue.favorite_count ?? 0}`;
        if (commentSpan) commentSpan.textContent = `コメント: ${issue.comments_count ?? 0}`;
    }

    /**
     * ユーザー円グラフ (YES/NO/様子見)
     */
    function createUserChart(issue) {
        const yesCount   = issue.yes_count   || 0;
        const noCount    = issue.no_count    || 0;
        const maybeCount = issue.maybe_count || 0;
        const sum = yesCount + noCount + maybeCount;

        const userCtx = document.getElementById('userChart')?.getContext('2d');
        if (!userCtx) return;

        createDonutChart(userCtx, {
            labels: ['YES', 'NO', '様子見'],
            data: [yesCount, noCount, maybeCount],
            colors: ['#42A5F5', '#EF5350', '#B0BEC5'],
            total: sum // formatterで使用する合計
        });
    }

    /**
     * AI円グラフ (固定 60:40)
     */
    function createAIChart() {
        const aiCtx = document.getElementById('aiChart')?.getContext('2d');
        if (!aiCtx) return;
        createDonutChart(aiCtx, {
            labels: ['YES', 'NO'],
            data: [60, 40],
            colors: ['#1E88E5', '#C62828'],
            total: 100
        });
    }
})();
// /public/js/commentRenderer.js