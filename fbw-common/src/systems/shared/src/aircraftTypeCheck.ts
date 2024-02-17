// Copyright (c) 2023-2024 FlyByWire Simulations
// SPDX-License-Identifier: GPL-3.0

/**
 * Determine the aircraft type using the Aircraft Title SimVar.
 * @returns {string} - the aircraft type (a32nx, a380x, other)
 */
export function getAircraftType(): string {
    const aircraftName :string = SimVar.GetSimVarValue('TITLE', 'string');
    let aircraft: string;
    if (aircraftName.includes('A320')) {
        aircraft = 'a32nx';
    } else if (aircraftName.includes('A380')) {
        aircraft = 'a380x';
    } else {
        aircraft = 'other';
    }
    return aircraft;
}
