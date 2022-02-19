import React, { useRef, useState, useEffect } from 'react';
import { usePersistentProperty } from '@instruments/common/persistence';
import { CloudArrowDown, ZoomIn, ZoomOut } from 'react-bootstrap-icons';
import { toast } from 'react-toastify';
import { ScrollableContainer } from '../../UtilComponents/ScrollableContainer';
import { fetchSimbriefDataAction, isSimbriefDataLoaded } from '../../Store/features/simbrief';
import { useAppDispatch, useAppSelector } from '../../Store/store';

export const LoadSheetWidget = () => {
    const loadsheet = useAppSelector((state) => state.simbrief.data.loadsheet);

    const ref = useRef<HTMLDivElement>(null);

    const [fontSize, setFontSize] = usePersistentProperty('LOADSHEET_FONTSIZE', '14');
    const [simbriefUserId] = usePersistentProperty('CONFIG_SIMBRIEF_USERID');

    const [imageSize, setImageSize] = useState(60);

    const [simbriefDataPending, setSimbriefDataPending] = useState(false);

    const dispatch = useAppDispatch();

    useEffect(() => {
        const pImages = ref.current?.getElementsByTagName('img');

        if (pImages) {
            for (let i = 0; i < pImages.length; i++) {
                pImages[i].style.width = `${imageSize}%`;
            }
        }
    }, [imageSize]);

    const [loadSheetStyle, setLoadSheetStyle] = useState({});

    useEffect(() => setLoadSheetStyle({
        fontSize: `${fontSize}px`,
        lineHeight: `${fontSize}px`,
    }), [fontSize]);

    function handleFontIncrease() {
        let cFontSize = (Number)(fontSize);
        let cImageSize = imageSize;

        if (cFontSize < 26) {
            cFontSize += 2;
            cImageSize += 5;
            handleScaling(cFontSize, cImageSize);
        }
    }

    function handleFontDecrease() {
        let cFontSize = (Number)(fontSize);
        let cImageSize = imageSize;

        if (cFontSize > 14) {
            cFontSize -= 2;
            cImageSize -= 5;
            handleScaling(cFontSize, cImageSize);
        }
    }

    const handleScaling = (cFontSize, cImageSize) => {
        setFontSize((String)(cFontSize));
        setImageSize(cImageSize);
    };

    const fetchData = async () => {
        setSimbriefDataPending(true);

        try {
            const action = await fetchSimbriefDataAction(simbriefUserId ?? '');

            dispatch(action);
        } catch (e) {
            toast.error(e.message);
        }

        setSimbriefDataPending(false);
    };

    const simbriefDataLoaded = isSimbriefDataLoaded();

    return (
        <div className="overflow-hidden relative p-6 mt-4 w-full h-content-section-reduced rounded-lg border-2 border-theme-accent">
            <>
                <div className="overflow-hidden absolute top-6 right-16 bg-theme-secondary rounded-md">
                    <button
                        type="button"
                        onClick={handleFontDecrease}
                        className="py-2 px-3 hover:bg-theme-highlight bg-opacity-50 hover:bg-opacity-100 transition duration-100"
                    >
                        <ZoomOut size={30} />
                    </button>
                    <button
                        type="button"
                        onClick={handleFontIncrease}
                        className="py-2 px-3 hover:bg-theme-highlight bg-opacity-50 hover:bg-opacity-100 transition duration-100"
                    >
                        <ZoomIn size={30} />
                    </button>
                </div>
                <ScrollableContainer height={51}>
                    <div
                        ref={ref}
                        className="image-theme"
                        style={loadSheetStyle}
                        dangerouslySetInnerHTML={{ __html: loadsheet }}
                    />
                </ScrollableContainer>
            </>
            <div className={`absolute inset-0 transition duration-200 bg-theme-body ${simbriefDataLoaded ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                <h1 className="flex justify-center items-center w-full h-full">
                    {simbriefDataPending ? (
                        <CloudArrowDown className="animate-bounce" size={40} />
                    ) : (
                        <>
                            {!simbriefDataLoaded && (
                                <div className="flex flex-col justify-center items-center space-y-8 h-full">
                                    <h1 className="max-w-4xl text-center">You have not yet imported any SimBrief data.</h1>
                                    <button
                                        type="button"
                                        onClick={fetchData}
                                        className="flex justify-center items-center p-2 space-x-4 w-full text-theme-body hover:text-theme-highlight bg-theme-highlight hover:bg-theme-body rounded-lg border-2 border-theme-highlight transition duration-100"
                                    >
                                        <CloudArrowDown size={26} />
                                        <p className="text-current">Import SimBrief Data</p>
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </h1>
            </div>
        </div>
    );
};
