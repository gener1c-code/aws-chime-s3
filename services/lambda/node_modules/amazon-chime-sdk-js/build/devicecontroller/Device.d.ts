/**
 * A specifier for how to obtain a media stream from the browser. This
 * can be a `MediaStream` itself, a set of constraints, a device ID.
 */
declare type Device = string | MediaTrackConstraints | MediaStream;
export default Device;
