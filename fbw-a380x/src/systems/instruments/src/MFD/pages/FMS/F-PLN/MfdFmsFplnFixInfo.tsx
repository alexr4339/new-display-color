import { AnyFix } from '@flybywiresim/fbw-sdk';

import { FmsPage } from '../../common/FmsPage';
import { ObservableFlightPlan } from '@fmgc/flightplanning/plans/ObservableFlightPlan';
import { FlightPlanIndex } from '@fmgc/flightplanning/FlightPlanManager';
import {
  ComponentProps,
  DateTimeFormatter,
  DisplayComponent,
  FSComponent,
  NumberFormatter,
  Subject,
  Subscribable,
  Subscription,
  VNode,
} from '@microsoft/msfs-sdk';
import { Footer } from '../../common/Footer';
import { TopTabNavigator, TopTabNavigatorPage } from '../../common/TopTabNavigator';
import { InputField } from '../../common/InputField';
import { FixFormat, RadialFormat, RadiusFormat } from '../../common/DataEntryFormats';
import { FmsError, FmsErrorType } from '@fmgc/FmsError';
import { FixInfoEntry } from '@fmgc/flightplanning/plans/FixInfo';
import { Button } from '../../common/Button';
import { WaypointEntryUtils } from '@fmgc/flightplanning/WaypointEntryUtils';

import './MfdFmsFplnFixInfo.scss';
import { ObservableFlightPlanManager } from '@fmgc/flightplanning/ObservableFlightPlanManager';

export class MfdFmsFplnFixInfo extends FmsPage {
  private readonly flightPlanManager = new ObservableFlightPlanManager(
    this.props.bus,
    this.props.fmcService.master!.flightPlanService,
  );

  private flightPlan = new ObservableFlightPlan(
    this.props.bus,
    this.props.fmcService.master!.flightPlanService,
    FlightPlanIndex.Active,
  );

  private readonly selectedTab = Subject.create(0);

  protected onNewData(): void {
    // noop
  }

  destroy() {
    super.destroy();

    this.flightPlan.destroy();
  }

  render(): VNode {
    return (
      <>
        {super.render()}
        {/* begin page content */}
        <div class="mfd-fms-fpln-fix-info-header"></div>
        <TopTabNavigator pageTitles={['FIX 1', 'FIX 2', 'FIX 3', 'FIX 4']} selectedPageIndex={this.selectedTab}>
          {([1, 2, 3, 4] as const).map((value) => (
            <TopTabNavigatorPage containerStyle="max-height: 45rem;">
              <div class="fr aic mfd-fms-fpln-fix-info-ref-ident">
                <span class="mfd-fms-fpln-fix-info-ref-ident-label">REF IDENT</span>

                <InputField<AnyFix, string, false>
                  readonlyValue={this.flightPlan.fixInfos[value].map((it) => it?.fix ?? null)}
                  onModified={async (text) => {
                    if (!text) {
                      return null;
                    }

                    const fix = await WaypointEntryUtils.getOrCreateWaypoint(this.props.fmcService.master!, text, true);

                    if (!fix) {
                      throw new FmsError(FmsErrorType.NotInDatabase);
                    }

                    void this.props.fmcService.master!.flightPlanService.setFixInfoEntry(
                      value,
                      new FixInfoEntry(fix, [], []),
                    );
                  }}
                  errorHandler={(msg) => this.props.mfd.showFmsErrorMessage(msg)}
                  dataEntryFormat={new FixFormat()}
                  tmpyActive={this.flightPlanManager.temporaryPlanExists}
                  hEventConsumer={this.props.mfd.hEventConsumer}
                  interactionMode={this.props.mfd.interactionMode}
                />
              </div>

              <div class="mfd-fms-fpln-fix-info-table">
                <div class="fr mfd-fms-fpln-fix-info-table-row-1">
                  <span class="mfd-fms-fpln-fix-info-table-col-left"></span>
                  <span class="fc jcc aic mfd-fms-fpln-fix-info-table-col-right mfd-fms-fpln-fix-info-fpl-intercept-header">
                    <span>F-PLN INTERCEPT</span>
                    <span>UTC</span>
                    <span>DIST</span>
                    <span>ALT</span>
                  </span>
                </div>

                <div class="fr mfd-fms-fpln-fix-info-table-row-2">
                  <span class="fc mfd-fms-fpln-fix-info-table-col-left">
                    <span class="mfd-fms-fpln-fix-info-radial-header">RADIAL</span>

                    <InputField<number, number, false>
                      class="mfd-fms-fpln-fix-info-radial-1"
                      disabled={this.flightPlan.fixInfos[value].map((it) => it?.fix === undefined)}
                      readonlyValue={this.flightPlan.fixInfos[value].map(
                        (it) => it?.radials?.[0]?.magneticBearing ?? null,
                      )}
                      onModified={(radial) => {
                        if (radial === null) {
                          return;
                        }

                        this.props.fmcService.master?.flightPlanService.editFixInfoEntry(value, (fixInfo) => {
                          if (!fixInfo.radials) {
                            fixInfo.radials = [];
                          }

                          fixInfo.radials[0] = {
                            magneticBearing: radial,
                            trueBearing: A32NX_Util.magneticToTrue(radial, A32NX_Util.getRadialMagVar(fixInfo.fix)),
                          };

                          return fixInfo;
                        });
                      }}
                      errorHandler={(msg) => this.props.mfd.showFmsErrorMessage(msg)}
                      dataEntryFormat={new RadialFormat()}
                      tmpyActive={this.flightPlanManager.temporaryPlanExists}
                      hEventConsumer={this.props.mfd.hEventConsumer}
                      interactionMode={this.props.mfd.interactionMode}
                    />

                    <InputField<number, number, false>
                      class="mfd-fms-fpln-fix-info-radial-2"
                      disabled={this.flightPlan.fixInfos[value].map(
                        (it) => it?.fix === undefined || (it.radials?.length ?? 0) < 1,
                      )}
                      readonlyValue={this.flightPlan.fixInfos[value].map(
                        (it) => it?.radials?.[1]?.magneticBearing ?? null,
                      )}
                      onModified={(radial) => {
                        if (radial === null) {
                          return;
                        }

                        this.props.fmcService.master?.flightPlanService.editFixInfoEntry(value, (fixInfo) => {
                          if (!fixInfo.radials) {
                            fixInfo.radials = [];
                          }

                          fixInfo.radials[1] = {
                            magneticBearing: radial,
                            trueBearing: A32NX_Util.magneticToTrue(radial, A32NX_Util.getRadialMagVar(fixInfo.fix)),
                          };

                          return fixInfo;
                        });
                      }}
                      errorHandler={(msg) => this.props.mfd.showFmsErrorMessage(msg)}
                      dataEntryFormat={new RadialFormat()}
                      tmpyActive={this.flightPlanManager.temporaryPlanExists}
                      hEventConsumer={this.props.mfd.hEventConsumer}
                      interactionMode={this.props.mfd.interactionMode}
                    />
                  </span>
                  <span class="fc mfd-fms-fpln-fix-info-table-col-right">
                    <FixInfoPredictionRow tmpyActive={this.flightPlanManager.temporaryPlanExists} />
                    <FixInfoPredictionRow tmpyActive={this.flightPlanManager.temporaryPlanExists} />
                  </span>
                </div>
                <div class="fr mfd-fms-fpln-fix-info-table-row-3">
                  <span class="fc mfd-fms-fpln-fix-info-table-col-left">
                    <span class="mfd-fms-fpln-fix-info-radius-header">RADIUS</span>

                    <InputField<number, number, false>
                      class="mfd-fms-fpln-fix-info-radius-1"
                      disabled={this.flightPlan.fixInfos[value].map((it) => it?.fix === undefined)}
                      readonlyValue={this.flightPlan.fixInfos[value].map((it) => it?.radii?.[0]?.radius ?? null)}
                      onModified={(radius) => {
                        if (radius === null) {
                          return;
                        }

                        this.props.fmcService.master?.flightPlanService.editFixInfoEntry(value, (fixInfo) => {
                          if (!fixInfo.radii) {
                            fixInfo.radii = [];
                          }

                          fixInfo.radii[0] = { radius };

                          return fixInfo;
                        });
                      }}
                      errorHandler={(msg) => this.props.mfd.showFmsErrorMessage(msg)}
                      dataEntryFormat={new RadiusFormat()}
                      tmpyActive={this.flightPlanManager.temporaryPlanExists}
                      hEventConsumer={this.props.mfd.hEventConsumer}
                      interactionMode={this.props.mfd.interactionMode}
                    />
                  </span>
                  <span class="mfd-fms-fpln-fix-info-table-col-right"></span>
                </div>
                <div class="fr mfd-fms-fpln-fix-info-table-row-4">
                  <span class="mfd-fms-fpln-fix-info-table-col-left">
                    <Button
                      disabled
                      label="ABEAM"
                      buttonStyle="width: 123px; margin-top: .6rem; margin-left: 1.35rem;"
                      onClick={() => {}}
                    />
                  </span>
                  <span class="mfd-fms-fpln-fix-info-table-col-right"></span>
                </div>
              </div>
            </TopTabNavigatorPage>
          ))}
        </TopTabNavigator>

        <Button
          label="RETURN"
          onClick={() => {
            this.props.mfd.uiService.navigateTo(`fms/${this.props.mfd.uiService.activeUri.get().category}/f-pln`);
          }}
          buttonStyle="width: 130px; margin-left: 12px;"
        />

        {/* end page content */}
        <Footer bus={this.props.bus} mfd={this.props.mfd} fmcService={this.props.fmcService} />
      </>
    );
  }
}

interface FixInfoPredictionRowProps extends ComponentProps {
  /** Whether a temporary flight plan is active */
  tmpyActive: Subscribable<boolean>;
}

class FixInfoPredictionRow extends DisplayComponent<FixInfoPredictionRowProps> {
  private readonly subscriptions: Subscription[] = [];

  private readonly buttonRef = FSComponent.createRef<Button>();

  private readonly ete = Subject.create(NaN);

  private readonly eteFormatter = DateTimeFormatter.create('{HH}:{mm}', { nanString: '--:--' });

  private readonly eteText = Subject.create('');

  private readonly distance = Subject.create(NaN);

  private readonly distanceFormatter = NumberFormatter.create({ precision: 1, maxDigits: 4, nanString: '----' });

  private readonly distanceText = Subject.create('');

  private readonly distanceUnitVisible = Subject.create(false);

  private readonly altitude = Subject.create(NaN);

  private readonly altitudeFormatter = NumberFormatter.create({ precision: 1, pad: 3, maxDigits: 4, nanString: '---' });

  private readonly altitudeText = Subject.create('');

  private readonly altitudeUnitVisible = Subject.create(false);

  private readonly insertAsWaypointButtonVisible = Subject.create(false);

  onAfterRender(node: VNode) {
    super.onAfterRender(node);

    this.subscriptions.push(this.ete.pipe(this.eteText, this.eteFormatter));
    this.subscriptions.push(this.distance.pipe(this.distanceText, this.distanceFormatter));
    this.subscriptions.push(this.distance.pipe(this.distanceUnitVisible, (distance) => Number.isFinite(distance)));
    this.subscriptions.push(this.altitude.pipe(this.altitudeText, this.altitudeFormatter));
    this.subscriptions.push(this.altitude.pipe(this.altitudeUnitVisible, (altitude) => Number.isFinite(altitude)));
  }

  public render(): VNode | null {
    return (
      <span
        class={{
          fr: true,
          ac: true,
          'mfd-fms-fpln-fix-info-intercept-row': true,
          tmpy: this.props.tmpyActive,
        }}
      >
        <span class="fr aic mfd-fms-fpln-fix-info-eta">
          <span class="mfd-value bigger">{this.eteText}</span>
        </span>
        <span class="fr aic mfd-fms-fpln-fix-info-dist">
          <span class="mfd-value bigger">{this.distanceText}</span>
          <span
            class="mfd-label-unit"
            style={{ visibility: this.distanceUnitVisible.map((it) => (it ? 'visible' : 'hidden')) }}
          >
            NM
          </span>
        </span>
        <span class="fr aic mfd-fms-fpln-fix-info-alt">
          <span
            class="mfd-label-unit"
            style={{ visibility: this.altitudeUnitVisible.map((it) => (it ? 'visible' : 'hidden')) }}
          >
            FL
          </span>
          <span class="mfd-value bigger">{this.altitudeText}</span>
        </span>

        <Button disabled visible={this.insertAsWaypointButtonVisible} label={'INSERT\nAS WPT*'} onClick={() => {}} />
      </span>
    );
  }
}
