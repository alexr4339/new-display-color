#pragma once

#include <MSFS/Legacy/gauges.h>
#include <SimConnect.h>

#include "AutopilotLaws.h"
#include "AutopilotStateMachine.h"
#include "Autothrust.h"
#include "EngineData.h"
#include "FlapsHandler.h"
#include "FlightDataRecorder.h"
#include "FlyByWire.h"
#include "InterpolatingLookupTable.h"
#include "RateLimiter.h"
#include "SimConnectInterface.h"
#include "SpoilersHandler.h"
#include "ThrottleAxisMapping.h"

class FlyByWireInterface {
 public:
  bool connect();

  void disconnect();

  bool update(double sampleTime);

 private:
  const std::string CONFIGURATION_FILEPATH = "\\work\\ModelConfiguration.ini";

  double previousSimulationTime = 0;

  int currentApproachCapability = 0;
  double previousApproachCapabilityUpdateTime = 0;

  bool flightDirectorSmoothingEnabled = false;
  double flightDirectorSmoothingFactor = 0;
  double flightDirectorSmoothingLimit = 0;
  bool customFlightGuidanceEnabled = false;
  bool gpsCourseToSteerEnabled = false;
  bool autopilotStateMachineEnabled = false;
  bool autopilotLawsEnabled = false;
  bool flyByWireEnabled = false;
  bool autoThrustEnabled = false;
  bool tailstrikeProtectionEnabled = true;

  bool pauseDetected = false;
  bool wasInSlew = false;

  bool flightDirectorConnectLatch_1 = false;
  bool flightDirectorConnectLatch_2 = false;
  bool flightDirectorDisconnectLatch_1 = false;
  bool flightDirectorDisconnectLatch_2 = false;

  bool autolandWarningLatch = false;
  bool autolandWarningTriggered = false;

  double flightGuidanceCrossTrackError = 0.0;
  double flightGuidanceTrackAngleError = 0.0;
  double flightGuidancePhiPreCommand = 0.0;

  double flightControlsKeyChangeAileron = 0.0;
  double flightControlsKeyChangeElevator = 0.0;
  double flightControlsKeyChangeRudder = 0.0;

  FlightDataRecorder flightDataRecorder;

  SimConnectInterface simConnectInterface;

  FlyByWireModelClass flyByWire;
  FlyByWireModelClass::ExternalInputs_FlyByWire_T flyByWireInput = {};

  AutopilotStateMachineModelClass autopilotStateMachine;
  AutopilotStateMachineModelClass::ExternalInputs_AutopilotStateMachine_T autopilotStateMachineInput = {};
  ap_raw_laws_input autopilotStateMachineOutput;

  AutopilotLawsModelClass autopilotLaws;
  AutopilotLawsModelClass::ExternalInputs_AutopilotLaws_T autopilotLawsInput = {};
  ap_raw_output autopilotLawsOutput;

  AutothrustModelClass autoThrust;
  AutothrustModelClass::ExternalInputs_Autothrust_T autoThrustInput = {};
  athr_output autoThrustOutput;

  InterpolatingLookupTable throttleLookupTable;

  ID idExternalOverride;

  ID idFdrEvent;

  ID idSideStickPositionX;
  ID idSideStickPositionY;

  ID idFmaLateralMode;
  ID idFmaLateralArmed;
  ID idFmaVerticalMode;
  ID idFmaVerticalArmed;
  ID idFmaSoftAltModeActive;
  ID idFmaCruiseAltModeActive;
  ID idFmaExpediteModeActive;
  ID idFmaSpeedProtectionActive;
  ID idFmaApproachCapability;

  ID idFlightDirectorBank;
  ID idFlightDirectorPitch;
  ID idFlightDirectorYaw;

  ID idAutopilotAutolandWarning;

  ID idAutopilotActiveAny;
  ID idAutopilotActive_1;
  ID idAutopilotActive_2;

  ID idAutopilotAutothrustMode;

  ID idFcuTrkFpaModeActive;
  ID idFcuSelectedFpa;
  ID idFcuSelectedVs;
  ID idFcuSelectedHeading;

  ID idFcuLocModeActive;
  ID idFcuApprModeActive;
  ID idFcuModeReversionActive;
  ID idFcuModeReversionTrkFpaActive;

  ID idFlightGuidanceAvailable;
  ID idFlightGuidanceCrossTrackError;
  ID idFlightGuidanceTrackAngleError;
  ID idFlightGuidancePhiCommand;

  ID idFwcFlightPhase;
  ID idFmgcFlightPhase;
  ID idFmgcV2;
  ID idFmgcV_APP;
  ID idFmgcV_LS;
  ID idFmgcV_MAX;
  ID idFmgcAltitudeConstraint;
  ID idFmgcThrustReductionAltitude;
  ID idFmgcThrustReductionAltitudeGoAround;
  ID idFmgcAccelerationAltitude;
  ID idFmgcAccelerationAltitudeEngineOut;
  ID idFmgcAccelerationAltitudeGoAround;
  ID idFmgcAccelerationAltitudeGoAroundEngineOut;
  ID idFmgcCruiseAltitude;
  ID idFmgcFlexTemperature;
  ID idFmgcDirToTrigger;

  ID idAirConditioningPack_1;
  ID idAirConditioningPack_2;

  double thrustLeverAngle_1 = 0.0;
  double thrustLeverAngle_2 = 0.0;
  ID idAutothrust_TLA_1;
  ID idAutothrust_TLA_2;
  ID idAutothrustN1_TLA_1;
  ID idAutothrustN1_TLA_2;
  ID idAutothrustReverse_1;
  ID idAutothrustReverse_2;
  ID idAutothrustThrustLimitType;
  ID idAutothrustThrustLimit;
  ID idAutothrustN1_c_1;
  ID idAutothrustN1_c_2;
  ID idAutothrustStatus;
  ID idAutothrustMode;
  ID idAutothrustModeMessage;
  ID idThrottlePosition3d_1;
  ID idThrottlePosition3d_2;
  InterpolatingLookupTable idThrottlePositionLookupTable3d;

  std::vector<std::shared_ptr<ThrottleAxisMapping>> throttleAxis;

  EngineData engineData = {};
  ID engineEngine1EGT;
  ID engineEngine2EGT;
  ID engineEngine1FF;
  ID engineEngine2FF;
  ID engineEngine1PreFF;
  ID engineEngine2PreFF;
  ID engineEngineImbalance;
  ID engineFuelUsedLeft;
  ID engineFuelUsedRight;
  ID engineFuelLeftPre;
  ID engineFuelRightPre;
  ID engineFuelAuxLeftPre;
  ID engineFuelAuxRightPre;
  ID engineFuelCenterPre;
  ID engineEngineCrank;
  ID engineEngineCycleTime;
  ID enginePreFlightPhase;
  ID engineActualFlightPhase;

  ID idFlapsHandleIndex;
  ID idFlapsHandlePercent;
  std::shared_ptr<FlapsHandler> flapsHandler;

  ID idSpoilersArmed;
  ID idSpoilersHandlePosition;
  std::shared_ptr<SpoilersHandler> spoilersHandler;

  void loadConfiguration();
  void setupLocalVariables();

  bool readDataAndLocalVariables(double sampleTime);

  bool updateEngineData(double sampleTime);

  bool updateAutopilotStateMachine(double sampleTime);
  bool updateAutopilotLaws(double sampleTime);
  bool updateFlyByWire(double sampleTime);
  bool updateAutothrust(double sampleTime);

  bool updateFlapsSpoilers(double sampleTime);

  double smoothFlightDirector(double sampleTime, double factor, double limit, double currentValue, double targetValue);

  double getHeadingAngleError(double u1, double u2);
};
