#include "ATCServices.h"
#include <algorithm>

#define SELCAL_LIGHT_TIME_MS 300
#define FLASHING_LIGHTS_TIMEOUT_MS 60000

ATCServices::ATCServices(HANDLE hSimConnect) : _hSimConnect(hSimConnect) {}

void ATCServices::initialize() {
  _selcalLVar = register_named_variable("A32NX_ACP_SELCAL");
  _selcalResetLVar = register_named_variable("A32NX_ACP_RESET");
  _volumeCOM1ACP1LVar = register_named_variable("A32NX_ACP1_Volume_VHF1");
  _volumeCOM1ACP2LVar = register_named_variable("A32NX_ACP2_Volume_VHF1");
  _volumeCOM1ACP3LVar = register_named_variable("A32NX_ACP3_Volume_VHF1");
  _volumeCOM2ACP1LVar = register_named_variable("A32NX_ACP1_Volume_VHF2");
  _volumeCOM2ACP2LVar = register_named_variable("A32NX_ACP2_Volume_VHF2");
  _volumeCOM2ACP3LVar = register_named_variable("A32NX_ACP3_Volume_VHF2");
  _knobCOM1ACP1LVar = register_named_variable("A32NX_ACP1_VHF1_Knob_Volume_Down");
  _knobCOM1ACP2LVar = register_named_variable("A32NX_ACP2_VHF1_Knob_Volume_Down");
  _knobCOM1ACP3LVar = register_named_variable("A32NX_ACP3_VHF1_Knob_Volume_Down");
  _knobCOM2ACP1LVar = register_named_variable("A32NX_ACP1_VHF2_Knob_Volume_Down");
  _knobCOM2ACP2LVar = register_named_variable("A32NX_ACP2_VHF2_Knob_Volume_Down");
  _knobCOM2ACP3LVar = register_named_variable("A32NX_ACP3_VHF2_Knob_Volume_Down");
  _updateATCServicesFromACPsLVar = register_named_variable("A32NX_COM_updateATCServicesFromACPsLVar");

  _isInitialized = true;

  notifyATCServicesStart();

  std::cout << "FLYPAD_BACKEND (ATCServices): ATCServices initialized" << std::endl;
}

void ATCServices::shutdown() {
  _isInitialized = false;
  std::cout << "FLYPAD_BACKEND (ATCServices): ATCServices shutdown" << std::endl;
}

void ATCServices::onUpdate(INT64 volumeCOM1, INT64 volumeCOM2, ATCServicesDataIVAO* IVAOData, ATCServicesDataVPILOT* VPILOTData) {
  if (!_isInitialized)
    return;

  if (IVAOData) {
    this->_selcalActive = IVAOData->selcal;
    std::cout << "UPDATE IVAO " << (unsigned)IVAOData->volumeCOM1 << "     Previous was " << (unsigned)this->_previousVolumeCOM1
              << std::endl;
    if ((unsigned)IVAOData->volumeCOM1 != (unsigned)this->_previousVolumeCOM1) {
      double volumeCOM1over100 = IVAOData->volumeCOM1 / 100.0;

      std::cout << "New Volume COM1 from IVAO " << (unsigned)IVAOData->volumeCOM1 << "     Previous was "
                << (unsigned)this->_previousVolumeCOM1 << std::endl;

      set_named_variable_value(_volumeCOM1ACP1LVar, volumeCOM1over100);
      set_named_variable_value(_volumeCOM1ACP2LVar, volumeCOM1over100);
      set_named_variable_value(_volumeCOM1ACP3LVar, volumeCOM1over100);

      std::string calculator_code = std::to_string(IVAOData->volumeCOM1);
      calculator_code += " (>K:COM1_VOLUME_SET)";
      execute_calculator_code(calculator_code.c_str(), nullptr, nullptr, nullptr);

      this->_previousVolumeCOM1 = IVAOData->volumeCOM1;
    }

    if ((unsigned)IVAOData->volumeCOM2 != (unsigned)this->_previousVolumeCOM2) {
      double volumeCOM2over100 = IVAOData->volumeCOM2 / 100.0;

      std::cout << "New Volume COM2 from IVAO " << (unsigned)IVAOData->volumeCOM2 << "     Previous was "
                << (unsigned)this->_previousVolumeCOM2 << std::endl;

      set_named_variable_value(_volumeCOM2ACP1LVar, volumeCOM2over100);
      set_named_variable_value(_volumeCOM2ACP2LVar, volumeCOM2over100);
      set_named_variable_value(_volumeCOM2ACP3LVar, volumeCOM2over100);

      std::string calculator_code = std::to_string(IVAOData->volumeCOM2);
      calculator_code += " (>K:COM2_VOLUME_SET)";
      execute_calculator_code(calculator_code.c_str(), nullptr, nullptr, nullptr);

      this->_previousVolumeCOM2 = IVAOData->volumeCOM2;
    }
  } else if (VPILOTData) {
    this->_selcalActive = VPILOTData->selcal;
  } else {
    bool update = false;

    auto now = std::chrono::system_clock::now();
    auto diff = std::chrono::duration_cast<std::chrono::milliseconds>(now - this->_previousTime).count();

    if (get_named_variable_value(_selcalResetLVar) == 0 && diff < FLASHING_LIGHTS_TIMEOUT_MS) {
      if (this->_selcalActive) {
        // Makes the push button blink every SELCAL_LIGHT_TIME_MS
        // It sets the BLINK_ID (foundable in the XML behaviors) then 0 to make it blink
        if (diff >= SELCAL_LIGHT_TIME_MS) {
          set_named_variable_value(_selcalLVar, get_named_variable_value(_selcalLVar) == this->_selcalActive ? 0 : this->_selcalActive);
          this->_previousTime = now;
        }
      }
    } else {
      // Reset everything related to SELCAL if RESET push button was pressed on one ACP
      // OR 60s have passed (according to FCOM)
      set_named_variable_value(_selcalResetLVar, 0);
      set_named_variable_value(_selcalLVar, 0);
      this->_selcalActive = 0;
      update = true;

      this->_previousTime = now;
    }

    // In case the volume was changed via the knobs on the ACPs
    if (get_named_variable_value(_updateATCServicesFromACPsLVar) == 1 &&
        ((unsigned)volumeCOM1 != (unsigned)this->_previousVolumeCOM1 || (unsigned)volumeCOM2 != (unsigned)this->_previousVolumeCOM2)) {
      std::cout << "New Volume COM1 from ACP " << (unsigned)volumeCOM1 << "     Previous was " << (unsigned)this->_previousVolumeCOM1
                << std::endl;
      std::cout << "New Volume COM2 from ACP " << (unsigned)volumeCOM2 << "     Previous was " << (unsigned)this->_previousVolumeCOM2
                << std::endl;

      this->_previousVolumeCOM1 = volumeCOM1;
      this->_previousVolumeCOM2 = volumeCOM2;

      update = true;

      set_named_variable_value(_updateATCServicesFromACPsLVar, 0);
    }

    if (update) {
      ATCServicesDataIVAO IVAODataTmp{this->_selcalActive, (uint8_t)this->_previousVolumeCOM1, (uint8_t)this->_previousVolumeCOM2};
      ATCServicesDataVPILOT VPILOTDataTmp{1, this->_selcalActive};

      setATCServicesDataIVAO(IVAODataTmp);
      setATCServicesDataVPILOT(VPILOTDataTmp);
    }
  }
}

void ATCServices::notifyATCServicesPause() const {
  ATCServicesDataVPILOT dataVPILOT{0, 0};
  setATCServicesDataVPILOT(dataVPILOT);

  ATCServicesDataIVAO dataIVAO{0, 0, 0};
  setATCServicesDataIVAO(dataIVAO);
}

/// @brief Notifying the third party the plane is unloaded
void ATCServices::notifyATCServicesShutdown() {
  // In MSFS's start/stop sequence, start and stop events are called twice therefore
  // we have to uninit it to make notifyATCServicesStart ineffective
  _isInitialized = false;
  notifyATCServicesPause();
}

/// @brief Notifying the third party the plane is loaded
void ATCServices::notifyATCServicesStart() const {
  if (_isInitialized) {
    ATCServicesDataIVAO dataIVAO{0, 80, 40};
    setATCServicesDataIVAO(dataIVAO);

    // notifying vPilot the aircraft is loaded
    ATCServicesDataVPILOT dataVPILOT{1, 0};
    setATCServicesDataVPILOT(dataVPILOT);
  }
}
