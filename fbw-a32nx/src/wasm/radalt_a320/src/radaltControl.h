#pragma once

#include "SimVars.h"

HANDLE  hSimConnect;
SimVars* simVars;

double  devState = 0.0;
bool	debug = true;
double	radarAltitude = 0.0;
double	snrMax = 0.0;
double	beamActual = 0.0;
double	beamMin = 0.0;   // Debug
double  snrActual = 0.0;
double	planeAltitude = 0.0; // Debug
double	probeAltitude = 0.0; // Debug
double	planeAboveGround = 0.0; // Debug
int		testIndex = 0;		 // Debug
int		interval = 1;	 // Debug
int     quit = 0;

static bool	radarActive = false;

constexpr int	 MAX_AI = 100;
constexpr double PI = 3.141592653589790;
constexpr double PI_FOURTH = 97.4090910340024;
constexpr double DEG_TO_RAD = PI / 180.0;
constexpr double RAD_TO_DEG = 180.0 / PI;
constexpr double PHI_2D = 1.32471795724474602596;		// 2D golden ratio
constexpr double ALPHA_0 = 1 / PHI_2D;
constexpr double ALPHA_1 = ALPHA_0 * ALPHA_0;
constexpr double EARTH_RAD = 20888156.17;				// earth's radius in feet
constexpr double LIGHT_SPEED = 299792458;				// speed of light in m/s
constexpr double POWER_TX = 0.1;						// peak transmit power in Watts (20 dBm)
constexpr double GAIN_ANTENNA = 10;						// transmit/ receive antenna gain (unitless)
constexpr double WAVELENGTH_SQUARED = 4.8607635E-03;	// wavelength in meters for a 4.3 GHz signal
constexpr double RCS = 16709011;						// radar cross section in meter^2 for a 1 x 1 meter terrain sample
constexpr double NOISE_FLOOR = -140;					// noise floor in dBm

constexpr double MAX_ANGLE = 1.56;						// around 90 degree limit
constexpr double H_ANGLE = 40;							// in degrees
constexpr double V_ANGLE = 20;							// in degrees
constexpr double MAX_BEAM_DISTANCE = 8192;						// in feet

constexpr double GAIN_FACTOR = 2.0 * POWER_TX * GAIN_ANTENNA * WAVELENGTH_SQUARED * RCS;
constexpr double PI_FACTOR = 4.0 * PI_FOURTH;
constexpr double K = GAIN_FACTOR / PI_FACTOR;

const double TAN_H_ANGLE = tan(H_ANGLE * DEG_TO_RAD);
const double TAN_V_ANGLE = tan(V_ANGLE * DEG_TO_RAD);

// convert degrees to radians
inline double deg2rad(double deg)
{
	return deg * DEG_TO_RAD;
}

// convert radians to degrees
inline double rad2deg(double rad)
{
	return rad * RAD_TO_DEG;
}

// finds maximum of two values
bool isNewSnrMax(double newSnr, double maxSnr)
{
	return newSnr > maxSnr;
}

struct UserStruct
{
	double  altitude;
	double  altitudeAboveGround;
	double  latitude;
	double  longitude;
	double  heading;
	double  bank;
	double  pitch;
};

struct ProbeStruct
{
	double  altitude;
	double  altitudeAboveGround;
	double  latitude;
	double  longitude;
	double	pitch;
	double	heading;
};

struct ProbeInfo
{
	SIMCONNECT_OBJECT_ID id;
	bool created;
};

static enum EVENT_ID {
	EVENT_RADAR_ON,
	EVENT_RADAR_OFF,
	EVENT_FREEZE_LATLONG,
	EVENT_FREEZE_ALTITUDE,
	EVENT_FREEZE_ATTITUDE
};

static enum DATA_DEFINE_ID {
	DEFINITION_USER_POS,
	DEFINITION_PROBE_POS
};

static enum DATA_REQUEST_ID {
	REQUEST_USER_DATA,
	REQUEST_PROBE_CREATE = 0x00100000,
	REQUEST_PROBE_REMOVE = 0x00200000,
	REQUEST_PROBE_DATA = 0x00300000,
	//REQUEST_PROBE_RELEASE = 0x00400000
};

static enum GROUP_ID {
	GROUP_ZX,
};

static enum INPUT_ID {
	INPUT_ZX,
};

// create varS to hold user plane position
UserStruct	userPosition;
ProbeStruct probePosition;
ProbeInfo	probeIndexnfo[MAX_AI];

double probeSNR(double beamActual) {
	return (10 * std::log10(K / std::pow(beamActual, 4))) - NOISE_FLOOR;
}

// Returns new lat/ long probe coordinates for each probe
// Beam distance coded as pitch
// TO BE CHECKED
ProbeStruct distanceAndBearing(UserStruct user, int probeIndex) {
	double probeX, probeY, bearing, distance;
	double lat1, lon1, lat2, lon2, xDist, yDist;
	double altitudeAboveGround = user.altitudeAboveGround;
	double bank = user.bank;
	double pitch = user.pitch;

	/* Setting constrains */
	altitudeAboveGround = (altitudeAboveGround > MAX_BEAM_DISTANCE) ? MAX_BEAM_DISTANCE : altitudeAboveGround;
	bank = (bank > MAX_ANGLE) ? MAX_ANGLE : ((bank < -MAX_ANGLE) ? -MAX_ANGLE : bank);
	pitch = (pitch > MAX_ANGLE) ? MAX_ANGLE : ((pitch < -MAX_ANGLE) ? -MAX_ANGLE : pitch);

	ProbeStruct probe;
	
	xDist = TAN_H_ANGLE * altitudeAboveGround;
	yDist = TAN_V_ANGLE * altitudeAboveGround;

	// Quasi-random R2 
	probeX = (0.5 + (ALPHA_0 * probeIndex));
	probeY = (0.5 + (ALPHA_1 * probeIndex));

	probeX = 2 * xDist * (probeX - (int)probeX - 0.5) + (tan(bank) * altitudeAboveGround);
	probeY = 2 * yDist * (probeY - (int)probeY - 0.5) - (tan(pitch) * altitudeAboveGround);

	bearing = atan(probeX / probeY);				  // 2D top-down bearing (degrees)
	distance = sqrt(pow(probeX, 2) + pow(probeY, 2)); // 2D top-down distance (feet)

	if (probeY < 0) {
		bearing = bearing + PI;
	}
	else if (probeX < 0 && probeY > 0) {
		bearing = (2 * PI) + bearing;
	}

	// LAT/LON Translation
	lat1 = deg2rad(user.latitude);
	lon1 = deg2rad(user.longitude);
	bearing = user.heading + bearing;

	// New Coordinates
	lat2 = asin((sin(lat1) * cos(distance / EARTH_RAD)) + (cos(lat1) * sin(distance / EARTH_RAD) * cos(bearing)));
	lon2 = lon1 + (atan2(sin(bearing) * sin(distance / EARTH_RAD) * cos(lat1), cos(distance / EARTH_RAD) - sin(lat1) * sin(lat2)));

	probe.latitude = rad2deg(lat2);
	probe.longitude = rad2deg(lon2);

	probe.pitch = distance / 100; // used to represent 2D beam distance from aircraft to probe
	probe.heading = bearing;

	return probe;
}

// Creates initial probe mesh when RA is turned on. Called by REQUEST_USER_DATA
void createProbeMesh(int probeIndex)
{
	SIMCONNECT_DATA_INITPOSITION initPosition;
	HRESULT hr;

	devState = simVars->getDeveloperState();

	ProbeStruct probeResult = distanceAndBearing(userPosition, probeIndex);

	if (debug) std::cout << "RADALT: Creating Probe (" << probeIndex << ") .." << std::endl;

	// Initialize probe 
	initPosition.Latitude = probeResult.latitude;
	initPosition.Longitude = probeResult.longitude;
	initPosition.Altitude = 0.0;
	initPosition.Pitch = 0.0;
	initPosition.Bank = 0.0;
	initPosition.Heading = 0.0;
	initPosition.OnGround = 1;
	initPosition.Airspeed = 0;

	if (devState == 3.0)
		hr = SimConnect_AICreateSimulatedObject(hSimConnect, "ralt_probe", initPosition, (UINT)REQUEST_PROBE_CREATE + probeIndex);
	else
		hr = SimConnect_AICreateSimulatedObject(hSimConnect, "triangleWithoutIndices", initPosition, (UINT)REQUEST_PROBE_CREATE + probeIndex);
}

// Removes the probe mesh when RA is turned off. Called by REQUEST_PROBE_DATA
void removeProbeMesh(int probeIndex) {

	HRESULT hr;

	if (probeIndexnfo[probeIndex].created) {

		if (debug) std::cout << "RADALT: Removing Probe (" << probeIndex << ").." << std::endl;
		probeIndexnfo[probeIndex].created = false;

		hr = SimConnect_AIRemoveObject(hSimConnect, probeIndexnfo[probeIndex].id, (UINT)REQUEST_PROBE_REMOVE + probeIndex);
		hr = SimConnect_RequestDataOnSimObject(hSimConnect,
			(UINT)REQUEST_PROBE_DATA + probeIndex,
			DEFINITION_PROBE_POS,
			probeIndexnfo[probeIndex].id,
			SIMCONNECT_PERIOD_NEVER);
		if (probeIndex == MAX_AI - 1) {
			hr = SimConnect_RequestDataOnSimObject(hSimConnect,
				REQUEST_USER_DATA,
				DEFINITION_USER_POS,
				SIMCONNECT_OBJECT_ID_USER,
				SIMCONNECT_PERIOD_NEVER);
		}
	}
}

// Function called everytime the aircraft's RA is ready to emit. Called by EVENT_RADAR_ON
void getStartupData() {
	HRESULT hr;

	if (debug) std::cout << "Entering getStartupData()... " << std::endl;

	hr = SimConnect_RequestDataOnSimObject(hSimConnect,
		REQUEST_USER_DATA,
		DEFINITION_USER_POS,
		SIMCONNECT_OBJECT_ID_USER,
		SIMCONNECT_PERIOD_SIM_FRAME,
		0, 0, interval, 0); //SIMCONNECT_DATA_REQUEST_FLAG_CHANGED

	for (int i = 0; i < MAX_AI; i++) {
		if (!radarActive) {
			createProbeMesh(i);
		}
	}

	radarActive = true;
}

// Function called to stop RA emission. Called by EVENT_RADAR_OFF
void removeProbes() {

	for (int i = 0; i < MAX_AI; i++) {
		removeProbeMesh(i);
	}
	radarActive = false;
}

// Calls freeze events on each probe. Called within REQUEST_PROBE_CREATE
void probeInit(int probeIndex)
{
	HRESULT hr;
	//hr = SimConnect_AIReleaseControl(hSimConnect, probeIndexnfo[probeIndex].id, (UINT)REQUEST_PROBE_RELEASE+probeIndex);

	//hr = SimConnect_TransmitClientEvent(hSimConnect,
	//  probeIndexnfo[probeIndex].id,
	//  EVENT_FREEZE_ALTITUDE,
	//  1, // set freeze value to 1
	//  SIMCONNECT_GROUP_PRIORITY_HIGHEST,
	//  SIMCONNECT_EVENT_FLAG_GROUPID_IS_PRIORITY);
	hr = SimConnect_TransmitClientEvent(hSimConnect,
		probeIndexnfo[probeIndex].id,
		EVENT_FREEZE_ATTITUDE,
		1, // set freeze value to 1
		SIMCONNECT_GROUP_PRIORITY_HIGHEST,
		SIMCONNECT_EVENT_FLAG_GROUPID_IS_PRIORITY);
	hr = SimConnect_TransmitClientEvent(hSimConnect,
		probeIndexnfo[probeIndex].id,
		EVENT_FREEZE_LATLONG,
		1, // set freeze value to 1
		SIMCONNECT_GROUP_PRIORITY_HIGHEST,
		SIMCONNECT_EVENT_FLAG_GROUPID_IS_PRIORITY);
}

// Sets request for probe position while probes are being created. Called within REQUEST_PROBE_CREATE
void getUpdatedProbe(int probeIndex) {
	HRESULT hr;

	hr = SimConnect_RequestDataOnSimObject(hSimConnect,
		(UINT)REQUEST_PROBE_DATA + probeIndex,
		DEFINITION_PROBE_POS,
		probeIndexnfo[probeIndex].id,
		SIMCONNECT_PERIOD_SIM_FRAME,
		0, 0, interval, 0); // SIMCONNECT_DATA_REQUEST_FLAG_CHANGED

}

// Sets new probe mesh position. Called by REQUEST_PROBE_DATA
void updateProbeMesh(int probeIndex) {
	HRESULT hr;

	ProbeStruct probe = distanceAndBearing(userPosition, probeIndex);

	probePosition.latitude = probe.latitude;
	probePosition.longitude = probe.longitude;
	probePosition.altitudeAboveGround = 0.0;
	probePosition.pitch = probe.pitch;
	probePosition.heading = probe.heading;

	hr = SimConnect_SetDataOnSimObject(hSimConnect,
		DEFINITION_PROBE_POS,
		probeIndexnfo[probeIndex].id,
		0,
		0,
		sizeof(ProbeStruct),
		&probePosition);
}

void readProbeData(int probeIndex, ProbeStruct probePosition) {
	if (probeIndex == 0) {
		snrMax = -99999;
		radarAltitude = 99999;
	}

	beamActual = sqrt(pow(probePosition.pitch * 100, 2) + pow(userPosition.altitude - probePosition.altitude, 2));
	snrActual = probeSNR(beamActual);

	if (isNewSnrMax(snrActual, snrMax)) {
		radarAltitude = userPosition.altitude - probePosition.altitude;
		snrMax = snrActual;
		planeAltitude = userPosition.altitude; // Debug
		probeAltitude = probePosition.altitude; // Debug
		planeAboveGround = userPosition.altitudeAboveGround; // Debug
		testIndex = probeIndex; // Debug
	}

	if (probeIndex == MAX_AI - 1) {
		if (radarAltitude > MAX_BEAM_DISTANCE || snrMax < NOISE_FLOOR)
			radarAltitude = 99999;

		simVars->setRadarAltitude(radarAltitude);

		if (debug) {
			std::cout << "RADALT: SNR Probe (" << testIndex <<
				") Plane_Alt: " << planeAltitude <<
				" Probe_Alt: " << probeAltitude <<
				" Plane_AltAbv: " << planeAboveGround <<
				" SNR: " << snrMax <<
				" RA: " << radarAltitude << std::endl;
		}
	}
}

static const char* ExceptionName(SIMCONNECT_EXCEPTION exception) {
	switch (exception) {
	case SIMCONNECT_EXCEPTION_NONE:				//0
		return "EXCEPTION_NONE (0)";
	case SIMCONNECT_EXCEPTION_ERROR:			//1
		return "EXCEPTION_ERROR (1)";
	case SIMCONNECT_EXCEPTION_SIZE_MISMATCH:	//2
		return "EXCEPTION_SIZE_MISMATCH (2)";
	case SIMCONNECT_EXCEPTION_UNRECOGNIZED_ID:	//3
		return "EXCEPTION_UNRECOGNIZED_ID (3)";
	case SIMCONNECT_EXCEPTION_UNOPENED:			//4
		return "EXCEPTION_UNOPENED (4)";
	case SIMCONNECT_EXCEPTION_VERSION_MISMATCH:	//5
		return "EXCEPTION_VERSION_MISMATCH (5)";
	case SIMCONNECT_EXCEPTION_TOO_MANY_GROUPS:	//6
		return "EXCEPTION_TOO_MANY_GROUPS (6)";
	case SIMCONNECT_EXCEPTION_NAME_UNRECOGNIZED://7
		return "EXCEPTION_NAME_UNRECOGNIZED (7)";
	case SIMCONNECT_EXCEPTION_TOO_MANY_EVENT_NAMES:		//8
		return "EXCEPTION_TOO_MANY_EVENT_NAMES (8)";
	case SIMCONNECT_EXCEPTION_EVENT_ID_DUPLICATE:		//9
		return "EXCEPTION_EVENT_ID_DUPLICATE (9)";
	case SIMCONNECT_EXCEPTION_TOO_MANY_MAPS:			//10
		return "EXCEPTION_TOO_MANY_MAPS (10)";
	case SIMCONNECT_EXCEPTION_TOO_MANY_OBJECTS:			//11
		return "EXCEPTION_TOO_MANY_OBJECTS (11)";
	case SIMCONNECT_EXCEPTION_TOO_MANY_REQUESTS:				//12
		return "EXCEPTION_TOO_MANY_REQUESTS (12)";
	case SIMCONNECT_EXCEPTION_WEATHER_INVALID_PORT:				//13
		return "EXCEPTION_WEATHER_INVALID_PORT (13)";
	case SIMCONNECT_EXCEPTION_WEATHER_INVALID_METAR:			//14
		return "EXCEPTION_WEATHER_INVALID_METAR (14)";
	case SIMCONNECT_EXCEPTION_WEATHER_UNABLE_TO_GET_OBSERVATION://15
		return "EXCEPTION_WEATHER_UNABLE_TO_GET_OBSERVATION (15)";
	case SIMCONNECT_EXCEPTION_WEATHER_UNABLE_TO_CREATE_STATION:	//16
		return "EXCEPTION_WEATHER_UNABLE_TO_CREATE_STATION (16)";
	case SIMCONNECT_EXCEPTION_WEATHER_UNABLE_TO_REMOVE_STATION:	//17
		return "EXCEPTION_WEATHER_UNABLE_TO_REMOVE_STATION (17)";
	case SIMCONNECT_EXCEPTION_INVALID_DATA_TYPE:				//18
		return "EXCEPTION_INVALID_DATA_TYPE (18)";
	case SIMCONNECT_EXCEPTION_INVALID_DATA_SIZE:				//19
		return "EXCEPTION_INVALID_DATA_SIZE (19)";
	case SIMCONNECT_EXCEPTION_DATA_ERROR:						//20
		return "EXCEPTION_DATA_ERROR (20)";
	case SIMCONNECT_EXCEPTION_INVALID_ARRAY:			//21
		return "EXCEPTION_INVALID_ARRAY (21)";
	case SIMCONNECT_EXCEPTION_CREATE_OBJECT_FAILED:		//22
		return "EXCEPTION_CREATE_OBJECT_FAILED (22)";
	case SIMCONNECT_EXCEPTION_LOAD_FLIGHTPLAN_FAILED:	//23
		return "EXCEPTION_LOAD_FLIGHTPLAN_FAILED (23)";
	case SIMCONNECT_EXCEPTION_OPERATION_INVALID_FOR_OBJECT_TYPE://24
		return "EXCEPTION_OPERATION_INVALID_FOR_OBJECT_TYPE (24)";
	case SIMCONNECT_EXCEPTION_ILLEGAL_OPERATION:				//25
		return "EXCEPTION_ILLEGAL_OPERATION (25)";
	case SIMCONNECT_EXCEPTION_ALREADY_SUBSCRIBED:				//26
		return "EXCEPTION_ALREADY_SUBSCRIBED (26)";
	case SIMCONNECT_EXCEPTION_INVALID_ENUM:						//27
		return "EXCEPTION_INVALID_ENUM (27)";
	case SIMCONNECT_EXCEPTION_DEFINITION_ERROR:	//28
		return "EXCEPTION_DEFINITION_ERROR (28)";
	case SIMCONNECT_EXCEPTION_DUPLICATE_ID:		//29
		return "EXCEPTION_DUPLICATE_ID (29)";
	case SIMCONNECT_EXCEPTION_DATUM_ID:			//30
		return "EXCEPTION_DATUM_ID (30)";
	case SIMCONNECT_EXCEPTION_OUT_OF_BOUNDS:	//31
		return "EXCEPTION_OUT_OF_BOUNDS (31)";
	case SIMCONNECT_EXCEPTION_ALREADY_CREATED:	//32
		return "EXCEPTION_ALREADY_CREATED (32)";
	case SIMCONNECT_EXCEPTION_OBJECT_OUTSIDE_REALITY_BUBBLE://33
		return "EXCEPTION_OBJECT_OUTSIDE_REALITY_BUBBLE (33)";
	case SIMCONNECT_EXCEPTION_OBJECT_CONTAINER:				//34
		return "EXCEPTION_OBJECT_CONTAINER (34)";
	case SIMCONNECT_EXCEPTION_OBJECT_AI:					//35
		return "EXCEPTION_OBJECT_AI (35)";
	case SIMCONNECT_EXCEPTION_OBJECT_ATC:					//36
		return "EXCEPTION_OBJECT_ATC (36)";
	case SIMCONNECT_EXCEPTION_OBJECT_SCHEDULE:				//37
		return "EXCEPTION_OBJECT_SCHEDULE (37)";
	default:
		return "UNKNOWN EXCEPTION";
	}
}
void CALLBACK RadaltDispatchProc(SIMCONNECT_RECV* pData, DWORD cbData, void* pContext)
{
	switch (pData->dwID)
	{
	case SIMCONNECT_RECV_ID_EVENT:
	{
		SIMCONNECT_RECV_EVENT* evt = (SIMCONNECT_RECV_EVENT*)pData;

		switch (evt->uEventID)
		{
		case EVENT_RADAR_ON:
			if (!radarActive)
			{
				simVars = new SimVars();
				getStartupData();
			}
			break;
		case EVENT_RADAR_OFF:
			if (radarActive)
			{
				removeProbes();
			}
			break;
		default:
			std::cout << "RADALT: Unknown event: " << evt->uEventID << std::endl;
			break;
		}
		break;
	}
	case SIMCONNECT_RECV_ID_SIMOBJECT_DATA:
	{
		SIMCONNECT_RECV_SIMOBJECT_DATA* pObjData = (SIMCONNECT_RECV_SIMOBJECT_DATA*)pData;

		if (pObjData->dwRequestID >= (UINT)REQUEST_PROBE_DATA &&
			pObjData->dwRequestID < (UINT)REQUEST_PROBE_DATA + MAX_AI) {

			UINT probeIndex = (UINT)pObjData->dwRequestID - (UINT)REQUEST_PROBE_DATA;

			ProbeStruct* pS = (ProbeStruct*)&pObjData->dwData;

			probePosition.altitude = pS->altitude;
			probePosition.altitudeAboveGround = pS->altitudeAboveGround;
			probePosition.latitude = pS->latitude;
			probePosition.longitude = pS->longitude;
			probePosition.pitch = pS->pitch;            // ground distance
			probePosition.heading = pS->heading;        // ground bearing

			updateProbeMesh(probeIndex);
			readProbeData(probeIndex, probePosition);

		}
		else if (pObjData->dwRequestID == (UINT)REQUEST_USER_DATA) {
			UserStruct* uS = (UserStruct*)&pObjData->dwData;

			userPosition.altitude = uS->altitude;
			userPosition.altitudeAboveGround = uS->altitudeAboveGround;
			userPosition.latitude = uS->latitude;
			userPosition.longitude = uS->longitude;
			userPosition.heading = uS->heading;
			userPosition.bank = uS->bank;
			userPosition.pitch = uS->pitch;

		}
		break;
	}
	case SIMCONNECT_RECV_ID_ASSIGNED_OBJECT_ID:
	{
		SIMCONNECT_RECV_ASSIGNED_OBJECT_ID* pObjData = (SIMCONNECT_RECV_ASSIGNED_OBJECT_ID*)pData;

		if (pObjData->dwRequestID >= (UINT)REQUEST_PROBE_CREATE &&
			pObjData->dwRequestID < (UINT)REQUEST_PROBE_CREATE + MAX_AI) {

			UINT probeIndex = (UINT)pObjData->dwRequestID - (UINT)REQUEST_PROBE_CREATE;
			probeIndexnfo[probeIndex].id = pObjData->dwObjectID;
			probeIndexnfo[probeIndex].created = true;

			probeInit(probeIndex);

			if (debug) std::cout << "Created probe id = " << probeIndexnfo[probeIndex].id << std::endl;

			getUpdatedProbe(probeIndex);
		}
		else {
			if (debug) std::cout << "Unknown creation %d" << pObjData->dwRequestID << std::endl;
		}
		break;
	}
	case SIMCONNECT_RECV_ID_QUIT:
	{
		quit = 1;
		break;
	}
	case SIMCONNECT_RECV_ID_EXCEPTION:
	{
		SIMCONNECT_RECV_EXCEPTION* data = (SIMCONNECT_RECV_EXCEPTION*)(pData);
		SIMCONNECT_EXCEPTION exception = (SIMCONNECT_EXCEPTION)(data->dwException);
		std::cout << "Exception: " << ExceptionName(exception) << std::endl;
		break;
	}
	default:
		std::cout << "Received: " << pData->dwID << std::endl;
		break;
	}
}