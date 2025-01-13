// public/js/category.js -- ブラウザ用
// (※ここに express や module.exports は書かない)

// ブラウザでカテゴリ一覧をGETして、<select>に反映する関数
export function initializeCategoryDropdown() {
    const tagDropdowns = document.querySelectorAll('select[name^="tag"]');
    if (!tagDropdowns.length) return;
  
    fetch('/api/categories', { credentials: 'same-origin' })
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch categories');
        return res.json();
      })
      .then(categories => {
        tagDropdowns.forEach(dropdown => {
          dropdown.innerHTML = '<option value="">選択してください</option>';
          categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category.id;   // カテゴリID
            option.textContent = category.name; // カテゴリ名
            dropdown.appendChild(option);
          });
        });
      })
      .catch(err => {
        console.error('Error fetching categories:', err);
        tagDropdowns.forEach(dropdown => {
          dropdown.innerHTML = '<option disabled>カテゴリの取得に失敗</option>';
        });
      });
  }
  