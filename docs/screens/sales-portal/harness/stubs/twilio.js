// @twilio/voice-sdk stand-in: a Device that can be rung from the console and
// a Call that stays "up" until disconnect() is called.
class Emitter { constructor() { this.h = {}; } on(ev, fn) { (this.h[ev] ||= []).push(fn); return this; } emit(ev, ...a) { (this.h[ev] || []).forEach((f) => f(...a)); } }
class FakeCall extends Emitter {
  constructor(params) { super(); this.parameters = params || {}; this.customParameters = new Map(); this._muted = false; }
  accept() { this.emit("accept"); }
  reject() { this.emit("reject"); }
  disconnect() { this.emit("disconnect"); }
  mute(v) { this._muted = v; }
  sendDigits(d) { (window.__dtmf ||= []).push(d); }
}
export class Device extends Emitter {
  constructor(token) { super(); this.token = token; this.audio = { availableInputDevices: new Map([["default", {}]]) }; Device.instances.push(this); }
  async register() { this.registered = true; }
  updateToken() {}
  destroy() {}
  async connect({ params }) { const call = new FakeCall(params); window.__outboundCall = call; return call; }
  ring(from = "+16135550142") { const call = new FakeCall({ From: from, To: "+14055550999", CallSid: "CA123" }); window.__inboundCall = call; this.emit("incoming", call); return call; }
}
Device.instances = [];
window.__ring = (from) => Device.instances.forEach((d) => d.ring(from));
