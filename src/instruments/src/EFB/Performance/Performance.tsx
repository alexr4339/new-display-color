import React, { useContext } from 'react';
import { map } from 'lodash';

import { Navbar } from '../Components/Navbar';
import TODCalculator from '../TODCalculator/TODCalculator';
import LandingWidget from './Widgets/LandingWidget';
import { GlobalContext } from '../Store/global-context';
import { PerformanceActions } from '../Store/performance-reducer';

const tabs = [
    { name: 'Top of Descent', renderComponent: () => <TODCalculator /> },
    { name: 'Landing', renderComponent: () => <LandingWidget /> },
];

const Performance = () => {
    const { performanceState, performanceDispatch } = useContext(GlobalContext);

    return (
        <div className="w-full">
            <h1 className="text-3xl pt-6 text-white">Performance</h1>
            <Navbar
                activeIndex={performanceState.currentView}
                tabs={map(tabs, 'name')}
                onSelected={(activeIndex) => {
                    performanceDispatch({
                        type: PerformanceActions.SET_CURRENT_VIEW,
                        payload: { currentView: activeIndex },
                    });
                }}
            />
            <div className="mt-6">
                {tabs[performanceState.currentView].renderComponent()}
            </div>
        </div>
    );
};

export default Performance;
