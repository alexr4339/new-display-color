// Copyright (c) 2021-2023 FlyByWire Simulations
//
// SPDX-License-Identifier: GPL-3.0

import { EventBus } from '@microsoft/msfs-sdk';

import { Failure, FailuresOrchestrator } from '@flybywiresim/fbw-sdk';
import { GenericGenerator } from './GenericGenerator';
import { FailureGeneratorAltitude } from './AltitudeFailureGenerator';
import { FailureGeneratorPerHour } from './PerHourFailureGenerator';
import { FailureGeneratorSpeed } from './SpeedFailureGenerator';
import { FailureGeneratorTakeOff } from './TakeOffFailureGenerator';
import { FailureGeneratorTimer } from './TimerFailureGenerator';

export const ArmingModeIndex = 0;
export const FailuresAtOnceIndex = 1;
export const MaxFailuresIndex = 2;

export enum FailurePhases {
  Dormant,
  TakeOff,
  InitialClimb,
  Flight,
}
export class RandomFailureGen {
  failureGenerators: GenericGenerator[];

  constructor(private readonly bus: EventBus) {
    this.failureGenerators = [
      new FailureGeneratorAltitude(this, this.bus),
      new FailureGeneratorSpeed(this, this.bus),
      new FailureGeneratorTimer(this, this.bus),
      new FailureGeneratorPerHour(this, this.bus),
      new FailureGeneratorTakeOff(this, this.bus),
    ];
  }

  absoluteTimePrev: number = Date.now();

  flatten(settings: number[]): string {
    let settingString = '';
    for (let i = 0; i < settings.length; i++) {
      settingString += settings[i].toString();
      if (i < settings.length - 1) settingString += ',';
    }
    return settingString;
  }

  activateRandomFailure(
    failureList: readonly Readonly<Failure>[],
    failureOrchestrator: FailuresOrchestrator,
    activeFailures: Set<number>,
    failuresAtOnce: number,
  ) {
    let failuresOffMap = failureList
      .filter((failure) => !activeFailures.has(failure.identifier))
      .map((failure) => failure.identifier);
    const maxNumber = Math.min(failuresAtOnce, failuresOffMap.length);
    for (let i = 0; i < maxNumber; i++) {
      if (failuresOffMap.length > 0) {
        const pick = Math.floor(Math.random() * failuresOffMap.length);
        const failureIdentifierPicked = failuresOffMap[pick];
        const pickedFailure = failureList.find((failure) => failure.identifier === failureIdentifierPicked);
        if (pickedFailure) {
          failureOrchestrator.activate(failureIdentifierPicked);
          failuresOffMap = failuresOffMap.filter((identifier) => identifier !== failureIdentifierPicked);
        }
      }
    }
  }

  private failureFlightPhase: FailurePhases;

  getFailureFlightPhase(): FailurePhases {
    return this.failureFlightPhase;
  }

  basicDataUpdate(): void {
    const isOnGround = SimVar.GetSimVarValue('SIM ON GROUND', 'Bool');
    const maxThrottleMode = Math.max(Simplane.getEngineThrottleMode(0), Simplane.getEngineThrottleMode(1));
    const throttleTakeOff = maxThrottleMode === ThrottleMode.FLEX_MCT || maxThrottleMode === ThrottleMode.TOGA;
    if (isOnGround) {
      if (throttleTakeOff) this.failureFlightPhase = FailurePhases.TakeOff;
      else this.failureFlightPhase = FailurePhases.Dormant;
    } else if (throttleTakeOff) this.failureFlightPhase = FailurePhases.InitialClimb;
    else this.failureFlightPhase = FailurePhases.TakeOff;
  }

  update(failureOrchestrator: FailuresOrchestrator) {
    const absoluteTime = Date.now();
    if (absoluteTime - this.absoluteTimePrev >= 100.0) {
      this.basicDataUpdate();
      for (let i = 0; i < this.failureGenerators.length; i++) {
        this.failureGenerators[i].updateFailure(failureOrchestrator);
      }
      this.absoluteTimePrev = absoluteTime;
    }
  }
}
