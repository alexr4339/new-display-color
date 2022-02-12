import React, { FC, useEffect, useState } from 'react';
import { Metar } from '@flybywiresim/api-client';
import { IconCloud, IconDroplet, IconGauge, IconPoint, IconTemperature, IconWind } from '@tabler/icons';
import { MetarParserType } from '@instruments/common/metarTypes';
import { usePersistentProperty } from '@instruments/common/persistence';
import { parseMetar } from '../../Utils/parseMetar';
import ColoredMetar from './ColorMetar';
import { SimpleInput } from '../../UtilComponents/Form/SimpleInput/SimpleInput';
import { useAppDispatch } from '../../Store/store';
import { setUserDepartureIcao, setUserDestinationIcao } from '../../Store/features/dashboard';

const MetarParserTypeProp: MetarParserType = {
    raw_text: '',
    raw_parts: [],
    color_codes: [],
    icao: '',
    observed: new Date(0),
    wind: {
        degrees: 0,
        degrees_from: 0,
        degrees_to: 0,
        speed_kts: 0,
        speed_mps: 0,
        gust_kts: 0,
        gust_mps: 0,
    },
    visibility: {
        miles: '',
        miles_float: 0.0,
        meters: '',
        meters_float: 0.0,
    },
    conditions: [],
    clouds: [],
    ceiling: {
        code: '',
        feet_agl: 0,
        meters_agl: 0,
    },
    temperature: {
        celsius: 0,
        fahrenheit: 0,
    },
    dewpoint: {
        celsius: 0,
        fahrenheit: 0,
    },
    humidity_percent: 0,
    barometer: {
        hg: 0,
        kpa: 0,
        mb: 0,
    },
    flight_category: '',
};

interface WeatherWidgetProps { name: 'origin'|'destination'; simbriefIcao: string; userIcao: string}

export const WeatherWidget:FC<WeatherWidgetProps> = ({ name, simbriefIcao, userIcao }) => {
    const [metar, setMetar] = useState<MetarParserType>(MetarParserTypeProp);
    const [showMetar, setShowMetar] = usePersistentProperty(`CONFIG_SHOW_METAR_${name}`, 'DISABLED');
    const [baroType] = usePersistentProperty('CONFIG_INIT_BARO_UNIT', 'HPA');
    const dispatch = useAppDispatch();
    const [simbriefIcaoAtLoading, setSimbriefIcaoAtLoading] = useState(simbriefIcao);
    const [metarSource] = usePersistentProperty('CONFIG_METAR_SRC', 'MSFS');
    const source = metarSource === 'MSFS' ? 'MS' : metarSource;

    const getBaroTypeForAirport = (icao: string) => (['K', 'C', 'M', 'P', 'RJ', 'RO', 'TI', 'TJ']
        .some((r) => icao.toUpperCase().startsWith(r)) ? 'IN HG' : 'HPA');

    const BaroValue = () => {
        const displayedBaroType = baroType === 'AUTO' ? getBaroTypeForAirport(metar.icao) : baroType;
        if (displayedBaroType === 'IN HG') {
            return (
                <>
                    {metar.barometer.hg.toFixed(2)}
                    {' '}
                    inHg
                </>
            );
        }
        return (
            <>
                {metar.barometer.mb.toFixed(0)}
                {' '}
                mb
            </>
        );
    };

    const handleIcao = (icao: string) => {
        if (name === 'origin') {
            dispatch(setUserDepartureIcao(icao));
        } else {
            dispatch(setUserDestinationIcao(icao));
        }
        if (icao.length === 4) {
            getMetar(icao, source);
        } else if (icao.length === 0) {
            getMetar(simbriefIcao, source);
        }
    };

    function getMetar(icao:any, source: any) {
        if (icao.length !== 4 || icao === '----') {
            return new Promise(() => {
                setMetar(MetarParserTypeProp);
            });
        }
        return Metar.get(icao, source)
            .then((result) => {
                const metarParse = parseMetar(result.metar);
                setMetar(metarParse);
            })
            .catch(() => {
                setMetar(MetarParserTypeProp);
            });
    }

    useEffect(() => {
        // if we have new simbrief data that is different from the simbrief data at
        // loading of the widget we overwrite the user input once. After that
        // user input has priority.
        if (simbriefIcao !== simbriefIcaoAtLoading) {
            dispatch(setUserDepartureIcao(''));
            dispatch(setUserDestinationIcao(''));
            getMetar(simbriefIcao, source);
            setSimbriefIcaoAtLoading(simbriefIcao);
        } else {
            getMetar(userIcao || simbriefIcao, source);
        }
    }, [simbriefIcao, userIcao, source]);

    return (
        <div>
            {metar === undefined
                ? <p>Loading ...</p>
                : (
                    <>
                        <div className="inline-flex items-center mb-8 w-80">
                            <div className="ml-6">
                                <IconCloud size={35} stroke={1.5} strokeLinejoin="miter" />
                            </div>
                            <SimpleInput
                                noLabel
                                className="ml-4 w-32 text-2xl font-medium text-center uppercase"
                                placeholder={simbriefIcao}
                                value={userIcao || simbriefIcao}
                                onChange={(value) => handleIcao(value)}
                                maxLength={4}
                            />
                            <div className="ml-6">
                                <button
                                    type="button"
                                    className="flex justify-center items-center p-2 mr-1 w-24 text-lg bg-gray-600 rounded-lg focus:outline-none"
                                    onClick={() => setShowMetar(showMetar === 'ENABLED' ? 'DISABLED' : 'ENABLED')}
                                >
                                    {showMetar === 'ENABLED' ? 'Metar' : 'Summary'}
                                </button>
                            </div>
                        </div>
                        {showMetar === 'DISABLED'
                            ? (
                                <>
                                    <div className="grid grid-cols-2 h-40">
                                        <div className="text-lg text-center justify-left">
                                            <div className="flex justify-center">
                                                <IconGauge className="mb-2" size={35} stroke={1.5} strokeLinejoin="miter" />
                                            </div>
                                            {metar.raw_text ? (
                                                <>
                                                    {metar.barometer ? <BaroValue /> : 'N/A'}
                                                </>
                                            ) : (
                                                <>
                                                    N/A
                                                </>
                                            )}
                                        </div>
                                        <div className="text-lg text-center justify-left">
                                            <div className="flex justify-center">
                                                <IconWind className="mb-2" size={35} stroke={1.5} strokeLinejoin="miter" />
                                            </div>
                                            {metar.raw_text
                                                ? (
                                                    <>
                                                        {metar.wind.degrees.toFixed(0)}
                                                        {' '}
                                                        <IconPoint
                                                            className="inline-block -mx-1 -mt-3"
                                                            size={20}
                                                            stroke={2}
                                                            strokeLinejoin="miter"
                                                        />
                                                        {' '}
                                                        /
                                                        {' '}
                                                        {metar.wind.speed_kts.toFixed(0)}
                                                        {' '}
                                                        kts
                                                    </>
                                                ) : 'N/A'}
                                        </div>
                                        <div className="mt-6 text-lg text-center">
                                            <div className="flex justify-center">
                                                <IconTemperature className="mb-2" size={35} stroke={1.5} strokeLinejoin="miter" />
                                            </div>
                                            {metar.raw_text
                                                ? (
                                                    <>
                                                        {metar.temperature.celsius.toFixed(0)}
                                                        {' '}
                                                        <IconPoint
                                                            className="inline-block -mx-1 -mt-3"
                                                            size={20}
                                                            stroke={2}
                                                            strokeLinejoin="miter"
                                                        />
                                                        {' '}
                                                        {' '}
                                                        C
                                                    </>
                                                ) : 'N/A'}
                                        </div>
                                        <div className="overflow-y-scroll mt-6 text-lg text-center">
                                            <div className="flex justify-center">
                                                <IconDroplet className="mb-2" size={35} stroke={1.5} strokeLinejoin="miter" />
                                            </div>
                                            {metar.raw_text
                                                ? (
                                                    <>
                                                        {metar.dewpoint.celsius.toFixed(0)}
                                                        {' '}
                                                        <IconPoint
                                                            className="inline-block -mx-1 -mt-3"
                                                            size={20}
                                                            stroke={2}
                                                            strokeLinejoin="miter"
                                                        />
                                                        {' '}
                                                        {' '}
                                                        C
                                                    </>
                                                ) : 'N/A'}
                                        </div>
                                    </div>
                                </>
                            )
                            : (
                                <>
                                    <div className="mr-4 ml-8 h-40 font-mono text-xl text-left scrollbar">
                                        {metar.raw_text
                                            ? (
                                                <>
                                                    <ColoredMetar metar={metar} />
                                                </>
                                            ) : (
                                                <>
                                                    NO VALID ICAO CHOSEN
                                                    {' '}
                                                    {' '}
                                                </>
                                            )}
                                    </div>
                                </>
                            )}
                    </>
                )}
        </div>
    );
};
