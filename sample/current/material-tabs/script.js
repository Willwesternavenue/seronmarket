document.addEventListener('DOMContentLoaded', () => {
  const tabsContainer = document.getElementById('tabsContainer');
  const contentArea = document.getElementById('contentArea');

  // 例: カテゴリが多い場合に備えた配列
  const categories = [
    { id: 1,  name: '政治' },
    { id: 2,  name: '社会' },
    { id: 3,  name: '経済' },
    { id: 4,  name: '外交' },
    { id: 5,  name: '税金' },
    { id: 6,  name: 'ビジネス' },
    { id: 7,  name: '少子高齢化' },
    { id: 8,  name: '医療福祉' },
    { id: 9,  name: '教育' },
    { id: 10, name: '環境' },
    { id: 11, name: 'テクノロジー' },
    { id: 12, name: '文化' },
    { id: 13, name: '地理' },
    { id: 14, name: '国際' },
    { id: 15, name: 'スポーツ' },
    { id: 16, name: 'エンタメ' },
    { id: 17, name: '芸術' },
    { id: 18, name: '歴史' },
    // ... ここにさらに追加してもOK
  ];

  categories.forEach((cat, index) => {
    const btn = document.createElement('button');
    btn.classList.add('tab-button');
    // 必要なら data-category 付与
    btn.dataset.category = cat.id;

    btn.textContent = cat.name;

    btn.addEventListener('click', () => {
      // 全ボタンのactive除去
      tabsContainer.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
      // クリックボタンをactive
      btn.classList.add('active');

      contentArea.innerHTML = `
        <h2>カテゴリ: ${cat.name}</h2>
        <p>ID: ${cat.id}</p>
      `;
    });

    tabsContainer.appendChild(btn);

    // 初期選択
    if (index === 0) {
      btn.classList.add('active');
      contentArea.innerHTML = `
        <h2>カテゴリ: ${cat.name}</h2>
        <p>初期選択されています</p>
      `;
    }
  });
});
