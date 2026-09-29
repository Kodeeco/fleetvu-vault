import type { Incident } from '@/lib/types';

export interface InternalFindingsSummary {
  headline: string;
  observations: string[];
  evidenceCompleteness: string[];
  gaps: string[];
  suggestedInternalNextSteps: string[];
  disclaimer: string;
}

/**
 * Observational, non-blame findings for claims / safety internal review.
 * Never assigns fault, guilt, or legal liability.
 */
export function buildInternalFindingsSummary(incident: Incident): InternalFindingsSummary {
  const truckMph = incident.truck_speed_mph ?? null;
  const targetMph = incident.target_speed_mph ?? null;
  const distanceM = incident.impact_distance_m ?? null;
  const angle = incident.impact_angle_type || incident.approach_angle || null;
  const truckMotion = incident.fleet_truck_motion || null;
  const targetMotion = incident.target_vehicle_motion || null;
  const lane = incident.lane_selection || null;
  const targetLabel = [incident.target_vehicle_make, incident.target_vehicle_model]
    .filter(Boolean)
    .join(' ') || incident.target_type || 'target object';
  const hasGps = incident.latitude != null && incident.longitude != null;
  const hasVoice = Boolean(incident.voice_note_transcript?.trim());
  const hasPhotos = Array.isArray(incident.photos) && incident.photos.length > 0;
  const hasNotes = Boolean(incident.investigator_notes?.trim());
  const severity = incident.severity_grade || null;

  const observations: string[] = [];

  observations.push(
    `Case ${incident.case_id || incident.id} recorded at ${new Date(incident.utc_timestamp).toLocaleString()} (UTC source timestamp).`,
  );

  if (truckMph != null && targetMph != null) {
    observations.push(
      `Reported speeds at capture: tractor ${truckMph.toFixed(1)} MPH; opposing/target object ${targetMph.toFixed(1)} MPH.`,
    );
  } else if (truckMph != null) {
    observations.push(`Reported tractor speed at capture: ${truckMph.toFixed(1)} MPH.`);
  }

  if (distanceM != null) {
    observations.push(
      `Closest recorded separation / closing distance in the captured window: ${distanceM.toFixed(1)} m.`,
    );
  }

  if (truckMotion || targetMotion) {
    observations.push(
      `Motion state in file: tractor reported as “${truckMotion || 'unspecified'}”; target reported as “${targetMotion || 'unspecified'}”.`,
    );
  }

  if (angle) {
    observations.push(
      `Geometry classified in file as “${angle.replace(/_/g, ' ')}” (sensor/geometry label — not a liability finding).`,
    );
  }

  if (lane) {
    observations.push(`Lane context in file: ${lane.replace(/_/g, ' ')}.`);
  }

  observations.push(`Associated other-vehicle description in file: ${targetLabel}.`);

  const angleKey = (angle || '').toLowerCase();
  if (angleKey === 'left_front' || angleKey === 'front_left') {
    observations.push(
      'C55 forward + left lateral channels are the expected lock path for left-front other-vehicle characterization in this geometry.',
    );
  } else if (angleKey === 'frontal' || angleKey === 'front') {
    observations.push(
      'C55 forward channel (with L/R corroboration) is the expected lock path for frontal other-vehicle characterization.',
    );
  } else if (angleKey.includes('rear')) {
    observations.push(
      'Note: forward/left/right grille channels primarily see forward-arc objects; rear-only other-vehicle kinematics require a rear pod or external evidence.',
    );
  }

  if (severity) {
    observations.push(`Internal severity tag on file: ${severity} (administrative triage only).`);
  }

  if (hasVoice) {
    observations.push('A driver voice note / transcript is attached to this case for internal context.');
  }

  const evidenceCompleteness: string[] = [];
  evidenceCompleteness.push(hasGps ? 'GPS coordinates present on file.' : 'GPS coordinates missing on file.');
  evidenceCompleteness.push('Reconstruction timeline phases (pre / impact / post) available for review.');
  evidenceCompleteness.push('SHA-256 chain-of-custody digest pathway available for sealed export.');
  if (hasPhotos) evidenceCompleteness.push(`${incident.photos.length} photo(s) attached.`);
  else evidenceCompleteness.push('No photos attached yet.');
  if (hasVoice) evidenceCompleteness.push('Voice note / transcript present.');
  else evidenceCompleteness.push('No voice note / transcript on file.');
  if (hasNotes) evidenceCompleteness.push('Investigator notes present on file.');
  else evidenceCompleteness.push('Investigator notes not yet entered.');

  const gaps: string[] = [];
  if (!hasGps) gaps.push('Confirm GPS lock / location metadata before counsel package.');
  if (!hasPhotos) gaps.push('Attach scene or damage photos if available.');
  if (!hasVoice) gaps.push('Capture or attach driver statement / voice note if required by policy.');
  if (!hasNotes) gaps.push('Add investigator notes documenting internal review steps taken.');
  if (truckMph == null || distanceM == null) {
    gaps.push('Speed and/or closing-distance fields incomplete — verify C55 telemetry window.');
  }
  if (gaps.length === 0) {
    gaps.push('No critical metadata gaps detected in the current file snapshot.');
  }

  const suggestedInternalNextSteps: string[] = [
    'Review pre-collision → impact → post-collision phases on the reconstruction canvas.',
    'Download sealed PDF digest for the internal claims / safety file.',
    'Email counsel or claims only after confirming evidence completeness checklist above.',
    'Record investigator notes with what was reviewed and what remains outstanding.',
  ];

  return {
    headline: 'Internal Findings Summary',
    observations,
    evidenceCompleteness,
    gaps,
    suggestedInternalNextSteps,
    disclaimer:
      'Observational summary for internal safety and claims review only. AccuVu / FleetVu does not determine fault, guilt, or legal liability and is not a substitute for a certified accident reconstruction expert.',
  };
}
