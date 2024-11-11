import Logger from '../logger/Logger';
import UserAgentParser from './UserAgentParser';
/**
 * [[DefaultUserAgentParser]] uses UAParser to parse the browser's user agent.
 * It is responsible to hold and provide browser, OS and device specific information.
 */
export default class DefaultUserAgentParser implements UserAgentParser {
    private static readonly UNAVAILABLE;
    private parserResult;
    private browserName;
    private browserVersion;
    private deviceName;
    private browserMajorVersion;
    constructor(logger: Logger);
    getParserResult(): {
        [key: string]: string;
    };
}
