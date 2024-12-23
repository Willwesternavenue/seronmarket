// script.js
document.addEventListener("DOMContentLoaded", function() {
    // Mermaid初期化
    mermaid.initialize({
      startOnLoad: false
    });
  
    // グラフ定義を取得
    const graphDefinition = document.getElementById("mermaidDiagram").textContent;
  
    // Mermaidグラフ描画
    mermaid.render("theGraph", graphDefinition, (svgCode) => {
      document.getElementById("mermaidContainer").innerHTML = svgCode;
    });
  });
  