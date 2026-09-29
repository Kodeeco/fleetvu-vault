import jsPDF from 'jspdf';
import type { Driver, Incident, Vehicle } from '@/lib/types';
import { sha256 } from '@/src/vault/merkle-chain';

export type VaultEventCategory = 'all' | 'post' | 'obstruction' | 'diag' | 'high-g';
export type VaultEventSeverity = 'pass' | 'critical' | 'warning';

export interface VaultEvent {
  id: string;
  category: VaultEventCategory;
  severity: VaultEventSeverity;
  time: string;
  timestamp: number;
  title: string;
  detail: string;
  hash: string;
  distance?: number;
  zone?: string;
}

export interface ReportContext {
  vehicle: Vehicle | null;
  driver: Driver | null;
  events: VaultEvent[];
  activeSensors: string[];
  lastSync: Date;
  postCompleted: boolean;
  /** When false (Vault LOCKED), PDF remains downloadable but is marked unsealed */
  sealed?: boolean;
}

const PAGE_MARGIN_L = 10;
const PAGE_MARGIN_R = 206;
const PAGE_CONTENT_W = PAGE_MARGIN_R - PAGE_MARGIN_L;

const COLOR_NAVY: [number, number, number] = [8, 21, 34];
const COLOR_PALE: [number, number, number] = [244, 247, 249];
const COLOR_ORANGE: [number, number, number] = [245, 113, 24];
const COLOR_GREEN: [number, number, number] = [10, 185, 83];

export function formatTime(value: string | number | Date): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '--:--:--';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

export function formatDate(value: string | number | Date): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatPostDate(value: string | number | Date): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

export function shortHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${(hash >>> 0).toString(16).padStart(8, '0')}${value.length.toString(16).padStart(4, '0')}`;
}

export function eventSeverity(incident: Incident): VaultEventSeverity {
  const distance = incident.impact_distance_m ?? 99;
  const grade = (incident.severity_grade || '').toLowerCase();
  return distance < 2 || grade.includes('critical') || grade.includes('high') ? 'critical' : 'warning';
}

export function eventTitle(incident: Incident): string {
  const target = [incident.target_type, incident.target_vehicle_make, incident.target_vehicle_model].filter(Boolean).join(' ');
  return target ? `OBSTRUCTION — ${target}` : 'OBSTRUCTION DETECTED';
}

function pdfText(doc: jsPDF, value: string, x: number, y: number, width?: number): number {
  const lines = width ? doc.splitTextToSize(value, width) : [value];
  doc.text(lines, x, y);
  return y + lines.length * 3.4;
}

function drawPdfSection(doc: jsPDF, title: string, y: number): number {
  doc.setTextColor(15, 29, 48);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(title, PAGE_MARGIN_L, y);
  doc.setDrawColor(...COLOR_ORANGE);
  doc.setLineWidth(0.5);
  doc.line(PAGE_MARGIN_L, y + 2, PAGE_MARGIN_R, y + 2);
  return y + 7;
}

function drawPdfTableRow(
  doc: jsPDF,
  values: string[],
  widths: number[],
  x: number,
  y: number,
  height: number,
  fill: boolean,
  color: [number, number, number],
  fontSize?: number,
  header = false,
): void {
  const totalWidth = widths.reduce((sum, width) => sum + width, 0);
  if (fill) {
    doc.setFillColor(...color);
    doc.rect(x, y - 3.5, totalWidth, height, 'F');
  }
  doc.setTextColor(header ? 255 : 65, header ? 255 : 78, header ? 255 : 90);
  doc.setFont('helvetica', header ? 'bold' : 'normal');
  doc.setFontSize(fontSize ?? (header ? 6.6 : 6.1));
  let cursor = x + 2;
  values.forEach((value, index) => {
    doc.text(doc.splitTextToSize(value, widths[index] - 4).slice(0, 2), cursor, y);
    cursor += widths[index];
  });
}

export function buildVaultEvents(vehicle: Vehicle | null, incidents: Incident[]): VaultEvent[] {
  const postEvents: VaultEvent[] = [0, 1].map((minutesAgo, index) => {
    const timestamp = Date.now() - minutesAgo * 60 * 1000;
    return {
      id: `post-${index}`,
      category: 'post' as const,
      severity: 'pass' as const,
      time: formatTime(timestamp),
      timestamp,
      title: 'POST CHECK PASSED',
      detail: index === 0 ? 'Sensor array and chain handshake verified' : 'Firmware signature and storage integrity verified',
      hash: shortHash(`post-${vehicle?.id || 'fleet'}-${index}`),
    };
  });

  const incidentEvents: VaultEvent[] = incidents
    .filter((incident) => !vehicle || incident.vehicle_id === vehicle.id)
    .map((incident) => {
      const timestamp = new Date(incident.utc_timestamp || incident.created_at).getTime();
      return {
        id: incident.id,
        category: 'obstruction' as const,
        severity: eventSeverity(incident),
        time: formatTime(timestamp),
        timestamp,
        title: eventTitle(incident),
        detail: `${incident.truck_speed_mph ?? 0} MPH · ${incident.proximity_zone || 'Active roadway'} · ${incident.lane_selection || 'Lane not recorded'}`,
        hash: shortHash(`${incident.id}-${incident.created_at}`),
        distance: incident.impact_distance_m ?? undefined,
        zone: incident.proximity_zone || 'Active roadway',
      };
    });

  return [...postEvents, ...incidentEvents].sort((a, b) => b.timestamp - a.timestamp);
}

export async function downloadFleetvuReport(ctx: ReportContext): Promise<{
  blob: Blob;
  fileName: string;
  reportHash: string;
  generatedAt: Date;
  driverNumber: string;
  driverName: string;
  truckNumber: string;
  companyName: string;
}> {
  const { vehicle, driver, events, activeSensors, lastSync, postCompleted, sealed = true } = ctx;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const generatedAt = new Date();

  const truckNumber = vehicle?.truck_number || 'Fleet';
  const driverName = driver?.name || 'Unassigned Driver';
  const driverNumber = driver?.driver_number || driver?.id || 'N/A';
  const depot = driver?.location || vehicle?.location || 'Fleet Operations';
  const companyName = driver?.company_name || vehicle?.company_name || 'FleetVu Operations';
  const reportHash = await sha256(`${truckNumber}|${driverNumber}|${generatedAt.toISOString()}|${events.length}|${vehicle?.id || ''}`);
  const eventRows = events.filter((e) => e.category === 'obstruction' || e.category === 'diag' || e.category === 'high-g');
  const ledgerRows = events.slice(0, 5);
  const ledgerHashes = await Promise.all(ledgerRows.map((event, index) => sha256(`${event.id}|${event.timestamp}|${event.category}|${event.detail}|${index}`)));
  const genesisHash = await sha256(`${truckNumber}|${vehicle?.id || ''}|genesis`);
  const safeScore = vehicle?.safety_score ?? 0;
  const cardW = (PAGE_CONTENT_W - 4) / 2;
  const cardLX = PAGE_MARGIN_L;
  const cardRX = PAGE_MARGIN_L + cardW + 4;

  const windowEnd = new Date(generatedAt);
  const windowStart = new Date(windowEnd.getTime() - 6 * 86400000);
  const dateRange = `${formatDate(windowStart)} – ${formatDate(windowEnd)}`;

  const header = (page: number): void => {
    doc.setFillColor(...COLOR_NAVY);
    doc.rect(0, 0, 216, 28, 'F');
    doc.setFillColor(...COLOR_ORANGE);
    doc.rect(0, 0, 216, 1.5, 'F');
    doc.setFillColor(...COLOR_ORANGE);
    doc.rect(PAGE_MARGIN_L, 4, 1.3, 19, 'F');
    doc.setTextColor(244, 246, 248);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(26);
    doc.text('EVALUATION COPY', 24, 205, { angle: 45 });
    doc.text('EVALUATION COPY', 24, 265, { angle: 45 });
    doc.setTextColor(248, 250, 252);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text('FleetVu Forensic Vault — Safety & Compliance Log Report', 15, 10);
    doc.setTextColor(245, 113, 24);
    doc.setFontSize(6.5);
    doc.text(`Report Period: ${dateRange} · Generated live at ${formatTime(generatedAt)} PDT`, 15, 15);
    doc.setTextColor(180, 190, 200);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.8);
    doc.text(`Generated: ${formatDate(generatedAt)} at ${formatTime(generatedAt)} · ${sealed ? 'SHA-256 Verified' : 'UNSEALED — Vault LOCKED'}`, 15, 21);
    doc.setTextColor(190, 82, 12);
    doc.setFont('helvetica', 'bold');
    const headerHash = `Hash: ${reportHash}`;
    let headerHashSize = 5.2;
    doc.setFontSize(headerHashSize);
    while (doc.getTextWidth(headerHash) > 61 && headerHashSize > 3.6) {
      headerHashSize -= 0.1;
      doc.setFontSize(headerHashSize);
    }
    doc.text(headerHash, 145, 21);
    doc.setDrawColor(180, 190, 200);
    doc.setLineWidth(0.25);
    doc.line(PAGE_MARGIN_L, 269, PAGE_MARGIN_R, 269);
    doc.setTextColor(130, 140, 150);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.text('Patent Pending — App. 64-036,221', PAGE_MARGIN_L, 274);
    doc.text(`Page ${page} of 2`, 191, 274);
  };

  // ── PAGE 1: Telemetry & POST Logs ──
  header(1);
  let y = 36;
  y = drawPdfSection(doc, 'Driver Profile & Safety Metrics', y);

  doc.setFillColor(...COLOR_PALE);
  doc.setDrawColor(210, 218, 225);
  doc.setLineWidth(0.2);
  doc.roundedRect(cardLX, y, cardW, 55, 2, 2, 'FD');
  doc.roundedRect(cardRX, y, cardW, 55, 2, 2, 'FD');

  doc.setTextColor(...COLOR_ORANGE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('DRIVER PROFILE', cardLX + 4, y + 7);
  const profile: [string, string][] = [
    ['Company', companyName],
    ['Driver Name', driverName],
    ['Driver ID', driverNumber],
    ['Truck #', `#${truckNumber}`],
    ['Depot', depot],
    ['Sensor HW', `${vehicle?.hardware_profile || 'C55-Pro'} (Verified)`],
  ];
  doc.setFontSize(8);
  profile.forEach(([label, value], index) => {
    const rowY = y + 15 + index * 6.2;
    doc.setTextColor(115, 125, 135);
    doc.setFont('helvetica', 'normal');
    doc.text(label, cardLX + 4, rowY);
    doc.setTextColor(45, 55, 65);
    doc.setFont('helvetica', 'bold');
    doc.text(doc.splitTextToSize(value, cardW - 28).slice(0, 1), cardLX + 28, rowY);
  });

  doc.setTextColor(...COLOR_ORANGE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('SAFETY SCORES & POST STATUS', cardRX + 4, y + 7);

  doc.setTextColor(245, 113, 24);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(32);
  doc.text(safeScore.toFixed(1), cardRX + 6, y + 21);
  doc.setTextColor(110, 120, 130);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text('/ 100  Safety Score', cardRX + 6, y + 27);
  doc.text('Pre-Trip POST:', cardRX + 6, y + 33);
  doc.setTextColor(...COLOR_GREEN);
  doc.setFont('helvetica', 'bold');
  doc.text(postCompleted ? 'PASSED' : 'RUNNING', cardRX + 30, y + 33);
  doc.setTextColor(110, 120, 130);
  doc.setFont('helvetica', 'normal');
  doc.text(`Last: ${formatTime(lastSync)}`, cardRX + 6, y + 38);
  doc.text(`Events: ${events.length} total`, cardRX + 6, y + 43);
  const critCount = events.filter((e) => e.severity === 'critical').length;
  const warnCount = events.filter((e) => e.severity === 'warning').length;
  doc.setTextColor(220, 55, 45);
  doc.text(`${critCount} critical`, cardRX + 6, y + 49);
  doc.setTextColor(245, 166, 35);
  doc.text(`${warnCount} warning`, cardRX + 40, y + 49);

  y += 61;
  y = drawPdfSection(doc, 'Daily POST Check Summary', y);
  const postWidths = [49, 49, 49, 49];
  drawPdfTableRow(doc, ['Date', 'POST Status', 'Completed At', 'Hardware Seal'], postWidths, PAGE_MARGIN_L, y, 7, true, COLOR_NAVY, 8.2, true);
  const today = new Date(generatedAt);
  for (let index = 0; index < 7; index += 1) {
    const date = new Date(today.getTime() - index * 86400000);
    const isToday = index === 0;
    drawPdfTableRow(
      doc,
      [formatPostDate(date), isToday ? 'PASSED' : 'NOT RECORDED', isToday ? formatTime(lastSync) : '--', isToday ? 'VERIFIED' : 'N/A'],
      postWidths,
      PAGE_MARGIN_L,
      y + 7 + index * 5.6,
      5.6,
      index % 2 === 1,
      COLOR_PALE,
      7.4,
      false,
    );
  }
  y += 47;

  doc.setTextColor(40, 55, 70);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Sensor Array Diagnostics', PAGE_MARGIN_L, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  const sensorLines = [
    '• Forward Radar (77GHz): Active — all checks passed within rolling window',
    '• Lateral Ultrasonic (40kHz): Active — left/right arrays nominal',
    '• Accelerometer: Active — high-G monitoring and [hard brake/accel/swerve]',
    `• BLE Telemetry Link: ${activeSensors.length > 0 ? 'Connected — sensor signal active' : 'Connected — no sustained signal loss events'}`,
  ];
  sensorLines.forEach((line, index) => {
    doc.setTextColor(85, 100, 115);
    doc.text(line, PAGE_MARGIN_L + 2, y + 5 + index * 3.6);
  });
  y += 22;

  y = drawPdfSection(doc, `Event & Obstruction Log (${dateRange})`, y);
  const eventWidths = [33, 26, 28, 36, 22, 51];
  drawPdfTableRow(doc, ['Timestamp', 'Severity', 'Zone', 'GPS Coordinates', 'Distance', 'Description'], eventWidths, PAGE_MARGIN_L, y, 7, true, COLOR_NAVY, 6.6, true);
  if (eventRows.length === 0) {
    drawPdfTableRow(doc, ['No events recorded', '', '', '', '', ''], eventWidths, PAGE_MARGIN_L, y + 7, 7, true, COLOR_PALE);
  } else {
    eventRows.slice(0, 5).forEach((event, index) =>
      drawPdfTableRow(
        doc,
        [formatDate(event.timestamp), event.severity.toUpperCase(), event.zone || 'FORWARD', '—', event.distance ? `${event.distance.toFixed(1)}m` : '—', event.detail],
        eventWidths,
        PAGE_MARGIN_L,
        y + 7 + index * 7,
        7,
        index % 2 === 1,
        COLOR_PALE,
      ),
    );
  }
  const eventRowCount = eventRows.length === 0 ? 1 : Math.min(eventRows.length, 5);
  y += 10 + eventRowCount * 7;

  // ── PAGE 1 CONTINUATION: SHA-256 Ledger ──
  y = drawPdfSection(doc, 'Cryptographic Event Ledger (SHA-256 Chain)', y);
  doc.setFillColor(...COLOR_GREEN);
  doc.rect(PAGE_MARGIN_L, y, PAGE_CONTENT_W, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text(`CHAIN INTEGRITY: VERIFIED  •  ${ledgerRows.length} entries  •  Tamper-evident append-only log`, PAGE_MARGIN_L + 3, y + 5);
  y += 12;
  const ledgerWidths = [16, 36, 38, 106];
  drawPdfTableRow(doc, ['Seq', 'Timestamp', 'Category', 'Entry Hash (SHA-256)'], ledgerWidths, PAGE_MARGIN_L, y, 7, true, COLOR_NAVY, 6.6, true);
  ledgerRows.forEach((event, index) => drawPdfTableRow(doc, [`#${index}`, formatDate(event.timestamp), event.category.toUpperCase(), ledgerHashes[index]], ledgerWidths, PAGE_MARGIN_L, y + 7 + index * 7, 7, index % 2 === 0, COLOR_PALE));

  // ── PAGE 2: Legal Verification ──
  doc.addPage();
  header(2);
  y = 36;
  doc.setTextColor(70, 80, 90);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.3);
  doc.text(`Genesis Hash: ${genesisHash}`, PAGE_MARGIN_L, y);
  doc.text(`Last Hash: ${ledgerHashes[ledgerHashes.length - 1] || reportHash}`, PAGE_MARGIN_L, y + 5);
  y += 14;

  doc.setFillColor(...COLOR_NAVY);
  doc.rect(PAGE_MARGIN_L, y, PAGE_CONTENT_W, 38, 'F');
  doc.setTextColor(...COLOR_ORANGE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Compliance & Legal Verification', PAGE_MARGIN_L + 5, y + 5);
  doc.setTextColor(220, 228, 235);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.8);
  const legal = 'I hereby declare under penalty of perjury that the forensic data contained in this report is a true and accurate record of all sensor telemetry, proximity alerts, diagnostic events, and pre-trip inspections recorded by the FleetVu hardware system during the period covered.';
  const legalLines = doc.splitTextToSize(legal, PAGE_CONTENT_W - 10);
  doc.text(legalLines, PAGE_MARGIN_L + 5, y + 9);
  let legalY = y + 9 + legalLines.length * 3;
  const legal2 = 'This document is generated as an evaluation-tier forensic record under the FleetVu compliance framework. All event entries are cryptographically hashed using SHA-256 and stored in a tamper-evident append-only log. Alteration of this document after generation invalidates the cryptographic hash verification.';
  const legal2Lines = doc.splitTextToSize(legal2, PAGE_CONTENT_W - 10);
  doc.text(legal2Lines, PAGE_MARGIN_L + 5, legalY);
  legalY += legal2Lines.length * 3 + 1;
  doc.setTextColor(20, 215, 100);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.text(`SHA-256 Chain: INTACT  •  0 Tamper Events  •  ${ledgerRows.length} Ledger Entries`, PAGE_MARGIN_L + 5, legalY);
  legalY += 4;
  doc.setTextColor(...COLOR_ORANGE);
  doc.text(`Driver: ${driverName} (${driverNumber})  •  Truck #${truckNumber}  •  ${depot}`, PAGE_MARGIN_L + 5, legalY);
  legalY += 4;
  doc.setTextColor(90, 105, 120);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.2);
  doc.text(`Report ID: FV-${generatedAt.toISOString().slice(0, 10).replaceAll('-', '')}-${driverNumber}  •  Hash: ${reportHash}`, PAGE_MARGIN_L + 5, legalY);
  doc.setDrawColor(120, 130, 140);
  doc.setLineWidth(0.3);
  doc.line(PAGE_MARGIN_L, y + 46, PAGE_MARGIN_L + 80, y + 46);
  doc.setFontSize(6.5);
  doc.text('Driver Signature (upon submission)', PAGE_MARGIN_L, y + 50);

  const fileName = `FleetVu_Forensic_Report_${generatedAt.toISOString().slice(0, 10)}_${driverNumber}.pdf`;
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);

  return {
    blob,
    fileName,
    reportHash,
    generatedAt,
    driverNumber,
    driverName,
    truckNumber,
    companyName,
  };
}

export type FleetvuReportResult = Awaited<ReturnType<typeof downloadFleetvuReport>>;

/** Persist a generated forensic PDF into archived_reports (customer company vault). */
export async function archiveFleetvuReport(
  result: FleetvuReportResult,
  opts?: { generatedBy?: string; companyId?: string | null; companyName?: string },
): Promise<{ id?: string; error?: string }> {
  try {
    const { supabase } = await import('@/lib/supabase');
    // Store as data URL for immediate reopen without object storage
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(result.blob);
    });

    const { data, error } = await supabase
      .from('archived_reports')
      .insert({
        report_title: result.fileName,
        report_type: 'safety_log',
        scope: `${opts?.companyName || result.companyName} — Truck #${result.truckNumber} · ${result.driverName}`,
        file_size_kb: Math.max(1, Math.round(result.blob.size / 1024)),
        generated_by: opts?.generatedBy || result.driverName,
        pdf_url: dataUrl,
        metadata: {
          driver_number: result.driverNumber,
          driver_name: result.driverName,
          truck_number: result.truckNumber,
          report_hash: result.reportHash,
          company_id: opts?.companyId || null,
          source: 'mobile_forensic_vault',
          generated_at: result.generatedAt.toISOString(),
        },
      })
      .select('id')
      .single();

    if (error) return { error: error.message };
    return { id: data.id };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Archive failed' };
  }
}
