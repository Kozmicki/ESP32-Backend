// Zajednički izrađuje i ažurira satne grafove u administratorskom i korisničkom sučelju.
window.telemetryCharts = (() => {
    const intervalMs = 60 * 60 * 1000;
    const pointCount = 30 * 24;
    const sensors = [
        { key: "temperatureC", label: "Temperatura (°C)", color: "#fb7185" },
        { key: "humidityPercent", label: "Vlažnost zraka (%)", color: "#38bdf8", max: 100 },
        { key: "soilMoisture1Percent", label: "Vlaga tla — sonda 1 (%)", color: "#a3e635", max: 100 },
        { key: "soilMoisture2Percent", label: "Vlaga tla — sonda 2 (%)", color: "#fbbf24", max: 100 },
        { key: "soilMoisture3Percent", label: "Vlaga tla — sonda 3 (%)", color: "#c084fc", max: 100 },
        { key: "soilMoisture4Percent", label: "Vlaga tla — sonda 4 (%)", color: "#f472b6", max: 100 }
    ];

    const create = (history, canvases) => {
        let startAt = new Date(history.startAt).getTime();
        let endAt = new Date(history.endAt).getTime();
        const samplesByHour = new Map(
            history.samples.map((sample) => [
                new Date(sample.sampledAt).getTime(),
                sample
            ])
        );
        const series = sensors.map((sensor) => ({
            ...sensor,
            points: []
        }));

        for (let index = 0; index < pointCount; index += 1) {
            const hour = startAt + index * intervalMs;
            const sample = samplesByHour.get(hour);

            for (const sensor of series) {
                sensor.points.push({ x: hour, y: sample?.[sensor.key] ?? 0 });
            }
        }

        const formatHour = (value) => {
            const date = new Date(Number(value));
            return `${date.toLocaleDateString("hr-HR", {
                day: "2-digit",
                month: "2-digit"
            })} ${date.toLocaleTimeString("hr-HR", {
                hour: "2-digit",
                minute: "2-digit"
            })}`;
        };
        const createOptions = (max) => {
            const valueAxis = {
                beginAtZero: true,
                ticks: { color: "#94a3b8" },
                grid: { color: "rgba(148, 163, 184, 0.12)" }
            };
            if (max !== undefined) valueAxis.max = max;

            return {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                parsing: false,
                normalized: true,
                plugins: {
                    legend: { display: false },
                    decimation: {
                        enabled: true,
                        algorithm: "lttb",
                        samples: 720
                    },
                },
                scales: {
                    x: {
                        type: "linear",
                        ticks: {
                            color: "#94a3b8",
                            maxTicksLimit: 8,
                            callback: formatHour
                        },
                        grid: { color: "rgba(148, 163, 184, 0.12)" }
                    },
                    y: valueAxis
                }
            };
        };
        const charts = series.map((sensor, index) => new Chart(canvases[index], {
            type: "line",
            data: {
                datasets: [{
                    label: sensor.label,
                    data: sensor.points,
                    borderColor: sensor.color,
                    backgroundColor: `${sensor.color}1f`,
                    borderWidth: 1.5,
                    pointRadius: 0,
                    tension: 0
                }]
            },
            options: createOptions(sensor.max)
        }));

        const apply = (update) => {
            const newEndAt = new Date(update.endAt).getTime();

            while (endAt < newEndAt) {
                endAt += intervalMs;
                startAt += intervalMs;
                for (const sensor of series) {
                    sensor.points.shift();
                    sensor.points.push({ x: endAt, y: 0 });
                }
            }

            for (const sample of update.samples) {
                const hour = new Date(sample.sampledAt).getTime();
                const pointIndex = Math.round((hour - startAt) / intervalMs);

                if (
                    pointIndex >= 0 &&
                    pointIndex < pointCount &&
                    series[0].points[pointIndex].x === hour
                ) {
                    for (const sensor of series) {
                        sensor.points[pointIndex].y = sample[sensor.key] ?? 0;
                    }
                }
            }

            for (const chart of charts) chart.update("none");
        };

        return {
            apply,
            getEndAt: () => endAt,
            destroy: () => {
                for (const chart of charts) chart.destroy();
            }
        };
    };

    return { create, intervalMs };
})();
