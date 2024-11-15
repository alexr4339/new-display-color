// Copyright (c) 2021-2023 FlyByWire Simulations
//
// SPDX-License-Identifier: GPL-3.0

import { ClockEvents, DisplayComponent, FSComponent, NodeReference, VNode, Subject, Subscribable } from '@microsoft/msfs-sdk';
import { ArincEventBus, Arinc429Word, Arinc429WordData, Arinc429Register, Arinc429RegisterSubject } from '@flybywiresim/fbw-sdk';
import { ArmedLateralMode, ArmedVerticalMode, isArmed, LateralMode, VerticalMode } from '@shared/autopilot';

import { SimplaneValues } from 'instruments/src/HUD/shared/SimplaneValueProvider';
import { getDisplayIndex } from './HUD';
import { Arinc429Values } from './shared/ArincValueProvider';
import { HUDSimvars } from './shared/HUDSimvarPublisher';
import {
    calculateHorizonOffsetFromPitch,
    calculateVerticalOffsetFromRoll,
    LagFilter,
    getSmallestAngle,
  } from './HUDUtils';
const DistanceSpacing = 1024 / 28 * 5;
const ValueSpacing = 5;

interface FlightPathVectorData {
    roll: Arinc429WordData;
    pitch: Arinc429WordData;
    fpa: Arinc429WordData;
    da: Arinc429WordData;
}



export class FlightPathVector extends DisplayComponent<{ bus: ArincEventBus; isAttExcessive: Subscribable<boolean>;
    filteredRadioAlt: Subscribable<number>  }> {

    private bird = FSComponent.createRef<SVGGElement>();
    private isTrkFpaActive = false;

    //TODO: test Arinc429Register.empty() instead of Arinc429Word(0)
    private data: FlightPathVectorData = {
        roll: new Arinc429Word(0),
        pitch: new Arinc429Word(0),
        fpa: new Arinc429Word(0),
        da: new Arinc429Word(0),
    }
    private needsUpdate = false;

    onAfterRender(node: VNode): void {
        super.onAfterRender(node);

        const sub = this.props.bus.getSubscriber<HUDSimvars & Arinc429Values & ClockEvents>();

        sub.on('fpa').handle((fpa) => {
            this.data.fpa = fpa;
            this.needsUpdate = true;
        });
        sub.on('da').handle((da) => {
            this.data.da = da;
            this.needsUpdate = true;
        });
        sub.on('rollAr').handle((r) => {
            this.data.roll = r;
            this.needsUpdate = true;
        });
        sub.on('pitchAr').handle((p) => {
            this.data.pitch = p;
            this.needsUpdate = true;
        });
        sub.on('realTime').handle((_t) => {
            if (this.needsUpdate) {
                this.needsUpdate = false;
                const daAndFpaValid = this.data.fpa.isNormalOperation() && this.data.da.isNormalOperation();
                if (daAndFpaValid) {
                    this.bird.instance.classList.remove('HiddenElement');
                    this.moveBird();
                } else {
                    this.bird.instance.classList.add('HiddenElement');
                }
            }
        });
    }

    private moveBird() {
        const daLimConv = this.data.da.value * DistanceSpacing / ValueSpacing;
        const pitchSubFpaConv = (calculateHorizonOffsetFromPitch(this.data.pitch.value) - calculateHorizonOffsetFromPitch(this.data.fpa.value));
        const rollCos = Math.cos(this.data.roll.value * Math.PI / 180);
        const rollSin = Math.sin(-this.data.roll.value * Math.PI / 180);

        const xOffset = daLimConv * rollCos - pitchSubFpaConv * rollSin;
        const yOffset = pitchSubFpaConv * rollCos + daLimConv * rollSin;

        this.bird.instance.style.transform = `translate3d(${xOffset}px, ${yOffset - 182.86}px, 0px)`;
    }

    render(): VNode {
        return (
            <>
                <g ref={this.bird} id="bird">
                    <g id="FlightPathVector">
                        <circle
                            class="SmallStroke Green"
                            cx="640"
                            cy="512"
                            r="16"
                        />
                        <path
                            class="SmallStroke Green"
                            d="m 590,512 h 34"
                        />
                        <path
                            class="SmallStroke Green"
                            d="m 656,512 h 34"
                        />
                        <path
                            class="SmallStroke Green"
                            d="M 640,496 v -16"
                        />

                    </g>
                    <TotalFlightPathAngle bus={this.props.bus} />
                    <FlightPathDirector bus={this.props.bus} />
                    <SelectedFlightPathAngle bus={this.props.bus} />
                    <DeltaSpeed bus={this.props.bus} />
                    <RadioAltAndDH
                        bus={this.props.bus}
                        filteredRadioAltitude={this.props.filteredRadioAlt}
                        attExcessive={this.props.isAttExcessive}
                    /> 
                    <FlareIndicator bus={this.props.bus}/>
                </g>
            </>
        );
    }
}

// FIXME the same logic with the speed trend tape. Need confirmation.

export class TotalFlightPathAngle extends DisplayComponent<{ bus: ArincEventBus }> {
    private refElement = FSComponent.createRef<SVGGElement>();

    private vCTrend = new Arinc429Word(0);

    onAfterRender(node: VNode): void {
        super.onAfterRender(node);

        const sub = this.props.bus.getArincSubscriber<Arinc429Values>();

        sub.on('vCTrend').withArinc429Precision(2).handle((word) => {
            this.vCTrend = word;

            if (this.vCTrend.isNormalOperation()) {
                this.refElement.instance.style.visibility = 'visible';
                const offset = -this.vCTrend.value * 28 / 5;
                this.refElement.instance.style.transform = `translate3d(0px, ${offset}px, 0px)`;
            } else {
                this.refElement.instance.style.visibility = 'hidden';
            }
        });
    }

    render(): VNode | null {
        return (
            <g id="TotalFlightPathAngle" ref={this.refElement}>
                <path class="SmallStroke Green" d="m 574,500 12,12 -12,12" />
                <path class="SmallStroke Green" d="m 706,500 -12,12 12,12" />
            </g>
        );
    }
}

interface FlightPathDirectorData {
    roll: Arinc429WordData;
    pitch: Arinc429WordData;
    fpa: Arinc429WordData;
    da: Arinc429WordData;
    activeVerticalMode: number;
    activeLateralMode: number;
    fdRoll: number;
    fdPitch: number;
    fdActive: boolean;
}

export class FlightPathDirector extends DisplayComponent<{bus: ArincEventBus}> {
    private flightPhase = -1;
    private declutterMode = 0;
    private crosswindMode = false;
    private sVisibility = Subject.create<String>('');

    private data: FlightPathDirectorData = {
        roll: new Arinc429Word(0),
        pitch: new Arinc429Word(0),
        fpa: new Arinc429Word(0),
        da: new Arinc429Word(0),
        fdPitch: 0,
        fdRoll: 0,
        fdActive: true,
        activeLateralMode: 0,
        activeVerticalMode: 0,
    }

    private isTrkFpaActive = false;

    private needsUpdate = false;

    private isVisible = false;

    private birdPath = FSComponent.createRef<SVGGElement>();

    // private birdPathWings = FSComponent.createRef<SVGGElement>();

    onAfterRender(node: VNode): void {
        super.onAfterRender(node);

        const sub = this.props.bus.getSubscriber<HUDSimvars & Arinc429Values & ClockEvents>();

        sub.on('fwcFlightPhase').whenChanged().handle((fp) => {
            this.flightPhase = fp;
            if(fp < 5 || fp >= 9){
              this.sVisibility.set("none");
            }
            if(fp > 4 && fp < 9){
              this.sVisibility.set("block");
            }
          });
        
          sub.on('declutterMode').whenChanged().handle((value) => {
              this.flightPhase = SimVar.GetSimVarValue('L:A32NX_FWC_FLIGHT_PHASE','Number');
              this.declutterMode = value;
          });


        sub.on('fd1Active').whenChanged().handle((fd) => {
            if (getDisplayIndex() === 1) {
                this.data.fdActive = fd;
                this.needsUpdate = true;
            }
        });

        sub.on('fd2Active').whenChanged().handle((fd) => {
            if (getDisplayIndex() === 2) {
                this.data.fdActive = fd;
                this.needsUpdate = true;
            }
        });
        sub.on('trkFpaActive').whenChanged().handle((a) => {
            this.isTrkFpaActive = a;
            this.needsUpdate = true;
        });

        sub.on('fpa').handle((fpa) => {
            this.data.fpa = fpa;
            this.needsUpdate = true;
        });

        sub.on('da').handle((da) => {
            this.data.da = da;
            this.needsUpdate = true;
        });

        sub.on('activeVerticalMode').whenChanged().handle((vm) => {
            this.data.activeLateralMode = vm;
            this.needsUpdate = true;
        });

        sub.on('activeLateralMode').whenChanged().handle((lm) => {
            this.data.activeLateralMode = lm;
            this.needsUpdate = true;
        });

        sub.on('fdPitch').handle((fdp) => {
            this.data.fdPitch = fdp;
            this.needsUpdate = true;
        });

        sub.on('fdBank').handle((fdr) => {
            this.data.fdRoll = fdr;
            this.needsUpdate = true;
        });

        sub.on('rollAr').handle((r) => {
            this.data.roll = r;
            this.needsUpdate = true;
        });

        sub.on('pitchAr').handle((p) => {
            this.data.pitch = p;
            this.needsUpdate = true;
        });

        sub.on('realTime').handle((_t) => {
            this.handlePath();
            if (this.needsUpdate && this.isVisible) {
                this.moveBird();
            }
        });
    }

    private handlePath() {
        const daAndFpaValid = this.data.fpa.isNormalOperation() && this.data.da.isNormalOperation();
        if (!this.data.fdActive || !daAndFpaValid) {
            this.birdPath.instance.style.visibility = 'hidden';
            this.isVisible = false;
        } else {
            this.birdPath.instance.style.visibility = 'visible';
            this.isVisible = true;
        }
    }

    private moveBird() {
        // if (this.data.fdActive && this.isTrkFpaActive) {
        if (this.data.fdActive) {
            const FDRollOrder = this.data.fdRoll;
            // FIXME assume that the FPD reaches the wing of the bird when roll order is +-45
            const FDRollOrderLim = Math.max(Math.min(FDRollOrder, 10), -10) * 3.4;
            const FDPitchOrder = this.data.fdPitch;
            const FDPitchOrderLim = Math.max(Math.min(FDPitchOrder, 5), -5) * DistanceSpacing / ValueSpacing;

            const rollCos = Math.cos(this.data.roll.value * Math.PI / 180);
            const rollSin = Math.sin(-this.data.roll.value * Math.PI / 180);

            const xOffset = -FDPitchOrderLim * rollSin + FDRollOrderLim * rollCos;
            const yOffset = FDPitchOrderLim * rollCos + FDRollOrderLim * rollSin;

            this.birdPath.instance.style.transform = `translate3d(${xOffset}px, ${yOffset}px, 0px)`;
        }
        this.needsUpdate = false;
    }

    render(): VNode {
        return (

            <g ref={this.birdPath} id="FlighPathDirector" display={this.sVisibility}>
                <circle
                    class="SmallStroke Green"
                    cx="640"
                    cy="512"
                    r="10"
                />
            </g>

        );
    }
}

export class SelectedFlightPathAngle extends DisplayComponent<{ bus: ArincEventBus }> {
    private refElement = FSComponent.createRef<SVGGElement>();

    private vCTrend = new Arinc429Word(0);

    private text = '';

    private fdActive = false;

    private isTrkFpaActive = false;

    private needsUpdate = false;

    private selectedFpa = 0;

    private selectFpaChanged = false;

    private activeVerticalMode = VerticalMode.NONE;

    private armedVerticalMode = VerticalMode.NONE;

    onAfterRender(node: VNode): void {
        super.onAfterRender(node);

        const sub = this.props.bus.getArincSubscriber<HUDSimvars & Arinc429Values & ClockEvents>();

        sub.on('fd1Active').whenChanged().handle((fd) => {
            if (getDisplayIndex() === 1) {
                this.fdActive = fd;
                this.needsUpdate = true;
            }
        });

        sub.on('fd2Active').whenChanged().handle((fd) => {
            if (getDisplayIndex() === 2) {
                this.fdActive = fd;
                this.needsUpdate = true;
            }
        });

        sub.on('trkFpaActive').whenChanged().handle((a) => {
            this.isTrkFpaActive = a;
            this.needsUpdate = true;
        });

        sub.on('activeVerticalMode').whenChanged().handle((vm) => {
            this.activeVerticalMode = vm;
            this.needsUpdate = true;
        });

        sub.on('selectedFpa').whenChanged().handle((a) => {
            this.selectedFpa = a;
            if (this.activeVerticalMode === VerticalMode.FPA) {
                this.selectFpaChanged = true;
            }
            const offset = -this.selectedFpa * 1024 / 28;
            this.refElement.instance.style.transform = `translate3d(0px, ${offset}px, 0px)`;
            this.needsUpdate = true;
        });

        sub.on('fmaVerticalArmed').whenChanged().handle((vm) => {
            this.armedVerticalMode = vm;
            this.needsUpdate = true;
        });

        sub.on('realTime').handle((_t) => {
            if (this.needsUpdate) {
                this.needsUpdate = false;

                if (this.fdActive && this.selectFpaChanged) {
                    this.selectFpaChanged = false;
                    this.refElement.instance.style.visibility = 'visible';
                    this.refElement.instance.classList.remove('Apear5s');
                    this.refElement.instance.classList.add('Apear5s');
                } else if (this.fdActive && this.armedVerticalMode === VerticalMode.FPA) {
                    this.refElement.instance.classList.remove('Apear5s');
                    this.refElement.instance.style.visibility = 'visible';
                } else {
                    this.refElement.instance.style.visibility = 'hidden';
                }
            }
        });
    }

    render(): VNode | null {
        return (
            <g id="SelectedFlightPathAngle" ref={this.refElement}>
                <circle class="ScaledStroke Green" cx="640" cy="512" r="5" />
                <text class="FontLarge StartAlign Green" x="518" y="682">{this.text}</text>
            </g>
        );
    }
}

interface SpeedStateInfo {
    speed: Arinc429WordData,
    selectedTargetSpeed: number,
    managedTargetSpeed: number,
    holdValue: number,
    isSelectedSpeed: boolean,
    isMach: boolean,
}

class DeltaSpeed extends DisplayComponent <{ bus: ArincEventBus }> {
    private flightPhase = -1;
    private declutterMode = 0;
    private crosswindMode = false;
    private sVisibility = Subject.create<String>('');
    private speedRefs : NodeReference<SVGElement>[] = [];

    private needsUpdate = true;

    private speedState: SpeedStateInfo = {
        speed: new Arinc429Word(0),
        selectedTargetSpeed: 100,
        managedTargetSpeed: 100,
        holdValue: 100,
        isSelectedSpeed: false,
        isMach: false,
    }

    onAfterRender(node: VNode): void {
        super.onAfterRender(node);
        this.needsUpdate = true;

        const sub = this.props.bus.getArincSubscriber<HUDSimvars & SimplaneValues & ClockEvents & Arinc429Values>();
        
        sub.on('fwcFlightPhase').whenChanged().handle((fp) => {
            this.flightPhase = fp;
            // preflight, taxi
            if(fp < 5 || fp >= 8){
                this.sVisibility.set("none");
            }else{
                this.sVisibility.set("block");
            }
            
            // TODO use fmgc flighphase to all declutter in approach and landing mode 
            if(fp > 2 && fp < 9){
              this.sVisibility.set("block");
            }
          });
        sub.on('isSelectedSpeed').whenChanged().handle((s) => {
            this.speedState.isSelectedSpeed = s;
            this.needsUpdate = true;
        });

        sub.on('speedAr').withArinc429Precision(2).handle((s) => {
            this.speedState.speed = s;
            this.needsUpdate = true;
        });

        sub.on('holdValue').whenChanged().handle((s) => {
            this.speedState.holdValue = s;
            this.needsUpdate = true;
        });

        sub.on('machActive').whenChanged().handle((s) => {
            this.speedState.isMach = s;
            this.needsUpdate = true;
        });

        sub.on('targetSpeedManaged').whenChanged().handle((s) => {
            this.speedState.managedTargetSpeed = s;
            this.needsUpdate = true;
        });

        sub.on('realTime').handle(this.onFrameUpdate.bind(this));
    }

    private setVisible(refNum: number[]) {
        for (let i = 0; i < 6; i++) {
            if (refNum.includes(i)) {
                this.speedRefs[i].instance.style.visibility = 'visible';
            } else {
                this.speedRefs[i].instance.style.visibility = 'hidden';
            }
        }
    }

    private onFrameUpdate(_realTime: number): void {
        if (this.needsUpdate === true) {
            this.needsUpdate = false;

            if (this.speedState.isSelectedSpeed) {
                if (this.speedState.isMach) {
                    const holdValue = this.speedState.holdValue;
                    this.speedState.selectedTargetSpeed = SimVar.GetGameVarValue('FROM MACH TO KIAS', 'number', holdValue === null ? undefined : holdValue);
                } else {
                    this.speedState.selectedTargetSpeed = this.speedState.holdValue;
                }
            }

            const deltaSpeed = this.speedState.speed.value - (this.speedState.isSelectedSpeed ? this.speedState.selectedTargetSpeed : this.speedState.managedTargetSpeed);
            const sign = Math.sign(deltaSpeed);

            if (Math.abs(deltaSpeed) < 1) {
                this.setVisible([0]);
            } else if (Math.abs(deltaSpeed) < 10) {
                this.speedRefs[1].instance.setAttribute('d', `m 595,512 v ${-deltaSpeed * 4.6} h 12 v ${deltaSpeed * 4.6}`);
                this.speedRefs[2].instance.setAttribute('d', `m 601,512 v ${-deltaSpeed * 4.6}`);
                this.setVisible([1, 2]);
            } else if (Math.abs(deltaSpeed) < 20) {
                this.speedRefs[1].instance.setAttribute('d', `m 595,512 v ${-deltaSpeed * 4.6} h 12 v ${deltaSpeed * 4.6}`);
                this.speedRefs[2].instance.setAttribute('d', `m 601,512 v ${-sign * 46}`);
                this.speedRefs[3].instance.style.transform = `translate3d(0px, ${-sign * 46}px, 0px)`;
                this.speedRefs[4].instance.setAttribute('d', `m 601,${512 - sign * 46} v ${-sign * (Math.abs(deltaSpeed) - 10) * 4.6}`);
                this.setVisible([1, 2, 3, 4]);
            } else {
                this.speedRefs[5].instance.style.transform = `translate3d(0px, ${-sign * 46}px, 0px)`;
                this.setVisible([5]);
            }
        }
    }

    render(): VNode {
        for (let i = 0; i < 6; i++) {
            this.speedRefs.push(FSComponent.createRef<SVGPathElement>());
        }
        return (
            <>
            <g id="DeltaSpeedGroup" display={this.sVisibility}>
                <path ref={this.speedRefs[0]} class="ScaledStroke CornerRound Green" d="m 595,507.4 h 12 v 9.2 h -12 z" style="visibility:hidden" />
                <path ref={this.speedRefs[1]} class="ScaledStroke CornerRound Green" style="visibility:hidden" />
                <path ref={this.speedRefs[2]} class="ScaledStroke CornerRound Green" style="visibility:hidden" />
                <path ref={this.speedRefs[3]} class="ScaledStroke CornerRound Green" d="m 595,512 h 12" style="visibility:hidden" />
                <path ref={this.speedRefs[4]} class="ScaledStroke CornerRound Green" style="visibility:hidden" />
                <g ref={this.speedRefs[5]} class="ScaledStroke CornerRound Green" style="visibility:hidden">
                    <path d="m 595,466 v 92" />
                    <path d="m 601,466 v 92" />
                    <path d="m 607,466 v 92" />
                </g>
            </g>
            </>
        );
    }
}

class RadioAltAndDH extends DisplayComponent<{
    bus: ArincEventBus;
    filteredRadioAltitude: Subscribable<number>;
    attExcessive: Subscribable<boolean>;
  }> {
    private sVisibility = Subject.create('none');
    private sFlareVisibility = Subject.create('none');
    private daRaGroup = FSComponent.createRef<SVGGElement>();
  
    private roll = new Arinc429Word(0);
  
    private readonly dh = Arinc429RegisterSubject.createEmpty();
  
    private filteredRadioAltitude = 0;
  
    private radioAltitude = new Arinc429Word(0);
  
    private transAltAr = Arinc429Register.empty();
  
    private transLvlAr = Arinc429Register.empty();
  
    private fmgcFlightPhase = 0;
  
    private altitude = new Arinc429Word(0);
  
    private attDhText = FSComponent.createRef<SVGTextElement>();
  
    private radioAltText = Subject.create('0');
  
    private radioAlt = FSComponent.createRef<SVGTextElement>();
  
    private classSub = Subject.create('');
  
    onAfterRender(node: VNode): void {
      super.onAfterRender(node);
  
      const sub = this.props.bus.getArincSubscriber<HUDSimvars & Arinc429Values>();
  
      sub.on('rollAr').handle((roll) => {
        this.roll = roll;
      });
  
      sub
        .on('fmTransAltRaw')
        .whenChanged()
        .handle((ta) => {
          this.transAltAr.set(ta);
        });
  
      sub
        .on('fmTransLvlRaw')
        .whenChanged()
        .handle((tl) => {
          this.transLvlAr.set(tl);
        });
  
      sub
        .on('fwcFlightPhase')
        .whenChanged()
        .handle((fp) => {
          this.fmgcFlightPhase = fp;
          (fp >= 4 && fp <= 9) ? this.sVisibility.set("block") : this.sVisibility.set('none');
        });
  
      sub.on('altitudeAr').handle((a) => {
        this.altitude = a;
      });
  
      sub.on('chosenRa').handle((ra) => {
        if (!this.props.attExcessive.get()) {
          this.radioAltitude = ra;
          const raFailed = !this.radioAltitude.isFailureWarning();
          const raHasData = !this.radioAltitude.isNoComputedData();
          const raValue = this.filteredRadioAltitude;
          const verticalOffset = calculateVerticalOffsetFromRoll(this.roll.value);
          const useTransAltVsLvl = this.fmgcFlightPhase <= 3;
          const chosenTransalt = useTransAltVsLvl ? this.transAltAr : this.transLvlAr;
          const belowTransitionAltitude =
            chosenTransalt.isNormalOperation() &&
            !this.altitude.isNoComputedData() &&
            this.altitude.value < (useTransAltVsLvl ? chosenTransalt.value : chosenTransalt.value * 100);
          let size = 'FontMedium';
          const dh = this.dh.get();
          const DHValid = dh.value >= 0 && !dh.isNoComputedData() && !dh.isFailureWarning();
  
          let text = '';
          let color = 'Amber';
  
          if (raHasData) {
            if (raFailed) {
              if (raValue < 2500) {
                if (raValue > 400 || (raValue > dh.value + 100 && DHValid)) {
                  color = 'Green';
                }
                if (raValue < 400) {
                  size = 'FontMedium';
                }
                if (raValue < 5) {
                  
                  text = Math.round(raValue).toString();
                } else if (raValue <= 50) {
                  text = (Math.round(raValue / 5) * 5).toString();
                } else if (raValue > 50 || (raValue > dh.value + 100 && DHValid)) {
                  text = (Math.round(raValue / 10) * 10).toString();
                }
              }
            } else {
              color = belowTransitionAltitude ? 'Red Blink9Seconds' : 'Red';
              text = 'RA';
            }

            (raValue < 5) ? this.sVisibility.set('none') : this.sVisibility.set('block');      


          }
  
          this.daRaGroup.instance.style.transform = `translate3d(0px, ${-verticalOffset}px, 0px)`;
          if (raFailed && DHValid && raValue <= dh.value) {
            this.attDhText.instance.style.visibility = 'visible';
          } else {
            this.attDhText.instance.style.visibility = 'hidden';
          }
          this.radioAltText.set(text);
          this.classSub.set(`${size} ${color} MiddleAlign TextOutline`);
        }
      });
  
      this.props.filteredRadioAltitude.sub((fra) => {
        this.filteredRadioAltitude = fra;
      }, true);
  
      this.props.attExcessive.sub((ae) => {
        if (ae) {
          this.radioAlt.instance.style.visibility = 'hidden';
        } else {
          this.radioAlt.instance.style.visibility = 'visible';
        }
      });
  
      sub.on('fmDhRaw').handle(this.dh.setWord.bind(this.dh));
    }
  
    render(): VNode {
      return (
        <g ref={this.daRaGroup} id="DHAndRAGroup" display={this.sVisibility}>
          <text
            ref={this.attDhText}
            id="AttDHText"
            x="0"
            y="0"
            class="FontMedium Amber MiddleAlign Blink9Seconds TextOutline"
            transform="translate(640 600)"
          >
            DH
          </text>
          <text ref={this.radioAlt} id="RadioAlt" x="0" y="0" transform="translate(640 600)" class={this.classSub}>
            {this.radioAltText}
          </text>
        </g>
      );
    }
  }


  
class FlareIndicator extends DisplayComponent<{
    bus: ArincEventBus;
  }> {
    private sVisibility = Subject.create('none');
    private flareGroup = FSComponent.createRef<SVGGElement>();
    onAfterRender(node: VNode): void {
      super.onAfterRender(node);
  
      const sub = this.props.bus.getArincSubscriber<HUDSimvars & Arinc429Values>();
  
        sub.on('activeVerticalMode').whenChanged().handle((v) =>{
            v === VerticalMode.FLARE ? this.sVisibility.set('block') : this.sVisibility.set('none'); 
        })
    }
  
    render(): VNode {
      return (
        <g ref={this.flareGroup} id="FlareArrows" display={this.sVisibility}>
            <path class="SmallStroke Green" d="m 615,512 v -32"  />
            <path class="SmallStroke Green" d="m 609,496 l 6 -16  l 6 16"  />
            <path class="SmallStroke Green" d="m 665,512 v -32"  />
            <path class="SmallStroke Green" d="m 659,496 l 6 -16  l 6 16"  />
        </g>
      );
    }
  }