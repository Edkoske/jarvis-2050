const numberOrNA = (value) => Number.isFinite(value) ? String(value) : "Not reported";

export function systemDetails() {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  return [
    ["BROWSER", navigator.userAgentData?.brands?.map((item) => item.brand).join(", ") || navigator.appName || "Browser", "actual"],
    ["PLATFORM", navigator.userAgentData?.platform || navigator.platform || "Not reported", "actual"],
    ["SCREEN", `${screen.width} × ${screen.height} · ${screen.colorDepth}-bit`, "actual"],
    ["NETWORK", navigator.onLine ? "Online" : "Offline", "actual"],
    ["CPU CORES", numberOrNA(navigator.hardwareConcurrency), "actual"],
    ["DEVICE MEMORY", navigator.deviceMemory ? `${navigator.deviceMemory} GB` : "Not exposed", "actual"],
    ["CONNECTION", connection ? `${connection.effectiveType || "unknown"}${connection.downlink ? ` · ${connection.downlink} Mbps` : ""}` : "Not exposed", "actual"]
  ];
}

export function startSystemMonitor(canvas) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};
  let frame = 0;
  let active = true;
  const samples = Array.from({ length: 60 }, () => 35 + Math.random() * 40);
  const render = () => {
    if (!active) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(rect.width * dpr) || canvas.height !== Math.round(rect.height * dpr)) {
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const width = rect.width;
    const height = rect.height;
    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = "rgba(132, 160, 194, .11)";
    ctx.lineWidth = 1;
    for (let y = 20; y < height; y += 25) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
    for (let x = 25; x < width; x += 50) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "rgba(85, 220, 255, .26)");
    gradient.addColorStop(1, "rgba(85, 220, 255, 0)");
    ctx.beginPath();
    samples.forEach((value, index) => {
      const x = index / (samples.length - 1) * width;
      const y = height - (value / 100) * (height - 15) - 5;
      if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.lineTo(width, height); ctx.lineTo(0, height); ctx.closePath(); ctx.fillStyle = gradient; ctx.fill();
    ctx.beginPath();
    samples.forEach((value, index) => {
      const x = index / (samples.length - 1) * width;
      const y = height - (value / 100) * (height - 15) - 5;
      if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = "#55dcff"; ctx.lineWidth = 1.5; ctx.shadowColor = "#55dcff"; ctx.shadowBlur = 7; ctx.stroke(); ctx.shadowBlur = 0;
    frame = requestAnimationFrame(render);
  };
  const sampleTimer = window.setInterval(() => {
    samples.shift();
    samples.push(20 + Math.random() * 70);
  }, 900);
  render();
  return () => { active = false; cancelAnimationFrame(frame); window.clearInterval(sampleTimer); };
}
