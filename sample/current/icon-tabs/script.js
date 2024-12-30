document.addEventListener('DOMContentLoaded', () => {
    const iconTabs = document.getElementById('iconTabs');
    const contentArea = document.getElementById('contentArea');
    const iconTabButtons = iconTabs.querySelectorAll('.icon-tab-button');
  
    iconTabButtons.forEach((btn, index) => {
      btn.addEventListener('click', () => {
        // 他のタブの .active を削除
        iconTabButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
  
        // デモ表示
        contentArea.innerHTML = `<h2>${btn.innerText} Selected</h2>
                                 <p>Icon Tabのデモ（index: ${index}）。</p>`;
      });
    });
  });
  