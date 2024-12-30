document.addEventListener('DOMContentLoaded', () => {
    const tabsPills = document.getElementById('tabsPills');
    const contentArea = document.getElementById('contentArea');
    const pillButtons = tabsPills.querySelectorAll('.pill-button');
  
    pillButtons.forEach((btn, index) => {
      btn.addEventListener('click', () => {
        // 全ボタンのactive除去
        pillButtons.forEach(b => b.classList.remove('active'));
        // クリックされたボタンをactiveに
        btn.classList.add('active');
  
        // デモ表示を更新
        contentArea.innerHTML = `<h2>${btn.textContent} Tab</h2>
                                 <p>ピル型タブのデモ。現在のインデックスは ${index} です。</p>`;
      });
    });
  });
  