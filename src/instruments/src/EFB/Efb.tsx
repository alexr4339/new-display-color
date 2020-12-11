/*
 * A32NX
 * Copyright (C) 2020 FlyByWire Simulations and its contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import React from "react";

import { getSimbriefData, IFuel, IWeights } from './SimbriefApi';
import StatusBar from "./StatusBar/StatusBar";
import ToolBar from "./ToolBar/ToolBar";
import DashboardWidget from "./Dashboard/DasshboardWidget";

import './Efb.scss';

import 'material-design-icons/iconfont/material-icons.css'
import LoadsheetWidget from "./Loadsheet/LoadsheetWidget";
import Settings from "./Settings/Settings";
import Profile from "./Profile/Profile";

type EfbProps = {
    logo: string,
};

type EfbState = {
    currentPageIndex: 0 | 1 | 2 | 3 | 4 | 5,
    simbriefUsername: string;
    departingAirport: string;
    departingIata: string;
    arrivingAirport: string;
    arrivingIata: string;
    flightDistance: string;
    flightETAInSeconds: string;
    currentTime: Date,
    initTime: Date,
    timeSinceStart: string,
    weights: IWeights,
    fuels: IFuel,
    units: string,
    altIcao: string,
    altIata: string,
    altBurn: number,
    tripTime: number,
    contFuelTime: number,
    resFuelTime: number,
    taxiOutTime: number,
};

class Efb extends React.Component<EfbProps, EfbState> {
    constructor(props: EfbProps) {
        super(props);
        this.updateCurrentTime = this.updateCurrentTime.bind(this);
        this.updateTimeSinceStart = this.updateTimeSinceStart.bind(this);
        this.fetchSimbriefData = this.fetchSimbriefData.bind(this);
    }

    state: EfbState = {
        currentPageIndex: 0,
        departingAirport: 'N/A',
        departingIata: 'N/A',
        arrivingAirport: 'N/A',
        arrivingIata: 'N/A',
        simbriefUsername: this.fetchSimbriefUsername(),
        flightDistance: 'N/A',
        flightETAInSeconds: 'N/A',
        currentTime: new Date(),
        initTime: new Date(),
        timeSinceStart: "00:00",
        weights: {
            cargo: 0,
            estLandingWeight: 0,
            estTakeOffWeight: 0,
            estZeroFuelWeight: 0,
            maxLandingWeight: 0,
            maxTakeOffWeight: 0,
            maxZeroFuelWeight: 0,
            passengerCount: 0,
            passengerWeight: 0,
            payload: 0,
        },
        fuels: {
            avgFuelFlow: 0,
            contingency: 0,
            enrouteBurn: 0,
            etops: 0,
            extra: 0,
            maxTanks: 0,
            minTakeOff: 0,
            planLanding: 0,
            planRamp: 0,
            planTakeOff: 0,
            reserve: 0,
            taxi: 0,
        },
        units: "kgs",
        altIcao: "N/A",
        altIata: "N/A",
        altBurn: 0,
        tripTime: 0,
        contFuelTime: 0,
        resFuelTime: 0,
        taxiOutTime: 0
    }

    updateCurrentTime(currentTime: Date) {
        this.setState({currentTime: currentTime});
    }

    updateTimeSinceStart(timeSinceStart: string) {
        this.setState({timeSinceStart: timeSinceStart});
    }

    fetchSimbriefUsername() {
        const username = window.localStorage.getItem("SimbriefUsername");
        if (username === null) {
            return '';
        } else {
            return username;
        }
    }

    async fetchSimbriefData() {
        if (!this.state.simbriefUsername) {
            return;
        }

        console.log("Fetching simbriefData");
        const simbriefData = await getSimbriefData(this.state.simbriefUsername);
        console.info(simbriefData);
        this.setState({
            departingAirport:    simbriefData.origin.icao,
            departingIata:       simbriefData.origin.iata,
            arrivingAirport:     simbriefData.destination.icao,
            arrivingIata:        simbriefData.destination.iata,
            flightDistance:      simbriefData.distance,
            flightETAInSeconds:  simbriefData.flightETAInSeconds,
            weights: {
                cargo:              simbriefData.weights.cargo,
                estLandingWeight:   simbriefData.weights.estLandingWeight,
                estTakeOffWeight:   simbriefData.weights.estTakeOffWeight,
                estZeroFuelWeight:  simbriefData.weights.estZeroFuelWeight,
                maxLandingWeight:   simbriefData.weights.maxLandingWeight,
                maxTakeOffWeight:   simbriefData.weights.maxTakeOffWeight,
                maxZeroFuelWeight:  simbriefData.weights.maxZeroFuelWeight,
                passengerCount:     simbriefData.weights.passengerCount,
                passengerWeight:    simbriefData.weights.passengerWeight,
                payload:            simbriefData.weights.payload,
            },
            fuels: {
                avgFuelFlow:     simbriefData.fuel.avgFuelFlow,
                contingency:     simbriefData.fuel.contingency,
                enrouteBurn:     simbriefData.fuel.enrouteBurn,
                etops:           simbriefData.fuel.etops,
                extra:           simbriefData.fuel.extra,
                maxTanks:        simbriefData.fuel.maxTanks,
                minTakeOff:      simbriefData.fuel.minTakeOff,
                planLanding:     simbriefData.fuel.planLanding,
                planRamp:        simbriefData.fuel.planRamp,
                planTakeOff:     simbriefData.fuel.planTakeOff,
                reserve:         simbriefData.fuel.reserve,
                taxi:            simbriefData.fuel.taxi,
            },
            units:              simbriefData.units,
            altIcao:            simbriefData.alternate.icao,
            altIata:            simbriefData.alternate.iata,
            altBurn:            simbriefData.alternate.burn,
            tripTime:           simbriefData.times.est_time_enroute,
            contFuelTime:       simbriefData.times.contfuel_time,
            resFuelTime:        simbriefData.times.reserve_time,
            taxiOutTime:        simbriefData.times.taxi_out
        });
    }

    changeSimbriefUsername = (event: React.ChangeEvent<HTMLInputElement>) => {
        this.setState({ simbriefUsername: event.target.value.toString() });
        window.localStorage.setItem("SimbriefUsername", event.target.value.toString());
    }

    currentPage() {
        switch (this.state.currentPageIndex) {
            case 1:
                return <LoadsheetWidget
                    weights={this.state.weights}
                    fuels={this.state.fuels}
                    units={this.state.units}
                    arrivingAirport={this.state.arrivingAirport}
                    arrivingIata={this.state.arrivingIata}
                    departingAirport={this.state.departingAirport}
                    departingIata={this.state.departingIata}
                    altBurn={this.state.altBurn}
                    altIcao={this.state.altIcao}
                    altIata={this.state.altIata}
                    tripTime={this.state.tripTime}
                    contFuelTime={this.state.contFuelTime}
                    resFuelTime={this.state.resFuelTime}
                    taxiOutTime={this.state.taxiOutTime}
                />;
            case 2:
                return <h1>Page 2</h1>;
            case 3:
                return <h1>Page 3</h1>;
            case 4:
                return <h1>Page 4</h1>;
            case 5:
                return <Settings/>;
            default:
                return <DashboardWidget
                    departingAirport={this.state.departingAirport}
                    arrivingAirport={this.state.arrivingAirport}
                    flightDistance={this.state.flightDistance}
                    flightETAInSeconds={this.state.flightETAInSeconds}
                    timeSinceStart={this.state.timeSinceStart}
                />;
        }
    }

    render() {
        return (
            <div>
                <StatusBar initTime={this.state.initTime} updateCurrentTime={this.updateCurrentTime} updateTimeSinceStart={this.updateTimeSinceStart}/>
                <ToolBar setPageIndex={(index) => this.setState({ currentPageIndex: index })} logo={this.props.logo} fetchSimbrief={this.fetchSimbriefData}/>
                <div id="main-container">
                    {this.currentPage()}
                </div>
            </div>
        );
    }
}

export default Efb;
