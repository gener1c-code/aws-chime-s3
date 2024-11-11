const AWS = require("aws-sdk");
const { ChimeSDKMediaPipelinesClient, CreateMediaCapturePipelineCommand } = require("@aws-sdk/client-chime-sdk-media-pipelines"); // CommonJS import

const aws_region = 'ap-southeast-1';
const aws_access_key = '';
const aws_secret_key = '';
const aws_s3_bucket_name = '';
const aws_client_id = '';
const aws_chime_endpoint = `https://meetings-chime.${aws_region}.amazonaws.com`;

const chime = new AWS.Chime({ region: aws_region });
const config = {
    region: aws_region,
    credentials: {
        accessKeyId: aws_access_key,
        secretAccessKey: aws_secret_key
    }
};
const client = new ChimeSDKMediaPipelinesClient(config);

//Replace region as needed. Using 'us-east-1' in this example.
chime.endpoint = new AWS.Endpoint(aws_chime_endpoint);

const json = (statusCode, contentType, body) => {
    return {
        statusCode,
        headers: { "content-type": contentType },
        body: JSON.stringify(body),
    };
};

function createUUID(){
    var dt = new Date().getTime();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = (dt + Math.random() * 16) % 16 | 0;
        dt = Math.floor(dt / 16);
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

// Create or join existing meeting
async function doMeeting(event) {

    const query = event.queryStringParameters;

    let meetingId = "";
    let meeting = null;
    let userName = "";

    const theBodyContent = JSON.parse(event.body);
    meetingId = theBodyContent.MEETING_ID;
    userName = theBodyContent.USERNAME;

    let meetingToken;
    if ((meetingId === "") || (meetingId === null) || (meetingId === "null")) {
        // New meeting

        meetingToken = createUUID();
        console.log("Note: New Meeting");
        meeting = await chime
            .createMeeting({
                ClientRequestToken: meetingToken,
                MediaRegion: aws_region,
                ExternalMeetingId: meetingToken,
            })
            .promise();

    } else {
        // Fetch meeting details
        try {
            meetingId = query.meetingId;
            meeting = await chime.getMeeting({
                MeetingId: meetingId,
            })
                .promise();
        } catch (e) {
            if (e.code === "NotFound") {
                console.log("Meeting Not Found");
            }
            return json(200, "application/json", {});
        }

    }

    console.log("External User Id: " + `${userName}#${query.clientId}`);

    // Add attendee to the meeting (new or existing)
    const attendee = await chime
        .createAttendee({
            MeetingId: meeting.Meeting.MeetingId,
            ExternalUserId: `${userName}#${query.clientId}`,
        })
        .promise();

    return json(200, "application/json", {
        Info: {
            Meeting: meeting,
            Attendee: attendee,
        },
    });
}

async function createMeeting(event) {

    let meeting = null;
    let meetingToken = createUUID();

    console.log("Note: New scheduled meeting created!");

    meeting = await chime.createMeeting({
        ClientRequestToken: meetingToken,
        MediaRegion: aws_region,
        ExternalMeetingId: meetingToken,
    })
        .promise();

    return json(200, "application/json", {
        Info: {
            Meeting: meeting
        }
    });
}

// Delete attendee from the meeting
async function deleteAttendee(event) {
    const body = JSON.parse(event.body);
    const deleteRequest = await chime.deleteAttendee({
        MeetingId: body.MEETING_ID,
        AttendeeId: body.ATTENDEE_ID
    }).promise();
    return json(200, "application/json", {});
}

// Delete the meeting
async function deleteMeeting(event) {
    const body = JSON.parse(event.body);
    console.log("NOTE end func: Meeting ID Received: " + body.MEETING_ID);
    const deleteRequest = await chime.deleteMeeting({
        MeetingId: body.MEETING_ID
    }).promise();
    return json(200, "application/json", {});
}

//artifacts will be stored to aws s3
async function startRecordingLatest(event) {
    const body = JSON.parse(event.body);
    const meetingId = body.MEETING_ID;

    const sinkArn = `arn:aws:s3:::${aws_s3_bucket_name}`;
    const aws_source_arn = `arn:aws:chime:${aws_region}:${aws_client_id}:meeting:${meetingId}`;

    const input = {
        SourceType: "ChimeSdkMeeting",
        SourceArn: aws_source_arn,
        SinkType: "S3Bucket",
        SinkArn: sinkArn,
        ClientRequestToken: `token-${Date.now()}`,
        ChimeSdkMeetingConfiguration: {
            ArtifactsConfiguration: {
                "Audio": {
                    "State": "Enabled",
                    "MuxType": "AudioOnly"
                },
                "Video": {
                    "State": "Enabled",
                    "MuxType": "VideoOnly"
                },
                "Content": {
                    "State": "Enabled",
                    "MuxType": "ContentOnly"
                },
            }
        }
    };

    const command = new CreateMediaCapturePipelineCommand(input);

    try {
        console.log('Starting media capture pipeline with configuration:', JSON.stringify(input, null, 2));
        const response = await client.send(command);
        console.log('Recording started successfully:', response.MediaCapturePipeline);

        return {
            statusCode: 200,
            body: JSON.stringify(response.MediaCapturePipeline),
        };

    } catch (error) {
        console.error('Error starting recording:', error.message);
        console.error('Error details:', error);  // Log full error object for detailed debugging

        // Additional logging specific to `audiovideostop` if relevant
        if (error.message.includes("audiovideostop")) {
            console.warn('Audio/Video stopped unexpectedly during recording initiation. Check AWS Chime SDK configurations.');
        }

        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message }),
        };
    }
}

exports.handler = async (event, context, callback) => {
    const bodyContent = JSON.parse(event.body);
    if (bodyContent.action === "DO_MEETING")
    {
        return doMeeting(event);
    }
    else if (bodyContent.action === "CREATE_MEETING")
    {
        return createMeeting(event);
    }
    else if (bodyContent.action === "DELETE_ATTENDEE")
    {
        return deleteAttendee(event);
    }
    else if (bodyContent.action === "END_MEETING")
    {
        return deleteMeeting(event);
    }
    else if (bodyContent.action === "START_RECORDING")
    {
        return startRecordingLatest(event);
    }
    else
    {
        console.log("Event Unrecognized");
        return json(200, "application/json", {});
    }

}
