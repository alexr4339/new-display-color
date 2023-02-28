import { Arinc429Word } from '@shared/arinc429';
import { DIR2 } from './DIR2';
import { Director } from './Director';
import { FlightPhaseManager } from '../managers/FlightPhaseManager';
import { DirectorMemory } from './DirectorMemory';
import { Cids } from '../CidsConstants';

export class DIR1 extends Director {
    private isInit: boolean;

    private dir2: DIR2;

    private flightPhaseManager: FlightPhaseManager;

    public memory: DirectorMemory;

    constructor() {
        super();

        this.memory = new DirectorMemory();

        /* Instantiate Managers */
        this.flightPhaseManager = new FlightPhaseManager(this, 1);
        // new managers here...

        this.isInit = false;
    }

    public init(dir2: DIR2): void {
        console.log('[CIDS/DIR1] Initializing...');
        this.dir2 = dir2;

        this.isInit = true;
    }

    public update(): void {
        if (!this.isInit) {
            throw new Error('[CIDS/DIR1] update() was called before initialization!');
        }

        if (this.isFaulty()) return;

        this.updateActiveState();

        this.writeMemory();

        if (Cids.DEBUG) {
            if (this.isFaulty()) {
                console.warn('[CIDS/DIR1] Director fault -> no simvars to set');
            } else {
                const set = SimVar.SetSimVarValue;
                const varname = 'L:A32NX_CIDS_DEBUG_DIR_1';

                set(`${varname}_FWC_FLIGHT_PHASE`, 'number', this.memory.fwcFlightPhase);
                set(`${varname}_ALL_DOORS_CLSD_LCKED`, 'Bool', this.memory.allDoorsClosedLocked);
                set(`${varname}_NW_STRG_DISC`, 'Bool', this.memory.nwStrgPinInserted);
                set(`${varname}_THR_LVR_1_POS`, 'number', this.memory.thrustLever1Position);
                set(`${varname}_THR_LVR_2_POS`, 'number', this.memory.thrustLever2Position);
                set(`${varname}_GPWS_FLAP_3`, 'Bool', this.memory.gpwsFlap3);
                set(`${varname}_FLAPS_CONF`, 'number', this.memory.flapsConfig);
                set(`${varname}_ALT`, 'number', this.memory.altitude);
                set(`${varname}_FCU_SEL_ALT`, 'number', this.memory.fcuSelectedAlt);
                set(`${varname}_FMA_VERT_MODE`, 'number', this.memory.fmaVerticalMode);
                set(`${varname}_FPA_SEL`, 'number', this.memory.fpaSelected);
                set(`${varname}_VS_SEL`, 'number', this.memory.vsSelected);
                set(`${varname}_CRZ_ALT`, 'number', this.memory.cruiseAltitude);
                set(`${varname}_ALT_CRZ_ACTIVE`, 'Bool', this.memory.altCrzActive);
                set(`${varname}_GS`, 'number', this.memory.groundSpeed);
                set(`${varname}_GEAR_DWN_LCKD`, 'Bool', this.memory.gearDownLocked);

                set('L:A32NX_CIDS_DEBUG_BOARDING_IN_PROGRESS', 'Bool', this.boardingInProgress);
                set('L:A32NX_CIDS_DEBUG_DEBOARDING_IN_PROGRESS', 'Bool', this.deboardingInProgress);
                set('L:A32NX_CIDS_DEBUG_TOTAL_PAX', 'number', this.totalPax);
                set('L:A32NX_CIDS_DEBUG_TOTAL_PAX_DESIRED', 'number', this.totalPaxDesired);
            }
        }

        /* Update Managers */
        this.flightPhaseManager.update();

        this.memory.clear();
    }

    public startup(): void {
        if (!this.isInit) {
            throw new Error('[CIDS/DIR1] startup() was called before initialization!');
        }

        console.log('[CIDS/DIR1] Booting...');

        // Should BITE ever be implemented a power up test should be performed before setting these simvars
        this.output(Cids.SimVar.DIR1.FAULT, 'Bool', false, null, true);
        this.output(Cids.SimVar.DIR1.ACTIVE, 'Bool', true, null, true);

        this.writeMemory();

        /* Initialize Managers */
        this.flightPhaseManager.init();

        this.memory.clear();
    }

    public shutdown(): void {
        console.log('[CIDS/DIR1] Shutting down...');

        this.memory.clear();
        this.output(Cids.SimVar.FLIGHT_PHASE, 'Enum', 0, null, true);
        this.output(Cids.SimVar.DIR1.FAULT, 'Bool', false, null, true);
        this.output(Cids.SimVar.DIR1.ACTIVE, 'Bool', false, null, true);
    }

    public fail(cause: string): void {
        if (this.isFaulty() && !this.isActive()) { // Prevent unnecessary simvar sets
            return;
        }
        this.memory.clear();
        this.output(Cids.SimVar.DIR1.ACTIVE, 'Bool', false, null, true);
        if (Cids.DEBUG) {
            this.output(Cids.SimVar.DIR1.FAULT, 'Bool', true, () => console.log(`[CIDS/DIR1] FAULT - Cause: ${cause}`), true);
        } else {
            this.output(Cids.SimVar.DIR1.FAULT, 'Bool', true, null, true);
        }
    }

    public isFaulty(): boolean {
        return !!SimVar.GetSimVarValue(Cids.SimVar.DIR1.FAULT, 'Bool');
    }

    public isActive(): boolean {
        return !!SimVar.GetSimVarValue(Cids.SimVar.DIR1.ACTIVE, 'Bool');
    }

    /**
     * Reads data from all physically connected systems and writes them to memory.
     */
    private writeMemory(): void {
        this.memory.fwcFlightPhase = SimVar.GetSimVarValue('L:A32NX_FWC_FLIGHT_PHASE', 'Enum');
        this.memory.onGround = this.isOnGround();
        this.memory.allDoorsClosedLocked = SimVar.GetSimVarValue('INTERACTIVE POINT OPEN:0', 'percent') < 20
                                    && SimVar.GetSimVarValue('INTERACTIVE POINT OPEN:3', 'percent') < 20
                                    && SimVar.GetSimVarValue('L:A32NX_FWD_DOOR_CARGO_LOCKED', 'Bool');
        this.memory.nwStrgPinInserted = SimVar.GetSimVarValue('L:A32NX_HYD_NW_STRG_DISC_ECAM_MEMO', 'Bool');
        this.memory.thrustLever1Position = SimVar.GetSimVarValue('L:A32NX_AUTOTHRUST_TLA:1', 'number');
        this.memory.thrustLever2Position = SimVar.GetSimVarValue('L:A32NX_AUTOTHRUST_TLA:2', 'number');
        this.memory.gpwsFlap3 = SimVar.GetSimVarValue('L:A32NX_GPWS_FLAPS3', 'Bool');
        this.memory.flapsConfig = SimVar.GetSimVarValue('L:A32NX_FLAPS_HANDLE_INDEX', 'number'); // TODO: This should use ARINC429 once both SFCCs are implemented.
        this.memory.altitude = this.decodeAltitude();
        this.memory.fcuSelectedAlt = Simplane.getAutoPilotDisplayedAltitudeLockValue(); // TODO: This should use ARINC429 once https://github.com/flybywiresim/a32nx/pull/7587 is merged.
        this.memory.fmaVerticalMode = SimVar.GetSimVarValue('L:A32NX_FMA_VERTICAL_MODE', 'Enum');
        this.memory.fpaSelected = SimVar.GetSimVarValue('L:A32NX_AUTOPILOT_FPA_SELECTED', 'degrees');
        this.memory.vsSelected = SimVar.GetSimVarValue('L:A32NX_AUTOPILOT_VS_SELECTED', 'feet per minute');
        this.memory.cruiseAltitude = SimVar.GetSimVarValue('L:AIRLINER_CRUISE_ALTITUDE', 'number');
        this.memory.altCrzActive = SimVar.GetSimVarValue('L:A32NX_FMA_CRUISE_ALT_MODE', 'Bool');
        this.memory.groundSpeed = this.decodeGroundSpeed();
        this.memory.gearDownLocked = this.isGearDownLocked();

        this.totalPax = this.getTotalPax();
        this.totalPaxDesired = this.getTotalPaxDesired();
        this.boardingInProgress = this.isBoardingInProgress();
        this.deboardingInProgress = this.isDeboardingInProgess();
    }

    private updateActiveState(): void {
        if (this.isActive()) {
            if (!this.isFaulty()) {
                this.output(Cids.SimVar.DIR1.ACTIVE, 'Bool', true, null, true);
            } else if (!this.dir2.isFaulty()) {
                this.output(Cids.SimVar.DIR1.ACTIVE, 'Bool', false, null, true);
            } else {
                this.output(Cids.SimVar.DIR1.ACTIVE, 'Bool', true, null, true);
            }
        } else if (this.dir2.isActive()) {
            this.output(Cids.SimVar.DIR1.ACTIVE, 'Bool', false, null, true);
        } else {
            this.output(Cids.SimVar.DIR1.ACTIVE, 'Bool', true, null, true);
        }
    }

    private decodeAltitude(): number {
        const alt1 = new Arinc429Word(SimVar.GetSimVarValue('L:A32NX_ADIRS_ADR_1_ALTITUDE', 'number'));
        const alt3 = new Arinc429Word(SimVar.GetSimVarValue('L:A32NX_ADIRS_ADR_3_ALTITUDE', 'number'));

        if (alt1.isNormalOperation()) {
            return alt1.value;
        }
        if (alt3.isNormalOperation()) {
            return alt3.value;
        }
        if (this.memory.fwcFlightPhase === 1 || this.memory.fwcFlightPhase === 10) return 0;

        this.fail('Invalid ADR data (altitude)');
        return 0;
    }

    private decodeGroundSpeed(): number {
        const gs1 = new Arinc429Word(SimVar.GetSimVarValue('L:A32NX_ADIRS_IR_1_GROUND_SPEED', 'number'));
        const gs3 = new Arinc429Word(SimVar.GetSimVarValue('L:A32NX_ADIRS_IR_3_GROUND_SPEED', 'number'));

        if (gs1.isNormalOperation()) {
            return gs1.value;
        }
        if (gs3.isNormalOperation()) {
            return gs3.value;
        }
        if (gs1.isNoComputedData() || gs3.isNoComputedData() && (this.memory.fwcFlightPhase === 1 || this.memory.fwcFlightPhase === 10)) {
            return 0;
        }

        this.fail('Invalid IR data (GS)');
        return 0;
    }

    private isGearDownLocked(): boolean {
        const lgciu1Discrete = new Arinc429Word(SimVar.GetSimVarValue('L:A32NX_LGCIU_1_DISCRETE_WORD_1', 'number'));

        if (lgciu1Discrete.isNormalOperation()) {
            return lgciu1Discrete.getBitValue(25);
        }

        this.fail('Invalid LGCIU data (gear down locked)');
        return false;
    }

    private isOnGround(): boolean {
        const lgciu1Discrete = new Arinc429Word(SimVar.GetSimVarValue('L:A32NX_LGCIU_1_DISCRETE_WORD_2', 'number'));

        if (lgciu1Discrete.isNormalOperation()) {
            return lgciu1Discrete.getBitValue(12);
        }

        this.fail('Invalid LGCIU data (A/C on ground)');
        return false;
    }
}
