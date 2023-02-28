import { FlightPhase } from './FlightPhase';

/**
 * Possible next flight phases:
 * 1. DISEMBARKATION
 * 2. AFTER DISEMBARKATION
 */
export class TaxiAfterLandingPhase extends FlightPhase {
    private nextFlightPhases: FlightPhase[];

    public init(...flightPhases: FlightPhase[]) {
        this.nextFlightPhases = flightPhases;
    }

    public tryTransition(): void {
        this.nextFlightPhases.forEach((current) => {
            if (current.shouldActivate()) {
                this.sendNewFlightPhaseToManager(current);
            }
        });
    }

    public shouldActivate(): boolean {
        return (
            this.flightPhaseManager.director.memory.onGround
            && this.flightPhaseManager.director.memory.groundSpeed < 80
            && this.flightPhaseManager.director.memory.groundSpeed > 0
        );
    }

    public getValue(): number {
        return 10;
    }
}
