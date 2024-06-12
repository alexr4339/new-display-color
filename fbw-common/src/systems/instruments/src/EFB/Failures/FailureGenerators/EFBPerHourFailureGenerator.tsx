// Copyright (c) 2021-2023 FlyByWire Simulations
//
// SPDX-License-Identifier: GPL-3.0

import { usePersistentProperty } from '@flybywiresim/fbw-sdk';

import React, { useMemo, useState } from 'react';
import {
  FailureGenContext,
  FailureGenData,
  FailureGenMode,
  ModalContext,
  setNewSetting,
} from 'instruments/src/EFB/Failures/FailureGenerators/EFBRandomFailureGen';
import {
  FailureGeneratorSingleSetting,
  FailureGeneratorText,
} from 'instruments/src/EFB/Failures/FailureGenerators/EFBFailureGeneratorSettingsUI';
import { t } from '@flybywiresim/flypad';

const settingName = 'EFB_FAILURE_GENERATOR_SETTING_PERHOUR';
const defaultNumberOfFailuresAtOnce = 1;
const defaultMaxNumberOfFailures = 2;
const defaultProbabilityPerHour = 0.1;
const additionalSetting = [
  FailureGenMode.FailureGenRepeat,
  defaultNumberOfFailuresAtOnce,
  defaultMaxNumberOfFailures,
  defaultProbabilityPerHour,
];
const numberOfSettingsPerGenerator = 4;
const uniqueGenPrefix = 'C';
const genName = 'PerHour';
const alias = () => t('Failures.Generators.GenPerHour');
const disableTakeOffRearm = false;
const FailurePerHourIndex = 3;

export const failureGenConfigPerHour: () => FailureGenData = () => {
  const [setting, setSetting] = usePersistentProperty(settingName);
  const [armedState, setArmedState] = useState<boolean[]>();
  const settings = useMemo(() => {
    const splitString = setting?.split(',');
    if (splitString) return splitString.map((it: string) => parseFloat(it));
    return [];
  }, [setting]);

  return {
    setSetting,
    settings,
    setting,
    numberOfSettingsPerGenerator,
    uniqueGenPrefix,
    additionalSetting,
    genName,
    alias,
    disableTakeOffRearm,
    generatorSettingComponents,
    armedState,
    setArmedState,
  };
};

const daysPerMonth = 30.4368 * 24;
const daysPerYear = 365.24219 * 24;

const generatorSettingComponents = (
  genNumber: number,
  modalContext: ModalContext,
  failureGenContext: FailureGenContext,
) => {
  const settings = modalContext.failureGenData.settings;
  const MttfDisplay = () => {
    if (settings[genNumber * numberOfSettingsPerGenerator + FailurePerHourIndex] <= 0)
      return t('Failures.Generators.Disabled');
    const meanTimeToFailure = 1 / settings[genNumber * numberOfSettingsPerGenerator + FailurePerHourIndex];
    if (meanTimeToFailure >= daysPerYear * 2)
      return `${Math.round(meanTimeToFailure / daysPerYear)} ${t('Failures.Generators.years')}`;
    if (meanTimeToFailure >= daysPerMonth * 2)
      return `${Math.round(meanTimeToFailure / daysPerMonth)} ${t('Failures.Generators.months')}`;
    if (meanTimeToFailure >= 24 * 3) return `${Math.round(meanTimeToFailure / 24)} ${t('Failures.Generators.days')}`;
    if (meanTimeToFailure >= 5) return `${Math.round(meanTimeToFailure)} ${t('Failures.Generators.hours')}`;
    if (meanTimeToFailure > 5 / 60) return `${Math.round(meanTimeToFailure * 60)} ${t('Failures.Generators.minutes')}`;
    return `${Math.round(meanTimeToFailure * 60 * 60)} ${t('Failures.Generators.seconds')}`;
  };

  const settingTable = [
    <FailureGeneratorSingleSetting
      title={t('Failures.Generators.FailurePerHour')}
      unit=""
      min={0}
      max={60}
      value={settings[genNumber * numberOfSettingsPerGenerator + FailurePerHourIndex]}
      mult={1}
      setNewSetting={setNewSetting}
      generatorSettings={modalContext.failureGenData}
      genIndex={genNumber}
      settingIndex={FailurePerHourIndex}
      failureGenContext={failureGenContext}
    />,
    <FailureGeneratorText title={t('Failures.Generators.MeanTimeToFailure')} unit="" text={MttfDisplay()} />,
  ];

  return settingTable;
};
