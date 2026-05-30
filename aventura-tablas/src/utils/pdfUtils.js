import { jsPDF } from "jspdf";

const TABLAS = ["","uno","dos","tres","cuatro","cinco","seis","siete","ocho","nueve","diez"];

export function descargarReportePDF(rep) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const W = 210;
  const margen = 18;
  let y = 20;

  const lineaColor = (r, g, b) => doc.setDrawColor(r, g, b);
  const texto = (str, x, tamaño, style = "normal", color = [255,255,255]) => {
    doc.setFontSize(tamaño);
    doc.setFont("helvetica", style);
    doc.setTextColor(...color);
    doc.text(str, x, y);
  };

  // ── Fondo oscuro
  doc.setFillColor(10, 14, 39);
  doc.rect(0, 0, W, 297, "F");

  // ── Banda de header
  doc.setFillColor(26, 31, 78);
  doc.rect(0, 0, W, 38, "F");

  // ── Título
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 245, 255);
  doc.text("Aventura de Tablas Pro", margen, 15);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(180, 180, 220);
  doc.text("Reporte de Progreso", margen, 22);

  doc.setFontSize(9);
  doc.setTextColor(120, 120, 160);
  const hoy = new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });
  doc.text(`Generado: ${hoy}`, margen, 28);

  // ── Logo / emoji como texto
  doc.setFontSize(22);
  doc.setTextColor(255, 214, 0);
  doc.text("★", W - margen - 10, 22);

  y = 50;

  // ── Datos del alumno
  doc.setFillColor(20, 24, 60);
  doc.roundedRect(margen, y - 6, W - margen * 2, 32, 3, 3, "F");

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(rep.Nombre || "Sin nombre", margen + 4, y + 4);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(160, 160, 200);
  const infoAlumno = [
    rep.Grado ? `Grado: ${rep.Grado}` : null,
    rep.Correo ? `Correo: ${rep.Correo}` : null,
    rep.Maestro_Nombre ? `Maestro: ${rep.Maestro_Nombre}` : null,
  ].filter(Boolean).join("   |   ");
  if (infoAlumno) doc.text(infoAlumno, margen + 4, y + 12);

  y += 42;

  // ── Progreso general
  const mundos = rep.mundos ?? (rep.Mundos_Completados || rep.Nivel_Max - 1 || 0);
  const pct = rep.pct ?? Math.round((mundos / 10) * 100);
  const tiempoMin = rep.tiempoMin ?? rep.Tiempo_Total_Min ?? 0;
  const horas = Math.floor(tiempoMin / 60);
  const mins = tiempoMin % 60;

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 245, 255);
  doc.text("PROGRESO GENERAL", margen, y);
  y += 6;

  // Barra de progreso
  const barW = W - margen * 2;
  doc.setFillColor(30, 30, 60);
  doc.roundedRect(margen, y, barW, 7, 2, 2, "F");

  const progColor = pct >= 80 ? [57, 255, 20] : pct >= 50 ? [255, 214, 0] : [255, 0, 110];
  doc.setFillColor(...progColor);
  const fillW = Math.max(4, (pct / 100) * barW);
  doc.roundedRect(margen, y, fillW, 7, 2, 2, "F");

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  if (pct > 10) doc.text(`${pct}%`, margen + fillW / 2 - 4, y + 5.2);
  y += 14;

  // Estadísticas en cajas
  const stats = [
    { label: "Mundos completados", value: `${mundos} / 10`, color: [0, 245, 255] },
    { label: "Tiempo conectado",   value: horas > 0 ? `${horas}h ${mins}min` : `${mins} min`, color: [162, 155, 254] },
    { label: "Monedas ganadas",    value: `${rep.Monedas || 0} 🪙`, color: [255, 214, 0] },
    { label: "Avance total",       value: `${pct}%`, color: pct >= 80 ? [57,255,20] : pct >= 50 ? [255,214,0] : [255,0,110] },
  ];

  const colW = (W - margen * 2 - 12) / 4;
  stats.forEach((s, i) => {
    const x = margen + i * (colW + 4);
    doc.setFillColor(20, 24, 60);
    doc.roundedRect(x, y, colW, 20, 2, 2, "F");
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...s.color);
    doc.text(s.value, x + colW / 2, y + 10, { align: "center" });
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 120, 160);
    doc.text(s.label, x + colW / 2, y + 16, { align: "center" });
  });

  y += 30;

  // ── Tablas problemáticas
  let fallos = {};
  try { fallos = typeof rep.fallos === "object" ? rep.fallos : JSON.parse(rep.Fallos_Tablas || "{}"); } catch {}
  const problemas = Object.entries(fallos).filter(([,v]) => v >= 3).sort((a,b) => b[1]-a[1]);

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 245, 255);
  doc.text("TABLAS QUE NECESITAN PRÁCTICA", margen, y);
  y += 6;

  if (problemas.length === 0) {
    doc.setFillColor(10, 50, 20);
    doc.roundedRect(margen, y, W - margen * 2, 12, 2, 2, "F");
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(57, 255, 20);
    doc.text("✓ Excelente rendimiento — Sin tablas problemáticas detectadas", margen + 4, y + 8);
    y += 18;
  } else {
    problemas.forEach(([tabla, errores]) => {
      const severidad = errores >= 7 ? [255, 0, 110] : errores >= 5 ? [255, 50, 50] : [255, 140, 0];
      doc.setFillColor(40, 10, 20);
      doc.roundedRect(margen, y, W - margen * 2, 12, 2, 2, "F");
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...severidad);
      doc.text(`Tabla del ${tabla} (${TABLAS[parseInt(tabla)] || tabla})`, margen + 4, y + 8);
      doc.setTextColor(200, 100, 100);
      doc.text(`${errores} errores acumulados`, W - margen - 4, y + 8, { align: "right" });
      y += 14;
    });
    y += 4;
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(120, 120, 160);
    doc.text("Recomendación: Practicar las tablas marcadas con ejercicios adicionales.", margen, y);
    y += 10;
  }

  // ── Tabla de errores completa (todas las tablas)
  y += 4;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 245, 255);
  doc.text("DETALLE POR TABLA DE MULTIPLICAR", margen, y);
  y += 8;

  const tablaColW = (W - margen * 2 - 18) / 10;
  for (let t = 1; t <= 10; t++) {
    const errores = fallos[String(t)] || 0;
    const x = margen + (t - 1) * (tablaColW + 2);
    const bgColor = errores >= 5 ? [60, 10, 20] : errores >= 3 ? [50, 30, 0] : errores > 0 ? [40, 40, 0] : [5, 40, 10];
    const txtColor = errores >= 5 ? [255, 0, 110] : errores >= 3 ? [255, 140, 0] : errores > 0 ? [255, 214, 0] : [57, 255, 20];
    doc.setFillColor(...bgColor);
    doc.roundedRect(x, y, tablaColW, 18, 2, 2, "F");
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...txtColor);
    doc.text(`×${t}`, x + tablaColW / 2, y + 8, { align: "center" });
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...txtColor);
    doc.text(errores > 0 ? `${errores} err` : "OK", x + tablaColW / 2, y + 14, { align: "center" });
  }
  y += 28;

  // ── Pie de página
  doc.setFillColor(26, 31, 78);
  doc.rect(0, 280, W, 17, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 140);
  doc.text("Aventura de Tablas Pro — Sistema educativo de tablas de multiplicar", margen, 289);
  doc.text(`Página 1`, W - margen, 289, { align: "right" });

  const nombreArchivo = `Reporte_${(rep.Nombre || "alumno").replace(/\s+/g, "_")}_${new Date().toISOString().slice(0,10)}.pdf`;
  doc.save(nombreArchivo);
}
