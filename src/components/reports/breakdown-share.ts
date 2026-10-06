// =========================================================
// Breakdown Share & Export Helpers  ·  Family Accounts
// CSV download and Canvas PNG generation / Web Share
// =========================================================

import type { PivotResult } from '@/lib/reports/pivot';
import { pivotToCsv } from '@/lib/reports/export';
import { money } from '@/lib/format';

export function downloadPivotCsv(
  result: PivotResult,
  locale: 'ar' | 'en'
): void {
  const csv = pivotToCsv(result, locale);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `breakdown-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function sharePivotPng(
  result: PivotResult,
  title: string,
  locale: 'ar' | 'en'
): Promise<void> {
  const isAr = locale.startsWith('ar');

  // Measure table dimensions
  const colCount = result.colLabels.length + 1; // plus total col
  const colWidth = 110;
  const labelWidth = 160;
  const rowHeight = 44;
  const padding = 32;
  const headerHeight = 80;

  const totalWidth = padding * 2 + labelWidth + colCount * colWidth;
  const totalHeight =
    padding * 2 + headerHeight + (result.rowLabels.length + 2) * rowHeight;

  const canvas = document.createElement('canvas');
  const dpr = 2; // high-dpi
  canvas.width = totalWidth * dpr;
  canvas.height = totalHeight * dpr;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.scale(dpr, dpr);

  // Background
  ctx.fillStyle = '#FAF8F5';
  ctx.fillRect(0, 0, totalWidth, totalHeight);

  // Card background
  const cardX = padding;
  const cardY = padding;
  const cardW = totalWidth - padding * 2;
  const cardH = totalHeight - padding * 2;
  const radius = 16;

  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, radius);
  ctx.fill();
  ctx.strokeStyle = '#E7E3DC';
  ctx.lineWidth = 1;
  ctx.stroke();

  // App Title & Report Name
  ctx.fillStyle = '#1C1917';
  ctx.font = 'bold 20px "IBM Plex Sans Arabic", sans-serif';
  ctx.textAlign = isAr ? 'right' : 'left';
  const titleX = isAr ? totalWidth - padding - 20 : padding + 20;
  ctx.fillText(isAr ? 'حساباتنا · تفصيل' : 'Family Accounts · Breakdown', titleX, cardY + 36);

  ctx.fillStyle = '#6B6560';
  ctx.font = '14px "IBM Plex Sans Arabic", sans-serif';
  ctx.fillText(title, titleX, cardY + 60);

  // Divider under header
  ctx.strokeStyle = '#E7E3DC';
  ctx.beginPath();
  ctx.moveTo(cardX + 16, cardY + 76);
  ctx.lineTo(cardX + cardW - 16, cardY + 76);
  ctx.stroke();

  // Table starting position
  const tableTop = cardY + 86;

  // Header row
  ctx.font = 'bold 13px "IBM Plex Sans Arabic", sans-serif';
  ctx.fillStyle = '#6B6560';

  let curX = isAr ? totalWidth - padding - 20 : padding + 20;

  // First column header (Items)
  ctx.textAlign = isAr ? 'right' : 'left';
  ctx.fillText(isAr ? 'البند' : 'Item', curX, tableTop + 24);

  curX = isAr ? curX - labelWidth : curX + labelWidth;

  // Value column headers
  for (let c = 0; c < result.colLabels.length; c++) {
    const colX = isAr ? curX - colWidth + 10 : curX + colWidth - 10;
    ctx.textAlign = isAr ? 'left' : 'right';
    ctx.fillText(result.colLabels[c], colX, tableTop + 24);
    curX = isAr ? curX - colWidth : curX + colWidth;
  }

  // Total column header
  const totHeaderX = isAr ? curX - colWidth + 10 : curX + colWidth - 10;
  ctx.textAlign = isAr ? 'left' : 'right';
  ctx.fillStyle = '#1C1917';
  ctx.fillText(isAr ? 'الإجمالي' : 'Total', totHeaderX, tableTop + 24);

  // Divider under table header
  ctx.strokeStyle = '#E7E3DC';
  ctx.beginPath();
  ctx.moveTo(cardX + 16, tableTop + 36);
  ctx.lineTo(cardX + cardW - 16, tableTop + 36);
  ctx.stroke();

  // Data rows
  let curY = tableTop + 36;
  ctx.font = '14px "IBM Plex Sans Arabic", sans-serif';

  for (let r = 0; r < result.rowLabels.length; r++) {
    curY += rowHeight;

    // Row divider
    ctx.strokeStyle = '#F3EFE9';
    ctx.beginPath();
    ctx.moveTo(cardX + 16, curY);
    ctx.lineTo(cardX + cardW - 16, curY);
    ctx.stroke();

    // Row label
    curX = isAr ? totalWidth - padding - 20 : padding + 20;
    ctx.textAlign = isAr ? 'right' : 'left';
    ctx.fillStyle = '#1C1917';
    ctx.fillText(result.rowLabels[r], curX, curY - 14);

    curX = isAr ? curX - labelWidth : curX + labelWidth;

    // Row cells
    for (let c = 0; c < result.colLabels.length; c++) {
      const val = result.cells[r][c];
      const colX = isAr ? curX - colWidth + 10 : curX + colWidth - 10;
      ctx.textAlign = isAr ? 'left' : 'right';

      if (val === 0) {
        ctx.fillStyle = '#A8A29E';
        ctx.fillText('–', colX, curY - 14);
      } else {
        ctx.fillStyle = val < 0 ? '#C2410C' : '#1C1917';
        ctx.fillText(
          money(Math.round(val), locale, { hideCurrency: true, fractionDigits: 0 }),
          colX,
          curY - 14
        );
      }
      curX = isAr ? curX - colWidth : curX + colWidth;
    }

    // Row total
    const rowTot = result.rowTotals[r];
    const rowTotX = isAr ? curX - colWidth + 10 : curX + colWidth - 10;
    ctx.textAlign = isAr ? 'left' : 'right';
    ctx.fillStyle = '#1C1917';
    ctx.font = 'bold 14px "IBM Plex Sans Arabic", sans-serif';
    ctx.fillText(
      rowTot === 0
        ? '–'
        : money(Math.round(rowTot), locale, { hideCurrency: true, fractionDigits: 0 }),
      rowTotX,
      curY - 14
    );
    ctx.font = '14px "IBM Plex Sans Arabic", sans-serif';
  }

  // Summary row divider
  curY += rowHeight;
  ctx.strokeStyle = '#E7E3DC';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cardX + 16, curY - rowHeight);
  ctx.lineTo(cardX + cardW - 16, curY - rowHeight);
  ctx.stroke();

  // Summary row (Total)
  curX = isAr ? totalWidth - padding - 20 : padding + 20;
  ctx.textAlign = isAr ? 'right' : 'left';
  ctx.fillStyle = '#1C1917';
  ctx.font = 'bold 14px "IBM Plex Sans Arabic", sans-serif';
  ctx.fillText(isAr ? 'الإجمالي' : 'Total', curX, curY - 14);

  curX = isAr ? curX - labelWidth : curX + labelWidth;

  // Column totals
  for (let c = 0; c < result.colTotals.length; c++) {
    const cTot = result.colTotals[c];
    const colX = isAr ? curX - colWidth + 10 : curX + colWidth - 10;
    ctx.textAlign = isAr ? 'left' : 'right';
    ctx.fillText(
      cTot === 0
        ? '–'
        : money(Math.round(cTot), locale, { hideCurrency: true, fractionDigits: 0 }),
      colX,
      curY - 14
    );
    curX = isAr ? curX - colWidth : curX + colWidth;
  }

  // Grand total
  const gTotX = isAr ? curX - colWidth + 10 : curX + colWidth - 10;
  ctx.textAlign = isAr ? 'left' : 'right';
  ctx.fillText(
    result.grandTotal === 0
      ? '–'
      : money(Math.round(result.grandTotal), locale, {
          hideCurrency: true,
          fractionDigits: 0,
        }),
    gTotX,
    curY - 14
  );

  // Export to Blob
  return new Promise((resolve) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        resolve();
        return;
      }

      const filename = `breakdown-${new Date().toISOString().slice(0, 10)}.png`;
      const file = new File([blob], filename, { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: title || 'Breakdown',
          });
          resolve();
          return;
        } catch {
          // Fall through to download if user cancelled or error
        }
      }

      // Download fallback
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      resolve();
    }, 'image/png');
  });
}
