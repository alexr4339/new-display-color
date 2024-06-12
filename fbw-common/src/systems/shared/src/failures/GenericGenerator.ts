// Copyright (c) 2021-2023 FlyByWire Simulations
//
// SPDX-License-Identifier: GPL-3.0

import { EventBus } from '@microsoft/msfs-sdk';

import {
  ArmingModeIndex,
  FailurePhases,
  FailuresAtOnceIndex,
  MaxFailuresIndex,
  RandomFailureGen,
} from './RandomFailureGen';
import { Failure, FailuresOrchestrator } from './failures-orchestrator';

export enum FailureGenMode {
  FailureGenAny = -1,
  FailureGenOff = 0,
  FailureGenOnce = 1,
  FailureGenTakeOff = 2,
  FailureGenRepeat = 3,
}

export interface FailureGenFailureList {
  failurePool: { generatorType: string; generatorNumber: number; failureString: string };
}

export interface FailureGenFeedbackEvent {
  expectedMode: { generatorType: string; mode: number[] };
  armingDisplayStatus: { generatorType: string; status: boolean[] };
}

export interface FailureGenEvent {
  refreshData: boolean;
  settings: { generatorType: string; settingsString: string };
}
export abstract class GenericGenerator {
  numberOfSettingsPerGenerator: number = 3;

  uniqueGenPrefix: string = 'UNIQUE LETTER HERE';

  failureGeneratorArmed: boolean[] = [];

  waitForTakeOff: boolean[] = [];

  waitForStopped: boolean[] = [];

  previousArmingMode: number[] = [];

  previousNbGenerator: number = 0;

  previousArmedState: boolean[] = [];

  previousRequestedMode: number[] = [];

  gs: number = 0;

  settings: number[] = [];

  requestedMode: number[] = [];

  armingMode: number[] = [];

  failuresAtOnce: number[] = [];

  maxFailures: number[] = [];

  refreshRequest: boolean = false;

  failurePool: string[] = [];

  getGeneratorFailurePool(failureOrchestrator: FailuresOrchestrator, genNumber: number): Failure[] {
    const failureIDs: Failure[] = [];
    const allFailures = failureOrchestrator.getAllFailures();

    if (allFailures.length > 0) {
      const failureGeneratorsTable = this.failurePool[genNumber].split(',');
      for (const failureID of failureGeneratorsTable) {
        if (failureGeneratorsTable.length > 0) {
          const temp = allFailures.find((value) => value.identifier.toString() === failureID);
          if (temp !== undefined) failureIDs.push(temp);
        }
      }
    }
    return failureIDs;
  }
  constructor(
    private readonly randomFailuresGen: RandomFailureGen,
    protected readonly bus: EventBus,
  ) {
    if (this.bus != null) {
      this.bus
        .getSubscriber<FailureGenEvent>()
        .on('refreshData')
        .handle((_value) => {
          this.refreshRequest = true;
          // console.info(`refresh request received: ${this.uniqueGenPrefix}`);
        });
      this.bus
        .getSubscriber<FailureGenEvent>()
        .on('settings')
        .handle(({ generatorType, settingsString }) => {
          // console.info('DISARMED');
          if (generatorType === this.uniqueGenPrefix) {
            // console.info(`settings received: ${generatorType} - ${settingsString}`);
            this.settings = settingsString.split(',').map((it) => parseFloat(it));
          }
        });
      this.bus
        .getSubscriber<FailureGenFailureList>()
        .on('failurePool')
        .handle(({ generatorType, generatorNumber, failureString }) => {
          if (generatorType === this.uniqueGenPrefix) {
            console.info(`failure pool received ${generatorType}${generatorNumber}: ${failureString}`);

            this.failurePool[generatorNumber] = failureString;
          }
        });
    }
  }

  arm(genNumber: number): void {
    this.failureGeneratorArmed[genNumber] = true;
    // console.info('ARMED');
  }

  disarm(genNumber: number): void {
    this.failureGeneratorArmed[genNumber] = false;
    // console.info('DISARMED');
  }

  reset(genNumber: number): void {
    this.disarm(genNumber);
    this.waitForTakeOff[genNumber] = true;
    this.waitForStopped[genNumber] = true;
  }

  loopStartAction(): void {
    //
  }

  additionalGenInitActions(_genNumber: number): void {
    //
  }

  generatorSpecificActions(_genNumber: number): void {
    //
  }

  conditionToTriggerFailure(_genNumber: number): boolean {
    return false;
  }

  additionalFailureTriggeredActions(_genNumber: number): void {
    //
  }

  conditionToArm(_genNumber: number): boolean {
    return false;
  }

  additionalArmingActions(_genNumber: number): void {
    //
  }

  additionalGenEndActions(_genNumber: number): void {
    //
  }

  loopEndAction(): void {
    //
  }

  sendFeedbackModeRequest(): void {
    const generatorType = this.uniqueGenPrefix;
    const mode = this.requestedMode;
    // console.info(`expectedMode sent: ${`${generatorType} - ${mode.toString()}`}`);
    this.bus.getPublisher<FailureGenFeedbackEvent>().pub('expectedMode', { generatorType, mode }, true);
  }

  sendFeedbackArmedDisplay(): void {
    const generatorType = this.uniqueGenPrefix;
    const status = this.failureGeneratorArmed;
    // console.info(`ArmedDisplay sent: ${`${generatorType} - ${status.toString()}`}`);
    this.bus.getPublisher<FailureGenFeedbackEvent>().pub('armingDisplayStatus', { generatorType, status }, true);
  }

  updateFailure(failureOrchestrator: FailuresOrchestrator): void {
    const nbGenerator = Math.floor(this.settings.length / this.numberOfSettingsPerGenerator);
    this.gs = SimVar.GetSimVarValue('GPS GROUND SPEED', 'Knots') || '0';
    this.loopStartAction();

    if (this.requestedMode === undefined) {
      this.requestedMode = [];
      // console.info('DECLARE');
    }

    for (let i = this.previousNbGenerator; i < nbGenerator; i++) {
      this.reset(i);
      this.additionalGenInitActions(i);
      this.requestedMode[i] = FailureGenMode.FailureGenAny;
      // console.info('INIT');
    }
    for (let i = 0; i < nbGenerator; i++) {
      if (
        this.requestedMode[i] === FailureGenMode.FailureGenOff &&
        this.settings[i * this.numberOfSettingsPerGenerator + ArmingModeIndex] <= 0
      ) {
        this.requestedMode[i] = FailureGenMode.FailureGenAny;
        // console.info('REQUEST RESET');
      }
      if (this.settings[i * this.numberOfSettingsPerGenerator + ArmingModeIndex] >= 0) {
        if (this.previousArmingMode[i] !== this.settings[i * this.numberOfSettingsPerGenerator + ArmingModeIndex]) {
          // console.info('RESETTING - ArmingModeChanged');
          this.reset(i);
        }
        if (this.waitForStopped[i] && this.gs < 1) {
          this.waitForStopped[i] = false;
        }
        if (
          this.waitForTakeOff[i] &&
          !this.waitForStopped[i] &&
          this.randomFailuresGen.getFailureFlightPhase() === FailurePhases.TakeOff &&
          this.gs > 1
        ) {
          this.waitForTakeOff[i] = false;
        }
        this.generatorSpecificActions(i);
        if (this.failureGeneratorArmed[i]) {
          if (
            this.settings[i * this.numberOfSettingsPerGenerator + ArmingModeIndex] ===
              FailureGenMode.FailureGenTakeOff &&
            this.gs < 1
          ) {
            this.reset(i);
          } else if (this.conditionToTriggerFailure(i)) {
            const activeFailures = failureOrchestrator.getActiveFailures();
            const numberOfFailureToActivate = Math.min(
              this.settings[i * this.numberOfSettingsPerGenerator + FailuresAtOnceIndex],
              this.settings[i * this.numberOfSettingsPerGenerator + MaxFailuresIndex] - activeFailures.size,
            );
            if (numberOfFailureToActivate > 0) {
              // console.info('FAILURE');
              this.randomFailuresGen.activateRandomFailure(
                this.getGeneratorFailurePool(failureOrchestrator, i),
                failureOrchestrator,
                activeFailures,
                numberOfFailureToActivate,
              );
              this.reset(i);
              if (
                this.settings[i * this.numberOfSettingsPerGenerator + ArmingModeIndex] === FailureGenMode.FailureGenOnce
              ) {
                this.requestedMode[i] = FailureGenMode.FailureGenOff;
              }
              this.additionalFailureTriggeredActions(i);
            }
          }
        }
        if (!this.failureGeneratorArmed[i] && this.requestedMode[i] !== FailureGenMode.FailureGenOff) {
          if (
            (this.settings[i * this.numberOfSettingsPerGenerator + ArmingModeIndex] === FailureGenMode.FailureGenOnce ||
              (this.settings[i * this.numberOfSettingsPerGenerator + ArmingModeIndex] ===
                FailureGenMode.FailureGenTakeOff &&
                !this.waitForTakeOff[i]) ||
              this.settings[i * this.numberOfSettingsPerGenerator + ArmingModeIndex] ===
                FailureGenMode.FailureGenRepeat) &&
            this.conditionToArm(i)
          ) {
            // console.info('ARMING');
            this.arm(i);
            this.additionalArmingActions(i);
          }
        } else if (
          this.settings[i * this.numberOfSettingsPerGenerator + ArmingModeIndex] === FailureGenMode.FailureGenOff
        ) {
          // console.info('RESETTING - Generator is OFF');
          this.reset(i);
        }
      } else if (this.failureGeneratorArmed[i] || this.requestedMode[i] === FailureGenMode.FailureGenOff) {
        // console.info('RESETTING - Generator removed');
        this.reset(i);
      }
      this.previousArmingMode[i] = this.settings[i * this.numberOfSettingsPerGenerator + ArmingModeIndex];
      this.additionalGenEndActions(i);
    }
    this.previousNbGenerator = nbGenerator;
    let feedbackChange: boolean = false;
    for (let i = 0; i < nbGenerator; i++) {
      if (this.previousArmedState[i] !== this.failureGeneratorArmed[i]) {
        feedbackChange = true;
      }
    }
    if (feedbackChange || this.refreshRequest) {
      this.sendFeedbackArmedDisplay();
      this.refreshRequest = false;
    }
    feedbackChange = false;
    for (let i = 0; i < nbGenerator; i++) {
      if (this.previousRequestedMode[i] !== this.requestedMode[i]) {
        feedbackChange = true;
      }
    }
    if (feedbackChange) {
      this.sendFeedbackModeRequest();
    }
    this.previousArmedState = Array.from(this.failureGeneratorArmed);
    this.previousRequestedMode = Array.from(this.requestedMode);
    this.previousNbGenerator = nbGenerator;
    this.loopEndAction();
  }
}
