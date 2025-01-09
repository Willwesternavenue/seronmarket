// /public/js/issue-detail.js
/**
 * HTMLをサニタイズする関数
 * @param {string} str - サニタイズする文字列
 * @returns {string} サニタイズされたHTML文字列
 */
function sanitizeHTML(str) {
    const tempDiv = document.createElement('div');
    tempDiv.textContent = str || ''; // 空の文字列も処理
    return tempDiv.innerHTML;
}

(function() {
    // 1) URLから issue_id を取得
    const urlParams = new URLSearchParams(window.location.search);
    const issueId = urlParams.get('issue_id');

    if (!issueId) {
        alert("イシューIDが見つかりませんでした。");
        throw new Error("Missing issue_id in URL");
    }

    // 2) API呼び出し → issue, comments を取得
    fetch(`/api/issues/${issueId}`)
        .then(response => {
            if (!response.ok) throw new Error("Failed to fetch issue details");
            return response.json();
        })
        .then(data => {
            // data.issue, data.comments
            displayIssueDetails(data.issue);
            displayStats(data.issue);
            displayComments(data.comments);
            createUserChart(data.issue);
            // AIは固定データを表示
            createAIChart();
        })
        .catch(err => {
            console.error('Error:', err);
            document.body.innerHTML = '<p>データの取得に失敗しました。</p>';
        });

    /**
     * イシュー詳細を表示
     */
    function displayIssueDetails(issue) {
        // カテゴリCSS
        const catParent = document.querySelector('.category-featured');
        for (let i = 1; i <= 13; i++) {
            catParent.classList.remove(`category-${i}`);
        }
        if (issue.category_id) {
            catParent.classList.add(`category-${issue.category_id}`);
        }

        // カテゴリ名/Featured
        document.querySelector('.category').textContent = issue.category_name || '未分類';
        const featuredSpan = document.querySelector('.featured');
        featuredSpan.style.display = (issue.is_featured === 1) ? 'inline-block' : 'none';

        // タイトル, 作成者
        document.querySelector('.issue-title').textContent = issue.headline;
        document.querySelector('.author-name').textContent = issue.author_name || '不明な作成者';

        // トップページリンク
        const topLinkContainer = document.querySelector('.top-link');
        if (topLinkContainer) {
            topLinkContainer.innerHTML = `<a href="/" class="btn-top-link">SERON - TOP</a>`;
        }
    }

    /**
     * スタッツ (いいね、スタンス投稿数、お気に入り、コメント) 表示
     */
    function displayStats(issue) {
        const likeSpan = document.querySelector('.like-stat span');
        if (likeSpan) {
            likeSpan.textContent = `いいね: ${issue.likes ?? 0}`;
        }
        const stanceSpan = document.querySelector('.stance-stat span');
        if (stanceSpan) {
            stanceSpan.textContent = `スタンス投稿数: ${issue.stance_count ?? 0}`;
        }
        const favSpan = document.querySelector('.favorite-stat span');
        if (favSpan) {
            favSpan.textContent = `お気に入り: ${issue.favorite_count ?? 0}`;
        }
        const commentSpan = document.querySelector('.comment-stat span');
        if (commentSpan) {
            commentSpan.textContent = `コメント: ${issue.comments_count ?? 0}`;
        }
    }

    /**
     * サーバーで計算された YES/NO/様子見 を円グラフで描画
     */
    function createUserChart(issue) {
        const yesCount = issue.yes_count || 0;
        const noCount = issue.no_count || 0;
        const maybeCount = issue.maybe_count || 0;

        const userData = {
            labels: ['YES', 'NO', '様子見'],
            datasets: [{
                data: [yesCount, noCount, maybeCount],
                backgroundColor: ['#42A5F5', '#EF5350', '#B0BEC5'],
                hoverBackgroundColor: ['#64B5F6', '#E57373', '#CFD8DC']
            }]
        };

        const userCtx = document.getElementById('userChart').getContext('2d');
        new Chart(userCtx, {
            type: 'doughnut',
            data: userData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' },
                    tooltip: { enabled: true },
                    datalabels: {
                        color: '#fff',
                        formatter: (value, context) => {
                            const sum = context.chart.data.datasets[0].data
                                .reduce((a, b) => a + b, 0);
                            if (sum === 0) return '0%';
                            const percentage = ((value / sum) * 100).toFixed(1) + '%';
                            return percentage;
                        },
                        font: { weight: 'bold', size: 14 }
                    }
                }
            },
            plugins: [ChartDataLabels]
        });
    }

    /**
     * AIチャートは固定 (60:40)
     */
    function createAIChart() {
        const aiData = {
            labels: ['YES', 'NO'],
            datasets: [{
                data: [60, 40],
                backgroundColor: ['#1E88E5', '#C62828'],
                hoverBackgroundColor: ['#1565C0', '#B71C1C']
            }]
        };
        const aiCtx = document.getElementById('aiChart').getContext('2d');
        new Chart(aiCtx, {
            type: 'doughnut',
            data: aiData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' },
                    tooltip: { enabled: true },
                    datalabels: {
                        color: '#fff',
                        formatter: (value, context) => {
                            const sum = context.chart.data.datasets[0].data
                                .reduce((a, b) => a + b, 0);
                            if (sum === 0) return '0%';
                            const percentage = ((value / sum) * 100).toFixed(1) + '%';
                            return percentage;
                        },
                        font: { weight: 'bold', size: 14 }
                    }
                }
            },
            plugins: [ChartDataLabels]
        });
    }

    /**
     * 全コメント配列から YES or NO を絞り込み表示
     */
    function displayComments(comments) {
        const yesContainer = document.getElementById('yes-comments');
        const noContainer = document.getElementById('no-comments');

        yesContainer.innerHTML = '';
        noContainer.innerHTML = '';

        comments.forEach(c => {
            if (!c.comment || c.comment.trim() === '') return; // 空コメントスキップ

            const div = document.createElement('div');
            div.className = 'comment';
            div.innerHTML = `
                <div class="comment-details">
                    <strong>${sanitizeHTML(c.comment)}</strong>
                </div>
                <div class="comment-header">
                    <div class="info">
                        by ${sanitizeHTML(c.username || '名無しさん')} - ${new Date(c.created_at).toLocaleString()}
                    </div>
                    <div class="likes">
                        <i class="fas fa-thumbs-up"></i> 0
                    </div>
                </div>
            `;

            if (c.stance === 'YES') {
                yesContainer.appendChild(div);
            } else if (c.stance === 'NO') {
                noContainer.appendChild(div);
            }
        });
    }
})();
