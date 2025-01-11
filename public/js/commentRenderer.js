// /public/js/commentRenderer.js

export function renderCommentsByStance(comments, yesContainerId, noContainerId) {
    const yesContainer = document.getElementById(yesContainerId);
    const noContainer  = document.getElementById(noContainerId);
    if (!yesContainer || !noContainer) {
        console.warn('YES/NOコメント表示先が見つかりません。');
        return;
    }

    yesContainer.innerHTML = '';
    noContainer.innerHTML  = '';

    comments.forEach(c => {
        if (!c.comment || !c.comment.trim()) return; // 空コメントは表示しない

        const div = document.createElement('div');
        div.className = 'comment';
        div.innerHTML = `
            <div class="comment-details">
                <strong>${sanitize(c.comment)}</strong>
            </div>
            <div class="comment-header">
                <div class="info">
                    by ${sanitize(c.username || '名無しさん')} - ${new Date(c.created_at).toLocaleString()}
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

/**
 * シンプルなサニタイズ
 */
function sanitize(str) {
    const tempDiv = document.createElement('div');
    tempDiv.textContent = str || '';
    return tempDiv.innerHTML;
}
