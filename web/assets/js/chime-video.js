//gateway to start meeting, stop meeting etc.
//replace with actual value from aws gateway. Eg. https://99zy3uwsgz.execute-api.ap-southeast-1.amazonaws.com/chime-test
const MEETING_SERVICE = "";

//gateway to trigger recording
//replace with actual value from aws gateway. Eg. https://99zy3uwsgz.execute-api.ap-southeast-1.amazonaws.com/chime-test-recording
const MEETING_SERVICE_RECORDING = "";

let isMeetingHost = false;
let meetingId = "";
let attendeeId = "";
let userName = "";
let clientId = "";
let isScreenShared = false;
const attendees = new Set();

let urlParams = new URLSearchParams(window.location.search);

// meetingId will be available if a user tries to join a meeting via a meeting URL
meetingId = urlParams.get("meetingId");

console.log(meetingId);

// Generate a unique client Id for the user
clientId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

let requestPath = MEETING_SERVICE + `?clientId=${clientId}`;
let requestPathRecording = MEETING_SERVICE_RECORDING + `?clientId=${clientId}`;

// Setup logger
const logger = new window.ChimeSDK.ConsoleLogger(
	"ChimeMeetingLogs",
	ChimeSDK.LogLevel.INFO
);

const deviceController = new ChimeSDK.DefaultDeviceController(logger);

// If meetingId is not available, then user is the meeting host.
if (!meetingId) {
	isMeetingHost = true;
}

let startButton = document.getElementById("start-button");
let stopButton = document.getElementById("stop-button");
let exitButton = document.getElementById("exit-button");
let shareButton = document.getElementById("share-button");
let startRecording = document.getElementById("start-recording");
let createMeetingButton = document.getElementById("create-meeting");

if (isMeetingHost) {
	startButton.innerText = "Start";
	stopButton.style.display = "inline-block";
} else {
	startButton.innerText = "Join";
	exitButton.style.display = "inline-block";
	requestPath += `&meetingId=${meetingId}`;
}

startButton.style.display = "inline-block";
shareButton.style.display = "inline-block";

// Create or Join Meeting
async function doMeeting() {
	userName = document.getElementById("username").value;
	if (userName.length === 0) {
		alert("Please enter username");
		return;
	}

	if (userName.indexOf("#") >= 0) {
		alert("Please do not use special characters in User Name");
		return;
	}

	//If Meeting session already present, return.
	if (window.meetingSession) {
		//alert("Meeting already in progress");
		return;
	}
	try {
		//Send request to service(API Gateway > Lambda function) to start/join meeting.
		let response = await fetch(requestPath, {
			method: "POST",
			headers: new Headers(),
			body: JSON.stringify({ action: "DO_MEETING", MEETING_ID: `${meetingId}`, USERNAME: `${userName}` })
		});

		const data = await response.json();

		if (! data.hasOwnProperty('Info')) {
			alert("Oops! The meeting might have ended!");
			console.log("Meeting was not Found");
			return;
		}

		meetingId = data.Info.Meeting.Meeting.MeetingId;
		attendeeId = data.Info.Attendee.Attendee.AttendeeId;

		document.getElementById("meeting-Id").innerText = meetingId;
		if (isMeetingHost) {
			document.getElementById("meeting-link").innerText = window.location.href + "?meetingId=" + meetingId;
		}
		else
		{
			document.getElementById("meeting-link").innerText = window.location.href;
		}

		const configuration = new ChimeSDK.MeetingSessionConfiguration(
			data.Info.Meeting.Meeting,
			data.Info.Attendee.Attendee
		);
		window.meetingSession = new ChimeSDK.DefaultMeetingSession(
			configuration,
			logger,
			deviceController
		);

		// Initialize Audio Video
		const audioInputs = await meetingSession.audioVideo.listAudioInputDevices();
		const videoInputs = await meetingSession.audioVideo.listVideoInputDevices();

		await meetingSession.audioVideo.startAudioInput(audioInputs[0].deviceId);
		await meetingSession.audioVideo.startVideoInput(videoInputs[0].deviceId);

		const observer = {
			// Tile State changed, so let's examine it.
			videoTileDidUpdate: (tileState) => {
				// if no attendeeId bound to tile, ignore it return
				if (!tileState.boundAttendeeId) {
					return;
				}
				//There is an attendee Id against the tile, and it's a valid meeting session, then update tiles view
				if (!(meetingSession === null)) {
					updateTiles(meetingSession);
				}
			},
		};

		const eventObserver = {
			// Check for events of interest for eg. Meeting End.
			eventDidReceive(name, attributes) {
				switch (name) {
					case 'meetingEnded':
						cleanup();
						console.log("NOTE: Meeting Ended", attributes);
						break;
					case 'meetingReconnected':
						console.log('NOTE: Meeting Reconnected...');
						break;
				}
			}
		}

		// Add observers for the meeting session
		meetingSession.audioVideo.addObserver(observer);
		meetingSession.audioVideo.realtimeSubscribeToAttendeeIdPresence(attendeeObserver);
		meetingSession.eventController.addObserver(eventObserver);

		const audioOutputElement = document.getElementById("meeting-audio");
		meetingSession.audioVideo.bindAudioElement(audioOutputElement);
		meetingSession.audioVideo.start();
		meetingSession.audioVideo.startLocalVideoTile();
	}
	catch (err) {
		console.error("Error: " + err);
	}
}

// Update Video Tiles on UI view
function updateTiles(meetingSession) {
	const tiles = meetingSession.audioVideo.getAllVideoTiles();
	tiles.forEach(tile => {
		let tileId = tile.tileState.tileId
		let divElement = document.getElementById("div-" + tileId);
		// If divElement not found.
		let videoElement;
		let tileUserName;
		let boundExtUserId;
		if (!divElement) {
			// Create divElement. Give it a unique id and name
			divElement = document.createElement("div");
			divElement.id = "div-" + +tileId;
			divElement.setAttribute("name", "div-" + tile.tileState.boundAttendeeId);
			divElement.style.display = "inline-block";
			divElement.style.padding = "5px";

			// Create videoElement. Give it a unique id
			videoElement = document.createElement("video");
			videoElement.id = "video-" + tileId;
			videoElement.setAttribute("name", "video-" + tile.tileState.boundAttendeeId);
			videoElement.controls = true;

			// Create 'p' element for username to display above video tile.
			tileUserName = document.createElement("p");
			tileUserName.style.color = "blueviolet";
			boundExtUserId = tile.tileState.boundExternalUserId
			tileUserName.textContent = boundExtUserId.substring(0, boundExtUserId.indexOf("#"));

			// Append appropriately
			divElement.append(tileUserName);
			divElement.append(videoElement);
			document.getElementById("video-list").append(divElement);

			meetingSession.audioVideo.bindVideoElement(
				tileId,
				videoElement
			);
		}
	})
}

// Attendee presence check
// Update the attendees set and div video tiles display based on this.
function attendeeObserver(attendeeId, present, externalUserId, dropped, posInFrame) {

	//Get Attendee User Name from externalUserId where it was set while joining meeting
	let attendeeUserName = externalUserId.substring(0, externalUserId.indexOf("#"));

	// If attendee 'present' is true, add to attendees set.
	if (present) {
		attendees.add(attendeeUserName);
	}
	else {
		// Attendee no longer 'present', remove the attendee display div with video tile
		const elements = document.getElementsByName("div-" + attendeeId);
		elements[0].remove();

		// For screen share attendeeId comes with #content suffix.
		// Do not remove user from attendees if this is screen share closure update
		if (!(attendeeId.indexOf("#content") >= 0)) {
			attendees.delete(attendeeUserName);
		}
	}

	refreshAttendeesDisplay();
}

// Refresh attendee list in UI view
function refreshAttendeesDisplay()
{
	//Create list of attendees from attendees set, and then display.
	let attendeeStr = "";
	for (const item of attendees) {
		attendeeStr = attendeeStr + item + " | ";
	}
	attendeeStr = attendeeStr.slice(0, -3);

	document.getElementById("Attendees").innerText = attendeeStr;
}

// Stop Meeting
async function stopMeeting() {
	//Send request to service(API Gateway > Lambda function) to end the Meeting
	try {
		let response = await fetch(requestPath, {
			method: "POST",
			headers: new Headers(),
			body: JSON.stringify({ action: "END_MEETING", MEETING_ID: `${meetingId}` })
		});

		const data = await response.json();
		console.log("NOTE: END MEETING RESPONSE " + JSON.stringify(data));
		//meetingSession.deviceController.destroy();

		cleanup();
	}
	catch (err) {
		console.error("NOTE Error: " + err);
	}
}


async function startRecord() {
	//Send request to service(API Gateway > Lambda function) to end the Meeting
	try {
		let response = await fetch(requestPathRecording, {
			method: "POST",
			headers: new Headers(),
			body: JSON.stringify({ action: "START_RECORDING", MEETING_ID: `${meetingId}` })
		});

		const data = await response.json();
		console.log("NOTE: RECORDING STARTED " + JSON.stringify(data));
	}
	catch (err) {
		console.error("NOTE Error: " + err);
	}
}

async function createMeeting() {
	try {
		let response = await fetch(requestPathRecording, {
			method: "POST",
			headers: new Headers(),
			body: JSON.stringify({ action: "CREATE_MEETING" })
		});

		const data = await response.json();
		console.log("NOTE: NEW SCHEDULED MEETING CREATED " + JSON.stringify(data));

		meetingId = data.Info.Meeting.Meeting.MeetingId;
		document.getElementById("meeting-Id").innerText = meetingId;
		document.getElementById("meeting-link").innerText = window.location.href + "?meetingId=" + meetingId;
	}
	catch (err) {
		console.error("NOTE Error: " + err);
	}
}

// Leave Meeting
async function exitMeeting() {
	//Send request to service(API Gateway > Lambda function) to delete Attendee Id from meeting.
	try {
		let response = await fetch(requestPath, {
			method: "POST",
			headers: new Headers(),
			body: JSON.stringify({ action: "DELETE_ATTENDEE", MEETING_ID: `${meetingId}`, ATTENDEE_ID: `${attendeeId}` })
		});

		const data = await response.json();
		console.log("NOTE: END MEETING RESPONSE " + JSON.stringify(data));
		//meetingSession.deviceController.destroy();

		cleanup();
	}
	catch (err) {
		console.error("Error: " + err);
	}
}

// Reset
function cleanup()
{
	meetingSession.deviceController.destroy();
	window.meetingSession = null;
	//if meeting host - don't preserve the meeting id.
	if (isMeetingHost)
	{
		meetingId = null;
	}
	document.getElementById("video-list").replaceChildren();
	attendees.clear();
	document.getElementById("meeting-link").innerText = "";
	refreshAttendeesDisplay();
}

// Toggle Screen Share
async function share() {
	try {
		if (window.meetingSession) {
			if (isScreenShared) {
				await meetingSession.audioVideo.stopContentShare();
				shareButton.innerText = "Start Screen Share";
				isScreenShared = false;
			}
			else {
				await meetingSession.audioVideo.startContentShareFromScreenCapture();
				shareButton.innerText = "Stop Screen Share";
				isScreenShared = true;
			}
		}
		else {
			alert("Please start or join a meeting first!");
		}
	}
	catch (err) {
		console.error("Error: " + err);
	}
}



window.addEventListener("DOMContentLoaded", () => {

	startButton.addEventListener("click", doMeeting);

	if (isMeetingHost) {
		stopButton.addEventListener("click", stopMeeting);
	}
	else {
		exitButton.addEventListener("click", exitMeeting);
	}

	startRecording.addEventListener("click", startRecord);

	createMeetingButton.addEventListener("click", createMeeting);

	shareButton.addEventListener("click", share);
});