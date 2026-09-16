import { Pipe, PipeTransform } from "@angular/core";
import type { Direction, TransportMode, TripStatus, WaitLevel } from "@desordre/shared-types";
import {
  DIRECTION_LABELS,
  TRANSPORT_MODE_LABELS,
  TRIP_STATUS_LABELS,
  UNKNOWN_LABEL,
  WAIT_LEVEL_LABELS,
} from "../labels";

@Pipe({ name: "directionLabel", standalone: true })
export class DirectionLabelPipe implements PipeTransform {
  transform(value: Direction | null | undefined): string {
    return value ? DIRECTION_LABELS[value] : UNKNOWN_LABEL;
  }
}

@Pipe({ name: "transportModeLabel", standalone: true })
export class TransportModeLabelPipe implements PipeTransform {
  transform(value: TransportMode | null | undefined): string {
    return value ? TRANSPORT_MODE_LABELS[value] : UNKNOWN_LABEL;
  }
}

@Pipe({ name: "tripStatusLabel", standalone: true })
export class TripStatusLabelPipe implements PipeTransform {
  transform(value: TripStatus | null | undefined): string {
    return value ? TRIP_STATUS_LABELS[value] : UNKNOWN_LABEL;
  }
}

@Pipe({ name: "waitLevelLabel", standalone: true })
export class WaitLevelLabelPipe implements PipeTransform {
  transform(value: WaitLevel | null | undefined): string {
    return value ? WAIT_LEVEL_LABELS[value] : UNKNOWN_LABEL;
  }
}

export const LABEL_PIPES = [
  DirectionLabelPipe,
  TransportModeLabelPipe,
  TripStatusLabelPipe,
  WaitLevelLabelPipe,
] as const;
