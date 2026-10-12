/* Rapora gömülen harita altbilgisinin kimlik ve veri künyesi. */
export function drawReportMapFooter({
  canvas, width, height, padding, footerHeight, frameTone, tones, dataset, meta = null
}) {
  const y = height - footerHeight + 12;
  canvas.line(padding, y - 8, width - padding, y - 8, frameTone);
  const fitText = (x, rowY, value, color) =>
    canvas.text(x, rowY, value, color, (12 * value.length <= width - 2 * padding) ? 2 : 1);
  const idLine = meta && meta.id ? ('DENDROGEO - ' + meta.id) : 'DENDROGEO - BILIMSEL ANALIZ HARITASI';
  canvas.text(padding, y, idLine, tones.ink, 2);
  const brandMark = 'DENDROGEO 2026';
  if (width - padding - 12 * brandMark.length > padding + 12 * idLine.length + 8)
    canvas.text(width - padding - 12 * brandMark.length, y, brandMark, tones.mut, 2);
  fitText(padding, y + 20,
    'VERI: ' + ((meta && meta.source) || dataset) + ' / COZUNURLUK: ' + (meta?.resolution || '10 M') +
      (meta && meta.epsg ? ' / PROJEKSIYON: EPSG:' + meta.epsg : ''),
    tones.mut);
  if (meta && (meta.dateStr || meta.engine)) {
    const details = (meta.dateStr ? 'ANALIZ TARIHI: ' + meta.dateStr : '') +
      (meta.dateStr && meta.engine ? ' / ' : '') +
      (meta.engine ? 'DENDROGEO LC ENGINE V' + meta.engine : '') + ' / CC BY-NC 4.0';
    fitText(padding, y + 40, details, tones.mut);
  }
}
