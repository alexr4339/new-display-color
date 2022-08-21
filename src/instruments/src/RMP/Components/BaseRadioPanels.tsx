import React, { useState, useRef } from 'react';
import useInterval from '@instruments/common/useInterval';
import { useSimVar, useInteractionSimVar } from '@instruments/common/simVars';
import { useInteractionEvent } from '@instruments/common/hooks';
import { TransceiverType } from './StandbyFrequency';
import { VhfRadioPanel } from './VhfRadioPanel';
import { HfRadioPanel } from './HfRadioPanel';
import { NavRadioPanel } from './NavRadioPanel';
import { RadioPanelDisplay } from './RadioPanelDisplay';

interface Props {
    /**
     * The RMP side (e.g. 'L' or 'R').
     */
    side: string,
}

/**
 * Root radio management panel React component.
 * Hooks into toggleSwitch and powerAvailable SimVars.
 * Renders a Powered or Unpowered sub-component.
 */
export const RootRadioPanel = (props: Props) => {
    const toggleSwitchName = `A32NX_RMP_${props.side}_TOGGLE_SWITCH`;
    const [panelSwitch] = useInteractionSimVar(`L:${toggleSwitchName}`, 'Boolean', toggleSwitchName);
    // On the A320 the captain's RMP is powered by the DC ESS BUS. The F/O's RMP by the DC 2 BUS.
    const [powerAvailable] = useSimVar(`L:A32NX_ELEC_${props.side === 'L' ? 'DC_ESS' : 'DC_2'}_BUS_IS_POWERED`, 'Boolean', 250);
    const powered = powerAvailable && panelSwitch;

    if (!powered) return <UnpoweredRadioPanel />;
    return <PoweredRadioPanel side={props.side} />;
};

/**
 * If a radio panel is unpowered, we render two empty <svg> to ensure the correct vertical spacing.
 * E.g. if left RMP is off but right RMP is on, we need the left RMP space to be reserved.
 */
const UnpoweredRadioPanel = () => (
    <span>
        <svg />
        <svg />
    </span>
);

/**
 * Powered radio management panel React component.
 * Hooks into panelMode SimVar and wires RMP mode buttons.
 * Renders appropriate mode sub-component (e.g. VhfRadioPanel).
 */
const PoweredRadioPanel = (props: Props) => {
    const [navReceiverType, setNavReceiverType] = useState(TransceiverType.ILS);
    const [nbTicks, setnbTicks] = useState(0);

    // Used to turn on the associated led
    const [panelMode, setPanelMode] = useSimVar(`L:A32NX_RMP_${props.side}_SELECTED_MODE`, 'Number', 250);
    // Used to determine (in the FGMC for instance) if the system is in NAV backup mode. L and R simvars have to be checked
    const [navButtonPressed, setNavButton] = useSimVar(`L:A32NX_RMP_${props.side}_NAV_BUTTON_SELECTED`, 'boolean', 250);
    // Used to return to the selected VHF once NAV is pushed again
    const [previousPanelMode, setPreviousPanelMode] = useState(panelMode);
    const [indexTransceiver, setIndexTransceiver] = useState(props.side === 'L' ? 1 : 2);

    const [ilsKnobPushed] = useSimVar(`L:A32NX_ACP_NAV_${props.side}_ILS_Knob_Volume_Down`, 'Boolean');
    const [vor1KnobPushed] = useSimVar(`L:A32NX_ACP_NAV_${props.side}_VOR1_Knob_Volume_Down`, 'Boolean');
    const [vor2KnobPushed] = useSimVar(`L:A32NX_ACP_NAV_${props.side}_VOR2_Knob_Volume_Down`, 'Boolean');
    const [adf1KnobPushed] = useSimVar(`L:A32NX_ACP_NAV_${props.side}_ADF1_Knob_Volume_Down`, 'Boolean');
    const [adf2KnobPushed] = useSimVar(`L:A32NX_ACP_NAV_${props.side}_ADF2_Knob_Volume_Down`, 'Boolean');

    const nbTicksRef = useRef(nbTicks);
    nbTicksRef.current = nbTicks;

    const ilsKnobPushedRef = useRef(ilsKnobPushed);
    ilsKnobPushedRef.current = ilsKnobPushed;

    const vor1KnobPushedRef = useRef(vor1KnobPushed);
    vor1KnobPushedRef.current = vor1KnobPushed;

    const vor2KnobPushedRef = useRef(vor2KnobPushed);
    vor2KnobPushedRef.current = vor2KnobPushed;

    const adf1KnobPushedRef = useRef(adf1KnobPushed);
    adf1KnobPushedRef.current = adf1KnobPushed;

    const adf2KnobPushedRef = useRef(adf2KnobPushed);
    adf2KnobPushedRef.current = adf2KnobPushed;

    // Hook radio management panel mode buttons to set panelMode SimVar.
    useInteractionEvent(`A32NX_RMP_${props.side}_VHF1_BUTTON_PRESSED`, () => {
        setPanelMode(1);
        setPreviousPanelMode(1);
        setIndexTransceiver(1);
    });

    useInteractionEvent(`A32NX_RMP_${props.side}_VHF2_BUTTON_PRESSED`, () => {
        setPanelMode(2);
        setPreviousPanelMode(2);
        setIndexTransceiver(2);
    });

    useInteractionEvent(`A32NX_RMP_${props.side}_VHF3_BUTTON_PRESSED`, () => {
        setPanelMode(3);
        setPreviousPanelMode(3);
        setIndexTransceiver(3);
    });

    useInteractionEvent(`A32NX_RMP_${props.side}_HF1_BUTTON_PRESSED`, () => {
        setPanelMode(4);
        setPreviousPanelMode(4);
        setIndexTransceiver(1);
    });

    useInteractionEvent(`A32NX_RMP_${props.side}_HF2_BUTTON_PRESSED`, () => {
        setPanelMode(5);
        setPreviousPanelMode(5);
        setIndexTransceiver(2);
    });

    useInteractionEvent(`A32NX_RMP_${props.side}_NAV_BUTTON_PRESSED`, () => {
        if (navButtonPressed) {
            setPanelMode(previousPanelMode);
        }

        setNavButton(!navButtonPressed);
    });

    useInteractionEvent(`A32NX_RMP_${props.side}_VOR_BUTTON_PRESSED`, () => {
        if (navButtonPressed) {
            setPanelMode(6);
            setNavReceiverType(TransceiverType.VOR);
        }
    });

    useInteractionEvent(`A32NX_RMP_${props.side}_ILS_BUTTON_PRESSED`, () => {
        if (navButtonPressed) {
            setPanelMode(7);
            setNavReceiverType(TransceiverType.ILS);
        }
    });

    useInterval(() => {
        if (nbTicksRef.current === 0 && ilsKnobPushedRef.current) {

        } else {
            if (vor1KnobPushedRef.current) {

            }

            if (vor2KnobPushedRef.current) {

            }

            if (adf1KnobPushedRef.current) {

            }

            if (adf2KnobPushedRef.current) {

            }
        }

        nbTicksRef.current++;

        // Every 40 seconds, the DME is broadcast
        if (nbTicksRef.current === 3) {
            nbTicksRef.current = 0;
        }
    }, 10_000);

    /**
     * MLS IMPLEMENTED IN THE XML BEHAVIOURS
     * BUT DISABLED HERE SINCE THERE IS NOT ENOUGH REFERENCES
     */
    // useInteractionEvent(`A32NX_RMP_${props.side}_MLS_BUTTON_PRESSED`, () => {
    //     if (navButtonPressed) {
    //         setPanelMode(8);
    //         setNavTransceiverType(TransceiverType.ILS);
    //     }
    // });

    useInteractionEvent(`A32NX_RMP_${props.side}_ADF_BUTTON_PRESSED`, () => {
        if (navButtonPressed) {
            setPanelMode(9);
            setNavReceiverType(TransceiverType.ADF);
        }
    });

    switch (panelMode) {
    case 1:
    case 2:
    case 3:
        return (<VhfRadioPanel side={props.side} vhf={indexTransceiver} />);
    case 4:
    case 5:
        return (<HfRadioPanel side={props.side} hf={indexTransceiver} />);
    case 6:
    case 7:
    case 9:
        return (<NavRadioPanel side={props.side} receiver={navReceiverType} />);
    default:
        // If we reach this block, something's gone wrong. We'll just render a broken panel.
        return (
            <span>
                <RadioPanelDisplay value="808.080" />
                <RadioPanelDisplay value="808.080" />
            </span>
        );
    }
};
