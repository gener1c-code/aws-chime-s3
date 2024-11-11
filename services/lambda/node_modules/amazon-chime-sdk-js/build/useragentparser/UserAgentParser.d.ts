/**
 * [[UserAgentParser]] is responsible to parse the browser's user agent
 * and provide the parsed result.
 */
export default interface UserAgentParser {
    /**
     * Provides resultant data after parsing browser user agent.
     */
    getParserResult(): {
        [key: string]: string;
    };
}
