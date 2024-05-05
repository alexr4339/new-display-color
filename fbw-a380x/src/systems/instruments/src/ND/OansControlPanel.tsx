import './UI/style.scss';
import './OansControlPanel.scss';

import {
  ArraySubject,
  ClockEvents,
  ComponentProps,
  DisplayComponent,
  EventBus,
  FSComponent,
  MapSubject,
  MappedSubject,
  MappedSubscribable,
  SimVarValueType,
  Subject,
  Subscribable,
  Subscription,
  VNode,
} from '@microsoft/msfs-sdk';
import {
  BrakeToVacateUtils,
  ControlPanelAirportSearchMode,
  ControlPanelStore,
  ControlPanelUtils,
  FmsDataStore,
  FmsOansDataArinc429,
  NavigraphAmdbClient,
  OansControlEvents,
  globalToAirportCoordinates,
} from '@flybywiresim/oanc';
import {
  AmdbAirportSearchResult,
  Arinc429RegisterSubject,
  EfisSide,
  FeatureType,
  FeatureTypeString,
  MathUtils,
  Runway,
} from '@flybywiresim/fbw-sdk';

import { Button } from './UI/Button';
import { OansRunwayInfoBox } from './OANSRunwayInfoBox';
import { DropdownMenu } from './UI/DropdownMenu';
import { RadioButtonGroup } from './UI/RadioButtonGroup';
import { InputField } from './UI/InputField';
import { LengthFormat } from './UI/DataEntryFormats';
import { IconButton } from './UI/IconButton';
import { TopTabNavigator, TopTabNavigatorPage } from './UI/TopTabNavigator';
import { Coordinates, distanceTo, placeBearingDistance } from 'msfs-geo';
import { AdirsSimVars } from 'instruments/src/MsfsAvionicsCommon/SimVarTypes';
import { NavigationDatabase, NavigationDatabaseBackend, NavigationDatabaseService } from '@fmgc/index';

export interface OansProps extends ComponentProps {
  bus: EventBus;
  side: EfisSide;
  isVisible: Subscribable<boolean>;
  togglePanel: () => void;
}

export enum EntityTypes {
  RWY,
  TWY,
  STAND,
  OTHER,
}

const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const monthLength = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export class OansControlPanel extends DisplayComponent<OansProps> {
  private readonly subs: (Subscription | MappedSubscribable<any>)[] = [];

  private readonly navigraphAvailable = Subject.create<boolean>(false);

  private amdbClient = new NavigraphAmdbClient();

  private readonly oansMenuRef = FSComponent.createRef<HTMLDivElement>();

  private readonly airportSearchAirportDropdownRef = FSComponent.createRef<DropdownMenu>();

  private readonly displayAirportButtonRef = FSComponent.createRef<Button>();

  private readonly closePanelButtonRef = FSComponent.createRef<HTMLButtonElement>();

  private readonly mapDataLdgShiftPanelRef = FSComponent.createRef<HTMLDivElement>();

  private readonly mapDataMainRef = FSComponent.createRef<HTMLDivElement>();

  private readonly mapDataBtvFallback = FSComponent.createRef<HTMLDivElement>();

  private readonly store = new ControlPanelStore();

  private readonly style = MapSubject.create<string, string>();

  private readonly activeTabIndex = Subject.create<number>(2);

  private readonly availableEntityTypes = Object.values(EntityTypes).filter((v) => typeof v === 'string') as string[];

  private readonly thresholdShift = Subject.create<number | null>(null);

  private readonly endShift = Subject.create<number | null>(null);

  private readonly selectedEntityType = Subject.create<EntityTypes | null>(EntityTypes.RWY);

  private readonly availableEntityList = ArraySubject.create(['']);

  private readonly selectedEntityIndex = Subject.create<number | null>(0);

  private readonly selectedEntityString = Subject.create<string | null>(null);

  private manualAirportSelection = false;

  private readonly pposLatWord = Arinc429RegisterSubject.createEmpty();

  private readonly pposLonWord = Arinc429RegisterSubject.createEmpty();

  private presentPos = MappedSubject.create(
    ([lat, lon]) => {
      return { lat: lat.value, long: lon.value } as Coordinates;
    },
    this.pposLatWord,
    this.pposLonWord,
  );

  private readonly fmsDataStore = new FmsDataStore(this.props.bus);

  private readonly runwayTora = Subject.create<string | null>(null);

  private readonly runwayLda = Subject.create<string | null>(null);

  private readonly reqStoppingDistance = Subject.create<number | null>(null);

  private arpCoordinates: Coordinates | undefined;

  private landingRunwayNavdata: Runway | undefined;

  private btvUtils = new BrakeToVacateUtils(this.props.bus);

  private readonly airportDatabase = Subject.create('SXT59027250AA04');

  private readonly activeDatabase = Subject.create('30DEC-27JAN');

  private readonly secondDatabase = Subject.create('27JAN-24FEB');

  private showLdgShiftPanel() {
    if (this.mapDataLdgShiftPanelRef.getOrDefault() && this.mapDataMainRef.getOrDefault()) {
      this.mapDataLdgShiftPanelRef.instance.style.display = 'flex';
      this.mapDataMainRef.instance.style.display = 'none';
    }
  }

  private hideLdgShiftPanel() {
    if (this.mapDataLdgShiftPanelRef.getOrDefault() && this.mapDataMainRef.getOrDefault()) {
      this.mapDataLdgShiftPanelRef.instance.style.display = 'none';
      this.mapDataMainRef.instance.style.display = 'flex';
    }
  }

  public onAfterRender(node: VNode): void {
    super.onAfterRender(node);

    new Promise((resolve) => setTimeout(resolve, 5000)).then(() => {});

    NavigationDatabaseService.activeDatabase = new NavigationDatabase(NavigationDatabaseBackend.Msfs);

    const date = SimVar.GetGameVarValue('FLIGHT NAVDATA DATE RANGE', 'string');
    if (date) {
      this.activeDatabase.set(this.calculateActiveDate(date));
      this.secondDatabase.set(this.calculateSecDate(date));
    }

    this.subs.push(
      this.props.isVisible.sub((it) => this.style.setValue('visibility', it ? 'visible' : 'hidden'), true),
    );

    this.amdbClient
      .searchForAirports('')
      .then((airports) => {
        this.store.airports.set(airports);
        this.navigraphAvailable.set(true);
      })
      .catch(() => this.navigraphAvailable.set(false));

    this.subs.push(
      this.store.airports.sub(() =>
        this.sortAirports(this.store.airportSearchMode.get() ?? ControlPanelAirportSearchMode.Icao),
      ),
    );

    this.subs.push(
      this.store.airportSearchMode.sub((mode) => this.sortAirports(mode ?? ControlPanelAirportSearchMode.Icao)),
    );

    this.subs.push(
      this.store.airportSearchMode.sub(() => this.updateAirportSearchData(), true),
      this.store.sortedAirports.sub(() => this.updateAirportSearchData(), true),
    );

    // unfocus input fields on tab change
    this.subs.push(this.activeTabIndex.sub((_index) => Coherent.trigger('UNFOCUS_INPUT_FIELD')));

    this.navigraphAvailable.sub((v) => {
      if (this.mapDataMainRef.getOrDefault() && this.mapDataBtvFallback.getOrDefault()) {
        this.mapDataMainRef.instance.style.display = v ? 'block' : 'none';
        this.mapDataBtvFallback.instance.style.display = v ? 'none' : 'block';
      }
    }, true);

    const sub = this.props.bus.getSubscriber<ClockEvents & FmsOansDataArinc429 & AdirsSimVars>();

    sub
      .on('latitude')
      .whenChanged()
      .handle((value) => {
        this.pposLatWord.setWord(value);
      });

    sub
      .on('longitude')
      .whenChanged()
      .handle((value) => {
        this.pposLonWord.setWord(value);
      });

    this.fmsDataStore.landingRunway.sub(async (it) => {
      // Set control panel display
      if (it) {
        this.availableEntityList.set([it.substring(4)]);
        this.selectedEntityType.set(EntityTypes.RWY);
        this.selectedEntityIndex.set(0);
        this.selectedEntityString.set(it.substring(4));

        // Load runway data
        const destination = this.fmsDataStore.destination.get();
        if (destination && this.navigraphAvailable.get() === true) {
          const data = await this.amdbClient.getAirportData(destination, [FeatureTypeString.RunwayThreshold]);
          const thresholdFeature = data.runwaythreshold?.features.filter(
            (td) => td.properties.feattype === FeatureType.RunwayThreshold && td.properties?.idthr === it.substring(4),
          );
          if (thresholdFeature && thresholdFeature[0]?.properties.lda && thresholdFeature[0]?.properties.tora) {
            this.runwayLda.set(
              (thresholdFeature[0].properties.lda > 0 ? thresholdFeature[0].properties.lda : 0).toFixed(0),
            );
            this.runwayTora.set(
              (thresholdFeature[0]?.properties.tora > 0 ? thresholdFeature[0].properties.tora : 0).toFixed(0),
            );
          } else {
            this.runwayLda.set('N/A');
            this.runwayTora.set('N/A');
          }
        } else if (destination && this.navigraphAvailable.get() === false) {
          const db = NavigationDatabaseService.activeDatabase.backendDatabase;

          const arps = await db.getAirports([destination]);
          this.arpCoordinates = arps[0].location;

          const runways = await db.getRunways(destination);
          this.landingRunwayNavdata = runways.filter((rw) => rw.ident === it)[0];
          this.runwayLda.set(this.landingRunwayNavdata.length.toFixed(0));
          this.runwayTora.set(this.landingRunwayNavdata.length.toFixed(0));
          const oppositeThreshold = placeBearingDistance(
            this.landingRunwayNavdata.thresholdLocation,
            this.landingRunwayNavdata.bearing,
            this.landingRunwayNavdata.length / MathUtils.METRES_TO_NAUTICAL_MILES,
          );
          const localThr = globalToAirportCoordinates(this.arpCoordinates, this.landingRunwayNavdata.thresholdLocation);
          const localOppThr = globalToAirportCoordinates(this.arpCoordinates, oppositeThreshold);

          this.btvUtils.selectRunwayFromNavdata(
            it,
            this.landingRunwayNavdata.length,
            this.landingRunwayNavdata.bearing,
            localThr,
            localOppThr,
          );
        }
      }
    });

    sub
      .on('realTime')
      .atFrequency(1)
      .handle((_) => this.autoLoadAirport());

    sub
      .on('realTime')
      .atFrequency(5)
      .handle((_) => {
        const ppos: Coordinates = { lat: 0, long: 0 };
        ppos.lat = SimVar.GetSimVarValue('PLANE LATITUDE', 'Degrees');
        ppos.long = SimVar.GetSimVarValue('PLANE LONGITUDE', 'Degrees');

        if (this.arpCoordinates && ppos.lat && this.navigraphAvailable.get() === false) {
          const localPpos = globalToAirportCoordinates(this.arpCoordinates, ppos);
          this.btvUtils.updateRemainingDistances(localPpos);
        }
      });

    sub
      .on('oansRequestedStoppingDistance')
      .whenChanged()
      .handle((it) => this.reqStoppingDistance.set(it.isNormalOperation() ? it.value : 0));

    this.selectedEntityIndex.sub((val) => this.selectedEntityString.set(this.availableEntityList.get(val ?? 0)));
  }

  public updateAirportSearchData() {
    const searchMode = this.store.airportSearchMode.get();
    const sortedAirports = this.store.sortedAirports.getArray();

    const prop = ControlPanelUtils.getSearchModeProp(searchMode ?? ControlPanelAirportSearchMode.Icao);

    this.store.airportSearchData.set(sortedAirports.map((it) => (it[prop] as string).toUpperCase()));
  }

  public setSelectedAirport(airport: AmdbAirportSearchResult) {
    this.store.selectedAirport.set(airport);
    const foundIndex = this.store.sortedAirports.getArray().findIndex((it) => it.idarpt === airport.idarpt);
    this.store.airportSearchSelectedAirportIndex.set(foundIndex === -1 ? null : foundIndex);
  }

  private sortAirports(mode: ControlPanelAirportSearchMode) {
    const array = this.store.airports.getArray().slice();

    const prop = ControlPanelUtils.getSearchModeProp(mode);

    array.sort((a, b) => {
      if (a[prop] < b[prop]) {
        return -1;
      }
      if (a[prop] > b[prop]) {
        return 1;
      }
      return 0;
    });

    this.store.sortedAirports.set(array.filter((it) => it[prop] !== null));
  }

  private handleSelectAirport = (icao: string, indexInSearchData?: number) => {
    const airport = this.store.airports.getArray().find((it) => it.idarpt === icao);

    if (!airport) {
      throw new Error('');
    }

    const firstLetter =
      airport[
        ControlPanelUtils.getSearchModeProp(this.store.airportSearchMode.get() ?? ControlPanelAirportSearchMode.Icao)
      ][0];
    this.store.airportSearchSelectedSearchLetterIndex.set(
      ControlPanelUtils.LETTERS.findIndex((it) => it === firstLetter),
    );

    const airportIndexInSearchData =
      indexInSearchData ?? this.store.sortedAirports.getArray().findIndex((it) => it.idarpt === icao);

    this.store.airportSearchSelectedAirportIndex.set(airportIndexInSearchData);
    this.store.selectedAirport.set(airport);
    this.store.isAirportSelectionPending.set(true);
  };

  private handleSelectSearchMode = (newSearchMode: ControlPanelAirportSearchMode) => {
    const selectedAirport = this.store.selectedAirport.get();

    this.store.airportSearchMode.set(newSearchMode);

    if (selectedAirport !== null) {
      const prop = ControlPanelUtils.getSearchModeProp(newSearchMode);

      const firstLetter = selectedAirport[prop][0];
      const airportIndexInSearchData = this.store.sortedAirports
        .getArray()
        .findIndex((it) => it.idarpt === selectedAirport.idarpt);

      this.store.airportSearchSelectedSearchLetterIndex.set(
        ControlPanelUtils.LETTERS.findIndex((it) => it === firstLetter),
      );
      this.store.airportSearchSelectedAirportIndex.set(airportIndexInSearchData);
    }
  };

  private handleDisplayAirport = () => {
    if (!this.store.selectedAirport.get()) {
      throw new Error('[OANS] Empty airport selected for display.');
    }

    this.manualAirportSelection = true;
    this.props.bus
      .getPublisher<OansControlEvents>()
      .pub('oansDisplayAirport', this.store.selectedAirport.get().idarpt, true);
    this.store.loadedAirport.set(this.store.selectedAirport.get().idarpt);
    this.store.isAirportSelectionPending.set(false); // TODO should be done when airport is fully loaded
  };

  private autoLoadAirport() {
    // If airport has been manually selected, do not auto load.
    if (
      this.manualAirportSelection === true ||
      this.store.loadedAirport.get() !== this.store.selectedAirport.get() ||
      this.store.airports.length === 0
    ) {
      return;
    }
    // If on ground, and no airport is loaded, find current airport.
    if (![5, 6, 7].includes(SimVar.GetSimVarValue('L:A32NX_FWC_FLIGHT_PHASE', SimVarValueType.Number))) {
      // Go through all airports, load if distance <20NM
      const nearestAirports = this.store.airports
        .getArray()
        .filter((ap) => distanceTo(this.presentPos.get(), { lat: ap.coordinates.lat, long: ap.coordinates.lon }) < 20);
      const sortedAirports = nearestAirports.sort(
        (a, b) =>
          distanceTo(this.presentPos.get(), { lat: a.coordinates.lat, long: a.coordinates.lon }) -
          distanceTo(this.presentPos.get(), { lat: b.coordinates.lat, long: b.coordinates.lon }),
      );
      if (sortedAirports.length > 0) {
        const ap = sortedAirports[0];
        if (ap.idarpt !== this.store.loadedAirport.get()?.idarpt) {
          this.handleSelectAirport(ap.idarpt);
          this.props.bus.getPublisher<OansControlEvents>().pub('oansDisplayAirport', ap.idarpt, true);
          this.store.loadedAirport.set(ap.idarpt);
          this.store.isAirportSelectionPending.set(false); // TODO should be done when airport is fully loaded
        }
        return;
      }
    }
    // If in flight, load destination airport if distance is <50NM. This could cause stutters, consider deactivating.
    else {
      const destArpt = this.store.airports.getArray().find((it) => it.idarpt === this.fmsDataStore.destination.get());
      if (destArpt && destArpt.idarpt !== this.store.loadedAirport.get()?.idarpt) {
        if (distanceTo(this.presentPos.get(), { lat: destArpt.coordinates.lat, long: destArpt.coordinates.lon }) < 50) {
          this.handleSelectAirport(destArpt.idarpt);
          this.props.bus.getPublisher<OansControlEvents>().pub('oansDisplayAirport', destArpt.idarpt, true);
          this.store.loadedAirport.set(destArpt.idarpt);
          this.store.isAirportSelectionPending.set(false); // TODO should be done when airport is fully loaded
          return;
        }
      }
    }
  }

  private findNewMonthIndex(index: number) {
    if (index === 0) {
      return 11;
    }
    return index - 1;
  }

  private lessThan10(num: number) {
    if (num < 10) {
      return `0${num}`;
    }
    return num;
  }

  private calculateActiveDate(date: string): string {
    if (date.length === 13) {
      const startMonth = date.slice(0, 3);
      const startDay = date.slice(3, 5);

      const endMonth = date.slice(5, 8);
      const endDay = date.slice(8, 10);

      return `${startDay}${startMonth}-${endDay}${endMonth}`;
    }
    return date;
  }

  private calculateSecDate(date: string): string {
    if (date.length === 13) {
      const primStartMonth = date.slice(0, 3);
      const primStartDay = Number(date.slice(3, 5));

      const primStartMonthIndex = months.findIndex((item) => item === primStartMonth);

      if (primStartMonthIndex === -1) {
        return 'ERR';
      }

      let newEndMonth = primStartMonth;
      let newEndDay = primStartDay - 1;

      let newStartDay = newEndDay - 27;
      let newStartMonth = primStartMonth;

      if (newEndDay === 0) {
        newEndMonth = months[this.findNewMonthIndex(primStartMonthIndex)];
        newEndDay = monthLength[this.findNewMonthIndex(primStartMonthIndex)];
      }

      if (newStartDay <= 0) {
        newStartMonth = months[this.findNewMonthIndex(primStartMonthIndex)];
        newStartDay = monthLength[this.findNewMonthIndex(primStartMonthIndex)] + newStartDay;
      }

      return `${this.lessThan10(newStartDay)}${newStartMonth}-${this.lessThan10(newEndDay)}${newEndMonth}`;
    }
    return 'ERR';
  }

  render(): VNode {
    return (
      <>
        <IconButton
          ref={this.closePanelButtonRef}
          onClick={() => this.props.togglePanel()}
          icon="double-up"
          containerStyle="z-index: 10; width: 49px; height: 45px; position: absolute; right: 2px; top: 768px;"
        />
        <div class="oans-control-panel-background">
          <div ref={this.oansMenuRef} class="oans-control-panel" style={this.style}>
            <TopTabNavigator
              pageTitles={Subject.create(['MAP DATA', 'ARPT SEL', 'STATUS'])}
              selectedPageIndex={this.activeTabIndex}
              tabBarHeight={45}
              tabBarSlantedEdgeAngle={30}
              selectedTabTextColor="cyan"
              additionalRightSpace={50}
            >
              <TopTabNavigatorPage>
                <div style="flex: 1; display: flex; flex-direction: row; height: 100%;">
                  <div style="flex: 1; display: flex: flex-direction: column; justify-content: stretch;">
                    <DropdownMenu
                      values={this.availableEntityList}
                      selectedIndex={this.selectedEntityIndex}
                      idPrefix="oanc-search-letter"
                      freeTextAllowed={false}
                      onModified={(i) => this.selectedEntityIndex.set(i)}
                      inactive={Subject.create(true)}
                    />
                    <div style="border-right: 2px solid lightgrey; height: 100%;">
                      <RadioButtonGroup
                        values={this.availableEntityTypes}
                        valuesDisabled={Subject.create(Array(4).fill(true))}
                        selectedIndex={this.selectedEntityType}
                        idPrefix="entityTypesRadio"
                      />
                    </div>
                  </div>
                  <div
                    ref={this.mapDataLdgShiftPanelRef}
                    style="display: none; flex: 3; flex-direction: column; margin: 5px 20px 5px 20px;"
                  >
                    <div style="flex: 1; display: flex; justify-content: space-between; border-bottom: 1px solid lightgrey;">
                      <div class="mfd-label-value-container" style="padding: 15px;">
                        <span class="mfd-label mfd-spacing-right">RWY</span>
                        <span class="mfd-value">{this.selectedEntityString}</span>
                      </div>
                    </div>
                    <div style="flex: 5; display: flex; flex-direction: row; justify-content: space-between; margin: 10px;">
                      <div style="display: flex; flex-direction: column;">
                        <div style="display: grid; grid-template-columns: 1fr auto; grid-template-rows: 50px 50px; align-items: center;">
                          <span class="mfd-label mfd-spacing-right bigger" style="justify-self: flex-end">
                            THRESHOLD SHIFT
                          </span>
                          <InputField<number>
                            dataEntryFormat={new LengthFormat(Subject.create(0), Subject.create(4000))}
                            value={this.thresholdShift}
                            mandatory={Subject.create(false)}
                          />
                          <span class="mfd-label mfd-spacing-right bigger" style="justify-self: flex-end">
                            END SHIFT
                          </span>
                          <InputField<number>
                            dataEntryFormat={new LengthFormat(Subject.create(0), Subject.create(4000))}
                            value={this.endShift}
                            mandatory={Subject.create(false)}
                          />
                        </div>
                        <div style="display: flex; flex-direction: row; justify-content: center; margin-top: 10px;">
                          <Button
                            label="RETURN"
                            buttonStyle="padding: 7px 15px 5px 15px;"
                            onClick={() => this.hideLdgShiftPanel()}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div
                    ref={this.mapDataMainRef}
                    style="display: flex; flex: 3; flex-direction: column; margin: 0px 20px 0px 20px;"
                  >
                    <div style="display: flex; flex-direction: row; justify-content: space-between;">
                      <Button
                        label="ADD CROSS"
                        onClick={() => console.log('ADD CROSS')}
                        buttonStyle="flex: 1"
                        disabled={Subject.create(true)}
                      />
                      <Button
                        label="ADD FLAG"
                        onClick={() => console.log('ADD FLAG')}
                        buttonStyle="flex: 1; margin-left: 10px; margin-right: 10px"
                        disabled={Subject.create(true)}
                      />
                      <Button
                        label="LDG SHIFT"
                        onClick={() => this.showLdgShiftPanel()}
                        buttonStyle="flex: 1"
                        disabled={Subject.create(true)}
                      />
                    </div>
                    <div style="display: flex; flex-direction: row; justify-content: center; margin-top: 10px;">
                      <Button
                        label={`CENTER MAP ON ${this.availableEntityList.get(this.selectedEntityIndex.get() ?? 0)}`}
                        onClick={() =>
                          console.log(
                            `CENTER MAP ON ${this.availableEntityList.get(this.selectedEntityIndex.get() ?? 0)}`,
                          )
                        }
                        disabled={Subject.create(true)}
                      />
                    </div>
                    <OansRunwayInfoBox
                      rwyOrStand={this.selectedEntityType}
                      selectedEntity={this.selectedEntityString}
                      tora={this.runwayTora}
                      lda={this.runwayLda}
                      ldaIsReduced={Subject.create(false)}
                      coordinate={Subject.create('----')}
                    />
                  </div>
                  <div
                    ref={this.mapDataBtvFallback}
                    style="display: flex; flex: 3; flex-direction: column; margin: 0px 20px 0px 20px;"
                  >
                    <div style="display: flex; flex-direction: row; justify-content: center; align-items: center; margin: 10px; margin-bottom: 40px;">
                      <div class="mfd-label" style="margin-right: 10px;">
                        BTV MANUAL CONTROL / FALLBACK
                      </div>
                    </div>
                    <div style="display: flex; flex-direction: row; justify-content: center; align-items: center; margin: 10px;">
                      <div class="mfd-label" style="margin-right: 10px;">
                        RUNWAY LENGTH
                      </div>
                      <span class="mfd-value smaller">
                        {this.runwayLda}
                        <span style="color: rgb(33, 33, 255)">M</span>
                      </span>
                    </div>
                    <div style="display: flex; flex-direction: row; justify-content: center; align-items: center; margin: 10px;">
                      <div class="mfd-label" style="margin-right: 10px;">
                        BTV STOP DISTANCE
                      </div>
                      <div>
                        <InputField<number>
                          dataEntryFormat={new LengthFormat(Subject.create(0), Subject.create(4000))}
                          dataHandlerDuringValidation={async (val) => {
                            if (this.navigraphAvailable.get() === false) {
                              SimVar.SetSimVarValue(
                                'L:A32NX_OANS_BTV_REQ_STOPPING_DISTANCE',
                                SimVarValueType.Number,
                                val,
                              );

                              if (val && this.landingRunwayNavdata && this.arpCoordinates) {
                                const exitLocation = placeBearingDistance(
                                  this.landingRunwayNavdata.thresholdLocation,
                                  this.landingRunwayNavdata.bearing,
                                  val / MathUtils.METRES_TO_NAUTICAL_MILES,
                                );
                                const localExitPos = globalToAirportCoordinates(this.arpCoordinates, exitLocation);

                                this.btvUtils.selectExitFromManualEntry(val, localExitPos);
                              }
                            }
                          }}
                          value={this.reqStoppingDistance}
                          mandatory={Subject.create(false)}
                          inactive={this.selectedEntityString.map((it) => !it)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </TopTabNavigatorPage>
              <TopTabNavigatorPage>
                <div style="flex: 1; display: flex; flex-direction: row; height: 100%;">
                  <div style="width: 30%; display: flex: flex-direction: column; justify-content: stretch;">
                    <div style="display: flex;">
                      <DropdownMenu
                        ref={this.airportSearchAirportDropdownRef}
                        values={this.store.airportSearchData}
                        selectedIndex={this.store.airportSearchSelectedAirportIndex}
                        onModified={(newSelectedIndex) => {
                          this.handleSelectAirport(
                            this.store.sortedAirports.get(newSelectedIndex ?? 0).idarpt,
                            newSelectedIndex ?? undefined,
                          );
                        }}
                        freeTextAllowed={false}
                        numberOfDigitsForInputField={7}
                        alignLabels={this.store.airportSearchMode.map((it) =>
                          it === ControlPanelAirportSearchMode.City ? 'flex-start' : 'center',
                        )}
                        idPrefix="oanc-search-airport"
                      />
                    </div>
                    <div style="padding-top: 20px; margin-top: 2px; height: 100%;">
                      <RadioButtonGroup
                        values={['ICAO', 'IATA', 'CITY NAME']}
                        selectedIndex={this.store.airportSearchMode}
                        onModified={(newSelectedIndex) => {
                          switch (newSelectedIndex) {
                            case 0:
                              this.handleSelectSearchMode(ControlPanelAirportSearchMode.Icao);
                              break;
                            case 1:
                              this.handleSelectSearchMode(ControlPanelAirportSearchMode.Iata);
                              break;
                            default:
                              this.handleSelectSearchMode(ControlPanelAirportSearchMode.City);
                              break;
                          }
                        }}
                        idPrefix="oanc-search"
                      />
                    </div>
                  </div>
                  <div
                    id="ArptSelMiddle"
                    style="display: flex; flex: 2; flex-direction: column; margin: 5px 20px 5px 20px;"
                  >
                    <div style="display: flex; flex-direction: column; justify-content: space-between; align-items: center; margin: 10px;">
                      <span class="mfd-value">
                        {this.store.selectedAirport.map((it) => it?.name?.substring(0, 18).toUpperCase() ?? '')}
                      </span>
                      <span class="mfd-value">
                        {this.store.selectedAirport.map((it) => {
                          if (!it) {
                            return '';
                          }

                          return `${it.idarpt}       ${it.iata}`;
                        })}
                      </span>
                      <span class="mfd-value">
                        {this.store.selectedAirport.map((it) => {
                          if (!it) {
                            return '';
                          }

                          return `${ControlPanelUtils.LAT_FORMATTER(it.coordinates.lat)}/${ControlPanelUtils.LONG_FORMATTER(it.coordinates.lon)}`;
                        })}
                      </span>
                    </div>
                    <div style="flex-grow: 1;" />
                    <div style="display: flex; flex-direction: row; justify-content: center; margin: 10px; ">
                      <Button
                        ref={this.displayAirportButtonRef}
                        label="DISPLAY AIRPORT"
                        onClick={() => this.handleDisplayAirport()}
                        buttonStyle="width: 100%"
                      />
                    </div>
                  </div>
                  <div
                    style="width: 20%; display: flex; flex-direction: column;
                                    margin-top: 20px; margin-bottom: 20px; justify-content: space-between;
                                    align-items: center; border-left: 2px solid lightgrey"
                  >
                    <Button
                      label={this.fmsDataStore.origin.map((it) => (it ? <>{it}</> : <>ORIGIN</>))}
                      onClick={() => {
                        const airport = this.fmsDataStore.origin.get();
                        if (airport) {
                          this.handleSelectAirport(airport);
                        }
                      }}
                      disabled={this.fmsDataStore.origin.map((it) => !it)}
                      buttonStyle="width: 100px;"
                    />
                    <Button
                      label={this.fmsDataStore.destination.map((it) => (it ? <>{it}</> : <>DEST</>))}
                      onClick={() => {
                        const airport = this.fmsDataStore.destination.get();
                        if (airport) {
                          this.handleSelectAirport(airport);
                        }
                      }}
                      disabled={this.fmsDataStore.destination.map((it) => !it)}
                      buttonStyle="width: 100px;"
                    />
                    <Button
                      label={this.fmsDataStore.alternate.map((it) => (it ? <>{it}</> : <>ALTN</>))}
                      onClick={() => {
                        const airport = this.fmsDataStore.alternate.get();
                        if (airport) {
                          this.handleSelectAirport(airport);
                        }
                      }}
                      disabled={this.fmsDataStore.alternate.map((it) => !it)}
                      buttonStyle="width: 100px;"
                    />
                  </div>
                </div>
              </TopTabNavigatorPage>
              <TopTabNavigatorPage containerStyle="justify-content: space-between; align-content: space-between; justify-items: space-between;">
                <div
                  style="display: flex; flex-direction: row; border-bottom: 2px solid lightgray;
                                padding-bottom: 25px; margin-left: 30px; margin-right: 30px;"
                >
                  <div style="flex: 3; display: flex; flex-direction: column; align-items: center;">
                    <span class="mfd-label" style="margin-bottom: 10px;">
                      ACTIVE
                    </span>
                    <span class="mfd-value bigger">{this.activeDatabase}</span>
                  </div>
                  <div style="flex: 1; display: flex; flex-direction: column; align-items: center;">
                    <Button
                      label="SWAP"
                      disabled={Subject.create(true)}
                      onClick={() => console.log('SWAP')}
                      buttonStyle="padding: 20px 30px 20px 30px;"
                    />
                  </div>
                  <div style="flex: 3; display: flex; flex-direction: column; align-items: center;">
                    <span class="mfd-label" style="margin-bottom: 10px;">
                      SECOND
                    </span>
                    <span class="mfd-value smaller">{this.secondDatabase}</span>
                  </div>
                </div>
                <div
                  style="display: flex; flex-direction: row; justify-content: space-between;
                                border-bottom: 2px solid lightgray; margin: 0px 15px 0px 15px; padding: 25px 10px 25px 10px;"
                >
                  <span class="mfd-label">AIRPORT DATABASE</span>
                  <span class="mfd-value">{this.airportDatabase}</span>
                </div>
                <div style="display: flex; flex-direction: row; justify-content: space-between; justify-content: center; margin-top: 20px; height: 20px;">
                  <span class="mfd-label bigger" />
                </div>
              </TopTabNavigatorPage>
            </TopTabNavigator>
          </div>
        </div>
      </>
    );
  }
}
