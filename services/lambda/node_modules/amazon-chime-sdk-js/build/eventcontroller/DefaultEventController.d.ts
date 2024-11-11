import Destroyable from '../destroyable/Destroyable';
import EventObserver from '../eventobserver/EventObserver';
import EventReporter from '../eventreporter/EventReporter';
import Logger from '../logger/Logger';
import MeetingSessionConfiguration from '../meetingsession/MeetingSessionConfiguration';
import AudioVideoEventAttributes from './AudioVideoEventAttributes';
import DeviceEventAttributes from './DeviceEventAttributes';
import EventController from './EventController';
import EventName from './EventName';
import VideoFXEventAttributes from './VideoFXEventAttributes';
export default class DefaultEventController implements EventController, Destroyable {
    private static readonly UNAVAILABLE;
    private parserResult;
    private browserMajorVersion;
    private meetingHistoryStates;
    private observerSet;
    private logger;
    private configuration;
    private _eventReporter;
    destroyed: boolean;
    private browserName;
    private browserVersion;
    private deviceName;
    constructor(configuration: MeetingSessionConfiguration, logger: Logger, eventReporter?: EventReporter);
    addObserver(observer: EventObserver): void;
    removeObserver(observer: EventObserver): void;
    private forEachObserver;
    publishEvent(name: EventName, attributes?: AudioVideoEventAttributes | DeviceEventAttributes | VideoFXEventAttributes): Promise<void>;
    private reportEvent;
    private setupEventReporter;
    private getAttributes;
    get eventReporter(): EventReporter;
    /**
     * Clean up this instance and resources that it created.
     *
     * After calling `destroy`, internal fields like `eventReporter` will be unavailable.
     */
    destroy(): Promise<void>;
}
