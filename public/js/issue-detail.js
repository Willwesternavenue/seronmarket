(() => {
    // 1. URLから issue_id を取得
    const urlParams = new URLSearchParams(window.location.search);
    const issueId = urlParams.get('issue_id');

    if (!issueId) {
        alert("イシューが見つかりませんでした。");
        throw new Error("Missing issue_id in URL");
    }

    // 2. /api/issues/:issueId をfetch
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
        })
        .catch(error => {
            console.error(error);
            document.body.innerHTML = '<p>データの取得に失敗しました。</p>';
        });

    /**
     * イシュー詳細を表示
     */
    function displayIssueDetails(issue) {
        const catParent = document.querySelector('.category-featured');

        for (let i = 1; i <= 13; i++) {
            catParent.classList.remove(`category-${i}`);
        }

        if (issue.category_id) {
            catParent.classList.add(`category-${issue.category_id}`);
        }

        document.querySelector('.category').textContent = issue.category_name || '未分類';

        const featuredSpan = document.querySelector('.featured');
        if (issue.is_featured === 1) {
            featuredSpan.style.display = 'inline-block';
        } else {
            featuredSpan.style.display = 'none';
        }

        document.querySelector('.issue-title').textContent = issue.headline;
        document.querySelector('.author-name').textContent = issue.author_name || '不明な作成者';
    }

    /**
     * スタッツ表示
     */
    function displayStats(issue) {
        document.querySelector('.like-stat span').textContent = `いいね: ${issue.likes ?? 0}`;
        document.querySelector('.stance-stat span').textContent = `スタンス投稿数: ${issue.stance_count ?? 0}`;
        document.querySelector('.favorite-stat span').textContent = `お気に入り: ${issue.favorite_count ?? 0}`;
        document.querySelector('.comment-stat span').textContent = `コメント: ${issue.comments_count ?? 0}`;
    }

    /**
     * コメントを表示
     */
    function displayComments(comments) {
        const yesContainer = document.getElementById('yes-comments');
        const noContainer = document.getElementById('no-comments');

        yesContainer.innerHTML = '';
        noContainer.innerHTML = '';

        comments.forEach(c => {
            const div = document.createElement('div');
            div.className = 'comment';
            div.innerHTML = `
                <div class="comment-header">
                    <div class="info">
                        <strong>${c.username || '名無しさん'}</strong> - ${new Date(c.created_at).toLocaleString()}
                    </div>
                    <div class="likes">
                        <i class="fas fa-thumbs-up"></i> 0
                    </div>
                </div>
                <div class="comment-details">
                    ${c.comment || ''}
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
