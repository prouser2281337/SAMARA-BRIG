import type { Assignment, Brigade } from '../api';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

export interface RoutePoint {
  type: 'departure' | 'arrival' | 'work' | 'travel' | 'return';
  time: string;
  label: string;
  description?: string;
  duration?: number;
  address?: string;
  client?: string;
  assignment?: Assignment;
}

export interface RouteSheet {
  brigade: Brigade;
  date: string;
  departureTime: string;
  returnTime: string;
  totalDistance: number;
  totalWorkTime: number;
  totalTravelTime: number;
  points: RoutePoint[];
  isFeasible: boolean;
  warning?: string;
}

const WORK_START = 9;
const WORK_END = 18;
const WORK_START_MIN = WORK_START * 60;
const WORK_END_MIN = WORK_END * 60;

function parseIsoTime(iso: string): { h: number; m: number; totalMinutes: number } {
  const match = iso.match(/T(\d{2}):(\d{2})/);
  if (!match) return { h: 0, m: 0, totalMinutes: 0 };
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  return { h, m, totalMinutes: h * 60 + m };
}

function minutesToTime(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, totalMinutes));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function calculateRouteSheet(
  brigade: Brigade,
  assignments: Assignment[],
  date: string,
  baseAddress = 'Центральная база (гараж)'
): RouteSheet {
  const sorted = [...assignments].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );

  const points: RoutePoint[] = [];
  let currentTime = WORK_START_MIN;
  let totalWorkTime = 0;
  let totalTravelTime = 0;
  let isFeasible = true;
  let warning: string | undefined;

  if (sorted.length === 0) {
    return {
      brigade,
      date,
      departureTime: minutesToTime(WORK_START_MIN),
      returnTime: minutesToTime(WORK_START_MIN),
      totalDistance: 0,
      totalWorkTime: 0,
      totalTravelTime: 0,
      points: [],
      isFeasible: true,
    };
  }

  const first = sorted[0];
  const firstStart = parseIsoTime(first.start_time);
  const firstTravel = first.travel_time || 15;
  const departureMin = Math.max(WORK_START_MIN, firstStart.totalMinutes - firstTravel);
  currentTime = departureMin;

  points.push({
    type: 'departure',
    time: minutesToTime(departureMin),
    label: 'Выезд с базы',
    description: baseAddress,
    duration: 0,
  });

  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i];
    const prev = i > 0 ? sorted[i - 1] : null;
    const travel = a.travel_time || 15;

    if (i > 0) {
      const prevEnd = parseIsoTime(prev!.end_time);
      const travelStart = prevEnd.totalMinutes;
      const arrival = travelStart + travel;
      currentTime = arrival;

      points.push({
        type: 'travel',
        time: minutesToTime(travelStart),
        label: 'В пути',
        description: `От ${prev!.address} до ${a.address}`,
        duration: travel,
      });
      totalTravelTime += travel;
    } else {
      const arrival = departureMin + firstTravel;
      currentTime = arrival;
      points.push({
        type: 'travel',
        time: minutesToTime(departureMin),
        label: 'В пути',
        description: `От базы до ${a.address}`,
        duration: firstTravel,
      });
      totalTravelTime += firstTravel;
    }

    const startT = parseIsoTime(a.start_time);
    const endT = parseIsoTime(a.end_time);
    const workDuration = endT.totalMinutes - startT.totalMinutes;

    points.push({
      type: 'arrival',
      time: minutesToTime(currentTime),
      label: 'Прибытие',
      description: a.address,
      address: a.address,
      client: a.client,
      assignment: a,
    });

    points.push({
      type: 'work',
      time: minutesToTime(startT.totalMinutes),
      label: 'Ремонтные работы',
      description: a.work_type,
      duration: workDuration,
      address: a.address,
      client: a.client,
      assignment: a,
    });

    totalWorkTime += workDuration;
    currentTime = endT.totalMinutes;
  }

  const last = sorted[sorted.length - 1];
  const returnTravel = last.travel_time || 15;
  const returnTime = currentTime + returnTravel;

  points.push({
    type: 'travel',
    time: minutesToTime(currentTime),
    label: 'В пути',
    description: `От ${last.address} до базы`,
    duration: returnTravel,
  });
  totalTravelTime += returnTravel;

  points.push({
    type: 'return',
    time: minutesToTime(returnTime),
    label: 'Возврат на базу',
    description: baseAddress,
    duration: 0,
  });

  if (returnTime > WORK_END_MIN) {
    isFeasible = false;
    warning = `Бригада не успевает вернуться к ${WORK_END}:00. Расчётное время возврата: ${minutesToTime(returnTime)}`;
  }

  return {
    brigade,
    date,
    departureTime: minutesToTime(departureMin),
    returnTime: minutesToTime(returnTime),
    totalDistance: Math.round(totalTravelTime * 0.5 * 10) / 10,
    totalWorkTime,
    totalTravelTime,
    points,
    isFeasible,
    warning,
  };
}

export function exportRouteSheetToCSV(sheet: RouteSheet): string {
  const lines: string[] = [
    `Маршрутный лист,${sheet.brigade.name},${sheet.date}`,
    `Выезд,${sheet.departureTime},,`,
    `Возврат,${sheet.returnTime},,`,
    `Общее время работы,${sheet.totalWorkTime} мин,,`,
    `Общее время в пути,${sheet.totalTravelTime} мин,,`,
    ``,
    `Время,Тип,Адрес / Описание,Длительность (мин)`,
  ];
  for (const p of sheet.points) {
    lines.push(`${p.time},${p.label},"${p.description || ''}",${p.duration || 0}`);
  }
  if (sheet.warning) {
    lines.push('');
    lines.push(`ВНИМАНИЕ,${sheet.warning},,`);
  }
  return lines.join('\n');
}

export function exportRouteSheetToText(sheet: RouteSheet): string {
  const lines: string[] = [
    `═══════════════════════════════════════`,
    `   МАРШРУТНЫЙ ЛИСТ`,
    `═══════════════════════════════════════`,
    ``,
    `Бригада:      ${sheet.brigade.name}`,
    `Автомобиль:   ${sheet.brigade.car_model} (${sheet.brigade.license_plate})`,
    `Дата:         ${sheet.date}`,
    ``,
    `Выезд с базы: ${sheet.departureTime}`,
    `Возврат:      ${sheet.returnTime}`,
    ``,
    `Рабочее время: ${sheet.totalWorkTime} мин (${Math.floor(sheet.totalWorkTime / 60)} ч ${sheet.totalWorkTime % 60} мин)`,
    `В пути:        ${sheet.totalTravelTime} мин`,
    ``,
    `───────────────────────────────────────`,
    `   ПОСЛЕДОВАТЕЛЬНОСТЬ ОБЪЕКТОВ`,
    `───────────────────────────────────────`,
  ];
  let objNum = 0;
  for (const p of sheet.points) {
    if (p.type === 'arrival') {
      objNum++;
      lines.push('');
      lines.push(`  Объект #${objNum}`);
      lines.push(`  Время прибытия: ${p.time}`);
      lines.push(`  Адрес:          ${p.address}`);
      lines.push(`  Клиент:         ${p.client}`);
    } else if (p.type === 'work') {
      lines.push(`  Время начала:   ${p.time}`);
      lines.push(`  Длительность:   ${p.duration} мин`);
      lines.push(`  Тип работ:      ${p.description}`);
    } else if (p.type === 'travel' && objNum > 0) {
      const isReturn = p.description?.includes('до базы');
      lines.push(`  → ${isReturn ? 'Возврат на базу' : 'В пути'}: ${p.duration} мин`);
    } else if (p.type === 'departure') {
      lines.push(`  → Выезд с базы: ${p.time}`);
    }
  }
  if (sheet.warning) {
    lines.push('');
    lines.push(`⚠ ВНИМАНИЕ: ${sheet.warning}`);
  }
  lines.push('');
  lines.push('═══════════════════════════════════════');
  return lines.join('\n');
}

/**
 * PDF экспорт через html2canvas — 100% поддержка кириллицы.
 * Рендерим HTML с русским текстом, конвертируем в canvas, вставляем в PDF.
 */
export async function exportRouteSheetToPDF(sheet: RouteSheet): Promise<void> {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-99999px';
  container.style.top = '0';
  container.style.width = '794px'; // A4 width @ 96dpi
  container.style.background = '#ffffff';
  container.style.padding = '40px';
  container.style.fontFamily = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
  container.style.fontSize = '13px';
  container.style.lineHeight = '1.5';
  container.style.color = '#0f172a';

  // Генерируем HTML таблицы маршрута
  let tableRows = '';
  let objNum = 0;

  for (const p of sheet.points) {
    let stageLabel = p.label;
    let stageBg = '';
    let stageColor = '';

    switch (p.type) {
      case 'departure':
        stageBg = '#0f172a';
        stageColor = '#ffffff';
        break;
      case 'arrival':
        objNum++;
        stageLabel = `Прибытие (#${objNum})`;
        stageBg = '#2563eb';
        stageColor = '#ffffff';
        break;
      case 'work':
        stageLabel = 'Ремонтные работы';
        stageBg = '#dcfce7';
        stageColor = '#166534';
        break;
      case 'travel':
        stageLabel = p.description?.includes('до базы') ? 'Возврат' : 'В пути';
        stageBg = '#f1f5f9';
        stageColor = '#64748b';
        break;
      case 'return':
        stageBg = '#0f172a';
        stageColor = '#ffffff';
        break;
    }

    tableRows += `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 10px 12px; font-weight: 700; font-size: 13px; width: 60px; vertical-align: middle;">${p.time}</td>
        <td style="padding: 10px 12px; width: 120px; vertical-align: middle;">
          <span style="display: inline-block; padding: 4px 10px; border-radius: 4px; font-size: 12px; font-weight: 600; line-height: 1.2;
                      background: ${stageBg}; color: ${stageColor};">${stageLabel}</span>
        </td>
        <td style="padding: 10px 12px; vertical-align: middle;">${p.description || ''}</td>
        <td style="padding: 10px 12px; width: 140px; vertical-align: middle;">${p.client || ''}</td>
        <td style="padding: 10px 12px; text-align: center; width: 70px; font-weight: 600; vertical-align: middle;">${p.duration ? p.duration + ' мин' : ''}</td>
      </tr>
    `;
  }

  container.innerHTML = `
    <div style="text-align: center; margin-bottom: 24px;">
      <h1 style="font-size: 22px; font-weight: 800; margin: 0; letter-spacing: 0.05em; text-transform: uppercase;">Маршрутный лист</h1>
      <p style="font-size: 12px; color: #64748b; margin: 6px 0 0;">Самарские Бригады · ${sheet.date}</p>
    </div>

    <div style="display: flex; gap: 16px; margin-bottom: 24px;">
      <div style="flex: 1;">
        <p style="margin: 0; font-size: 15px; font-weight: 700;">${sheet.brigade.name}</p>
        <p style="margin: 4px 0 0; font-size: 12px; color: #64748b;">${sheet.brigade.car_model} · ${sheet.brigade.license_plate}</p>
      </div>
      <div style="text-align: right;">
        <p style="margin: 0; font-size: 12px; color: #64748b;">Квалификация</p>
        <p style="margin: 2px 0 0; font-size: 13px; font-weight: 600;">${sheet.brigade.qualification}</p>
      </div>
    </div>

    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px 20px;
                display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px;">
      <div>
        <p style="margin: 0; font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">Выезд</p>
        <p style="margin: 4px 0 0; font-size: 16px; font-weight: 800;">${sheet.departureTime}</p>
      </div>
      <div>
        <p style="margin: 0; font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">Возврат</p>
        <p style="margin: 4px 0 0; font-size: 16px; font-weight: 800; ${sheet.isFeasible ? '' : 'color: #dc2626;'}">${sheet.returnTime}</p>
      </div>
      <div>
        <p style="margin: 0; font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">Работа</p>
        <p style="margin: 4px 0 0; font-size: 16px; font-weight: 800;">${Math.floor(sheet.totalWorkTime / 60)}ч ${sheet.totalWorkTime % 60}м</p>
      </div>
      <div>
        <p style="margin: 0; font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">В пути</p>
        <p style="margin: 4px 0 0; font-size: 16px; font-weight: 800;">${sheet.totalTravelTime} мин</p>
      </div>
    </div>

    ${sheet.warning ? `
      <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 10px 14px; margin-bottom: 24px;">
        <p style="margin: 0; font-size: 12px; font-weight: 700; color: #dc2626;">! ${sheet.warning}</p>
      </div>
    ` : ''}

    <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
      <thead>
        <tr style="background: #0f172a;">
          <th style="padding: 10px 12px; text-align: left; color: #fff; font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em; width: 60px;">Время</th>
          <th style="padding: 10px 12px; text-align: left; color: #fff; font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em; width: 120px;">Этап</th>
          <th style="padding: 10px 12px; text-align: left; color: #fff; font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em;">Адрес / Описание</th>
          <th style="padding: 10px 12px; text-align: left; color: #fff; font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em; width: 140px;">Клиент</th>
          <th style="padding: 10px 12px; text-align: center; color: #fff; font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em; width: 70px;">Длит.</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>

    <p style="margin: 24px 0 0; font-size: 10px; color: #94a3b8; text-align: center;">
      Сформировано автоматически системой Самарские Бригады · ${new Date().toLocaleString('ru-RU')}
    </p>
  `;

  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    const imgData = canvas.toDataURL('image/png');
    const doc = new jsPDF('p', 'mm', 'a4');

    const pageWidth = 210;  // A4 mm
    const pageHeight = 297; // A4 mm
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    // Если содержимое больше одной страницы — разбиваем
    let heightLeft = imgHeight;
    let position = 0;

    doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      doc.addPage();
      doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    doc.save(`Маршрутный_лист_${sheet.brigade.name}_${sheet.date}.pdf`);
  } finally {
    document.body.removeChild(container);
  }
}
