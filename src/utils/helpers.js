let _pid = 10;
export function nPid() { return "p" + (_pid++); }

let _vid = 100;
export function nVid() { return "v" + (_vid++); }

let _did = 10;
export function nDid() { return "d" + (_did++); }

let _mrid = 20;
export function nMrId() { return "mr" + (_mrid++); }

export function td() {
  const d = new Date();
  return String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
