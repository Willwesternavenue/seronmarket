// /public/js/chart.js
// Chart.js & ChartDataLabels はすでに issue.html で CDN 読み込み済み (グローバル変数として使用)

export function createDonutChart(ctx, chartInfo) {
    const sum = chartInfo.data.reduce((acc, val) => acc + val, 0);

    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: chartInfo.labels,
            datasets: [{
                data: chartInfo.data,
                backgroundColor: chartInfo.colors,
                hoverBackgroundColor: chartInfo.colors
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' },
                tooltip: { enabled: true },
                datalabels: {
                    color: '#fff',
                    formatter: (value) => {
                        if (sum === 0) return '0%';
                        const pct = ((value / sum) * 100).toFixed(1);
                        return `${pct}%`;
                    },
                    font: { weight: 'bold', size: 14 }
                }
            }
        },
        plugins: [ChartDataLabels]
    });
}
// /public/js/commentRenderer.js