export const KEY_COMMANDS = {
  home: "Home",
  reverse: "Rev",
  forward: "Fwd",
  play: "Play",
  select: "Select",
  left: "Left",
  right: "Right",
  down: "Down",
  up: "Up",
  back: "Back",
  replay: "InstantReplay",
  info: "Info",
  backspace: "Backspace",
  search: "Search",
  enter: "Enter",
  literal: "Lit",
  find_remote: "FindRemote",
  volume_down: "VolumeDown",
  volume_up: "VolumeUp",
  volume_mute: "VolumeMute",
  channel_up: "ChannelUp",
  channel_down: "ChannelDown",
  input_tuner: "InputTuner",
  input_hdmi1: "InputHDMI1",
  input_hdmi2: "InputHDMI2",
  input_hdmi3: "InputHDMI3",
  input_hdmi4: "InputHDMI4",
  input_av1: "InputAV1",
  power: "Power",
  poweroff: "PowerOff",
  poweron: "PowerOn"
} as const;

export type CommandName = keyof typeof KEY_COMMANDS;

export const SENSOR_TYPES = ["acceleration", "magnetic", "orientation", "rotation"] as const;
export type SensorName = (typeof SENSOR_TYPES)[number];

export const TOUCH_ACTIONS = ["up", "down", "press", "move", "cancel"] as const;
export type TouchOp = (typeof TOUCH_ACTIONS)[number];
